import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO,
  importBank,
  validateBank,
  parseCSV,
  matchingPairs,
  freshProfile,
  scoreFor,
  loadState,
  makeSubmission,
  submitResult,
} from "../src/core.js";
const csv =
  'id,type,prompt,choiceA,choiceB,choiceC,choiceD,answerIndex,explanation,points,word,meaning\r\nv1,vocabulary,"Which word, explorer?",tree,bird,sky,river,0,"tree 是樹。\n記得這個字。",10,tree,樹';
test("original four-skill bank and optional matching pairs validate", () => {
  assert.equal(validateBank(DEMO).questions.length, 6);
  assert.equal(matchingPairs(DEMO).length, 3);
});
test("CSV handles BOM, quoted commas, newlines and escaped quotes", () => {
  const b = importBank("\uFEFF" + csv, "questions.csv");
  assert.equal(b.questions[0].prompt, "Which word, explorer?");
  assert.match(b.questions[0].explanation, /\n/);
  assert.equal(
    parseCSV(csv.replace("Which word, explorer?", 'Which ""word"", explorer?'))
      .questions[0].prompt,
    'Which "word", explorer?',
  );
});
test("invalid CSV, duplicate IDs, invalid answers and unsafe URLs rejected", () => {
  assert.throws(() => importBank(csv + "\nx,y", "x.csv"));
  assert.throws(() => parseCSV(csv + '"'), /引號/);
  for (const change of [
    (q) => (q.answerIndex = 4),
    (q) => (q.audioUrl = "javascript:alert(1)"),
    (q) => (q.points = -1),
    (q) => (q.explanation = ""),
    (q) => (q.choices[1] = q.choices[0]),
  ]) {
    const b = structuredClone(DEMO);
    change(b.questions[0]);
    assert.throws(() => validateBank(b));
  }
  const b = structuredClone(DEMO);
  b.questions[1].id = b.questions[0].id;
  assert.throws(() => validateBank(b), /重複/);
});
test("oversized and empty banks rejected; import is atomic", () => {
  const original = JSON.stringify(DEMO);
  assert.throws(
    () => importBank("x".repeat(1024 * 1024 + 1), "x.json"),
    /1 MB/,
  );
  assert.throws(() => validateBank({ version: 1, questions: [] }));
  assert.equal(JSON.stringify(DEMO), original);
});
test("score uses first attempts and matching completion only once", () => {
  const p = freshProfile();
  p.answers.v1 = true;
  p.answers.v2 = false;
  assert.equal(scoreFor(DEMO, p), 10);
  p.completed.push("matching");
  assert.equal(scoreFor(DEMO, p), 40);
  p.completed.push("matching");
  assert.equal(scoreFor(DEMO, p), 40);
});
test("corrupt and blocked storage have safe fallback", () => {
  for (const raw of [
    "{",
    "null",
    JSON.stringify({
      version: 1,
      bank: DEMO,
      profiles: { bad: { answers: [], completed: [] } },
      nickname: "bad",
    }),
  ])
    assert.equal(loadState({ getItem: () => raw }), null);
  assert.equal(
    loadState({
      getItem: () => {
        throw Error();
      },
    }),
    null,
  );
  const s = {
    version: 1,
    bank: DEMO,
    nickname: "Mia",
    profiles: { Mia: freshProfile() },
  };
  assert.deepEqual(loadState({ getItem: () => JSON.stringify(s) }), s);
});
test("submission contract verifies server acknowledgment; rejects opaque/errors/timeouts", async () => {
  const payload = makeSubmission(DEMO, "Mia", freshProfile(), "unique-1");
  assert.equal(payload.maxScore, 90);
  const ok = await submitResult(
    "https://example.com",
    payload,
    async (_, opts) => {
      assert.equal(JSON.parse(opts.body).submissionId, "unique-1");
      return {
        ok: true,
        type: "basic",
        json: async () => ({ ok: true, submissionId: "unique-1" }),
      };
    },
  );
  assert.equal(ok.ok, true);
  for (const response of [
    { ok: false },
    { ok: true, type: "opaque" },
    { ok: true, json: async () => ({ ok: true, submissionId: "wrong" }) },
  ])
    await assert.rejects(
      submitResult("https://example.com", payload, async () => response),
    );
  await assert.rejects(submitResult("http://example.com", payload));
  await assert.rejects(
    submitResult("https://example.com", payload, async () => {
      throw Error("timeout");
    }),
  );
});
