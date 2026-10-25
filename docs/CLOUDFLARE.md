# Cloudflare 免費方案部署與操作

## 目前狀態

程式、D1 migration、Pages Function、Worker 設定與部署工具已建立；真實部署須先取得 Cloudflare 帳戶授權。沒有憑證時不會建立遠端資源，也沒有可宣稱已上線的網址。既有 Windows 單檔版仍可用於本機練習，但不會回傳雲端成績。

## 授權前確認

1. 登入 Cloudflare，確認使用的帳戶及 Workers／D1 為 Free，不要選擇升級 Workers Paid 或購買方案。
2. 建立 Zero Trust 團隊，選 **Free** 方案；老師帳號只有已允許的老師，學生不使用 Access 帳號。若介面要求選方案或付款，先確認頁面實際選的是 Free，不授權任何升級。
3. 在 Zero Trust 的 Authentication／Login methods 啟用 **One-time PIN**（Email 一次性驗證碼）。老師允許名單目前為 `g9641723@gmail.com`。
4. 在使用者 Cloudflare Profile → API Tokens 建立僅限該帳戶的 Token。部署需要 Pages Edit、Workers Scripts Edit、D1 Edit、Access Apps and Policies Edit，以及讀取 Access Organization／Identity Providers 的權限。Cloudflare 當前權限名稱若有變化，依該介面相應項目選擇，不加入帳單或方案修改權限。
5. 將 Token 安全填到本雲端環境設定的 `CLOUDFLARE_API_TOKEN`，非機密帳戶 ID 填到 `CLOUDFLARE_ACCOUNT_ID`。不要將 Token 貼在聊天、Git 或前端程式。設定已存在時直接沿用，不重複建立。
6. 審查、儲存環境設定並依介面要求發布／套用；回到任務讓代理重新確認設定是否已注入。

Cloudflare 免費額度、Access 使用者上限及 API 權限可能調整，正式啟用時需以控制台與官方當前文件為準。部署工具不呼叫帳單或訂閱修改 API，也不會自動切換付費方案。若帳戶本身已在付費方案，部署前先處理，不以程式替使用者改訂閱。

## 部署命令

```bash
npm ci
npm run deploy:cloud -- --check
npm run deploy:cloud -- --free-plan-confirmed
```

`--check` 只檢查設定名稱及是否存在，不印出 Token 或建立資源。只有在實際確認帳戶使用 Free 後才使用 `--free-plan-confirmed`。

部署工具會：

1. 確認 Zero Trust 組織及 One-time PIN 可用；缺少時在建立網站／資料庫前停止。
2. 建立帳戶專屬名稱的 Pages 專案及 D1；遇到不屬於本次部署紀錄的同名資源會停止，避免覆蓋其他網站。
3. 建立 Access 應用保護正式 Pages 網域的 `/teacher.html` 與 `/api/admin/*`，只允許指定老師 Email；Worker 仍驗證 JWT。
4. 寫出只包含非機密綁定資訊的 `.cloudflare/worker.json`、`.cloudflare/pages.json`，執行遠端 D1 migration，部署私有 Worker、建置雲端前端，部署 Pages。
5. 檢查正式 `/api/status`，並確認未登入老師頁會被 Access 攔截；未通過不宣稱就緒。需由老師本人再完成 OTP 真實登入驗收。
6. 將實際學生／老師網址與資源 ID 存到忽略 Git 的 `.cloudflare/deployment.json`。此檔不包含 Token，保留以便重跑部署及避免資源誤認。不要猜測網址。

可以以 `CF_PAGES_PROJECT` 指定其他新專案名稱；既有部署紀錄不應任意更換名稱或帳戶。部署中途失敗會保留已建立的資源及紀錄，診斷權限或設定後可續跑，不會自動刪除使用者資源。Access 邊緣設定可能稍後才生效；若保護檢查未通過，先排查設定，不要把網址發給學生當作完成。

## 老師操作

1. 開啟實際老師網址，以允許的 Email 收驗證碼登入。學生端不要使用老師的登入裝置或瀏覽器設定檔。
2. 預設原有示範題已發布；也可上傳 JSON／CSV 題庫，檢查首題預覽後發布為新版本。
3. 建立班級，指定題庫及 1–100 位學生，名冊依 1 到 N 座號建立；立即下載入場碼 CSV，個別發放對應入場碼。
4. 學生開遊戲網址輸入班級、座號與入場碼，即可沿用原有五區玩法。每關完成自動儲存。
5. 在管理頁篩選班級、查看平均分數、完成率、名冊成績與排行榜，下載成績 CSV。CSV 含未開始學生，時間為台灣時間。
6. 入場碼遺失時用重設功能，舊碼與舊登入立即失效；只個別轉交新碼，不公開班級完整碼表。

## 本機開發與驗證

```bash
npm test
npm run test:worker
node --test tests/deploy.test.js
npm run build:cloud
CHROMIUM_PATH=/usr/bin/chromium npm run test:cloud
```

其他電腦先 `npx playwright install chromium`，再省略 `CHROMIUM_PATH`。雲端整合測試啟動本機 Pages 靜態頁、真實 workerd 與本機 D1，測試專用簽章模擬 Access JWT；只存在於 `tests/fixtures/`，不部署任何登入繞過。真實 Email OTP、遠端 D1 寫入及公開網址只在授權後才能驗證。

日常本機遊戲使用 `npm run dev`。獨立後端可用 `npm run worker:dev`，其設定檔的範例 D1 ID、Access 值只代表待設定，不是已連線。完整本機雲端流程優先用測試 fixture；禁止把測試 JWT fixture 當成正式 Worker。

## 免費額度與維護

Pages 靜態資源由 Pages 提供；只有 `/api/*` 進入 Functions 及 Worker，減少不必要呼叫。D1 採索引、SQL 綁定、關卡一次提交與去重，沒有即時輪詢或第三方分析服務。老師手動刷新才查詢成績；免費額度耗盡可能導致服務暫停或失敗，此時保留待同步提示，不自動付費升級。

正式上線後請在 Cloudflare 控制台監看 Workers Requests／CPU、D1 儲存及讀寫額度、Access 老師用戶數和 Pages 建置次數。服務使用兩層 Worker（Pages Function＋私有 API Worker），API 成本不只是一個入口呼叫。首次實班先以小班測試，再依實際用量評估。


## GitHub 連接後的 Worker 建置設定

使用 Cloudflare 控制台的 GitHub 連接時，可由使用者在控制台自行授權，不需要把 API Token 提供給代理。既有 `english-island-api` Worker 的 Production branch 必須選 `feature/cloudflare-classroom`，此分支包含根目錄的 package.json 與 package-lock.json。

- Root directory／Path：`/`。
- Build command：`npm ci`。
- Deploy command：`npx wrangler deploy --config worker/wrangler.jsonc`。
- 若介面要求 Preview command：`npx wrangler versions upload --config worker/wrangler.jsonc`；正式版本仍由 Deploy command 發布。
- Build cache 可保持開啟或關閉，不會修復錯誤的來源分支。
- 若控制台沒有 Save 按鈕，切到其他頁再返回確認 Production branch 是否仍是指定值；不要只因畫面沒有按鈕就重建專案。
- 新提交推送後，到 Builds／Deployments 確認新紀錄的分支為 `feature/cloudflare-classroom`，不重試舊的 main 建置。

這一步只部署後端。老師 Access 設定、Pages 前端及公開網址驗證仍須接續完成；不能把後端建置成功當成整套系統已上線。
