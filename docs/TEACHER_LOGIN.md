# 老師登入：不使用 Zero Trust，不綁付款方式

現在使用現有 Cloudflare Workers＋D1 的老師 Email／密碼登入；不需要開通 Zero Trust，也不需要提供付款方式給登入系統。既有 Pages、API Worker、班級、學生與成績都保留。

## 你只需要私下做一次

1. 開啟 https://english-adventure-island-3ip.pages.dev/teacher-password.html 。
2. 自訂至少 14 個字元的遊戲專用長密碼（不要使用 Gmail／信箱密碼），輸入兩次，按「產生私密設定值」。密碼只在你的瀏覽器產生加鹽雜湊，不會送出或存入網站資料庫。
3. 按「複製私密設定值」。**不要把密碼或設定值貼到聊天、GitHub、公開文件或截圖。**
4. 登入 Cloudflare，進入 **Workers & Pages → english-island-api → Settings → Variables and Secrets**，新增一項：
   - Type：**Secret**
   - Name：`TEACHER_PASSWORD_HASH`
   - Value：私下貼上剛複製的整段設定值。
5. 依控制台按鈕儲存並套用／部署 Secret 變更；這不是重新建立專案。
6. 開啟 https://english-adventure-island-3ip.pages.dev/teacher.html ，Email 填 `g9641723@gmail.com`，密碼填第 2 步自己設定的**原始密碼**，不是那段雜湊值。

第一次正確登入會自動新增 `teacher_sessions` 表與索引；不會重建或清空既有資料。沒有正確的 Worker Secret，任何人都不能從公開設定頁註冊老師或改掉老師密碼；公開設定頁只能在自己的瀏覽器產生一段值，真正啟用必須有後端 Worker 的設定權限。

## 建班與學生作答

登入後建立班級，輸入人數並選題庫；立即下載個別入場碼 CSV，私下發給對應座號。學生用遊戲網址、班級、座號與入場碼登入，每關完成會自動儲存到 D1。學生入場碼不能登入老師頁。

## 重設密碼

忘記密碼時，在同一個私下設定頁產生新值，替換 Worker 的同名 Secret。舊密碼及所有舊老師 Session 立即無法通過新憑證版本檢查。學生成績與學生登入不受影響。只修改密碼不需要重新建立帳號或資料庫。

沒有 Email 寄信找回功能，也不使用第三方寄信服務。老師的 Cloudflare 帳戶管理權限是重設憑證的方式。

## 保護方式與限制

- Secret 格式為 PBKDF2-HMAC-SHA256、100000 次、128-bit 隨機 salt、256-bit 結果；不用明碼或預設共用密碼。100000 次符合目前 Worker Web Crypto 支援的迭代上限，應搭配足夠長且不重複的密碼。
- 正式登入使用 HTTPS，後端核對 Email 允許名單與密碼雜湊。登入時原始密碼經 HTTPS 送到自己的 API 驗證，不寫入 D1、日誌或瀏覽器永久儲存。
- 老師 Session 使用隨機 Token，D1 只存 Token 雜湊，Cookie 為 HttpOnly／SameSite=Strict，HTTPS 加 Secure；最長 8 小時。
- 登出會刪除伺服器 Session；過期、重設 Secret 或移除允許 Email 都會使舊登入失效。
- 修改 API 檢查 Origin，登入每 IP 十分鐘最多 5 次，降低密碼猜測風險。五次失敗後需等下一個十分鐘視窗，不要一直重按。
- 同一個 `TEACHER_PASSWORD_HASH` 是此系統的管理密碼；若將允許名單擴充為多個 Email，這些 Email 共用此密碼。需要各老師獨立密碼時應另做多帳號管理，不要宣稱已有此功能。
- 不再有 Access 的 MFA／Email OTP。請保護 Cloudflare 帳號與密碼；登入頁的 HTML 可以公開載入，但所有名冊、成績、CSV 與管理 API 都需要有效老師 Session。
- 保持原有免費 Workers／D1 方案，不會替帳戶啟用付費；實際效能與免費額度仍依 Cloudflare 當前限制，需完成真實帳戶登入驗收。

## 部署後檢查

`/api/teacher/config` 只回報是否已設定，不回傳雜湊。未設定 Secret 時老師頁會提示設定，管理 API 回 503 並不開放資料；設定後未登入則回 401。請以自己的瀏覽器確認登入、建立測試班級、匯出與登出後無法查看資料，再正式發給學生。
