import { api, post, cloudAvailable } from "./cloud.js";
import "./style.css";
import {
  DEMO,
  STAGES,
  importBank,
  matchingPairs,
  freshProfile,
  loadState,
  scoreFor,
  makeSubmission,
} from "./core.js";
import { fox, island } from "./art.js";
import { setSound, effect, duck } from "./audio.js";
const $ = (s) => document.querySelector(s),
  app = $("#app");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem: () => null,
    setItem: () => {
      throw Error("unavailable");
    },
  };
}
const saved =
  import.meta.env.VITE_CLOUD_MODE === "true" ? null : loadState(storage);
let state = saved ?? {
  version: 1,
  nickname: "冒險家",
  profiles: { 冒險家: freshProfile() },
  bank: structuredClone(DEMO),
  sound: false,
};
let cloudMode = import.meta.env.VITE_CLOUD_MODE === "true",
  cloudUser = null,
  requiresStudentCode = true,
  cloudPicks = {},
  cloudPairs = [],
  cloudQueue = {},
  cloudSyncing = false;
let selected = 0,
  stage = null,
  question = null,
  answered = false,
  pending = null,
  matching = null,
  choice = null,
  audio = null,
  utterance = null,
  started = false;
function profile() {
  return state.profiles[state.nickname];
}
function score() {
  return scoreFor(state.bank, profile());
}
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function save() {
  if (cloudMode) {
    persistCloud();
    return;
  }
  profile().updatedAt = Date.now();
  try {
    storage.setItem("eai-v1", JSON.stringify(state));
  } catch {
    notify("無法保存：目前改為暫存模式，請匯出成績。");
  }
}
function available(s) {
  return s.id === "matching"
    ? matchingPairs(state.bank).length > 1
    : state.bank.questions.some((q) => q.type === s.id);
}
function unlocked(i) {
  return STAGES.slice(0, i).every(
    (s) => !available(s) || profile().completed.includes(s.id),
  );
}
function render() {
  app.innerHTML = `<header class="topbar"><a class="brand" href="#" aria-label="回到島嶼首頁"><span class="brand-icon">✧</span><span>ENGLISH ADVENTURE<span class="brand-sub">ISLAND · 英語冒險島</span></span></a><nav aria-label="主選單"><button id="teacher" class="quiet">題庫工坊</button><button id="ranking" class="quiet">排行榜</button><button id="sound" class="sound" aria-pressed="false">♫ 聲音關閉</button><button id="player" class="player" aria-label="設定冒險家暱稱"><span class="avatar" aria-hidden="true">✦</span><span id="player-name">${esc(state.nickname)}</span></button></nav></header>
<main>${cloudMode ? '<div class="cloud-status"><span id="cloud-state" role="status"></span><button id="sync-now" class="quiet">重試同步</button></div>' : ""}<section class="hero"><div class="eyebrow"><span></span> YOUR NEXT ADVENTURE STARTS HERE</div><h1>每一個英文，<br>都是<span>冒險的起點。</span></h1><p>跟著小狐狸 Lumi 探索奇幻島嶼。<br class="mobile-break">收集知識水晶，讓勇氣與英文一起升級。</p><div class="hero-actions"><button class="primary" id="start">${Object.keys(profile().answers).length ? "繼續我的冒險" : "開始我的冒險"} <span>↗</span></button><span class="demo-label">原創示範題 · 國中程度</span></div><div class="hero-stats"><span><b>05</b> 奇幻區域</span><i></i><span><b>04</b> 英文能力</span><i></i><span><b>∞</b> 探索的可能</span></div></section>
<section class="adventure" aria-label="島嶼地圖與任務"><div class="map-heading"><div><span class="eyebrow">THE EXPLORER’S MAP</span><h2>你的冒險地圖 <span>點選地標開始探索</span></h2></div><span class="map-pill"><span></span> 知識群島 · 第一章</span></div><div class="map-layout"><div class="map-scene">${island()}<span class="map-coordinate">N 25° 03′ &nbsp; E 121° 30′<br>一座只屬於你的知識島嶼</span><div class="map-label">THE FLOATING ISLES</div><div class="map-nodes">${STAGES.map((s, i) => `<button class="map-node node-${i} ${i === selected ? "selected" : ""} ${profile().completed.includes(s.id) ? "done" : ""}" data-node="${i}" aria-label="${s.name} ${unlocked(i) ? "選擇地標" : "尚未解鎖"}"><span>${profile().completed.includes(s.id) ? "✓" : s.icon}</span><b>${s.name}</b></button>`).join("")}</div><div class="fox-on-map">${fox}<span>Lumi</span></div><div class="map-legend"><span>✦ 目前任務</span><span>○ 未探索</span><span>✓ 已完成</span></div></div><aside class="quest-panel" id="quest-panel"></aside></div></section>
<section class="journey"><div class="journey-title"><span class="eyebrow">ONE ISLAND, MANY POSSIBILITIES</span><h2>把學習，變成值得期待的事。</h2></div><div class="feature"><span>✧</span><div><h3>探索，而不只是背誦</h3><p>單字、文法、閱讀與聽力，藏在每一次冒險裡。</p></div></div><div class="feature"><span>❖</span><div><h3>每一步，都看得見成長</h3><p>即時解析與水晶獎勵，陪你找到自己的節奏。</p></div></div></section></main><footer><span>✧ ENGLISH ADVENTURE ISLAND</span><span>為好奇心而造，為每一位冒險家而生。</span><span>${cloudMode ? "Cloudflare 雲端成績模式" : "本機練習模式"}</span></footer><dialog id="modal"><div id="modal-body"></div></dialog><div id="toast" role="status"></div>`;
  $("#start").onclick = () => {
    const i = STAGES.findIndex(
      (s, i) =>
        available(s) && unlocked(i) && !profile().completed.includes(s.id),
    );
    select(i < 0 ? 0 : i);
    begin();
  };
  $('[class="brand"]').onclick = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  document.querySelectorAll("[data-node]").forEach(
    (b) =>
      (b.onclick = () => {
        select(Number(b.dataset.node));
        effect(true);
      }),
  );
  $("#sound").onclick = async () => {
    started = true;
    state.sound = await setSound(!state.sound);
    updateSound();
    save();
  };
  $("#player").onclick = playerDialog;
  $("#teacher").textContent = cloudMode ? "老師管理" : "題庫工坊";
  $("#teacher").onclick = cloudMode
    ? () => location.assign("/teacher.html")
    : teacherDialog;
  $("#ranking").textContent = cloudMode ? "我的成績" : "排行榜";
  $("#ranking").onclick = cloudMode ? ownCloudResult : rankingDialog;
  if (cloudMode) {
    $("#sync-now").onclick = () => syncCloud();
    updateCloudStatus();
  }
  $("#modal").addEventListener("close", stopListening);
  $("#modal").addEventListener("cancel", () => {
    stage = null;
  });
  paintQuest();
  updateSound();
}
function updateSound() {
  const b = $("#sound");
  b.textContent = state.sound ? "♫ 聲音開啟" : "♫ 聲音關閉";
  b.setAttribute("aria-pressed", String(state.sound));
}
function select(i) {
  selected = i;
  document
    .querySelectorAll("[data-node]")
    .forEach((b) =>
      b.classList.toggle("selected", Number(b.dataset.node) === i),
    );
  const f = $(".fox-on-map");
  f.style.setProperty("--fox-x", [28, 53, 41, 68, 61][i] + "%");
  f.style.setProperty("--fox-y", [48, 58, 52, 42, 28][i] + "%");
  paintQuest();
}
function paintQuest() {
  const s = STAGES[selected],
    done = profile().completed.includes(s.id),
    can = unlocked(selected);
  $("#quest-panel").innerHTML =
    `<div class="quest-top"><span>CHAPTER 0${selected + 1}</span><span class="badge">${done ? "已完成" : can ? "可探索" : "待解鎖"}</span></div><div class="quest-emblem">${s.icon}<span class="orbit"></span></div><span class="eyebrow">${s.label}</span><h3>${s.name}</h3><p>${s.desc}</p><div class="quest-meta"><span>◷ 約 2 分鐘</span><span>✦ ${s.id === "matching" ? matchingPairs(state.bank).length * 10 : state.bank.questions.filter((q) => q.type === s.id).reduce((n, q) => n + q.points, 0)} 水晶</span></div><button id="explore" class="primary" ${!can || !available(s) ? "disabled" : ""}>${!available(s) ? "此題庫沒有此關卡" : done ? "再次練習" : can ? "進入這座島嶼" : "完成前一關解鎖"} <span>→</span></button><div class="progress-caption"><span>島嶼探索進度</span><b>${profile().completed.filter((id) => available(STAGES.find((s) => s.id === id))).length} / ${STAGES.filter(available).length}</b></div><div class="progress-track"><span style="width:${(profile().completed.length / Math.max(1, STAGES.filter(available).length)) * 100}%"></span></div><div class="crystal-count">❖ <b>${score()}</b><span>已收集水晶</span></div><div class="guide"><div>${fox}</div><p>「不用怕答錯，<br>每次嘗試都會讓你更勇敢！」<span>— 你的夥伴 Lumi</span></p></div>`;
  $("#explore").onclick = begin;
}
function show(content) {
  const d = $("#modal");
  if (d.open) d.close();
  $("#modal-body").innerHTML =
    `<button class="close" aria-label="關閉視窗">×</button>${content}`;
  $(".close").onclick = () => {
    d.close();
    stage = null;
  };
  d.showModal();
}
function stopListening() {
  window.speechSynthesis?.cancel();
  if (audio) {
    audio.pause();
    audio = null;
  }
  utterance = null;
  duck(false);
}
async function begin() {
  await cloudReady;
  if (cloudMode && !cloudUser) {
    studentLogin(() => begin());
    return;
  }
  if (!available(STAGES[selected]) || !unlocked(selected)) return;
  if (!started) {
    started = true;
    await setSound(state.sound);
  }
  stage = STAGES[selected].id;
  choice = null;
  if (stage === "matching") {
    matching = {
      pairs: matchingPairs(state.bank),
      found: [],
      left: null,
      right: null,
    };
    showMatching();
    return;
  }
  showQuestion();
}
function showQuestion(retryQuestion = null) {
  stopListening();
  const qs = state.bank.questions.filter((q) => q.type === stage);
  question =
    retryQuestion ??
    qs.find((q) => !Object.hasOwn(profile().answers, q.id)) ??
    qs[0];
  answered = false;
  const count = qs.filter((q) => Object.hasOwn(profile().answers, q.id)).length;
  show(
    `<div class="eyebrow">${STAGES[selected].name} · ${count} / ${qs.length} 已探索</div><h2>${stage === "listening" ? "聆聽風中的線索" : stage === "reading" ? "讀懂島嶼的小故事" : "找到正確的冒險線索"}</h2><div class="question-type">${stage === "vocabulary" ? "VOCABULARY" : stage.toUpperCase()} · 首次答對 +${question.points} 水晶</div>${question.passage ? `<blockquote>${esc(question.passage)}</blockquote>` : ""}${stage === "listening" ? '<div class="listen-tools"><button id="listen" class="secondary">▶ 播放英文線索</button><button id="transcript" class="quiet">練習模式：查看逐字稿</button><p id="audio-status" role="status"></p><p id="transcript-text" hidden></p></div>' : ""}<h3 class="prompt">${esc(question.prompt)}</h3><div class="options">${question.choices.map((c, i) => `<button data-answer="${i}"><span>${"ABCD"[i]}</span>${esc(c)}</button>`).join("")}</div><div id="feedback" role="status"></div><div class="mode-note">練習模式 · 首次作答計分，重試不重複加分 · 進度自動保存</div>`,
  );
  document
    .querySelectorAll("[data-answer]")
    .forEach((b) => (b.onclick = () => answer(Number(b.dataset.answer))));
  if (stage === "listening") {
    $("#listen").onclick = listen;
    $("#transcript").onclick = () => {
      const t = $("#transcript-text");
      t.hidden = !t.hidden;
      t.textContent = question.speech || "此題使用教師音檔，未提供逐字稿。";
    };
  }
}
function answer(i) {
  if (answered) return;
  answered = true;
  stopListening();
  const q = question,
    correct = i === q.answerIndex,
    first = !Object.hasOwn(profile().answers, q.id);
  if (first) {
    profile().answers[q.id] = correct;
    if (cloudMode) cloudPicks[q.id] = i;
  }
  save();
  effect(correct);
  document.querySelectorAll("[data-answer]").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.answer) === q.answerIndex) b.classList.add("correct");
    else if (Number(b.dataset.answer) === i) b.classList.add("wrong");
  });
  $("#feedback").innerHTML =
    `<div class="feedback ${correct ? "success" : "error"}"><b>${correct ? "✦ 太棒了！你找到線索了！" : "再勇敢試一次！"}</b><p>${esc(q.explanation)}</p><small>${first ? (correct ? `獲得 ${q.points} 水晶` : "本題首次作答 0 分；重試可練習，不加分") : "本題已作答，練習不重複計分"}</small></div>${correct ? '<div class="reward" aria-hidden="true">✦ ❖ ✧ ❖ ✦</div>' : ""}<button id="next" class="primary">繼續探索 →</button>${!correct ? '<button id="retry" class="secondary">再練習這題</button>' : ""}`;
  $("#next").onclick = () => {
    const qs = state.bank.questions.filter((q) => q.type === stage);
    if (qs.every((q) => Object.hasOwn(profile().answers, q.id))) finish();
    else showQuestion();
  };
  if ($("#retry")) $("#retry").onclick = () => showQuestion(q);
  paintQuest();
}
function listen() {
  stopListening();
  duck(true);
  const status = $("#audio-status");
  status.textContent = "準備播放…";
  if (question.audioUrl) {
    audio = new Audio(question.audioUrl);
    audio.onended = () => {
      status.textContent = "播放完畢，可再次播放。";
      duck(false);
    };
    audio.onerror = () => {
      status.textContent = "音檔無法載入，請聯絡教師或查看逐字稿練習。";
      duck(false);
    };
    audio
      .play()
      .then(() => (status.textContent = "正在播放…"))
      .catch(() => {
        status.textContent = "無法播放，請重試或查看逐字稿。";
        duck(false);
      });
    return;
  }
  const voices = window.speechSynthesis
    ?.getVoices()
    .filter((v) => v.lang.startsWith("en"));
  if (!voices?.length) {
    status.textContent =
      "此裝置沒有可用英文語音。請查看逐字稿練習，或請教師匯入 audioUrl 音檔。";
    duck(false);
    return;
  }
  utterance = new SpeechSynthesisUtterance(question.speech);
  utterance.voice = voices[0];
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  utterance.onend = () => {
    status.textContent = "播放完畢，可再次播放。";
    duck(false);
  };
  utterance.onerror = () => {
    status.textContent = "語音播放失敗，請查看逐字稿練習。";
    duck(false);
  };
  window.speechSynthesis.speak(utterance);
  status.textContent = "正在播放…";
}
function showMatching() {
  if (cloudMode && !profile().completed.includes("matching")) cloudPairs = [];
  show(
    `<div class="eyebrow">星語溪谷 · MATCH & DISCOVER</div><h2>讓單字找到它的夥伴</h2><p>先點英文，再點中文。全部配對即可點亮溪谷！</p><div class="match-grid"><div>${matching.pairs.map((q) => `<button data-left="${esc(q.id)}">${esc(q.word)}</button>`).join("")}</div><div>${[
      ...matching.pairs,
    ]
      .reverse()
      .map(
        (q) => `<button data-right="${esc(q.id)}">${esc(q.meaning)}</button>`,
      )
      .join(
        "",
      )}</div></div><div id="match-status" role="status">已完成 0 / ${matching.pairs.length} 組</div><p class="mode-note">每組 10 水晶，首次完成時領取；答錯可重試。</p>`,
  );
  document
    .querySelectorAll("[data-left],[data-right]")
    .forEach((b) => (b.onclick = () => matchClick(b)));
}
function matchClick(b) {
  const side = b.dataset.left ? "left" : "right",
    id = b.dataset[side];
  matching[side] = id;
  document
    .querySelectorAll(`[data-${side}]`)
    .forEach((n) => n.classList.toggle("picked", n === b));
  if (!matching.left || !matching.right) return;
  const correct = matching.left === matching.right;
  if (cloudMode && !profile().completed.includes("matching"))
    cloudPairs.push({ left: matching.left, right: matching.right });
  effect(correct);
  if (correct) {
    matching.found.push(id);
    for (const key of ["left", "right"]) {
      const btn = [...document.querySelectorAll(`[data-${key}]`)].find(
        (n) => n.dataset[key] === id,
      );
      btn.disabled = true;
      btn.classList.add("correct");
    }
    $("#match-status").textContent =
      `✦ 配對成功！已完成 ${matching.found.length} / ${matching.pairs.length} 組`;
  } else {
    const pair = matching.pairs.find((q) => q.id === matching.left);
    $("#match-status").textContent =
      `還差一點！「${pair.word}」的意思是「${pair.meaning}」。請重新選擇。`;
  }
  if (cloudMode) persistCloud();
  matching.left = null;
  matching.right = null;
  document
    .querySelectorAll(".picked")
    .forEach((n) => n.classList.remove("picked"));
  if (matching.found.length === matching.pairs.length) {
    $("#match-status").innerHTML =
      '<p>✦ 溪谷的星光都被你點亮了！</p><button id="match-done" class="primary">領取獎勵 →</button>';
    $("#match-done").onclick = finish;
  }
}
function finish() {
  if (
    cloudMode &&
    !cloudUser.progress.completedStages.includes(stage) &&
    !cloudQueue[stage]
  ) {
    const payload =
      stage === "matching"
        ? { pairs: structuredClone(cloudPairs) }
        : {
            answers: Object.fromEntries(
              state.bank.questions
                .filter((q) => q.type === stage)
                .map((q) => [q.id, cloudPicks[q.id]]),
            ),
          };
    cloudQueue[stage] = payload;
  }
  if (!profile().completed.includes(stage)) profile().completed.push(stage);
  save();
  effect(true);
  const all = STAGES.filter(available).every((s) =>
    profile().completed.includes(s.id),
  );
  show(
    `<div class="completion-fox">${fox}</div><div class="eyebrow">${all ? "ISLAND EXPLORER" : "QUEST COMPLETE"}</div><h2>${all ? "你點亮了整座知識島嶼！" : "冒險完成，新的島嶼在等你！"}</h2><p>每一次嘗試，都是成長的水晶。<br>目前收集 <b>${score()}</b> 顆水晶。</p><div class="reward">✧ ❖ ✦ ❖ ✧</div><button id="back-map" class="primary">返回島嶼地圖 →</button><button id="export-result" class="secondary">匯出本次成績</button>`,
  );
  $("#back-map").onclick = () => {
    $("#modal").close();
    stage = null;
    render();
    select(Math.min(selected + 1, 4));
  };
  $("#export-result").onclick = exportResult;
  paintQuest();
  if (cloudMode) syncCloud();
}
function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportResult() {
  const payload = makeSubmission(
    state.bank,
    state.nickname,
    profile(),
    crypto.randomUUID(),
  );
  download("island-result.json", JSON.stringify(payload, null, 2));
  notify(
    cloudMode
      ? "已匯出本機紀錄；官方成績請看雲端同步狀態。"
      : "成績已匯出；此版本為本機練習模式。",
  );
}
function playerDialog() {
  if (cloudMode) {
    studentLogin();
    return;
  }
  show(
    `<div class="eyebrow">HELLO, EXPLORER</div><h2>這次冒險，要叫你什麼呢？</h2><p>使用暱稱就好，不需要真實姓名。每個暱稱有各自的進度。</p><form id="name-form"><label for="nickname">冒險家暱稱（1–16 字）</label><input id="nickname" maxlength="16" required value="${esc(state.nickname)}" autocomplete="off"><button class="primary">儲存並開始 →</button></form><button id="reset" class="danger">重設目前暱稱的進度</button>`,
  );
  $("#name-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#nickname").value.trim();
    if (!name || ["__proto__", "constructor", "prototype"].includes(name)) {
      notify("請輸入其他暱稱。");
      return;
    }
    state.nickname = name;
    if (!Object.hasOwn(state.profiles, name))
      state.profiles[name] = freshProfile();
    save();
    $("#modal").close();
    render();
  };
  $("#reset").onclick = () => {
    if (confirm("確定清除目前暱稱的分數與進度？")) {
      state.profiles[state.nickname] = freshProfile();
      save();
      $("#modal").close();
      render();
    }
  };
}
function rankingDialog() {
  const rows = Object.entries(state.profiles).sort(
    (a, b) =>
      scoreFor(state.bank, b[1]) - scoreFor(state.bank, a[1]) ||
      a[1].updatedAt - b[1].updatedAt,
  );
  show(
    `<div class="eyebrow">LOCAL HALL OF EXPLORERS</div><h2>此裝置冒險家排行榜</h2><p>僅顯示此瀏覽器的紀錄；不是班級共享排行榜。<br>同分以較早更新的紀錄優先。</p><ol class="leaderboard">${rows.map(([n, p]) => `<li><span>${esc(n)}</span><b>❖ ${scoreFor(state.bank, p)}</b></li>`).join("")}</ol><button id="export-result" class="secondary">匯出我的成績 JSON</button><p class="mode-note">成績儲存於裝置，可被修改；不會傳送至 Google 或其他服務。</p>`,
  );
  $("#export-result").onclick = exportResult;
}
function teacherDialog() {
  pending = null;
  show(
    `<div class="eyebrow">TEACHER’S WORKSHOP</div><h2>讓你的教材，成為下一場冒險。</h2><p>匯入 JSON 或 UTF-8 CSV，最多 200 題、1 MB。先預覽再套用；套用後會重設此裝置所有學生的進度。</p><div class="template-links"><a href="/templates/questions.json" download>↓ JSON 題庫範本</a><a href="/templates/questions.csv" download>↓ CSV 題庫範本</a></div><label class="upload" for="bank-file"><span>↑</span>選擇 JSON / CSV 題庫<input id="bank-file" type="file" accept=".json,.csv"></label><div id="import-status" role="status"></div><button id="apply-bank" class="primary" disabled>確認套用題庫</button><button id="restore-demo" class="secondary">還原原創示範題</button><details><summary>匯入格式與配對活動</summary><p>type：vocabulary / grammar / reading / listening。answerIndex：0–3；四個不同選項；需填繁中 explanation。閱讀需 passage；聽力需 speech 或 HTTPS audioUrl。配對另需 word 與 meaning，至少兩組且不可重複。缺少的關卡將跳過。CSV 範本含選配欄位。</p></details>`,
  );
  $("#bank-file").onchange = async (e) => {
    pending = null;
    $("#apply-bank").disabled = true;
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw Error("檔案不可超過 1 MB。");
      pending = importBank(await file.text(), file.name);
      $("#import-status").textContent =
        `驗證成功：${pending.questions.length} 題。第一題：${pending.questions[0].prompt}。可用配對 ${matchingPairs(pending).length} 組。請確認後套用。`;
      $("#apply-bank").disabled = false;
    } catch (error) {
      $("#import-status").textContent =
        "匯入失敗，原題庫保留：\n" + error.message;
    }
  };
  $("#apply-bank").onclick = () => {
    if (pending && confirm("套用新題庫並清除所有暱稱的舊進度？"))
      applyBank(pending);
  };
  $("#restore-demo").onclick = () => {
    if (confirm("還原示範題並清除所有暱稱的舊進度？"))
      applyBank(structuredClone(DEMO));
  };
}
function applyBank(bank) {
  state.bank = bank;
  for (const name of Object.keys(state.profiles))
    state.profiles[name] = freshProfile();
  save();
  selected = 0;
  $("#modal").close();
  render();
  notify("題庫已套用，新的冒險準備好了！");
}
const cloudReady = cloudAvailable().then(async (enabled) => {
  cloudMode = enabled;
  if (enabled) {
    try {
      requiresStudentCode =
        (await api("status")).studentLoginMode !== "class-seat";
    } catch {
      /* Default to code-required when configuration cannot be read. */
    }
    try {
      await restoreCloud(await api("student/me"));
    } catch (e) {
      cloudUser = null;
      if (e.status !== 401) console.warn("Cloud session unavailable");
    }
    render();
    if (cloudUser) syncCloud();
  }
});
render();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopListening();
});

