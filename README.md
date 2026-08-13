# 列車行駛方向投票（大橋頭分岔梗）

純娛樂。開 `luzhou-vote.html` 就能用，不用裝任何東西。

---

## 它在做什麼

1. 用**大橋頭站北向官方時刻表**算出「下一班車幾點發、實際開往蘆洲還是迴龍」。
2. 在那班車發車前，開放投票（發車前 30 秒截止）。
3. 截止後開票，比對民意 vs 時刻表，然後告訴你台北捷運不予理會。
4. 每輪結果寫進當日紀錄，可以看今天蘆洲贏幾場。

平日 278 班、假日 234 班，蘆洲／迴龍各佔一半（139:139、117:117），首班 06:02（往蘆洲）、末班 00:48（往迴龍）。

---

## 三種模式

| 模式 | 條件 | 說明 |
|---|---|---|
| 離線模式 | 預設 | 票只存在你自己的瀏覽器，可以先玩看看 |
| 多人共享 | 填了 Firebase 設定 | 所有人即時共用票數 |
| 示範模式 | 設定裡打開開關 | 每 45 秒一輪，半夜收班也能測 |

---

## 開啟多人共享（Firebase，免費）

1. 到 <https://console.firebase.google.com/> 建一個專案。
2. 左側 **Build → Realtime Database → 建立資料庫**，位置選 `asia-southeast1`，先選「測試模式」。
3. 抄下資料庫網址，長這樣：
   `https://你的專案-default-rtdb.asia-southeast1.firebasedatabase.app`
4. **專案設定 → 一般 → 你的應用程式 → 新增網頁應用程式**，抄下 `apiKey`（`AIza...` 開頭）。
5. 打開網頁 → 最下面「設定」→ 貼上這兩欄 → 儲存並重新載入。
6. 上方狀態列變成綠色「多人連線中」就成功了。

### 建議的安全性規則

測試模式 30 天後會失效，到 Realtime Database → 規則貼上：

```json
{
  "rules": {
    "luzhouVote": {
      "rounds": {
        "$round": {
          "votes": {
            "$uid": {
              ".read": true,
              ".write": "!data.exists() || newData.val() != data.val()",
              ".validate": "newData.isString() && (newData.val() == 'L' || newData.val() == 'H')"
            },
            ".read": true
          }
        }
      },
      "history": {
        "$day": {
          ".read": true,
          "$round": { ".write": true }
        }
      }
    }
  }
}
```

沒有帳號系統，所以是開放寫入的。想防灌票的話得再加 Firebase Anonymous Auth，目前一個瀏覽器 = 一票（uid 存在 localStorage，清掉就能再投）。

---

## 接 TDX 即時到站（可選）

網頁預設用內建時刻表推算，這個完全夠用。想看真實即時看板才需要：

1. 到 <https://tdx.transportdata.tw/> 註冊，會員中心拿 `Client Id` / `Client Secret`（免費）。
2. 填進網頁的「設定」。

用的端點：

- 取 token：`POST https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token`（`grant_type=client_credentials`）
- 即時到站：`GET https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/LiveBoard/TRTC?$filter=StationID eq 'O12'`（O12 = 大橋頭）

### 兩個要知道的坑

- **CORS**：瀏覽器直接打 TDX 幾乎一定被擋。設定裡有「Proxy 前綴」欄位，填自己架的 proxy（程式會用 `proxy + 原始網址` 去打）。Cloudflare Workers 十行就能寫一個。
- **Secret 會公開**：前端的東西沒有秘密可言。只用測試用金鑰，不要放正式的。

抓不到就自動退回內建時刻表，投票功能不受影響。狀態列會顯示目前用哪個資料來源。

TDX 的 LiveBoard 回傳欄位我沒辦法實測（需要金鑰），程式裡是容錯解析（`TripHeadSign` / `DestinationStationName` / `EstimateTime` 都試），你拿到金鑰後如果欄位對不上，改 `TDX.liveboard()` 那段即可。

---

## 已知限制

- **國定假日**只用星期判斷（六日 = 假日班表），像中秋、國慶這種平日放假會抓錯班表。要精準得再接一份行事曆。
- 時刻表是 **2026-05-11 生效版**，北捷改點後要更新 `TT` 那兩個字串。
- 最短投票視窗 90 秒（07:39 那班前後班距只有 2 分鐘），其他時段大多 3–10 分鐘。
- 00:48 收班後到隔天 06:02 之間會顯示「今日已收班」，想繼續玩就開示範模式。

---

## 資料來源

- 班距與營運模式：[臺北大眾捷運公司－路線及班距](https://www.metro.taipei/cp.aspx?n=ead981369a065968&s=E153D917FDC2AC69)
- 大橋頭站時刻表（含迴龍／蘆洲終點標記）：[ericyu.org O12 大橋頭時刻表](https://ericyu.org/TaipeiMetroTime/stations/O12-a-1,2,3,4,5.html)（2026-05-11 生效），已與[交通小幫手 O12 時刻表](https://taiwanhelper.com/taipeiMetro/time/station/O12)逐筆比對一致
- 官方 PDF 原件：<https://web.metro.taipei/img/ALL/timetables/128a.PDF>
- TDX 授權方式：[TDX API 授權驗證與使用方式](https://motc-ptx.gitbook.io/tdx-xin-shou-zhi-yin/api-shi-yong-shuo-ming/api-shou-quan-yan-zheng-yu-shi-yong-fang-shi)
- 梗的出處：[@yenn0625\_ 的 Threads 貼文](https://www.threads.com/share/J4j-kw6eg/)
