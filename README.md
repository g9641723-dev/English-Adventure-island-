# English Adventure Island · 英語冒險島

國中生奇幻島嶼英文遊戲：保留原創浮空島、狐狸 Lumi、動畫與聲音，以及單字、配對、文法、閱讀、聽力五區玩法。

目前新增 Cloudflare 全套成績架構：**Pages 遊戲＋Workers API＋D1 成績＋Access 老師登入**。不使用 Google Apps Script 或 Google 試算表。程式與本機驗證已完成；公開部署仍需使用者帳戶授權，沒有上線前不提供猜測網址。

## 學生與老師

- 學生開始前輸入班級、座號及老師發的個別入場碼，不需真實姓名。
- 每關完成自動送出首次作答，後端計分、保存正確率與伺服器時間。斷線清楚顯示待同步，支援重試，重送不重複加分。
- 老師以 `g9641723@gmail.com` 的 Access Email 驗證碼登入，可建班／發碼、發布題庫、查看班級成績／排行榜／平均分數／完成率及匯出 CSV。
- 學生只能讀寫自己的紀錄；老師 API 驗證 JWT，不依賴前端隱藏功能。

詳細操作與部署見 [Cloudflare 設定指南](docs/CLOUDFLARE.md)，資料及權限定義見 [成績系統設計](docs/INTEGRATION.md)。

## 開發與測試

需要 Node.js 24 LTS 與 npm。

```bash
npm ci
npm run dev
npm test
npm run test:worker
node --test tests/deploy.test.js
npm run build:cloud
npm run test:cloud
```

瀏覽器測試需先 `npx playwright install chromium`；已有系統 Chromium 的雲端環境使用 `CHROMIUM_PATH=/usr/bin/chromium npm run test:cloud`。`npm run build:cloud` 啟用正式成績模式並產生學生與老師兩個頁面；`npm run build` 是本機練習模式。Access 及後端失效時，正式模式不會偷偷改成本機模式並宣稱已儲存。

授權後使用 `npm run deploy:cloud -- --free-plan-confirmed`；部署工具不啟用付費方案，不寫入 Token 至檔案。設定草稿保存不代表已授權、已套用或已上線。

## 題庫與計分

JSON／CSV 範本位於 `public/templates/`。題庫最多 200 題、1 MB，需四個非空、不重複選項與繁體中文解析；`answerIndex` 從 0 起算。閱讀需 `passage`，聽力需 `speech` 或合法 HTTPS／同站 `audioUrl`。配對來自單字題的 `word`、`meaning`，至少兩組、上限四組。

正式雲端題庫只能由老師發布，班級各自綁定不可變版本，學生不能以自訂題庫改寫官方成績。選擇題首次答對才加分；配對全部完成首次領取獎勵。正確率與完成率定義見設計文件。系統是練習用途，不保證正式考試防作弊。

## Windows 本機版仍保留

`English-Adventure-Island.html` 可直接由 Edge／Chrome 開啟；`START-GAME.bat` 也能啟動。此版完全是本機練習，不回傳成績。修改原始碼後用 `npm run build:portable` 更新，詳見 [Windows 說明](docs/WINDOWS.md)。

先前 `exports/` 的 ZIP 是舊本機版快照，不代表這次已部署的雲端系統。新版本應從目前分支的完整原始碼與文件審查，正式網址必須待真實部署成功後才產生。

## 文件

- [測試流程與結果](docs/TESTING.md)
- [遊戲規劃](docs/PLAN.md)
- [素材來源](docs/ASSETS.md)：場景、角色、動畫及合成音樂為本專案原創；沒有外部素材下載依賴。
