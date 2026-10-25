import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { build } from "esbuild";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { DEMO } from "../src/core.js";
import { csvCell, gradeStage } from "../worker/index.js";
let mf, db, key, jwt;
const origin = "https://island.test";
async function token(
  email = "teacher@example.test",
  aud = "test-audience",
  expiry = "1h",
) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://island-test.cloudflareaccess.com")
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(key.privateKey);
}
async function call(
  path,
  { method = "GET", body, cookie, teacher = false, headers = {} } = {},
) {
  return mf.dispatchFetch(origin + path, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(teacher ? { "Cf-Access-Jwt-Assertion": jwt } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function makeClass(name = "701", seats = 3) {
  const r = await call("/api/admin/classes", {
    teacher: true,
    method: "POST",
    body: { name, seats },
  });
  assert.equal(r.status, 201, await r.clone().text());
  return r.json();
}
async function login(c, seat = 1) {
  const r = await call("/api/student/login", {
    method: "POST",
    body: { className: c.name, seat, entryCode: c.roster[seat - 1].entryCode },
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Set-Cookie"), /HttpOnly; SameSite=Strict/);
  assert.match(r.headers.get("Set-Cookie"), /Secure/);
  return r.headers.get("Set-Cookie").split(";")[0];
}
before(async () => {
  key = await generateKeyPair("RS256", { extractable: true });
  jwt = await token();
  const dir = await mkdtemp(join(tmpdir(), "island-worker-"));
  await build({
    entryPoints: ["tests/fixtures/access-worker.js"],
    bundle: true,
    format: "esm",
    outfile: join(dir, "worker.mjs"),
    target: "es2022",
  });
  mf = new Miniflare({
    modules: true,
    modulesRoot: dir,
    scriptPath: join(dir, "worker.mjs"),
    compatibilityDate: "2026-08-01",
    d1Databases: ["DB"],
    bindings: {
      APP_ORIGINS: origin,
      ACCESS_TEAM_DOMAIN: "island-test.cloudflareaccess.com",
      ACCESS_AUD: "test-audience",
      TEACHER_EMAILS: "teacher@example.test",
      TEST_PUBLIC_KEY: JSON.stringify(await exportJWK(key.publicKey)),
    },
  });
  db = await mf.getD1Database("DB");
  await db.exec(await readFile("worker/migrations/0001_schema.sql", "utf8"));
  await db.exec(await readFile("worker/migrations/0002_demo.sql", "utf8"));
});
after(async () => {
  await mf?.dispose();
});
test("Access requires a valid signature, audience, expiry and teacher allowlist", async () => {
  assert.equal((await call("/api/admin/report")).status, 401);
  for (const bad of [
    "forged",
    await token("other@example.test"),
    await token("teacher@example.test", "wrong"),
    await token("teacher@example.test", "test-audience", "-1h"),
  ])
    assert.equal(
      (
        await call("/api/admin/report", {
          headers: { "Cf-Access-Jwt-Assertion": bad },
        })
      ).status,
      403,
    );
  assert.equal((await call("/api/admin/me", { teacher: true })).status, 200);
});
test("CSRF, content type, invalid bank and SQL injection filter are rejected", async () => {
  assert.equal(
    (
      await call("/api/admin/classes", {
        teacher: true,
        method: "POST",
        body: { name: "bad", seats: 1 },
        headers: { Origin: "https://evil.test" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/api/admin/banks", {
        teacher: true,
        method: "POST",
        body: { title: "bad", bank: { version: 1, questions: [] } },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/admin/report?classId=" + encodeURIComponent("' OR 1=1 --"),
        { teacher: true },
      )
    ).status,
    404,
  );
});
test("class provisioning supports 100 seats with bounded SQL queries; entry codes stored hashed", async () => {
  const c = await makeClass("100-seat", 100);
  assert.equal(c.roster.length, 100);
  assert.equal(new Set(c.roster.map((r) => r.entryCode)).size, 100);
  const s = await db
    .prepare("SELECT entry_hash FROM students WHERE class_id=? AND seat=1")
    .bind(c.id)
    .first();
  assert.notEqual(s.entry_hash, c.roster[0].entryCode);
  assert.equal(
    (
      await call("/api/admin/classes", {
        teacher: true,
        method: "POST",
        body: { name: "100-seat", seats: 1 },
      })
    ).status,
    409,
  );
});
test("class and seat alone cannot impersonate students; sessions cannot access teacher or others", async () => {
  const c = await makeClass("702");
  const cookie = await login(c);
  const other = await login(c, 2);
  assert.equal(
    (
      await call("/api/student/login", {
        method: "POST",
        body: { className: c.name, seat: 1, entryCode: c.roster[1].entryCode },
      })
    ).status,
    401,
  );
  assert.equal((await call("/api/admin/report", { cookie })).status, 401);
  const me = await (await call("/api/student/me", { cookie: other })).json();
  assert.equal(me.seat, 2);
  assert.equal(me.progress.score, 0);
  assert.equal(
    (await call("/api/student/results?seat=1", { cookie: other })).status,
    404,
  );
  assert.equal(
    (
      await call("/api/student/stages/grammar", {
        method: "POST",
        cookie,
        body: { answers: { g1: 3 } },
      })
    ).status,
    409,
  );
});
test("server grades all stages, ignores forged totals, deduplicates retries and computes completion stats", async () => {
  const c = await makeClass("703");
  const cookie = await login(c);
  let result;
  for (const stage of [
    "vocabulary",
    "matching",
    "grammar",
    "reading",
    "listening",
  ]) {
    const payload =
      stage === "matching"
        ? {
            pairs: [
              { left: "v1", right: "v2" },
              ...["v1", "v2", "v3"].map((id) => ({ left: id, right: id })),
            ],
          }
        : {
            answers: Object.fromEntries(
              DEMO.questions
                .filter((q) => q.type === stage)
                .map((q) => [q.id, q.answerIndex]),
            ),
            score: 99999,
            studentId: "someone-else",
          };
    const r = await call("/api/student/stages/" + stage, {
      method: "POST",
      cookie,
      body: payload,
    });
    assert.equal(r.status, 200, await r.clone().text());
    result = await r.json();
    if (stage === "vocabulary") {
      const duplicate = await call("/api/student/stages/vocabulary", {
        method: "POST",
        cookie,
        body: { answers: { v1: 1, v2: 0, v3: 0 }, score: 0 },
      });
      assert.equal((await duplicate.json()).progress.score, 30);
    }
  }
  assert.equal(result.progress.score, 90);
  assert.equal(result.progress.correctCount, 9);
  assert.equal(result.progress.questionCount, 10);
  assert.equal(result.progress.accuracy, 90);
  assert.ok(result.progress.completedAt);
  assert.equal(result.progress.completedStages.length, 5);
  const r = await (
    await call("/api/admin/report?classId=" + c.id, { teacher: true })
  ).json();
  assert.equal(r.classes[0].expected_count, 3);
  assert.equal(r.classes[0].completionRate, 33.33);
  assert.equal(r.classes[0].averageScore, 90);
  assert.equal(r.leaderboard[0].seat, 1);
  assert.equal(r.students[1].started_at, null);
  assert.equal(r.classes[0].bank_data, undefined);
});
test("rotation invalidates old login and session; logout invalidates cookie", async () => {
  const c = await makeClass("704", 1);
  const cookie = await login(c);
  const rotated = await (
    await call(`/api/admin/classes/${c.id}/students/1/code`, {
      teacher: true,
      method: "POST",
      body: {},
    })
  ).json();
  assert.equal((await call("/api/student/me", { cookie })).status, 401);
  assert.equal(
    (
      await call("/api/student/login", {
        method: "POST",
        body: { className: c.name, seat: 1, entryCode: c.roster[0].entryCode },
      })
    ).status,
    401,
  );
  c.roster[0].entryCode = rotated.entryCode;
  const next = await login(c);
  assert.equal(
    (
      await call("/api/student/logout", {
        cookie: next,
        method: "POST",
        body: {},
      })
    ).status,
    200,
  );
  assert.equal((await call("/api/student/me", { cookie: next })).status, 401);
});
test("CSV exports include unstarted roster, correct content type, BOM and formula escaping", async () => {
  const c = await makeClass("=DANGER", 1);
  const r = await call("/api/admin/export.csv?classId=" + c.id, {
    teacher: true,
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /text\/csv/);
  assert.match(await r.text(), /"'=DANGER"/);
  assert.equal(csvCell(" @SUM(A1)"), `"' @SUM(A1)"`);
  assert.equal(csvCell('a,"b'), `"a,""b"`);
});
test("matching grader rejects incomplete pairs and unbounded inputs", () => {
  assert.throws(() =>
    gradeStage(DEMO, "matching", { pairs: [{ left: "v1", right: "v1" }] }),
  );
  assert.throws(() =>
    gradeStage(DEMO, "vocabulary", { answers: { v1: 99, v2: 1, v3: 2 } }),
  );
});
test("login throttling returns 429 and does not disclose roster", async () => {
  let r;
  for (let i = 0; i < 41; i++)
    r = await call("/api/student/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "192.0.2.10" },
      body: { className: "none", seat: 1, entryCode: "0".repeat(32) },
    });
  assert.equal(r.status, 429);
});
