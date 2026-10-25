import { chromium } from "playwright";
import { expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const html = await readFile("English-Adventure-Island.html");
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
let count = 0;
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 360, height: 800 },
  ]) {
    const page = await browser.newPage({ viewport, acceptDownloads: true });
    const errors = [],
      remote = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) remote.push(r.url());
    });
    await page.goto(
      process.env.PORTABLE_FILE_MODE
        ? pathToFileURL(resolve("English-Adventure-Island.html")).href
        : url,
    );
    await page.locator(".island-art").waitFor();
    assert.equal(await page.locator(".map-node").count(), 5);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.getByRole("button", { name: "開始我的冒險" }).click();
    for (const [i, answer] of [0, 1, 2].entries()) {
      await page.locator(`[data-answer="${answer}"]`).click();
      assert.match(await page.locator("#feedback").innerText(), /太棒了/);
      await page.getByRole("button", { name: "繼續探索" }).click();
    }
    await page.getByRole("button", { name: "返回島嶼地圖" }).click();
    await page.getByRole("button", { name: "進入這座島嶼" }).click();
    for (const id of ["v1", "v2", "v3"]) {
      await page.locator(`[data-left="${id}"]`).click();
      await page.locator(`[data-right="${id}"]`).click();
    }
    await page.getByRole("button", { name: "領取獎勵" }).click();
    await page.getByRole("button", { name: "返回島嶼地圖" }).click();
    for (const answer of [3, 1, 2]) {
      await page.getByRole("button", { name: "進入這座島嶼" }).click();
      await page.locator(`[data-answer="${answer}"]`).click();
      await page.getByRole("button", { name: "繼續探索" }).click();
      await page.getByRole("button", { name: "返回島嶼地圖" }).click();
    }
    assert.match(await page.locator(".crystal-count").innerText(), /90/);
    await page.reload();
    assert.match(await page.locator(".progress-caption").innerText(), /5 \/ 5/);
    await page.getByRole("button", { name: "題庫工坊" }).click();
    for (const name of ["JSON", "CSV"]) {
      const download = page.waitForEvent("download");
      await page
        .getByRole("link", { name: new RegExp(name + " 題庫範本") })
        .click();
      const file = await download;
      assert.equal(file.suggestedFilename(), "questions." + name.toLowerCase());
      assert.equal(await file.failure(), null);
    }
    await page
      .locator("#bank-file")
      .setInputFiles("public/templates/questions.csv");
    await expect(page.locator("#import-status")).toContainText("驗證成功");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "確認套用題庫" }).click();
    assert.match(await page.locator(".progress-caption").innerText(), /0 \/ 5/);
    assert.deepEqual(errors, []);
    assert(remote.every((u) => u === url));
    assert(remote.length <= 2);
    console.log(
      `PASS ${viewport.width}×${viewport.height}: standalone HTML rendering, all five stages, 90 points, saved progress, embedded downloads and CSV import; no external resources or JS errors.`,
    );
    count++;
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  `${count} portable browser scenarios passed. Windows itself was not available. Cloud browser policy blocks file://; tested the standalone HTML over loopback using Chromium on Linux, without source modules or external resources.`,
);