function pendingKey() {
  return "eai-cloud-" + cloudUser.progress.runId;
}
function persistCloud() {
  if (!cloudUser) return;
  try {
    sessionStorage.setItem(
      pendingKey(),
      JSON.stringify({
        picks: cloudPicks,
        pairs: cloudPairs,
        queue: cloudQueue,
        answers: profile().answers,
        completed: profile().completed,
      }),
    );
  } catch {
    notify("此裝置無法暫存尚未同步的答案，請保持網路連線。");
  }
}
async function restoreCloud(user) {
  cloudUser = user;
  state.bank = user.bank;
  state.nickname = `${user.className} · ${user.seat} 號`;
  state.profiles = { [state.nickname]: freshProfile() };
  cloudPicks = {};
  cloudPairs = [];
  cloudQueue = {};
  for (const result of user.progress.stages) {
    if (result.stage !== "matching")
      for (const [id, index] of Object.entries(result.answers)) {
        cloudPicks[id] = index;
        const q = state.bank.questions.find((q) => q.id === id);
        if (q) profile().answers[id] = index === q.answerIndex;
      }
  }
  profile().completed = [...user.progress.completedStages];
  try {
    const cached = JSON.parse(sessionStorage.getItem(pendingKey()));
    if (cached && cached.picks && cached.queue) {
      cloudPicks = { ...cloudPicks, ...cached.picks };
      cloudPairs = cached.pairs || [];
      cloudQueue = cached.queue;
      for (const id of user.progress.completedStages) delete cloudQueue[id];
      Object.assign(profile().answers, cached.answers || {});
      profile().completed = [
        ...new Set([...profile().completed, ...Object.keys(cloudQueue)]),
      ];
    }
  } catch {
    /* invalid partial data is ignored; official server data remains authoritative */
  }
}
function updateCloudStatus(text) {
  const node = $("#cloud-state");
  if (!node) return;
  node.textContent =
    text ||
    (!cloudUser
      ? requiresStudentCode
        ? "雲端成績模式：請先輸入班級、座號及個別入場碼。"
        : "簡易登入：輸入班級與座號即可開始。請只使用自己的座號。"
      : Object.keys(cloudQueue).length
        ? `${state.nickname} · 有 ${Object.keys(cloudQueue).length} 關等待同步，請保持此分頁開啟。`
        : `${state.nickname} · 已儲存 ${cloudUser.progress.completedStages.length} 關至 Cloudflare D1`);
  $("#sync-now").hidden = !cloudUser || !Object.keys(cloudQueue).length;
}
async function syncCloud() {
  if (!cloudUser || cloudSyncing) return;
  cloudSyncing = true;
  try {
    for (const s of STAGES) {
      if (!cloudQueue[s.id]) continue;
      updateCloudStatus("正在儲存成績至 Cloudflare D1…");
      const data = await post("student/stages/" + s.id, cloudQueue[s.id]);
      cloudUser.progress = data.progress;
      delete cloudQueue[s.id];
      persistCloud();
    }
    updateCloudStatus();
  } catch (e) {
    if (e.status === 401) cloudUser = null;
    updateCloudStatus(
      "尚未儲存：" + e.message + " 請點重試同步，或重新登入後再試。",
    );
  } finally {
    cloudSyncing = false;
  }
}
function studentLogin(after) {
  show(
    `<div class="eyebrow">CLASSROOM ADVENTURE</div><h2>${cloudUser ? "學生帳號" : "輸入班級與座號，開始冒險"}</h2><p>${requiresStudentCode ? "使用老師個別發給你的入場碼，請勿分享；不需要真實姓名。" : "只需輸入老師建立的班級及自己的座號，不需要入場碼。簡易登入不驗證身分，請勿冒用同學座號。"}關卡完成後會自動儲存。</p>${cloudUser ? `<p>目前：${esc(state.nickname)}</p><button id="student-logout" class="secondary">登出並切換學生</button>` : `<form id="student-login"><label for="student-class">班級</label><input id="student-class" required maxlength="30" placeholder="例如：701" autocomplete="off"><label for="student-seat">座號</label><input id="student-seat" required type="number" min="1" max="100">${requiresStudentCode ? '<label for="student-code">個別入場碼</label><input id="student-code" required type="password" maxlength="32" autocomplete="off">' : ""}<button class="primary">登入並開始冒險 →</button></form>`}<p id="login-status" role="status"></p>`,
  );
  if (cloudUser) {
    $("#student-logout").onclick = async () => {
      if (
        Object.keys(cloudQueue).length &&
        !confirm("仍有未儲存關卡，登出會清除暫存。確定登出？")
      )
        return;
      try {
        await post("student/logout", {});
        sessionStorage.removeItem(pendingKey());
        cloudUser = null;
        cloudPicks = {};
        cloudQueue = {};
        cloudPairs = [];
        state.nickname = "冒險家";
        state.profiles = { 冒險家: freshProfile() };
        state.bank = structuredClone(DEMO);
        $("#modal").close();
        selected = 0;
        render();
      } catch (e) {
        $("#login-status").textContent = e.message;
      }
    };
    return;
  }
  $("#student-login").onsubmit = async (e) => {
    e.preventDefault();
    e.submitter.disabled = true;
    try {
      await post("student/login", {
        className: $("#student-class").value.trim(),
        seat: Number($("#student-seat").value),
        ...(requiresStudentCode
          ? { entryCode: $("#student-code").value.trim() }
          : {}),
      });
      await restoreCloud(await api("student/me"));
      $("#modal").close();
      selected = 0;
      render();
      await syncCloud();
      if (after) after();
    } catch (error) {
      $("#login-status").textContent = error.message;
      e.submitter.disabled = false;
    }
  };
}
function ownCloudResult() {
  if (!cloudUser) {
    studentLogin();
    return;
  }
  const p = cloudUser.progress;
  show(
    `<div class="eyebrow">MY CLOUD RESULTS</div><h2>${esc(state.nickname)} 的成績</h2><p>以下為伺服器已確認紀錄，不包含尚未同步的關卡。</p><p>得分：${p.score} / ${p.maxScore}<br>答對：${p.correctCount} / ${p.questionCount}<br>正確率：${p.accuracy}%<br>完成關卡：${p.completedStages.length} / ${p.totalStages}<br>完成時間：${p.completedAt ? new Date(p.completedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "尚未全部完成"}<br>經過時間：${p.elapsedSeconds} 秒</p><p class="mode-note">${requiresStudentCode ? "不提供其他學生的成績查詢。" : "簡易登入不驗證身分，知道班級與座號的人可能讀取或續作該座號進度。請只使用自己的座號。"}老師排行榜請至受保護的管理頁。</p>`,
  );
}
window.addEventListener("online", () => {
  if (cloudMode) syncCloud();
});
