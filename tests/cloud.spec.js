import { DEMO } from "../src/core.js";
import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
test("teacher provisions class, student auto-saves all stages with retry, teacher views stats and CSV", async ({
  page,
  browser,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/teacher.html");
  await page.getByLabel("Email", { exact: true }).fill("g9641723@gmail.com");
  await page
    .getByLabel("密碼", { exact: true })
    .fill("Local test password only 2026!");
  await page.getByRole("button", { name: "登入成績管理" }).click();
  await expect(
    page.getByRole("heading", { name: "看見每一位冒險家的成長。" }),
  ).toBeVisible();
  const name = "TEST-" + info.project.name;
  await page.locator("#class-name").fill(name);
  await page.locator("#seat-count").fill("2");
  await page.getByRole("button", { name: "建立班級", exact: true }).click();
  await expect(page.locator("#roster-output")).toContainText("2 位學生");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下載此班入場碼 CSV" }).click();
  const download = await downloadPromise;
  const text = await readFile(await download.path(), "utf8");
  const code = text.match(/"1","([a-f0-9]{32})"/)[1];
  const context = await browser.newContext({
    viewport: info.project.use.viewport,
  });
  const student = await context.newPage();
  student.on("pageerror", (e) => errors.push(e.message));
  await student.goto("http://127.0.0.1:4180/");
  await student.getByRole("button", { name: "開始我的冒險" }).click();
  await student.getByLabel("班級", { exact: true }).fill(name);
  await student.getByLabel("座號", { exact: true }).fill("1");
  await student.getByLabel("個別入場碼", { exact: true }).fill(code);
  await student.getByRole("button", { name: "登入並開始冒險" }).click();
  await expect(student.locator(".prompt")).toBeVisible();
  expect(
    (
      await student.request.get("http://127.0.0.1:4180/api/admin/report")
    ).status(),
  ).toBe(401);
  let failedOnce = false;
  await student.route("**/api/student/stages/vocabulary", async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "測試短暫斷線" }),
      });
    } else await route.continue();
  });
  for (const answer of [0, 1, 2]) {
    await student.locator(`[data-answer="${answer}"]`).click();
    await student
      .getByRole("button", { name: "繼續探索", exact: false })
      .click();
  }
  await expect(student.locator("#cloud-state")).toContainText("尚未儲存");
  await student.getByRole("button", { name: "返回島嶼地圖" }).click();
  await student.getByRole("button", { name: "重試同步" }).click();
  await expect(student.locator("#cloud-state")).toContainText("已儲存 1 關");
  await student.getByRole("button", { name: "進入這座島嶼" }).click();
  for (const id of ["v1", "v2", "v3"]) {
    await student.locator(`[data-left="${id}"]`).click();
    await student.locator(`[data-right="${id}"]`).click();
  }
  await student.getByRole("button", { name: "領取獎勵" }).click();
  await expect(student.locator("#cloud-state")).toContainText("已儲存 2 關");
  await student.getByRole("button", { name: "返回島嶼地圖" }).click();
  for (const [index, answer] of [3, 1, 2].entries()) {
    await student.getByRole("button", { name: "進入這座島嶼" }).click();
    await student.locator(`[data-answer="${answer}"]`).click();
    await student.getByRole("button", { name: "繼續探索" }).click();
    await expect(student.locator("#cloud-state")).toContainText(
      `已儲存 ${index + 3} 關`,
    );
    await student.getByRole("button", { name: "返回島嶼地圖" }).click();
  }
  await student.reload();
  await expect(student.locator(".progress-caption")).toContainText("5 / 5");
  await student.getByRole("button", { name: "我的成績", exact: true }).click();
  await expect(student.locator("#modal-body")).toContainText("得分：90 / 90");
  await expect(student.locator("#modal-body")).toContainText("正確率：100%");
  await student.getByRole("button", { name: "關閉視窗" }).click();
  await student.getByRole("button", { name: "設定冒險家暱稱" }).click();
  await student.getByRole("button", { name: "登出並切換學生" }).click();
  expect(
    (
      await student.request.get("http://127.0.0.1:4180/api/student/me")
    ).status(),
  ).toBe(401);
  await context.close();
  await page.getByRole("button", { name: "重新整理", exact: true }).click();
  await page.locator("#class-filter").selectOption({ label: name });
  await expect(page.locator("#summary")).toContainText("50%");
  await expect(page.locator("#results")).toContainText("90 / 90");
  await expect(page.locator("#results")).toContainText("9 / 9");
  await expect(page.locator("#summary")).toContainText("平均分數 90");
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下載 CSV 成績" }).click();
  const csv = await csvPromise;
  expect(await readFile(await csv.path(), "utf8")).toContain(name);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: `artifacts/teacher-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "老師登入", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/report")).status()).toBe(401);
  expect(errors).toEqual([]);
});
test("student cannot open teacher data or publish bank", async ({ page }) => {
  await page.addInitScript(
    (bank) =>
      localStorage.setItem(
        "eai-v1",
        JSON.stringify({
          version: 1,
          nickname: "OtherPrivate",
          profiles: {
            OtherPrivate: {
              answers: { v1: true },
              completed: ["vocabulary"],
              updatedAt: 1,
            },
          },
          bank,
          sound: false,
        }),
      ),
    DEMO,
  );
  await page.goto("/");
  await expect(page.locator("#player-name")).toHaveText("冒險家");
  await expect(page.locator(".crystal-count b")).toHaveText("0");
  await page.goto("/teacher.html");
  await expect(page.getByRole("heading", { name: "老師登入" })).toBeVisible();
  expect(
    (
      await page.request.post("/api/admin/banks", {
        data: {},
        headers: { Origin: "http://127.0.0.1:4180" },
      })
    ).status(),
  ).toBe(401);
});

test("password setup derives locally without sending credentials", async ({
  page,
}) => {
  await page.goto("/teacher-password.html");
  const outgoing = [];
  page.on("request", (r) => {
    if (r.method() === "POST") outgoing.push(r.url());
  });
  await page
    .getByLabel("自訂密碼（至少 14 字元）")
    .fill("Only local password example 2026!");
  await page
    .getByLabel("再次輸入密碼")
    .fill("Only local password example 2026!");
  await page.getByRole("button", { name: "產生私密設定值" }).click();
  await expect(page.locator("#secret-value")).toHaveValue(
    /^pbkdf2-sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/,
  );
  expect(outgoing).toEqual([]);
  await expect(page.locator("#new-password")).toHaveValue("");
  await page.getByRole("button", { name: "清除本頁私密設定值" }).click();
  await expect(page.locator("#secret-value")).toHaveValue("");
});
