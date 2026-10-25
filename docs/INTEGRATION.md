# 未來成績串接契約

目前沒有設定遠端端點，遊戲僅本機儲存與匯出 JSON。程式不會自動發送資料。

## 請求與確認

`makeSubmission(bank, nickname, profile, submissionId)` 產出：

```json
{"schemaVersion":1,"submissionId":"固定的唯一識別碼","nickname":"Mia","quizId":"題庫識別字串","score":80,"maxScore":90,"completedAt":"ISO-8601 時間","answers":{"v1":true,"v2":false}}
```

`submitResult(httpsEndpoint, payload)` 透過可讀取回應的 HTTPS POST 傳送，10 秒逾時。後端必須回覆 `{"ok":true,"submissionId":"與請求相同"}`。不使用 `no-cors`，不將 opaque 回應或 HTTP 200 但內容不符視為同步成功。

## Apps Script 建議設定流程（尚未實作）

1. 教師建立專用試算表，僅授予必要的管理人員權限。欄位建議為 submissionId、nickname、quizId、score、maxScore、completedAt、receivedAt。
2. 建立 Apps Script 的 `doPost`，檢查 schemaVersion、欄位大小、題庫識別、分數範圍與型別。不要信任前端總分；正式評量應由後端依可信題庫重新計算。
3. 用 submissionId 去重，並以 LockService 保護併發寫入。試算表文字應防止公式注入。只保存必要欄位，訂定保存期限與刪除方式。
4. 部署成 Web App，審慎設定執行身分與存取權限。機密存於 Apps Script Properties 或 Cloudflare Functions 的伺服器設定，不放在前端或聊天中。
5. 實測 Apps Script `/exec` 端點的重新導向、JSON POST 預檢與 CORS。若無法從瀏覽器讀取確認，新增固定目的地的 Pages Function 代理；不可建立任意 URL 代理。前端呼叫受控代理，由代理檢查並轉送合法請求。
6. 在下一版建立持久待同步佇列；同一筆紀錄重試需使用相同 submissionId。有限重試，顯示待同步／失敗／已確認，只有匹配確認才移除紀錄。
7. 以測試資料驗證成功、拒絕、斷線、逾時、重複與併發提交，再確認試算表實際內容。沒有真實端點前，只能宣稱 mock 契約測試通過。

共享排行榜也需要後端查詢及班級資料隔離；此裝置排行榜不能當作共享排行榜。未來版本須先定義班級識別、權限及學生資料保存規則。
