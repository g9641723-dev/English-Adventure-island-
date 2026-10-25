export const DEMO = {
  version: 1,
  questions: [
    {
      id: "v1",
      type: "vocabulary",
      prompt: "The island has a hidden treasure. What does “treasure” mean?",
      choices: ["寶藏", "森林", "橋梁", "天氣"],
      answerIndex: 0,
      explanation: "treasure 是「寶藏」。hidden treasure 指藏起來的寶藏。",
      points: 10,
      word: "treasure",
      meaning: "寶藏",
    },
    {
      id: "v2",
      type: "vocabulary",
      prompt: "Which word means「勇敢的」?",
      choices: ["quiet", "brave", "hungry", "cloudy"],
      answerIndex: 1,
      explanation:
        "brave 是「勇敢的」；quiet 是安靜的，hungry 是飢餓的，cloudy 是多雲的。",
      points: 10,
      word: "brave",
      meaning: "勇敢的",
    },
    {
      id: "v3",
      type: "vocabulary",
      prompt: "We cross the river on a _____.",
      choices: ["cloud", "flower", "bridge", "star"],
      answerIndex: 2,
      explanation: "bridge 是「橋梁」。cross the river 表示渡過河流。",
      points: 10,
      word: "bridge",
      meaning: "橋梁",
    },
    {
      id: "g1",
      type: "grammar",
      prompt: "Look! The little fox _____ under the tree.",
      choices: ["sleep", "sleeps", "sleeping", "is sleeping"],
      answerIndex: 3,
      explanation:
        "Look! 提示正在發生的動作，使用現在進行式 be + V-ing。主詞是單數，所以用 is sleeping。",
      points: 10,
    },
    {
      id: "r1",
      type: "reading",
      passage:
        "Mia finds a small bird near the river. Its wing is hurt. She takes it to a safe tree house and brings it water. The next morning, the bird can fly again.",
      prompt: "Why does Mia take the bird to the tree house?",
      choices: [
        "To teach it to sing.",
        "To help the hurt bird.",
        "To find a treasure.",
        "To meet her friends.",
      ],
      answerIndex: 1,
      explanation:
        "文中提到鳥的翅膀受傷（Its wing is hurt），Mia 將牠帶到安全的樹屋並給水，因此目的是幫助受傷的小鳥。",
      points: 10,
    },
    {
      id: "l1",
      type: "listening",
      speech:
        "Go across the bridge and turn left. The treasure is behind the big tree.",
      prompt: "Where is the treasure?",
      choices: [
        "Under the bridge.",
        "Next to the river.",
        "Behind the big tree.",
        "In the tree house.",
      ],
      answerIndex: 2,
      explanation:
        "音訊說 The treasure is behind the big tree.，所以寶藏在大樹後方。behind 表示「在……後面」。",
      points: 10,
    },
  ],
};
export const STAGES = [
  {
    id: "vocabulary",
    name: "晨光森林",
    label: "單字探索",
    icon: "✦",
    desc: "跟著狐狸，找回森林裡的英文線索。",
  },
  {
    id: "matching",
    name: "星語溪谷",
    label: "中英配對",
    icon: "❖",
    desc: "讓英文與中文相遇，點亮溪谷的星光。",
  },
  {
    id: "grammar",
    name: "月影遺跡",
    label: "文法試煉",
    icon: "☾",
    desc: "解開古老句型，打開遺跡之門。",
  },
  {
    id: "reading",
    name: "天空樹屋",
    label: "閱讀任務",
    icon: "⌂",
    desc: "讀一段小故事，發現藏在字裡的溫柔。",
  },
  {
    id: "listening",
    name: "水晶之巔",
    label: "聽力寶藏",
    icon: "♬",
    desc: "仔細聆聽最後的線索，找到島嶼寶藏。",
  },
];
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell) {
        throw Error("CSV 引號格式不正確。");
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("CSV 引號未閉合。");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2) throw Error("CSV 需要欄位名稱與至少一筆題目。");
  const headers = rows.shift().map((x) => x.trim());
  if (new Set(headers).size !== headers.length)
    throw Error("CSV 欄位名稱重複。");
  const questions = rows.map((r, i) => {
    if (r.length !== headers.length) throw Error(`第 ${i + 2} 列欄位數不符。`);
    const q = Object.fromEntries(headers.map((h, j) => [h, r[j]]));
    return {
      ...q,
      choices: ["choiceA", "choiceB", "choiceC", "choiceD"].map((k) => q[k]),
      answerIndex: q.answerIndex === "" ? NaN : Number(q.answerIndex),
      points: q.points === "" || q.points === undefined ? 10 : Number(q.points),
    };
  });
  return { version: 1, questions };
}
export function validateBank(bank) {
  const errors = [];
  if (bank?.version !== 1) errors.push("version 必須為 1。");
  if (
    !Array.isArray(bank?.questions) ||
    !bank.questions.length ||
    bank.questions.length > 200
  )
    throw Error("題庫必須包含 1–200 題。");
  const ids = new Set();
  bank.questions.forEach((q, i) => {
    const e = (m) => errors.push(`第 ${i + 1} 題：${m}`);
    if (!q || typeof q !== "object") {
      e("格式錯誤");
      return;
    }
    if (
      typeof q.id !== "string" ||
      !q.id.trim() ||
      ["__proto__", "constructor", "prototype"].includes(q.id) ||
      ids.has(q.id)
    )
      e("id 缺少或重複");
    ids.add(q.id);
    if (!["vocabulary", "grammar", "reading", "listening"].includes(q.type))
      e("不支援的 type");
    if (
      typeof q.prompt !== "string" ||
      !q.prompt.trim() ||
      q.prompt.length > 3000
    )
      e("prompt 為必填，最多 3000 字");
    if (
      !Array.isArray(q.choices) ||
      q.choices.length !== 4 ||
      q.choices.some(
        (c) => typeof c !== "string" || !c.trim() || c.length > 1000,
      ) ||
      new Set(q.choices).size !== 4
    )
      e("需要四個不重複的非空選項");
    if (
      !Number.isInteger(q.answerIndex) ||
      q.answerIndex < 0 ||
      q.answerIndex > 3
    )
      e("answerIndex 必須為 0–3");
    if (!Number.isFinite(q.points) || q.points < 0 || q.points > 100)
      e("points 必須為 0–100");
    if (
      typeof q.explanation !== "string" ||
      !q.explanation.trim() ||
      q.explanation.length > 5000
    )
      e("explanation 為必填，最多 5000 字");
    if (
      q.type === "reading" &&
      (typeof q.passage !== "string" || !q.passage.trim())
    )
      e("閱讀題需要 passage");
    if (q.type === "listening" && !q.audioUrl && !q.speech)
      e("聽力題需要 audioUrl 或 speech");
    for (const k of ["passage", "speech", "word", "meaning", "audioUrl"])
      if (
        q[k] !== undefined &&
        (typeof q[k] !== "string" || q[k].length > 10000)
      )
        e(`${k} 格式錯誤或過長`);
    if (q.audioUrl && !/^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/.test(q.audioUrl))
      e("audioUrl 僅支援 HTTPS 或 / 開頭的同站路徑");
  });
  if (errors.length) throw Error(errors.join("\n"));
  return { version: 1, questions: bank.questions.map((q) => ({ ...q })) };
}
export function importBank(text, filename) {
  if (new TextEncoder().encode(text).length > 1024 * 1024)
    throw Error("檔案不可超過 1 MB。");
  return validateBank(
    filename.toLowerCase().endsWith(".csv") ? parseCSV(text) : JSON.parse(text),
  );
}
export function matchingPairs(bank) {
  return bank.questions
    .filter(
      (q) => q.type === "vocabulary" && q.word?.trim() && q.meaning?.trim(),
    )
    .filter(
      (q, i, a) =>
        a.findIndex((v) => v.word === q.word || v.meaning === q.meaning) === i,
    )
    .slice(0, 4)
    .map((q) => ({ id: q.id, word: q.word, meaning: q.meaning }));
}
export function scoreFor(bank, profile) {
  return (
    bank.questions.reduce(
      (n, q) => n + (profile.answers[q.id] === true ? q.points : 0),
      0,
    ) +
    (profile.completed.includes("matching")
      ? matchingPairs(bank).length * 10
      : 0)
  );
}
export function freshProfile() {
  return { answers: {}, completed: [], updatedAt: 0 };
}
export function loadState(storage) {
  try {
    const s = JSON.parse(storage.getItem("eai-v1"));
    if (
      s?.version !== 1 ||
      typeof s.profiles !== "object" ||
      !s.profiles ||
      Array.isArray(s.profiles)
    )
      return null;
    validateBank(s.bank);
    if (
      typeof s.nickname !== "string" ||
      !s.nickname ||
      s.nickname.length > 16 ||
      !s.profiles[s.nickname]
    )
      return null;
    for (const [name, p] of Object.entries(s.profiles)) {
      if (
        !name ||
        name.length > 16 ||
        !p ||
        typeof p.answers !== "object" ||
        !p.answers ||
        Array.isArray(p.answers) ||
        Object.values(p.answers).some((v) => typeof v !== "boolean") ||
        !Array.isArray(p.completed) ||
        p.completed.some((v) => !STAGES.some((s) => s.id === v)) ||
        !Number.isFinite(p.updatedAt)
      )
        return null;
    }
    return s;
  } catch {
    return null;
  }
}
export function makeSubmission(bank, nickname, profile, id) {
  return {
    schemaVersion: 1,
    submissionId: id,
    nickname,
    quizId: "island-" + bank.questions.map((q) => q.id).join("-"),
    score: scoreFor(bank, profile),
    maxScore:
      bank.questions.reduce((n, q) => n + q.points, 0) +
      matchingPairs(bank).length * 10,
    completedAt: new Date().toISOString(),
    answers: profile.answers,
  };
}
export async function submitResult(endpoint, payload, fetcher = fetch) {
  if (!/^https:\/\//.test(endpoint)) throw Error("回傳端點必須使用 HTTPS。");
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || response.type === "opaque")
    throw Error("伺服器未確認成績，請稍後重試。");
  const body = await response.json();
  if (body.ok !== true || body.submissionId !== payload.submissionId)
    throw Error("成績確認格式不符。");
  return body;
}
