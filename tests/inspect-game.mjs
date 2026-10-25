import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
import { chromium } from "playwright";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
await page.emulateMedia({ reducedMotion: "reduce" });
const report = {
  url: process.env.GAME_URL || "http://127.0.0.1:5173/",
  consoleErrors: [],
  javascriptErrors: [],
  failedRequests: [],
  badResponses: [],
};
page.on("pageerror", (e) => report.javascriptErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.consoleErrors.push(m.text());
});
page.on("requestfailed", (r) =>
  report.failedRequests.push({ url: r.url(), failure: r.failure()?.errorText }),
);
page.on("response", (r) => {
  if (r.status() >= 400)
    report.badResponses.push({ url: r.url(), status: r.status() });
});
const response = await page.goto(report.url, { waitUntil: "networkidle" });
report.httpStatus = response.status();
await page.locator(".island-art").waitFor({ state: "visible" });
report.svgCount = await page.locator(".island-art").count();
report.mapNodeCount = await page.locator(".map-node").count();
report.brokenImages = await page
  .locator("img")
  .evaluateAll((imgs) =>
    imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src),
  );
report.sceneBox = await page.locator(".map-scene").boundingBox();
await page
  .locator(".adventure")
  .screenshot({ path: "artifacts/island-map.png" });
await page.getByRole("button", { name: "開始我的冒險" }).click();
await page.locator('[data-answer="0"]').click();
report.rewardVisible = await page.locator(".reward").isVisible();
report.feedback = await page.locator("#feedback").innerText();
await page.screenshot({ path: "artifacts/gameplay.png" });
report.passed =
  report.httpStatus === 200 &&
  report.svgCount === 1 &&
  report.mapNodeCount === 5 &&
  report.rewardVisible &&
  !report.javascriptErrors.length &&
  !report.consoleErrors.length &&
  !report.failedRequests.length &&
  !report.badResponses.length &&
  !report.brokenImages.length;
await import("node:fs/promises").then((fs) =>
  fs.writeFile("artifacts/browser-check.json", JSON.stringify(report, null, 2)),
);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!report.passed) process.exitCode = 1;
