# 測試流程與實際結果

## 初版本機遊戲驗證（歷史紀錄）

- Node.js 24.19.0、Vite 7.3.7、系統 Chromium、Playwright。
- `npm test`：7 項通過，0 失敗、0 跳過。涵蓋題庫驗證、CSV 特殊字元、錯誤資料、大小限制、首次計分、儲存損毀及成績回傳 mock 契約。
- `npm run build`：成功產出 `dist`。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`：9 項通過，0 失敗、0 跳過。
- 瀏覽器測試在正式建置產物上執行。桌面 1440×1000、平板 768×1024、手機 360×800，各跑三項流程：完整闖關與進度保存；題庫匯入與暱稱／聲音；響應式地圖與鎖定／鍵盤／減少動畫。
- 完整流程包含首次答錯、繁中解析、重試不加分、配對答錯與完成、文法／閱讀／聽力、最終分數與重新整理保存。匯入測試包含無效 JSON 保留原題庫、有效 JSON 套用及 CSV 預覽；內容以純文字呈現。
- 已檢視自動產生的桌面與手機全頁截圖。截圖與執行輸出位於忽略追蹤的 `test-results/`。

## 教師人工驗收

1. 執行 README 的安裝與啟動步驟，確認首頁場景、五個地標與狐狸顯示。
2. 輸入暱稱，開啟聲音，實際聽背景音樂與答題音效；關閉聲音並重新載入，確認偏好保留。不同裝置音量與自動播放限制需實機確認。
3. 開始冒險，選錯一題，閱讀解析後重試。確認錯題第一次不加分，重試也不加分；首次答對才加分。
4. 在配對關先選錯，查看中英解釋；完成全部配對，領取一次獎勵。重新練習不得再加分。
5. 完成所有關卡；聽力音訊可重播與查看逐字稿。無英文語音的裝置應顯示替代提示。教師另匯入合法音檔並驗證失敗提示與實際播放。
6. 重新整理確認保存；換暱稱確認進度隔離；重設時取消確認應保留資料，再確認清除。
7. 工坊下載範本，分別上傳 JSON、CSV；先預覽再套用。上傳答案越界、重複 ID、缺少文章或損毀 JSON，應顯示錯誤且舊題庫不變。
8. 在手機直橫向、平板與桌面操作全部按鈕、選項及上傳。以鍵盤 Tab／Enter／Escape 操作，開啟系統減少動畫偏好。確認無關鍵介面被裁切。
9. 匯出成績並檢查 nickname、score、maxScore、answers。確認沒有宣稱遠端同步成功。
10. 部署後再跑以上核心流程，並從新裝置確認首頁、素材及範本可讀。

## 已知驗證限制

測試使用 Chromium 模擬視窗及觸控，未使用實體手機或平板，也未測 iOS Safari／Firefox。自動化可確認音訊操作與提示，不等同人工聽感檢查。語音可用性依裝置而異。無 Google Apps Script 真實端點，未做試算表寫入、去重、CORS 或併發端到端驗證；成績回傳只有 mock 契約測試。未部署至 Cloudflare。完整無障礙稽核、自由移動與正式測驗防作弊不在第一版範圍。

## Windows 單檔版新增驗證

`npm run build:portable` 產生完整內嵌程式、場景、聲音與題庫範本的 `English-Adventure-Island.html`。`CHROMIUM_PATH=/usr/bin/chromium node scripts/test-portable.mjs` 在桌面、平板、手機三種尺寸全部通過五區闖關、90 分計分、保存、範本下載與 CSV 套用。測試不使用 Vite、不載入原始模組或外部資源；以 localhost 提供同一份 HTML。本環境政策阻擋 file://，Windows 實機雙擊開啟尚未驗證。

`scripts/package-windows.py` 將完整原始碼、單檔、Windows 啟動批次檔、說明與 dist 打包，驗證 ZIP CRC、項目唯一性及 HTML 位元組一致；排除 Git 歷史、開發依賴與憑證檔。


## 目前 Cloudflare 課堂版驗證

- `npm ci --cache /tmp/english-island-npm --no-audit --no-fund`：以 lockfile 安裝成功。
- `npm test`：20 項通過、0 失敗、0 跳過。涵蓋原題庫／計分、真實 workerd＋本機 D1、JWT 簽章與 audience／expiry／Email 允許名單、學生隔離、限流、CSRF、去重、配對統計、CSV 公式防護，以及部署工具的 mock API／Free 確認／順序與失敗處理。
- `npm run build:cloud`：成功產生學生頁與老師頁；`wrangler pages functions build` 成功；`wrangler deploy --dry-run --config worker/wrangler.jsonc` 成功（雲端環境以可寫入的 XDG_CONFIG_HOME 啟動）。dry-run 沒有建立遠端服務。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:cloud`：6 項通過、0 失敗、0 跳過。桌面、平板、手機各驗證完整師生流程與學生禁止查閱老師資料。
- 完整流程包含老師建班／下載個別入場碼、學生登入、五區作答、後端 90 分、第一次提交短暫失敗的待同步提示及手動重試、重載後官方進度、老師平均分數／50% 完成率／CSV，以及學生登出失效。
- `npm run build` 後既有 `npm run test:e2e`：9 項通過，原有畫面、解析、配對、匯入及跨尺寸操作保留。
- 重建 Windows 單檔版後，`scripts/test-portable.mjs` 三種尺寸全部通過，最後已恢復 `dist` 為 cloud mode 產物。
- 老師頁截圖位於忽略 Git 的 `artifacts/teacher-desktop.png`、`teacher-tablet.png`、`teacher-mobile.png`；使用虛構測試班級，不包含真實學生資料。

Cloudflare Access 的 JWT 使用本機測試專用產生的簽章及公鑰驗證；測試 fixture 不會部署。尚未驗證老師真實 Email OTP、遠端 D1、Access 邊緣政策、公開網址或 Cloudflare 實際免費用量。這些需要使用者授權並確認 Free 方案後執行。沒有 Windows／iOS 實機測試，也不宣稱正式考試防作弊。


## 不綁卡老師帳密登入版本

本次移除 Access／JWT 認證依賴，改測真實 PBKDF2 密碼驗證、Email 允許名單、D1 伺服器 Session、登出／到期／憑證版本失效、猜密碼限流與學生隔離。密碼產生頁只在瀏覽器計算，測試確認沒有送出 POST，也不保存原始密碼。新 schema 只新增 teacher_sessions 表與索引，不改既有班級或成績。實際測試結果見本次交付；先前 Access 測試為歷史紀錄，不能作為新版登入已驗證的證據。

最新驗證結果：`npm test` 24 項通過；`npm run build:cloud` 三個 HTML 入口成功；`npm run test:cloud` 9 項跨尺寸情境通過，含真正密碼登入／建班／五關／CSV／登出，以及私密設定值在本機產生且沒有 POST。尚未使用使用者真正的老師 Secret 做線上登入，需由使用者私下設定後驗收。

## 班級＋座號簡易登入版本

26 項 `npm test` 通過，包含簡易模式不需碼、既有進度／run ID 保留、無效班級或座號拒絕、學生仍不能讀取老師管理資料，以及 client 不能靠參數關閉伺服器的入場碼模式。9 項跨尺寸 `test:cloud` 通過；完整師生流程改用無碼登入、老師下載名冊，仍測五關／存分重試／CSV／老師與學生登出。建置成功，無需修改既有 D1 schema。此模式不驗證座號本人，不宣稱防止冒用。
