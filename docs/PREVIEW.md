# 目前預覽方式：Windows 本機

本階段不公開部署，不需要 Cloudflare 帳號或 API Token。請優先使用 [Windows 本機操作說明](WINDOWS.md)。

最簡單方式是解壓縮 ZIP，雙擊根目錄 `English-Adventure-Island.html`，或執行 `START-GAME.bat`。要修改程式才需要 Node.js。

原始碼的畫面檢查可在開發伺服器運作時執行 `CHROMIUM_PATH=/usr/bin/chromium npm run inspect:game`；Windows 使用 Playwright 下載的瀏覽器時不需設定這個變數。截圖位於 `artifacts/`，不是公開預覽網址。

先前環境設定草稿中的 Cloudflare 需求不參與本機遊戲，也不需要填寫。沒有執行公開部署。
