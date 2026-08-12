# Apple 健康運動匯入（iPhone 捷徑）

Calorie Dashboard 支援將 Apple Health 嘅運動記錄一鍵匯入，唔使手動逐項輸入。

## 運作原理

1. iPhone 捷徑讀取 Apple Health 嘅運動樣本（Workout）
2. 將每項運動（類型、開始時間、時長）POST 到 API：`POST /api/exercises/import`
3. Worker 用 MET 公式 + 你嘅體重計 kcal：`kcal = MET × 體重(kg) × 時長(小時)`
4. 之後喺 app 嘅 今日/日記 頁會見到「Apple」標籤嘅運動記錄

## 建立捷徑（一次過，約 2 分鐘）

1. 開 iPhone「捷徑」app → 新建捷徑
2. 加「**取得健康樣本**」動作：
   - 樣本類型：**體能訓練**（Workout）
   - 開始日期：**今日**（或你想匯入嘅日期）
   - 結束日期：**今日**（或同日）
3. 加「**重複每一個項目**」（Repeat with Each）動作，喺入面放：
   - 「**取得健康樣本詳細資料**」→ 欄位：`Workout Activity Type`、`開始日期`、`結束日期`、`Duration`（秒）
   - 「**文字**」動作，內容填以下 JSON template（用魔術變數填入上面四個欄位）：
     ```json
     {"items":[{"type":"Workout Activity Type","startDate":"開始日期","endDate":"結束日期","duration":Duration}]}
     ```
     註：香港日期格式要選「短」或者用 ISO 格式，令 `startDate` 開頭係 `YYYY-MM-DD`，server 先認到日期。
4. 喺「重複每一個項目」**外面**（或直接喺入面）加「**取得 URL 內容**」動作：
   - 方法：**POST**
   - URL：`https://calorie-api.baronjetso.workers.dev/api/exercises/import`
   - 標頭：`x-admin-key` = 你嘅 ADMIN_KEY（即 `.env` 入面嗰個，用嚟以 BK 身份寫入）
   - 內容類型：JSON
   - 要求本文：上面個 JSON 文字
5. 改名「匯入運動到卡路里」，完成。

## 自動化（可選）

「個人自動化」→「特定時間」（例如每晚 10 點）→ 執行「匯入運動到卡路里」。

## 資料格式

`POST /api/exercises/import` body：

```json
{
  "items": [
    {
      "type": "HKWorkoutActivityTypeRunning",
      "startDate": "2026-08-12T18:30:00+0800",
      "endDate": "2026-08-12T19:15:00+0800",
      "duration": 2700
    }
  ]
}
```

- `type`：接受 `HKWorkoutActivityTypeRunning` / `Running` 等 Apple 格式（substring 匹配，唔區分大小寫）
- `duration`：**秒**（Apple 健康樣本預設單位）；亦可傳 `durationMin`（分鐘）
- `startDate`：ISO 時間；server 用前 10 個字元做日期（`2026-08-12`）
- 重複匯入會自動去重（同類型 + 同時長 + 同開始時間只記一次），可以放心每日自動跑

## 支援嘅運動類型（MET）

| Apple 類型 | 顯示名 | MET |
|---|---|---|
| Running | 跑步 | 8.3 |
| Walking | 步行 | 3.5 |
| Cycling | 單車 | 6.8 |
| Swimming | 游泳 | 5.8 |
| Hiking | 行山 | 6.0 |
| Yoga | 瑜伽 | 2.5 |
| Strength Training | 重量訓練 | 3.5 |
| Elliptical | 橢圓機 | 5.0 |
| Stair Stepper | 樓梯機 | 6.0 |
| Rowing | 划船機 | 7.0 |
| Dance | 跳舞 | 5.0 |
| Pilates | 普拉提 | 3.0 |
| HIIT | 高強度間歇 | 8.0 |
| Tai Chi | 太極 | 3.0 |
| Jump Rope | 跳繩 | 11.0 |
| Basketball | 籃球 | 6.5 |
| Badminton | 羽毛球 | 5.5 |
| Soccer/Football | 足球 | 7.0 |
| Tennis | 網球 | 7.3 |
| Table Tennis | 乒乓球 | 4.0 |
| Golf | 高爾夫 | 4.8 |
| 其他 | 運動（generic） | 4.0 |

MET 來源：Compendium of Physical Activities。kcal = MET × 體重(kg) × 小時，係冇心率帶之下最準嘅估算。
