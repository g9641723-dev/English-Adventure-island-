# 桌面版 Codex 接手說明

## 先讀這裡

使用者希望把 English Adventure Island 的後續工作移至自己的 Windows 電腦與桌面版 Codex。先保留既有遊戲與已建立的 Cloudflare 資源，協助本機執行，再依使用者的新指示繼續。不要重新走一次建立資料庫／Worker 的流程。

此文件是工作摘要，不會自動帶入原對話或轉移雲端登入權限。ZIP 內沒有 Git 歷史、Token、學生成績或瀏覽器登入狀態。

## 專案來源與已完成內容

- GitHub：`https://github.com/g9641723-dev/English-Adventure-island-`
- 正式程式分支：`feature/cloudflare-classroom`。打包時基底提交：`4a73412`。
- 下載與接手文件分支：`desktop-codex-handoff`，不要把此分支當成正式環境設定。
- `.agents/skills/english-game-builder/SKILL.md` 已存在；實作遊戲前先讀取。
- 遊戲包含奇幻島嶼、狐狸 Lumi、動畫、聲音，以及單字、配對、文法、閱讀與聽力五區。
- 支援 JSON／CSV 題庫、本機進度與正式班級作答。完整原始碼在 `src/`。
- Windows 免安裝試玩：用 Edge／Chrome 開啟根目錄 `English-Adventure-Island.html`，或雙擊 `START-GAME.bat`。單檔版不需要 Node.js，也不回傳雲端成績。
- 要修改原始碼才需要 Node.js 24 LTS；解壓縮後於專案根目錄執行 `npm ci`，再執行 `npm run dev -- --host 127.0.0.1 --open`。

## Cloudflare 現況（需自行確認即時狀態）

- 學生正式網址：`https://english-adventure-island-3ip.pages.dev/`
- 老師頁：`https://english-adventure-island-3ip.pages.dev/teacher.html`
- Pages 專案：`english-adventure-island`；Production branch 為 `feature/cloudflare-classroom`；Build command 為 `npm run build:cloud`，輸出 `dist`。
- API Worker：`english-island-api`，使用 `worker/wrangler.jsonc`；已由使用者透過 GitHub 連接部署成功，對外無 workers.dev 路由是預期設計。
- Pages 根目錄 `wrangler.jsonc` 透過名為 `BACKEND` 的 Service Binding 呼叫 API Worker；兩份設定檔不可混淆。
- D1 名稱：`english-island-results`；ID：`87103fb7-ffae-4214-9b80-bef003bfc7e9`（此 ID 不是憑證）。
- 使用者已在 D1 Console 手動建立七張表與索引，並匯入 `demo-v1` 六題示範題。**不要對遠端重跑原始非冪等 CREATE TABLE migration**；若需 Wrangler migration 管理，先讀取實際結構與 migration 紀錄再決定如何基線化。
- 老師允許 Email：`g9641723@gmail.com`。原先學校 Email 已被替換。
- `ACCESS_TEAM_DOMAIN` 與 `ACCESS_AUD` 在 Worker 設定仍是待填範例；Cloudflare Access 真實老師登入尚未完成驗證。老師頁存在不代表老師已能登入建班。
- 最近確認首頁與 `/api/status` HTTP 200；未登入的學生／老師 API 都回 401，沒有測試真實遠端學生成績寫入。
- 正式學生入口需要班級、座號、個別入場碼。使用者希望學生能直接玩，已討論「免登入試玩＋班級作答」雙入口，但**線上免登入入口尚未實作**。先確認使用者是否要繼續此項；不要宣稱它已存在。根目錄單檔 HTML 可先免登入試玩。
- 另有一個同名 `english-adventure-island` 失敗 Worker，與 Pages 不是同一個項目。不要自行刪除；不要把它當成已成功的 API Worker。

## 授權與部署注意

- 使用者曾選擇自己私下處理 Cloudflare 設定，未提供本機 API Token。GitHub 授權給 Cloudflare 不會讓 Codex 自動取得 Cloudflare 帳戶操作權。
- 不要索取聊天中的密碼、Token 或 Email 驗證碼。必要時由使用者在自己電腦安全登入 Wrangler，或以安全的環境設定提供最小權限憑證。
- 僅使用 Free 方案，不啟用付費訂閱或帳單變更。
- 儲存庫已與 Cloudflare 自動建置連接。**推送正式分支可能立即觸發 Worker 與 Pages 部署**；先完成本機驗證並確認本次工作的部署授權。
- `scripts/deploy-cloudflare.mjs` 原本供新環境自動建立資源。現有資源是使用者在控制台手動建立，沒有可假定存在的 `.cloudflare/deployment.json`；不要直接執行此腳本而建立重複資源。
- `tests/fixtures/access-worker.js` 只用於本機測試，不能部署成正式 Worker 或用來繞過老師登入。
- 不使用 Google Apps Script、Google 試算表或其他第三方成績服務。

## 驗證與建置

```text
npm ci
npm test
npm run build
npm run build:cloud
npm run build:portable
```

三種 build 用途不同：`build` 是本機練習前端，`build:cloud` 啟用需要班級登入的正式模式，`build:portable` 更新根目錄可雙擊的完整 HTML。`dist/index.html` 是網站產物，不應直接雙擊作為 Windows 免安裝入口。

歷史通過：20 項資料／D1／權限／部署工具測試、6 項跨尺寸雲端整合測試、9 項本機遊戲回歸測試、3 項單檔版瀏覽器情境。這些主要在 Linux Chromium 與本機 workerd/D1 執行；真實 Cloudflare Access OTP、Windows／iOS 實機與完整雲端成績流程尚未驗證。不要把歷史測試當成新修改已通過。

瀏覽器測試先執行 `npx playwright install chromium`，再使用 `npm run test:e2e` 或 `npm run test:cloud`。有系統 Chromium 的 Linux 環境可指定 `CHROMIUM_PATH=/usr/bin/chromium`。不關閉 TLS 驗證或瀏覽器安全防護來讓測試通過。

其他文件：`docs/CLOUDFLARE.md`、`docs/INTEGRATION.md`、`docs/WINDOWS.md`、`docs/TESTING.md`。

## 給桌面版 Codex 的第一則訊息範本

> 請先讀 HANDOFF.md 和 .agents/skills/english-game-builder/SKILL.md，檢查這個專案並在我的電腦啟動本機遊戲。保留既有玩法與 Cloudflare 資源，不重新建立 D1，不啟用付費，不公開部署。先告訴我本機啟動結果與目前仍待完成的項目；任何新部署都先依我的最新指示處理。
