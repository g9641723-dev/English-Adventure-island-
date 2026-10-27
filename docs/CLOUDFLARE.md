# Cloudflare 免費方案部署與操作

## 已部署系統：不必開通 Zero Trust

目前使用者已透過 GitHub 連接部署 Pages 與私有 Worker，並手動初始化 D1。請保留這些資源；老師登入改為 Email＋自訂密碼，不需要 Access、Zero Trust 或綁付款方式。按 [TEACHER_LOGIN.md](TEACHER_LOGIN.md) 在自己的瀏覽器產生私密設定值，安全填入現有 Worker 的 `TEACHER_PASSWORD_HASH` Secret 即可。

- Pages：`english-adventure-island`，網址 `https://english-adventure-island-3ip.pages.dev/`。
- API Worker：`english-island-api`，Git 部署命令 `npx wrangler deploy --config worker/wrangler.jsonc`。
- D1：`english-island-results`。不得重建或清空；既有七張表與示範題已建立。
- 老師 Email：`g9641723@gmail.com`。
- 不要在前端、GitHub 建置變數或聊天中存放密碼／雜湊；應選後端 Worker 的 Secret 型別。Wrangler 更新部署不會自動刪除既有 Secret。

## 新環境的自動部署（目前既有帳戶不必執行）

`scripts/deploy-cloudflare.mjs` 只供另建新環境使用。既有資源由使用者手動建立、沒有可假定的部署 receipt，不要直接重跑此工具而建立重複網站或資料庫。

新環境需自行確認 Workers／D1 使用 Free，並安全提供帳戶 ID 與僅限該帳戶的 Pages Edit、Workers Scripts Edit、D1 Edit Token；不需要 Access 權限或 Zero Trust 團隊。Token 只透過安全環境設定提供，不貼在聊天。

```bash
npm ci
npm run deploy:cloud -- --check
npm run deploy:cloud -- --free-plan-confirmed
```

工具建立 Pages、私有 Worker Service Binding 及 D1，執行 migration 與前端建置，確認首頁 API 正常及未登入的管理 API 拒絕存取；不生成或公開老師密碼。部署後仍須私下設定 Secret 並真實登入驗收，才能宣稱老師功能已可用。工具不呼叫 Access、帳單或方案升級 API；同名且不屬於本次 receipt 的資源會停止，不自動覆蓋。

## 本機驗證

```bash
npm test
npm run build:cloud
CHROMIUM_PATH=/usr/bin/chromium npm run test:cloud
```

其他電腦先 `npx playwright install chromium` 再省略 CHROMIUM_PATH。整合測試使用真實 workerd／本機 D1 與完整密碼登入，沒有 JWT 注入、測試登入繞過或外部驗證服務。測試密碼只用於本機 fixture，不可設定到正式 Worker。

## 免費額度

Pages 靜態資源不進入 API Worker；只有 `/api/*` 透過 Pages Functions 與私有 Worker。保持原有免費方案，監看實際 Requests／CPU、D1 讀寫與儲存、Pages 建置用量。密碼驗證也消耗運算，正式帳戶需實測；超額或效能失敗時不得自動升級付費。

## GitHub 連接後的 Worker 建置設定

使用 Cloudflare 控制台的 GitHub 連接時，可由使用者在控制台自行授權，不需要把 API Token 提供給代理。既有 `english-island-api` Worker 的 Production branch 必須選 `feature/cloudflare-classroom`，此分支包含根目錄的 package.json 與 package-lock.json。

- Root directory／Path：`/`。
- Build command：`npm ci`。
- Deploy command：`npx wrangler deploy --config worker/wrangler.jsonc`。
- 若介面要求 Preview command：`npx wrangler versions upload --config worker/wrangler.jsonc`；正式版本仍由 Deploy command 發布。
- Build cache 可保持開啟或關閉，不會修復錯誤的來源分支。
- 若控制台沒有 Save 按鈕，切到其他頁再返回確認 Production branch 是否仍是指定值；不要只因畫面沒有按鈕就重建專案。
- 新提交推送後，到 Builds／Deployments 確認新紀錄的分支為 `feature/cloudflare-classroom`，不重試舊的 main 建置。

這一步只部署後端。老師密碼 Secret 設定、Pages 前端及公開網址驗證仍須接續完成；不能把後端建置成功當成整套系統已上線。


### 同一個儲存庫的 Pages／Worker 名稱提醒

根目錄的 `wrangler.jsonc` 屬於 Pages（`english-adventure-island`）；`worker/wrangler.jsonc` 屬於後端（`english-island-api`）。Workers Builds 可能依根目錄設定顯示名稱不一致提醒；不要只為消除此提醒把 Pages 的名稱改成 Worker 名稱。後端部署必須使用明確的 `--config worker/wrangler.jsonc`。

排查時以新建置的分支與提交為準。舊的 `main · Manually deployed` 紀錄即使重試仍缺少 package-lock.json；推送正確分支後，應在新的觸發紀錄中檢查分支為 `feature/cloudflare-classroom`，若沒有新紀錄則再檢查 Git 建置連線與觸發狀態。


### 既有 Pages 專案的建置設定

在 Pages 的 Settings → Build configuration 設定 Build command 為 `npm run build:cloud`、Build output directory 為 `dist`，Root directory 保持預設；Production branch 使用 `feature/cloudflare-classroom`。若建置命令與輸出目錄空白，並不會自動產生本遊戲需要的 dist 產物。

保存設定後，推送新的分支提交或對正確分支的既有紀錄執行 Retry deployment，再觀察新建置；設定保存不會把先前的失敗紀錄變成成功。成功前，Production 可能顯示 No production deployment yet。若再次失敗，以該筆 Details 中的實際錯誤診斷，不重建資料庫或改動已成功的私有 API Worker。

## 學生簡易登入

目前 `worker/wrangler.jsonc` 宣告 `STUDENT_LOGIN_MODE=class-seat`，Git 部署後學生只需班級＋座號。既有 D1 不需 migration、班級不需重建、老師 Secret 不需更動。此設定是使用者已選擇的練習模式，無法防冒用座號；若要恢復入場碼，維護者可改為 entry-code 後部署，教師頁會重新提供發碼工具。未設定或不認得的模式預設維持入場碼驗證，前端不能自行降低驗證要求。
