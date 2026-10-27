import "./style.css";
import "./teacher.css";
import { createPasswordHash } from "./password.js";
const root = document.querySelector("#password-setup");
root.innerHTML = `<main class="teacher-shell"><section class="teacher-card"><div class="eyebrow">PRIVATE TEACHER SETUP</div><h1>設定你的老師登入密碼</h1><p>不需要 Zero Trust、不需要綁付款方式。請使用遊戲專用的新密碼，不要輸入信箱密碼。本頁只在你的瀏覽器產生加鹽密碼雜湊，不會送出密碼或自動修改雲端設定。</p><form id="password-form"><label>自訂密碼（至少 14 字元）<input id="new-password" type="password" required minlength="14" maxlength="128" autocomplete="new-password"></label><label>再次輸入密碼<input id="confirm-password" type="password" required minlength="14" maxlength="128" autocomplete="new-password"></label><button class="primary">產生私密設定值</button></form><p id="setup-status" role="status"></p><section id="secret-output" hidden><h2>只需複製到 Cloudflare 一次</h2><p>請勿把密碼或下方設定值貼到聊天、GitHub 或截圖。此值必須當作私密資料保管。</p><label>TEACHER_PASSWORD_HASH（已隱藏，直接按複製）<input id="secret-value" type="password" readonly spellcheck="false" autocomplete="off"></label><button id="copy-secret" class="primary">複製私密設定值</button><ol><li>登入 Cloudflare，進入 Workers &amp; Pages → <b>english-island-api</b> → Settings → Variables and Secrets。</li><li>新增一項，Type 選 <b>Secret</b>，名稱填 <b>TEACHER_PASSWORD_HASH</b>，Value 貼上剛複製的值。</li><li>儲存並套用／部署變更，之後到老師管理頁用 Email 與剛才自訂的原始密碼登入。</li></ol><p>Worker 首次成功登入會自動新增老師 session 表，不會重建班級或學生成績。以後重設密碼也用同樣流程；覆換 Secret 後，舊密碼與舊老師 session 都會失效。</p><a class="secondary" href="/teacher.html">前往老師登入頁</a><button id="clear-secret" class="quiet">清除本頁私密設定值</button></section></section></main>`;
const $ = (s) => document.querySelector(s);
$("#password-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#secret-value").value = "";
  $("#secret-output").hidden = true;
  const password = $("#new-password").value;
  if (password !== $("#confirm-password").value) {
    $("#setup-status").textContent = "兩次密碼不一致。";
    return;
  }
  e.submitter.disabled = true;
  try {
    $("#setup-status").textContent = "正在你的裝置產生設定值…";
    const value = await createPasswordHash(password);
    $("#secret-value").value = value;
    $("#secret-output").hidden = false;
    $("#new-password").value = "";
    $("#confirm-password").value = "";
    $("#setup-status").textContent =
      "已產生，請私下複製到後端 Worker 的 Secret。";
  } catch (e) {
    $("#setup-status").textContent = e.message;
  } finally {
    e.submitter.disabled = false;
  }
};
$("#copy-secret").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("#secret-value").value);
    $("#setup-status").textContent =
      "已複製，請私下貼到 Cloudflare Secret；不要貼到聊天。";
  } catch {
    $("#secret-value").select();
    $("#setup-status").textContent = "請按 Ctrl+C 複製已選取的設定值。";
  }
};
$("#clear-secret").onclick = () => {
  $("#secret-value").value = "";
  $("#secret-output").hidden = true;
  $("#setup-status").textContent = "本頁設定值已清除。";
};
