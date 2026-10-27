import "./style.css";
import "./teacher.css";
import { api, post } from "./cloud.js";
import { importBank } from "./core.js";
const app = document.querySelector("#teacher-app"),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let simpleStudentLogin = false;
let report = null,
  roster = null,
  banks = [],
  selected = "",
  published = null;
const date = (v) =>
  v ? new Date(v).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "—";
function msg(text) {
  document.querySelector("#admin-status").textContent = text;
}
function cell(value) {
  const s = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""') +
    '"'
  );
}
function download(name, text) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function refresh() {
  try {
    report = await api(
      "admin/report" +
        (selected ? "?classId=" + encodeURIComponent(selected) : ""),
    );
    paint();
  } catch (e) {
    msg(e.message);
  }
}
async function start() {
  app.innerHTML =
    '<main class="teacher-shell"><h1>老師成績管理</h1><p role="status">正在確認老師登入狀態…</p></main>';
  try {
    const me = await api("admin/me");
    simpleStudentLogin = me.studentLoginMode === "class-seat";
    banks = await api("admin/banks");
    app.innerHTML = `<header class="topbar"><a class="brand" href="/">✧ ENGLISH ADVENTURE ISLAND</a><nav><span>${esc(me.email)}</span><button id="teacher-logout" class="quiet">登出</button></nav></header><main class="teacher-shell"><div class="eyebrow">TEACHER’S OBSERVATORY</div><h1>看見每一位冒險家的成長。</h1><p>僅授權老師可讀取；時間以台灣時間顯示。成績由 Cloudflare Workers 計算並保存於 D1。</p>${simpleStudentLogin ? '<p class="class-summary">學生使用簡易登入：只需班級＋座號，不用發入場碼。此模式不驗證學生身分，可能被冒用，不適合正式測驗。</p>' : ""}<p id="admin-status" role="status"></p><section class="teacher-card"><h2>班級與成績</h2><div class="toolbar"><label>篩選班級<select id="class-filter"><option value="">全部班級</option></select></label><button id="refresh" class="secondary">重新整理</button><a id="export-csv" class="primary" href="/api/admin/export.csv">下載 CSV 成績</a></div><div id="summary"></div><p class="mode-note">平均分數以已開始學生計算（含未完成）；完成率以全班名冊人數為分母。配對正確率包含所有配對嘗試，重練不改寫首次成績。</p><div class="table-wrap"><table><thead><tr><th>班級</th><th>座號</th><th>分數／滿分</th><th>答對／作答</th><th>正確率</th><th>完成關卡</th><th>完成時間</th><th>經過時間</th></tr></thead><tbody id="results"></tbody></table></div><h3>排行榜</h3><p class="mode-note">先按得分比例、再按分數；同分時完成者優先、完成耗時短者優先。只供老師查看，不公開學生紀錄。</p><ol id="board" class="leaderboard"></ol></section><section class="teacher-card"><h2>${simpleStudentLogin ? "建立班級" : "建立班級與學生入場碼"}</h2><p>${simpleStudentLogin ? "名冊依 1 到指定人數建立。建立後學生只需輸入班級與座號即可開始，不需要入場碼。" : "名冊依 1 到指定人數建立。每位學生有獨立入場碼，只顯示這一次；請立即下載，個別發給學生，不要公開整份名冊。"}</p><form id="create-class"><label>班級名稱<input id="class-name" required maxlength="30" placeholder="例如：701"></label><label>學生人數<input id="seat-count" type="number" min="1" max="100" value="30" required></label><label>指定題庫<select id="bank-select">${banks.map((b) => `<option value="${esc(b.id)}">${esc(b.title)}</option>`).join("")}</select></label><button class="primary">建立班級</button></form><div id="roster-output"></div></section><section class="teacher-card"><h2>發布教師題庫</h2><p>上傳 JSON／CSV，先驗證再發布。題庫保存為不可變版本，新增班級時選取；既有班級題庫不會被覆蓋。</p><label>題庫名稱<input id="bank-title" maxlength="80" placeholder="例如：七上 Unit 1"></label><label>選擇題庫<input id="bank-upload" type="file" accept=".json,.csv"></label><p id="bank-preview" role="status"></p><button id="publish-bank" class="primary" disabled>確認發布題庫</button></section>${simpleStudentLogin ? "" : `<section class="teacher-card"><h2>遺失入場碼</h2><p>重設會立即使該學生先前登入失效，保留已儲存成績；新碼只顯示一次。</p><form id="rotate-code"><label>班級<select id="rotate-class"></select></label><label>座號<input id="rotate-seat" type="number" min="1" max="100" required></label><button class="secondary">重設此學生入場碼</button></form><p id="new-code" role="status"></p></section>`}<p class="mode-note">練習型遊戲：題目與答案會送到學生裝置，不提供正式考試的防作弊保證。請依學校政策保管成績與名冊。</p></main>`;
    document.querySelector("#teacher-logout").onclick = async () => {
      try {
        await post("teacher/logout", {});
        await start();
      } catch (e) {
        msg(e.message);
      }
    };
    document.querySelector("#refresh").onclick = refresh;
    document.querySelector("#class-filter").onchange = (e) => {
      selected = e.target.value;
      refresh();
    };
    document.querySelector("#create-class").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      btn.disabled = true;
      try {
        const data = await post("admin/classes", {
          name: document.querySelector("#class-name").value.trim(),
          seats: Number(document.querySelector("#seat-count").value),
          bankId: document.querySelector("#bank-select").value,
        });
        roster = data;
        document.querySelector("#roster-output").innerHTML =
          `<p>已建立 ${esc(data.name)}：${data.roster.length} 位學生。${simpleStudentLogin ? "直接告訴學生班級與座號即可登入。" : "請立即下載入場碼。"}</p><button id="download-roster" class="secondary">${simpleStudentLogin ? "下載班級名冊 CSV" : "下載此班入場碼 CSV"}</button>`;
        document.querySelector("#download-roster").onclick = () =>
          download(
            simpleStudentLogin ? "class-roster.csv" : "student-entry-codes.csv",
            [
              simpleStudentLogin
                ? ["班級", "座號"]
                : ["班級", "座號", "個別入場碼"],
              ...roster.roster.map((s) =>
                simpleStudentLogin
                  ? [roster.name, s.seat]
                  : [roster.name, s.seat, s.entryCode],
              ),
            ]
              .map((r) => r.map(cell).join(","))
              .join("\r\n"),
          );
        selected = "";
        await refresh();
        msg(
          simpleStudentLogin
            ? "班級已建立，學生輸入班級與座號即可登入。"
            : "班級已建立，請下載並個別發放入場碼。",
        );
      } catch (e) {
        msg(e.message);
      } finally {
        btn.disabled = false;
      }
    };
    document.querySelector("#bank-upload").onchange = async (e) => {
      published = null;
      document.querySelector("#publish-bank").disabled = true;
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1048576) throw Error("檔案超過 1 MB");
        published = importBank(await file.text(), file.name);
        document.querySelector("#bank-preview").textContent =
          `驗證成功：${published.questions.length} 題。首題：${published.questions[0].prompt}`;
        document.querySelector("#publish-bank").disabled = false;
      } catch (e) {
        document.querySelector("#bank-preview").textContent = e.message;
      }
    };
    document.querySelector("#publish-bank").onclick = async () => {
      try {
        if (!published) return;
        await post("admin/banks", {
          title: document.querySelector("#bank-title").value.trim(),
          bank: published,
        });
        banks = await api("admin/banks");
        document.querySelector("#bank-select").innerHTML = banks
          .map((b) => `<option value="${esc(b.id)}">${esc(b.title)}</option>`)
          .join("");
        document.querySelector("#publish-bank").disabled = true;
        msg("題庫已發布，可在建立班級時選取。");
      } catch (e) {
        msg(e.message);
      }
    };
    if (document.querySelector("#rotate-code"))
      document.querySelector("#rotate-code").onsubmit = async (e) => {
        e.preventDefault();
        if (!confirm("確定重設此學生入場碼並登出其所有裝置？")) return;
        try {
          const id = document.querySelector("#rotate-class").value,
            seat = Number(document.querySelector("#rotate-seat").value);
          if (!id) return;
          const r = await post(
            `admin/classes/${encodeURIComponent(id)}/students/${seat}/code`,
            {},
          );
          document.querySelector("#new-code").textContent =
            `座號 ${seat} 新入場碼：${r.entryCode}（請個別轉交）`;
        } catch (e) {
          msg(e.message);
        }
      };
    await refresh();
  } catch (e) {
    await loginPage(e);
  }
}
function paint() {
  const filter = document.querySelector("#class-filter");
  if (!selected) {
    filter.innerHTML =
      '<option value="">全部班級</option>' +
      report.classes
        .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
        .join("");
    if (document.querySelector("#rotate-class"))
      document.querySelector("#rotate-class").innerHTML = report.classes
        .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
        .join("");
  }
  filter.value = selected;
  document.querySelector("#export-csv").href =
    "/api/admin/export.csv" +
    (selected ? "?classId=" + encodeURIComponent(selected) : "");
  document.querySelector("#summary").innerHTML = report.classes.length
    ? report.classes
        .map(
          (c) =>
            `<div class="class-summary"><h3>${esc(c.name)}</h3><span>平均分數 <b>${c.averageScore}</b></span><span>已開始 <b>${c.started}/${c.expected_count}</b></span><span>已完成 <b>${c.completed}/${c.expected_count}</b></span><span>完成率 <b>${c.completionRate}%</b></span><small>${esc(c.bank_title)}</small></div>`,
        )
        .join("")
    : "<p>尚無班級，請在下方建立。</p>";
  document.querySelector("#results").innerHTML = report.students
    .map(
      (s) =>
        `<tr><td>${esc(s.class_name)}</td><td>${s.seat}</td><td>${s.score} / ${s.max_score}</td><td>${s.correct_count} / ${s.question_count}</td><td>${s.accuracy === null ? "—" : s.accuracy + "%"}</td><td>${s.completed_stages}</td><td>${date(s.completed_at)}</td><td>${s.elapsed_seconds === null ? "—" : s.elapsed_seconds + " 秒"}</td></tr>`,
    )
    .join("");
  document.querySelector("#board").innerHTML = report.leaderboard
    .slice(0, 100)
    .map(
      (s) =>
        `<li><span>${esc(s.class_name)} · ${s.seat} 號</span><b>${s.score} / ${s.max_score}</b></li>`,
    )
    .join("");
}
start();

