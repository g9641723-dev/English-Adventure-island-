# Windows 最簡單預覽方式

## 直接玩：不必安裝 Node.js

需要 Windows 10／11 與新版 Microsoft Edge 或 Google Chrome。Edge 通常已隨 Windows 安裝。沒有公開部署，也不需要 Cloudflare、API Token、帳號或伺服器。

1. 下載 `English-Adventure-Island-Windows.zip`。
2. 在檔案總管對 ZIP 按右鍵，選「全部解壓縮」。不要直接在壓縮檔預覽中執行。
3. 進入解壓縮後的 `English-Adventure-Island` 資料夾。
4. 雙擊 `English-Adventure-Island.html`，選擇 Edge 或 Chrome 開啟；也可雙擊 `START-GAME.bat`，由預設瀏覽器開啟同一檔案。
5. 點「開始我的冒險」。聲音預設關閉，可手動開啟。題庫工坊可直接下載內嵌的 JSON／CSV 範本，再匯入自訂題目。

這份 HTML 已包含程式、樣式、SVG 場景、角色、合成音樂、音效與示範題庫；不用下載第三方素材。聽力示範的英文語音依 Windows／瀏覽器是否提供可用語音而定，部分語音服務可能需要網路。沒有語音時可看逐字稿；教師匯入遠端音檔時也需要網路。

### 常見問題

- 看到程式文字：在 HTML 檔按右鍵 →「開啟檔案」→ 選 Edge 或 Chrome，不要用記事本。
- 沒有聲音：先按畫面「聲音關閉」開啟，檢查 Windows 音量與分頁靜音；聽力要另按播放。
- 進度消失：使用同一瀏覽器和同一檔案路徑，不要用 InPrivate／無痕模式。不同瀏覽器對本機檔案的儲存行為可能不同，移動或重新命名檔案可能使儲存區改變；重要成績請先匯出 JSON。
- 企業或學校電腦禁止本機 HTML：這可能是電腦管理政策，請由管理員核准，或使用下列 localhost 開發方式。不要關閉瀏覽器安全防護。
- 自訂音檔未播放：單一 `/` 開頭的同站音檔路徑是供網站模式使用，在本機檔案模式請用合法 HTTPS 音檔 URL 或 `speech`，並確認裝置可連線。

## 修改程式：才需要 Node.js

從 Node.js 官方網站 https://nodejs.org/ 安裝 Node.js 24 LTS，保持 npm 選項勾選。重新開啟 PowerShell 或命令提示字元，在解壓縮後的專案資料夾執行：

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --open
```

此命令只提供自己電腦的本機預覽並開啟瀏覽器；沒有公開部署。不使用雲端 API 或 Token。第一次 `npm ci` 需要網路下載開發套件；看到錯誤時保留原始錯誤訊息再排查，不要以關閉 TLS 驗證解決。

修改 `src` 後要更新免安裝 HTML：

```powershell
npm run build:portable
```

一般網站建置與資料測試：

```powershell
npm run build
npm test
```

進階瀏覽器測試另需 `npx playwright install chromium`，再執行 `node scripts/test-portable.mjs`。雲端既有 Chromium 可用 `CHROMIUM_PATH` 指定。

## ZIP 內容

- `English-Adventure-Island.html`：可直接開啟的完整單檔遊戲。
- `START-GAME.bat`：開啟上述 HTML，不下載或安裝任何程式。
- `src/`、`public/`、`scripts/`、`tests/`：完整原始碼、範本、建置與測試。
- `package.json`、`package-lock.json`：可重現安裝資訊。
- `.agents/skills/english-game-builder/SKILL.md`：原有 Skill。
- `dist/`：一般網站建置產物；直接雙擊請使用根目錄單檔 HTML，不是 `dist/index.html`。
- `docs/`：繁體中文操作、規劃、素材與測試文件。

不包含 `.git` 歷史、`node_modules`、學生紀錄、憑證或 API Token。

## 實際驗證範圍

已在 Linux Chromium 使用獨立 HTML 驗證桌面、平板、手機尺寸的五區完成、90 分計分、進度保存、JSON／CSV 範本下載及 CSV 匯入，沒有引用原始模組或外部圖像。此測試用 localhost 傳送該單檔，沒有使用 Vite 或應用後端。

本環境的管理政策禁止 `file://` 導覽，且沒有 Windows 實機，因此不能宣稱已在 Windows 雙擊實測。單檔已移除外部模組與資源依賴，使用一般瀏覽器可執行的內嵌 JavaScript；請依以上步驟在自己的 Windows 電腦驗收。若企業政策禁止本機檔案，改用本機 Node.js 預覽。
