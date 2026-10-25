import { test, expect } from "@playwright/test";
test("complete adventure, wrong explanation, retry scoring, matching and persisted progress", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "每一個英文， 都是冒險的起點。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "開始我的冒險" }).click();
  await page.locator('[data-answer="1"]').click();
  await expect(page.locator("#feedback")).toContainText("treasure 是");
  await page.getByRole("button", { name: "再練習這題" }).click();
  await expect(page.locator(".prompt")).toContainText("hidden treasure");
  await page.locator('[data-answer="0"]').click();
  await expect(page.locator("#feedback")).toContainText("不重複計分");
  await page.getByRole("button", { name: "繼續探索" }).click();
  await page.locator('[data-answer="1"]').click();
  await page.getByRole("button", { name: "繼續探索" }).click();
  await page.locator('[data-answer="2"]').click();
  await page.getByRole("button", { name: "繼續探索" }).click();
  await expect(
    page.getByRole("heading", { name: "冒險完成，新的島嶼在等你！" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回島嶼地圖" }).click();
  await page.getByRole("button", { name: "進入這座島嶼" }).click();
  await page.locator('[data-left="v1"]').click();
  await page.locator('[data-right="v2"]').click();
  await expect(page.locator("#match-status")).toContainText("重新選擇");
  for (const id of ["v1", "v2", "v3"]) {
    await page.locator(`[data-left="${id}"]`).click();
    await page.locator(`[data-right="${id}"]`).click();
  }
  await page.getByRole("button", { name: "領取獎勵" }).click();
  await page.getByRole("button", { name: "返回島嶼地圖" }).click();
  for (const answer of [3, 1, 2]) {
    await page.getByRole("button", { name: "進入這座島嶼" }).click();
    if (answer === 2) {
      await page.getByRole("button", { name: "播放英文線索" }).click();
      await expect(page.locator("#audio-status")).not.toBeEmpty();
      await page.getByRole("button", { name: "練習模式：查看逐字稿" }).click();
      await expect(page.locator("#transcript-text")).toContainText("Go across");
    }
    await page.locator(`[data-answer="${answer}"]`).click();
    await page.getByRole("button", { name: "繼續探索" }).click();
    await page.getByRole("button", { name: "返回島嶼地圖" }).click();
  }
  await expect(page.locator(".crystal-count")).toContainText("80");
  await page.reload();
  await expect(page.locator(".progress-caption")).toContainText("5 / 5");
  await page.getByRole("button", { name: "排行榜", exact: true }).click();
  await expect(page.locator(".leaderboard")).toContainText("80");
  expect(errors).toEqual([]);
});
test("JSON/CSV preview, bad import preserves bank, nickname separation, sound and safe rendering", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "聲音關閉" }).click();
  await expect(page.getByRole("button", { name: "聲音開啟" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "聲音開啟" }).click();
  await page.getByRole("button", { name: "設定冒險家暱稱" }).click();
  await page
    .getByRole("textbox", { name: "冒險家暱稱（1–16 字）" })
    .fill("Mia");
  await page.getByRole("button", { name: "儲存並開始" }).click();
  await expect(page.locator("#player-name")).toHaveText("Mia");
  await page.getByRole("button", { name: "題庫工坊" }).click();
  await page
    .locator("#bank-file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });
  await expect(page.locator("#import-status")).toContainText("原題庫保留");
  await expect(page.locator("#apply-bank")).toBeDisabled();
  await page
    .locator("#bank-file")
    .setInputFiles("public/templates/questions.json");
  await expect(page.locator("#import-status")).toContainText("驗證成功");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "確認套用題庫" }).click();
  await expect(page.locator(".progress-caption")).toContainText("0 / 5");
  await page.getByRole("button", { name: "題庫工坊" }).click();
  await page
    .locator("#bank-file")
    .setInputFiles("public/templates/questions.csv");
  await expect(page.locator("#import-status")).toContainText("驗證成功");
  await page.getByRole("button", { name: "關閉視窗" }).click();
  await page.getByRole("button", { name: "設定冒險家暱稱" }).click();
  await page
    .getByRole("textbox", { name: "冒險家暱稱（1–16 字）" })
    .fill("<b>Fox</b>");
  await page.getByRole("button", { name: "儲存並開始" }).click();
  await expect(page.locator("#player-name")).toHaveText("<b>Fox</b>");
  expect(await page.locator("#player-name b").count()).toBe(0);
});
test("responsive map, locked levels, keyboard, reduced motion and screenshot", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "水晶之巔 尚未解鎖" }).click();
  await expect(
    page.getByRole("button", { name: "完成前一關解鎖" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "晨光森林 選擇地標" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "進入這座島嶼" }),
  ).toBeEnabled();
  await page.screenshot({
    path: `test-results/${info.project.name}-island.png`,
    fullPage: true,
  });
});
