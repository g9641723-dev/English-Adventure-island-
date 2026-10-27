import { validPasswordHash, verifyPassword } from "../src/password.js";
import { validateBank, STAGES, matchingPairs } from "../src/core.js";
const enc = new TextEncoder();
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
export async function digest(value) {
  return [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function random() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function cookie(req, value, age) {
  return `eai_student=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
function getCookie(req) {
  return (
    req.headers
      .get("Cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("eai_student="))
      ?.slice(12) || ""
  );
}
function teacherToken(req) {
  return (
    req.headers
      .get("Cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("eai_teacher="))
      ?.slice(12) || ""
  );
}
function teacherCookie(req, value, age) {
  return `eai_teacher=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function cleanupTeacherSessions(env) {
  try {
    await env.DB.prepare("DELETE FROM teacher_sessions WHERE expires_at<?")
      .bind(Date.now())
      .run();
  } catch (e) {
    if (!String(e.message).includes("no such table: teacher_sessions")) throw e;
  }
}
async function body(req) {
  if (!req.headers.get("Content-Type")?.startsWith("application/json"))
    fail(415, "請使用 JSON。");
  if (Number(req.headers.get("Content-Length")) > 1048576)
    fail(413, "資料不可超過 1 MB。");
  const reader = req.body?.getReader(),
    chunks = [];
  let size = 0;
  if (reader)
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) {
        await reader.cancel();
        fail(413, "資料不可超過 1 MB。");
      }
      chunks.push(value);
    }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const b = JSON.parse(text);
    if (!b || typeof b !== "object" || Array.isArray(b)) throw Error();
    return b;
  } catch {
    fail(400, "JSON 格式錯誤。");
  }
}
export function activeStages(bank) {
  return STAGES.filter((s) =>
    s.id === "matching"
      ? matchingPairs(bank).length >= 2
      : bank.questions.some((q) => q.type === s.id),
  ).map((s) => s.id);
}
export function gradeStage(bank, stage, input) {
  if (!activeStages(bank).includes(stage)) fail(400, "此題庫沒有指定關卡。");
  if (stage === "matching") {
    const pairs = matchingPairs(bank),
      ids = new Set(pairs.map((p) => p.id));
    if (
      !Array.isArray(input.pairs) ||
      !input.pairs.length ||
      input.pairs.length > 200
    )
      fail(400, "配對紀錄格式錯誤。");
    const found = new Set();
    let correct = 0;
    for (const p of input.pairs) {
      if (!p || !ids.has(p.left) || !ids.has(p.right) || found.has(p.left))
        fail(400, "配對紀錄不合法。");
      if (p.left === p.right) {
        correct++;
        found.add(p.left);
      }
    }
    if (found.size !== pairs.length) fail(400, "請完成全部配對。");
    return {
      score: pairs.length * 10,
      maxScore: pairs.length * 10,
      correct,
      questions: input.pairs.length,
      answers: input.pairs,
    };
  }
  const questions = bank.questions.filter((q) => q.type === stage);
  if (
    !input.answers ||
    typeof input.answers !== "object" ||
    Array.isArray(input.answers) ||
    Object.keys(input.answers).length !== questions.length
  )
    fail(400, "請送出完整的本關答案。");
  let score = 0,
    correct = 0;
  for (const q of questions) {
    const a = input.answers[q.id];
    if (!Number.isInteger(a) || a < 0 || a > 3) fail(400, "答案必須介於 0–3。");
    if (a === q.answerIndex) {
      score += q.points;
      correct++;
    }
  }
  return {
    score,
    maxScore: questions.reduce((n, q) => n + q.points, 0),
    correct,
    questions: questions.length,
    answers: input.answers,
  };
}
async function rate(req, env, action, max) {
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  const key = await digest(
    `${action}:${ip}:${Math.floor(Date.now() / 600000)}`,
  );
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits",
  )
    .bind(key, Date.now() + 3600000)
    .first();
  if (row.hits > max) fail(429, "嘗試次數過多，請十分鐘後再試。");
}
async function student(req, env) {
  const token = getCookie(req);
  if (!/^[a-f0-9]{32}$/.test(token)) fail(401, "請先輸入班級、座號及入場碼。");
  const row = await env.DB.prepare(
    "SELECT students.*, classes.name AS class_name, classes.bank_id FROM sessions JOIN students ON students.id=sessions.student_id JOIN classes ON classes.id=students.class_id WHERE sessions.token_hash=? AND sessions.expires_at>?",
  )
    .bind(await digest(token), Date.now())
    .first();
  if (!row) fail(401, "登入已到期，請重新登入。");
  return row;
}
async function bankFor(env, id) {
  const b = await env.DB.prepare("SELECT * FROM banks WHERE id=?")
    .bind(id)
    .first();
  if (!b) fail(404, "找不到題庫。");
  return JSON.parse(b.data_json);
}
async function runFor(env, s) {
  const r = await env.DB.prepare(
    "SELECT * FROM runs WHERE student_id=? AND bank_id=?",
  )
    .bind(s.id, s.bank_id)
    .first();
  if (!r) fail(409, "請重新登入開始作業。");
  return r;
}
async function progress(env, run, bank) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM stage_results WHERE run_id=? ORDER BY completed_at,stage",
  )
    .bind(run.id)
    .all();
  let score = 0,
    correct = 0,
    questions = 0;
  for (const r of results) {
    score += r.score;
    correct += r.correct_count;
    questions += r.question_count;
  }
  const maxScore =
    bank.questions.reduce((n, q) => n + q.points, 0) +
    (matchingPairs(bank).length >= 2 ? matchingPairs(bank).length * 10 : 0);
  return {
    runId: run.id,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    elapsedSeconds: Math.max(
      0,
      Math.round(((run.completed_at || Date.now()) - run.started_at) / 1000),
    ),
    score,
    maxScore,
    correctCount: correct,
    questionCount: questions,
    accuracy: questions ? Math.round((correct / questions) * 10000) / 100 : 0,
    completedStages: results.map((r) => r.stage),
    totalStages: activeStages(bank).length,
    stages: results.map((r) => ({
      stage: r.stage,
      score: r.score,
      maxScore: r.max_score,
      correctCount: r.correct_count,
      questionCount: r.question_count,
      completedAt: r.completed_at,
      answers: JSON.parse(r.answers_json),
    })),
  };
}
export function csvCell(value) {
  const s = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""') +
    '"'
  );
}
async function report(env, classId) {
  const classes = await env.DB.prepare(
    "SELECT classes.*,banks.title AS bank_title,banks.data_json AS bank_data,(SELECT COUNT(*) FROM students WHERE class_id=classes.id) AS expected_count FROM classes JOIN banks ON banks.id=classes.bank_id ORDER BY classes.name",
  ).all();
  const selected = classes.results.filter((c) => !classId || c.id === classId);
  if (classId && !selected.length) fail(404, "找不到班級。");
  const rows = await env.DB.prepare(
    `SELECT c.id AS class_id,c.name AS class_name,s.seat,r.id AS run_id,r.started_at,r.completed_at,COALESCE(SUM(sr.score),0) AS score,COALESCE(SUM(sr.correct_count),0) AS correct_count,COALESCE(SUM(sr.question_count),0) AS question_count,COUNT(sr.stage) AS completed_stages FROM students s JOIN classes c ON c.id=s.class_id LEFT JOIN runs r ON r.student_id=s.id AND r.bank_id=c.bank_id LEFT JOIN stage_results sr ON sr.run_id=r.id WHERE (?='' OR c.id=?) GROUP BY s.id ORDER BY c.name,s.seat`,
  )
    .bind(classId || "", classId || "")
    .all();
  const banks = new Map();
  for (const c of selected) banks.set(c.id, JSON.parse(c.bank_data));
  const students = rows.results.map((r) => ({
    ...r,
    max_score:
      banks.get(r.class_id).questions.reduce((n, q) => n + q.points, 0) +
      (matchingPairs(banks.get(r.class_id)).length >= 2
        ? matchingPairs(banks.get(r.class_id)).length * 10
        : 0),
    accuracy: r.question_count
      ? Math.round((r.correct_count / r.question_count) * 10000) / 100
      : null,
    elapsed_seconds: r.started_at
      ? Math.max(
          0,
          Math.round(((r.completed_at || Date.now()) - r.started_at) / 1000),
        )
      : null,
  }));
  const summaries = selected.map((c) => {
    const rs = students.filter((s) => s.class_id === c.id),
      started = rs.filter((s) => s.started_at),
      completed = rs.filter((s) => s.completed_at);
    const { bank_data, ...safeClass } = c;
    return {
      ...safeClass,
      started: started.length,
      completed: completed.length,
      completionRate: rs.length
        ? Math.round((completed.length / rs.length) * 10000) / 100
        : 0,
      averageScore: started.length
        ? Math.round(
            (started.reduce((n, r) => n + r.score, 0) / started.length) * 100,
          ) / 100
        : 0,
    };
  });
  const leaderboard = students
    .filter((s) => s.started_at)
    .sort(
      (a, b) =>
        (b.max_score ? b.score / b.max_score : 0) -
          (a.max_score ? a.score / a.max_score : 0) ||
        b.score - a.score ||
        (b.completed_at ? 1 : 0) - (a.completed_at ? 1 : 0) ||
        a.elapsed_seconds - b.elapsed_seconds ||
        a.seat - b.seat,
    );
  return { classes: summaries, students, leaderboard, generatedAt: Date.now() };
}
export function createHandler() {
  return async function handle(req, env) {
    try {
      const url = new URL(req.url),
        path = url.pathname,
        method = req.method;
      if (!env.DB) fail(503, "資料庫尚未設定。");
      if (method === "POST" || method === "PUT" || method === "DELETE") {
        const origins = (env.APP_ORIGINS || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        if (!origins.includes(req.headers.get("Origin")))
          fail(403, "來源不符，請由正式遊戲網址操作。");
      }
      if (path === "/api/status" && method === "GET")
        return json({ cloud: true, teacherPath: "/teacher.html" });
      if (path === "/api/teacher/config" && method === "GET")
        return json({
          configured: validPasswordHash(env.TEACHER_PASSWORD_HASH),
          auth: "password",
        });
      if (path === "/api/teacher/login" && method === "POST") {
        if (!validPasswordHash(env.TEACHER_PASSWORD_HASH))
          fail(503, "請先在後端 Worker 設定 TEACHER_PASSWORD_HASH Secret。");
        await rate(req, env, "teacher-login", 5);
        const b = await body(req);
        const email =
          typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
        const approved = (env.TEACHER_EMAILS || "")
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);
        const matches = await verifyPassword(
          b.password,
          env.TEACHER_PASSWORD_HASH,
        );
        if (!matches || !approved.includes(email))
          fail(401, "老師 Email 或密碼不正確。");
        // Additive initialization only after a valid teacher password. Existing tables/data stay intact.
        await env.DB.batch([
          env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS teacher_sessions (token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,auth_tag TEXT NOT NULL,expires_at INTEGER NOT NULL)",
          ),
          env.DB.prepare(
            "CREATE INDEX IF NOT EXISTS teacher_sessions_expiry ON teacher_sessions(expires_at)",
          ),
        ]);
        const token = random();
        await env.DB.prepare(
          "INSERT INTO teacher_sessions(token_hash,email,auth_tag,expires_at) VALUES(?,?,?,?)",
        )
          .bind(
            await digest(token),
            email,
            await digest(env.TEACHER_PASSWORD_HASH),
            Date.now() + 8 * 3600000,
          )
          .run();
        return json({ ok: true }, 200, {
          "Set-Cookie": teacherCookie(req, token, 8 * 3600),
        });
      }
      if (path === "/api/teacher/logout" && method === "POST") {
        const token = teacherToken(req);
        if (/^[a-f0-9]{32}$/.test(token))
          try {
            await env.DB.prepare(
              "DELETE FROM teacher_sessions WHERE token_hash=?",
            )
              .bind(await digest(token))
              .run();
          } catch (e) {
            if (!String(e.message).includes("no such table: teacher_sessions"))
              throw e;
          }
        return json({ ok: true }, 200, {
          "Set-Cookie": teacherCookie(req, "", 0),
        });
      }
      let teacherEmail;
      if (path.startsWith("/api/admin/")) {
        if (!validPasswordHash(env.TEACHER_PASSWORD_HASH))
          fail(503, "老師密碼尚未設定，請先完成私下設定。");
        const token = teacherToken(req);
        if (!/^[a-f0-9]{32}$/.test(token)) fail(401, "請先登入老師帳號。");
        let session;
        try {
          session = await env.DB.prepare(
            "SELECT email,auth_tag FROM teacher_sessions WHERE token_hash=? AND expires_at>?",
          )
            .bind(await digest(token), Date.now())
            .first();
        } catch (e) {
          if (!String(e.message).includes("no such table: teacher_sessions"))
            throw e;
        }
        const approved = (env.TEACHER_EMAILS || "")
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);
        if (
          !session ||
          session.auth_tag !== (await digest(env.TEACHER_PASSWORD_HASH)) ||
          !approved.includes(session.email)
        )
          fail(401, "老師登入已失效，請重新登入。");
        teacherEmail = session.email;
      }
      if (path === "/api/admin/me" && method === "GET")
        return json({ email: teacherEmail });
      if (path === "/api/admin/banks" && method === "GET")
        return json(
          (
            await env.DB.prepare(
              "SELECT id,title,created_at FROM banks ORDER BY created_at DESC",
            ).all()
          ).results,
        );
      if (path === "/api/admin/banks" && method === "POST") {
        const b = await body(req);
        let bank;
        try {
          bank = validateBank(b.bank);
        } catch (e) {
          fail(400, e.message);
        }
        if (
          typeof b.title !== "string" ||
          !b.title.trim() ||
          b.title.length > 80
        )
          fail(400, "題庫名稱需為 1–80 字。");
        const id = await digest(JSON.stringify(bank));
        await env.DB.prepare(
          "INSERT OR IGNORE INTO banks(id,title,data_json,created_at) VALUES(?,?,?,?)",
        )
          .bind(id, b.title.trim(), JSON.stringify(bank), Date.now())
          .run();
        return json({ id }, 201);
      }
      if (path === "/api/admin/classes" && method === "POST") {
        const b = await body(req);
        if (
          typeof b.name !== "string" ||
          !b.name.trim() ||
          b.name.length > 30 ||
          !Number.isInteger(b.seats) ||
          b.seats < 1 ||
          b.seats > 100
        )
          fail(400, "班級名稱需為 1–30 字，學生人數為 1–100。");
        await bankFor(env, b.bankId || "demo-v1");
        if (
          await env.DB.prepare("SELECT id FROM classes WHERE name=?")
            .bind(b.name.trim())
            .first()
        )
          fail(409, "班級名稱已存在。");
        const id = random(),
          roster = [];
        const inserts = [
          env.DB.prepare(
            "INSERT INTO classes(id,name,bank_id,created_at) VALUES(?,?,?,?)",
          ).bind(id, b.name.trim(), b.bankId || "demo-v1", Date.now()),
        ];
        let chunk = [];
        for (let seat = 1; seat <= b.seats; seat++) {
          const entryCode = random();
          roster.push({ seat, entryCode });
          chunk.push([random(), id, seat, await digest(entryCode)]);
          if (chunk.length === 25 || seat === b.seats) {
            inserts.push(
              env.DB.prepare(
                "INSERT INTO students(id,class_id,seat,entry_hash) VALUES " +
                  chunk.map(() => "(?,?,?,?)").join(","),
              ).bind(...chunk.flat()),
            );
            chunk = [];
          }
        }
        await env.DB.batch(inserts);
        return json({ id, name: b.name.trim(), roster }, 201);
      }
      const rotate = path.match(
        /^\/api\/admin\/classes\/([a-f0-9]{32})\/students\/(\d+)\/code$/,
      );
      if (rotate && method === "POST") {
        const s = await env.DB.prepare(
          "SELECT id FROM students WHERE class_id=? AND seat=?",
        )
          .bind(rotate[1], Number(rotate[2]))
          .first();
        if (!s) fail(404, "找不到學生。");
        const entryCode = random();
        await env.DB.batch([
          env.DB.prepare("UPDATE students SET entry_hash=? WHERE id=?").bind(
            await digest(entryCode),
            s.id,
          ),
          env.DB.prepare("DELETE FROM sessions WHERE student_id=?").bind(s.id),
        ]);
        return json({ entryCode });
      }
      if (
        (path === "/api/admin/report" || path === "/api/admin/export.csv") &&
        method === "GET"
      ) {
        const data = await report(env, url.searchParams.get("classId"));
        if (path.endsWith(".csv")) {
          const headers = [
            "班級",
            "座號",
            "得分",
            "滿分",
            "答對題數",
            "作答次數",
            "正確率(%)",
            "完成關卡",
            "開始時間(台北)",
            "完成時間(台北)",
            "經過秒數",
          ];
          const time = (v) =>
            v
              ? new Date(v).toLocaleString("sv-SE", { timeZone: "Asia/Taipei" })
              : "";
          const rows = data.students.map((s) => [
            s.class_name,
            s.seat,
            s.score,
            s.max_score,
            s.correct_count,
            s.question_count,
            s.accuracy ?? "",
            s.completed_stages,
            time(s.started_at),
            time(s.completed_at),
            s.elapsed_seconds ?? "",
          ]);
          return new Response(
            "\uFEFF" +
              [headers, ...rows]
                .map((r) => r.map(csvCell).join(","))
                .join("\r\n"),
            {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition":
                  'attachment; filename="island-results.csv"',
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
              },
            },
          );
        }
        return json(data);
      }
      if (path === "/api/admin/cleanup" && method === "POST") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(
            Date.now(),
          ),
          env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?").bind(
            Date.now(),
          ),
        ]);
        await cleanupTeacherSessions(env);
        return json({ ok: true });
      }
      if (path === "/api/student/login" && method === "POST") {
        await rate(req, env, "login-ip", 600);
        const b = await body(req);
        if (
          typeof b.className !== "string" ||
          b.className.length > 30 ||
          !Number.isInteger(b.seat) ||
          b.seat < 1 ||
          b.seat > 100 ||
          typeof b.entryCode !== "string" ||
          !/^[a-f0-9]{32}$/.test(b.entryCode)
        )
          fail(401, "班級、座號或入場碼不正確。");
        await rate(
          req,
          env,
          "login-seat:" + (await digest(b.className.trim() + ":" + b.seat)),
          8,
        );
        const s = await env.DB.prepare(
          "SELECT s.*,c.bank_id,c.name AS class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE c.name=? AND s.seat=? AND s.entry_hash=?",
        )
          .bind(b.className.trim(), b.seat, await digest(b.entryCode))
          .first();
        if (!s) fail(401, "班級、座號或入場碼不正確。");
        const token = random();
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO sessions(token_hash,student_id,expires_at) VALUES(?,?,?)",
          ).bind(await digest(token), s.id, Date.now() + 8 * 3600000),
          env.DB.prepare(
            "INSERT OR IGNORE INTO runs(id,student_id,bank_id,started_at) VALUES(?,?,?,?)",
          ).bind(random(), s.id, s.bank_id, Date.now()),
        ]);
        return json({ ok: true }, 200, {
          "Set-Cookie": cookie(req, token, 8 * 3600),
        });
      }
      if (path === "/api/student/logout" && method === "POST") {
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
          .bind(await digest(getCookie(req)))
          .run();
        return json({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
      }
      if (path.startsWith("/api/student/")) {
        const s = await student(req, env),
          bank = await bankFor(env, s.bank_id),
          run = await runFor(env, s);
        if (path === "/api/student/me" && method === "GET")
          return json({
            className: s.class_name,
            seat: s.seat,
            bankId: s.bank_id,
            bank,
            progress: await progress(env, run, bank),
          });
        const stageMatch = path.match(/^\/api\/student\/stages\/([a-z]+)$/);
        if (stageMatch && method === "POST") {
          await rate(req, env, "submit:" + s.id, 40);
          const stage = stageMatch[1],
            input = await body(req),
            stages = activeStages(bank),
            index = stages.indexOf(stage);
          if (index < 0) fail(400, "找不到關卡。");
          const done = (
            await env.DB.prepare(
              "SELECT stage FROM stage_results WHERE run_id=?",
            )
              .bind(run.id)
              .all()
          ).results.map((r) => r.stage);
          if (!stages.slice(0, index).every((s) => done.includes(s)))
            fail(409, "請先完成前面的關卡。");
          const grade = gradeStage(bank, stage, input);
          const now = Date.now();
          await env.DB.prepare(
            "INSERT OR IGNORE INTO stage_results(run_id,stage,score,max_score,correct_count,question_count,completed_at,answers_json) VALUES(?,?,?,?,?,?,?,?)",
          )
            .bind(
              run.id,
              stage,
              grade.score,
              grade.maxScore,
              grade.correct,
              grade.questions,
              now,
              JSON.stringify(grade.answers),
            )
            .run();
          await env.DB.prepare(
            "UPDATE runs SET completed_at=COALESCE(completed_at,?) WHERE id=? AND (SELECT COUNT(*) FROM stage_results WHERE run_id=?)=?",
          )
            .bind(now, run.id, run.id, stages.length)
            .run();
          const current = await runFor(env, s);
          return json({
            ok: true,
            progress: await progress(env, current, bank),
          });
        }
      }
      fail(404, "找不到此功能。");
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("API failure:", e?.name);
      return json({ error: "服務暫時無法完成，請保留畫面並稍後重試。" }, 500);
    }
  };
}
export default {
  fetch: createHandler(),
  async scheduled(event, env) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(
        Date.now(),
      ),
      env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?").bind(
        Date.now(),
      ),
    ]);
    await cleanupTeacherSessions(env);
  },
};
