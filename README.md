# English Adventure Island · 英語冒險島

面向國中生的奇幻島嶼英語遊戲第一版。使用原創 SVG 島嶼、卡通狐狸 Lumi、Web Audio 音樂與音效，不需帳號或付費素材。首次載入即有原創示範題，不需要後端。

## Windows 直接試玩（推薦）

解壓縮專案 ZIP 後，直接用 Edge／Chrome 開啟根目錄 `English-Adventure-Island.html`，或雙擊 `START-GAME.bat`。**不用安裝 Node.js、不用 Token，也不會公開部署。** 詳見 [Windows 操作說明](docs/WINDOWS.md)。要修改原始碼時才使用下面的開發流程。修改後以 `npm run build:portable` 重建單檔版。

## 啟動與建置

需要 Node.js 22.12 以上（本次驗證版本 24.19.0）。

```bash
npm ci --cache /tmp/english-island-npm
npm run dev
```

終端機會顯示開發伺服器位置。在自己的開發電腦可透過該位置操作；雲端環境是否提供網頁存取，依所用平台而定。

```bash
npm test
npm run build
npm run preview
```

瀏覽器測試：有系統 Chromium 時使用 `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`；其他環境先執行 `npx playwright install chromium`，再執行 `npm run test:e2e`。下載需要允許 `cdn.playwright.dev` 及其重新導向目的地；本環境使用已安裝的 Chromium，沒有關閉驗證。

## 學生操作

1. 右上角點暱稱，輸入 1–16 字暱稱。請勿輸入真實姓名等個人資料；共用裝置可換暱稱，各自保存進度。
2. 點「開始我的冒險」，或選擇地圖上已解鎖的地標，再點「進入這座島嶼」。狐狸會跟著地標移動。
3. 依序完成晨光森林（單字）、星語溪谷（配對）、月影遺跡（文法）、天空樹屋（閱讀）、水晶之巔（聽力）。缺少題目的關卡會跳過。
4. 四選一每題首次答對獲得題目設定的水晶；答錯顯示繁體中文解析，可重試但不補分。所有題目作答後即可完成該關，不要求全部答對。配對可反覆嘗試，全部完成首次領取每組 10 水晶。
5. 聲音預設關閉，點「聲音關閉」開啟背景音樂及答題音效。聽力題有獨立播放按鈕；靜音背景不會禁止主動播放聽力題。播放聽力時背景音樂暫停。
6. 聽力示範使用裝置英文語音；若無英文語音，會提示查看逐字稿。教師可改用音檔。練習模式允許查看逐字稿，不是封閉測驗模式。
7. 關閉題目視窗可回到地圖，已作答內容會保存。點排行榜查看此裝置紀錄；同分依較早更新時間排序。暱稱視窗可確認後重設自己的進度。
8. 完成關卡或開啟排行榜可匯出成績 JSON。進度存於此瀏覽器，不會跨裝置同步，清除網站資料會遺失；無法儲存時以提示告知並改為暫存。

## 教師匯入題庫

從「題庫工坊」下載 JSON／CSV 範本，編輯後上傳，確認預覽才套用。匯入錯誤會保留原題庫。套用新題庫或還原示範題均需確認，且清除這台裝置所有暱稱的舊進度。

- 最多 200 題、1 MB；JSON 頂層為 `{"version":1,"questions":[...]}`。
- `id`：不重複字串；`type`：`vocabulary`、`grammar`、`reading`、`listening`。
- `prompt`：題目（最多 3000 字）；`choices`：四個不重複非空選項；`answerIndex`：從 0 起算，介於 0–3；`explanation`：必填繁中解析（最多 5000 字）；`points`：0–100。
- CSV 使用 UTF-8，允許 BOM、引號、逗號、換行與雙引號跳脫。選項為 `choiceA` 到 `choiceD`。其餘欄位見範本。
- 閱讀題另填 `passage`。聽力題填 `speech`（英文語音合成）或 `audioUrl`（HTTPS／以單一 `/` 開頭的同站音檔路徑），優先播放音檔。音檔必須在實際裝置可載入；載入失敗會顯示提示。
- 配對活動從單字題的選配欄位 `word`、`meaning` 取得，至少兩組、不重複，上限四組；重複單字或中文義只保留第一組。示範題有三組。
- 所有匯入文字以純文字呈現，不執行 HTML。上傳後先查看題目預覽與可配對數量。全題庫沒有任何配對資料時，配對關會略過。

JSON 範本：[public/templates/questions.json](public/templates/questions.json)。CSV 範本：[public/templates/questions.csv](public/templates/questions.csv)。

## Google Apps Script 預留介面

第一版只做本機練習與匯出，不自動傳送學生資料。`src/core.js` 提供 `makeSubmission` 與 `submitResult`，後者以 mock 驗證成功、拒絕、逾時及無法確認的回應；尚未接上真實 Apps Script。

未來後端契約與設定步驟見 [docs/INTEGRATION.md](docs/INTEGRATION.md)。前端成績可被修改，不能當成具防作弊保證的正式測驗紀錄。

## Cloudflare Pages（未來選配，目前不使用）

1. 將這份程式提交到自己的 GitHub 分支並審查後，在 Cloudflare Pages 建立專案，連接該儲存庫。
2. 使用 Node.js 24，建置命令 `npm run build`，輸出目錄 `dist`，專案根目錄為儲存庫根目錄。
3. 或本機建置後，直接上傳 `dist`。此版為單頁靜態前端，不需要密鑰、資料庫或 Functions，無深層路由。
4. 部署後測試首頁、全部關卡、JSON／CSV 下載與匯入、重新整理保存、音訊及行動裝置。不要把本機成功當成部署驗證。
5. 更新使用新提交觸發建置；回復使用 Cloudflare 部署紀錄中先前成功版本。題庫保存在瀏覽器，改程式不會自動覆蓋學生已匯入的題庫；可在工坊還原示範題。

目前未部署到 Cloudflare，未建立公開網址。

## 測試、授權與第一版範圍

詳見 [docs/TESTING.md](docs/TESTING.md)、[docs/ASSETS.md](docs/ASSETS.md)。第一版沒有自由行走碰撞、教師登入、正式測驗模式、共享排行榜、跨裝置帳號或真實成績回傳。探索採地圖點選，角色會移動到地標；重點是可操作的完整練習循環。

實際畫面檢查與公開預覽部署步驟見 [docs/PREVIEW.md](docs/PREVIEW.md)。