async function loginPage(error) {
  let configured = false,
    unavailable = "";
  try {
    configured = (await api("teacher/config")).configured === true;
  } catch (e) {
    unavailable = e.message;
  }
  app.innerHTML = `<main class="teacher-shell"><section class="teacher-card"><div class="eyebrow">TEACHER LOGIN</div><h1>老師登入</h1><p>用老師 Email 和遊戲專用密碼登入（不是信箱密碼）；學生登入不能查看老師管理頁。不需要 Zero Trust 或付款方式。</p>${configured ? `<form id="teacher-login"><label>Email<input id="teacher-email" type="email" required autocomplete="username"></label><label>密碼<input id="teacher-password" type="password" required maxlength="128" autocomplete="current-password"></label><button class="primary">登入成績管理</button></form>` : `<p>${esc(unavailable || "尚未設定老師密碼。請先產生私密設定值，儲存到後端 Worker 的 Secret。")}</p><a class="primary" href="/teacher-password.html">私下設定老師密碼</a>`}<p id="teacher-login-status" role="status"></p><a class="secondary" href="/">返回學生遊戲</a>${configured ? '<p class="mode-note">忘記密碼？可私下產生新設定值並替換後端 Secret，舊登入會失效。</p><a href="/teacher-password.html">重新設定密碼</a>' : ""}</section></main>`;
  if (configured)
    document.querySelector("#teacher-login").onsubmit = async (e) => {
      e.preventDefault();
      e.submitter.disabled = true;
      const input = document.querySelector("#teacher-password");
      try {
        await post("teacher/login", {
          email: document.querySelector("#teacher-email").value.trim(),
          password: input.value,
        });
        input.value = "";
        await start();
      } catch (e) {
        input.value = "";
        document.querySelector("#teacher-login-status").textContent = e.message;
        e.submitter.disabled = false;
      }
    };
}
