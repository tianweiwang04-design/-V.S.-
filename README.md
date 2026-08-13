# 列車行駛方向投票

> 幹等等就要上車了 大家可以多投蘆洲嗎不然我回不了家

台北捷運中和新蘆線在**大橋頭**分岔，往蘆洲或往迴龍全看時刻表。這是一個真的能投票決定方向的網頁 —— 雖然北捷不予理會。

梗出自 [@yenn0625\_ 的 Threads 貼文](https://www.threads.com/share/J4j-kw6eg/)。**純娛樂，不影響任何實際營運。**

---

## 它怎麼運作

1. 用**大橋頭站北向官方時刻表**算出下一班車幾點發、實際開往蘆洲還是迴龍。
2. 那班車發車前開放投票，**發車前 30 秒截止**。
3. 截止後開票，比對民意 vs 時刻表，發車後 45 秒切到下一輪。
4. 每輪結果寫進當日紀錄，可以看今天蘆洲贏幾場、猜中幾次。

| | 班次 | 往蘆洲 | 往迴龍 | 首班 | 末班 |
|---|---|---|---|---|---|
| 平日 | 278 | 139 | 139 | 06:02 往蘆洲 | 00:48 往迴龍 |
| 假日 | 234 | 117 | 117 | 06:02 往蘆洲 | 00:48 往迴龍 |

---

## 三種模式

| 模式 | 條件 | 說明 |
|---|---|---|
| **離線模式** | 預設 | 票只存在自己的瀏覽器，開了就能玩 |
| **多人共享** | 填了 Firebase 設定 | 所有人即時共用票數 |
| **示範模式** | 設定裡打開開關 | 每 45 秒一輪，半夜收班也能測 |

---

## 隱藏功能

網址後面加 hash 就會出現，不用重新整理也生效：

| 網址 | 出現什麼 |
|---|---|
| `#tdx` | TDX 即時到站的設定欄位 |
| `#diag` | 診斷面板：`innerHeight` / `100dvh` 實測 / safe-area / standalone / DPR 等裝置實際回報值 |
| `#tdx,diag` | 兩個都開 |

手機版面出問題時，開 `#diag` 截圖，數字一比通常一眼看得出成因。

---

## 資料存在哪

全部在使用者自己的瀏覽器或你的 Firebase，沒有其他後端。

| 內容 | 位置 | 鍵名 |
|---|---|---|
| 匿名使用者 ID | localStorage | `lzv_uid` |
| Firebase 設定 | localStorage | `lzv_fbUrl` / `lzv_fbKey` |
| TDX 設定 | localStorage | `lzv_tdxId` / `lzv_tdxSec` / `lzv_proxy` |
| 示範模式開關 | localStorage | `lzv_demo` |
| 離線模式的票 | localStorage | `lzv_local_r_<輪次ID>` |
| 離線模式的當日紀錄 | localStorage | `lzv_local_h_<營運日>`（上限 400 筆） |
| 多人模式的票 | Firebase RTDB | `luzhouVote/rounds/<輪次ID>/votes/<uid>` |
| 多人模式的紀錄 | Firebase RTDB | `luzhouVote/history/<營運日>/<輪次ID>` |

一個瀏覽器 = 一票（uid 存在 localStorage，清掉就能再投）。

---

## 開啟多人共享（Firebase，免費）

1. <https://console.firebase.google.com/> 建專案。
2. **Build → Realtime Database → 建立資料庫**，位置選 `asia-southeast1`，先選測試模式。
3. 抄下資料庫網址：`https://你的專案-default-rtdb.asia-southeast1.firebasedatabase.app`
4. **專案設定 → 一般 → 新增網頁應用程式**，抄下 `apiKey`。
5. 網頁最下面「設定」貼上這兩欄 → 儲存並重新載入。
6. 上方變成綠色「多人連線中」就成功了。

測試模式 30 天後失效，到 Realtime Database → 規則貼上：

```json
{
  "rules": {
    "luzhouVote": {
      "rounds": {
        "$round": {
          "votes": {
            ".read": true,
            "$uid": {
              ".write": true,
              ".validate": "!newData.exists() || (newData.isString() && (newData.val() == 'L' || newData.val() == 'H'))"
            }
          }
        }
      },
      "history": {
        "$day": { ".read": true, "$round": { ".write": true } }
      }
    }
  }
}
```

沒有帳號系統，所以是開放寫入的。要防灌票得再加 Firebase Anonymous Auth。

---

## 接 TDX 即時到站（可選）

預設用內建時刻表推算，這樣就夠了。想看真實看板才需要，網址加 `#tdx` 開設定欄位。

- 取 token：`POST https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token`（`grant_type=client_credentials`）
- 即時到站：`GET https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/LiveBoard/TRTC?$filter=StationID eq 'O12'`（O12 = 大橋頭）

**兩個坑：**

- **CORS** —— 瀏覽器直打 TDX 幾乎一定被擋。設定裡填「Proxy 前綴」，程式會用 `proxy + 原始網址` 去打。Cloudflare Workers 十行就能寫一個。
- **Secret 會公開** —— 前端沒有秘密可言，只用測試金鑰。

抓不到就自動退回內建時刻表，投票不受影響。LiveBoard 的回傳欄位我沒辦法實測（需要金鑰），程式裡是容錯解析（`TripHeadSign` / `DestinationStationName` / `EstimateTime` 都試），欄位對不上就改 `TDX.liveboard()`。

---

## 部署

純靜態，全部檔案放**根目錄**（Service Worker 必須和 `index.html` 同層才管得到整站）：

```
index.html              應用本體（單一檔案，含 CSS 與 JS）
manifest.webmanifest    PWA 設定
sw.js                   Service Worker（改版要把 VERSION 加一號）
icon-192.png  icon-512.png  apple-touch-icon.png
README.md
.gitignore
```

Vercel：Add New → Project → Import repo →
**Framework Preset `Other`**、**Build Command 留空**、**Output Directory 留空** → Deploy。

之後 push 到 `main` 就自動重新部署。**改過 `index.html` 記得把 `sw.js` 的 `VERSION` 加一號**，否則使用者拿到舊快取。

### 加入主畫面

手機 Safari／Chrome 開網址 → 分享 → **加入主畫面**。之後是全螢幕、沒有網址列，離線也能開（離線時自動退回單機模式）。

---

## 驗證做到哪

不是實機測試，是 headless Chromium 的自動化驗證。

**靜態**：CSS 括號配對、標籤配對、JS/CSS 取用的 id 全部存在、module 語法、`sw.js` 語法、manifest 可解析。

**邏輯**：平日與假日各跑 23 小時逐 10 秒模擬 —— 278 / 234 個輪次各觸發**恰好一次**、無重複、相位無異常（永遠恰好處於投票中或開票中）；最短投票視窗 90 秒（平日 07:39、假日 23:24）；計票守恆（L+H = total、髒資料排除、百分比加總 100）。

**版面**：7 種尺寸（390×844 / 430×932 / 375×667 / 844×390 / 768×1024 / 1440×900 / 1920×1080）全部**水平溢出 0px**；三個主要按鈕各做 250 點 `elementFromPoint` 掃描，**750/750 全命中**；模擬 44px 瀏海後內容不被壓到；橫向專注模式在 390px 高度內**剛好塞得下不用捲動**。

**互動**：示範模式跑完整輪次 —— 選擇→送出→改票→取消→開票→接上下一輪，確認改票不會變兩票、取消會歸零、示範模式不寫入歷史、無 JS 執行期錯誤。

---

## 已知限制

- **國定假日**只用星期判斷（六日 = 假日班表），中秋、國慶這種平日放假會抓錯班表。要精準得再接一份行事曆。
- 時刻表是 **2026-05-11 生效版**，北捷改點後要更新 `index.html` 裡的 `TT` 兩個字串。
- 00:48 收班後到隔天 06:02 顯示「今日已收班」，想繼續玩就開示範模式。
- 沒有帳號系統，清掉 localStorage 就能再投一票。

---

## 資料來源

- 班距與營運模式：[臺北大眾捷運公司－路線及班距](https://www.metro.taipei/cp.aspx?n=ead981369a065968&s=E153D917FDC2AC69)
- 大橋頭站時刻表（含迴龍／蘆洲終點標記）：[ericyu.org O12 大橋頭時刻表](https://ericyu.org/TaipeiMetroTime/stations/O12-a-1,2,3,4,5.html)（2026-05-11 生效），已與[交通小幫手 O12 時刻表](https://taiwanhelper.com/taipeiMetro/time/station/O12)逐筆比對一致
- 官方 PDF 原件：<https://web.metro.taipei/img/ALL/timetables/128a.PDF>
- TDX 授權方式：[TDX API 授權驗證與使用方式](https://motc-ptx.gitbook.io/tdx-xin-shou-zhi-yin/api-shi-yong-shuo-ming/api-shou-quan-yan-zheng-yu-shi-yong-fang-shi)

## 商標聲明

「臺北捷運」、中和新蘆線路線識別與相關標誌為臺北大眾捷運股份有限公司所有。本專案為非官方的粉絲惡搞作品，與臺北捷運公司無任何關聯，不提供任何真實的營運資訊，也不會影響列車實際行駛方向。
