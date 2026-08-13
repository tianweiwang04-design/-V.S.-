# 列車行駛方向投票

> 幹等等就要上車了 大家可以多投蘆洲嗎不然我回不了家

台北捷運中和新蘆線在**大橋頭**分岔，往蘆洲或往迴龍全看時刻表。這是一個大家可以**一起即時投票**決定方向的網頁 —— 雖然北捷不予理會。

梗出自 [@yenn0625\_ 的 Threads 貼文](https://www.threads.com/share/J4j-kw6eg/)。**純娛樂，不影響任何實際營運。**

---

## 部署前要做的兩件事

### 1. 建 Firebase Realtime Database

1. <https://console.firebase.google.com/> 建一個專案
2. **Build → Realtime Database → 建立資料庫**，位置選 `asia-southeast1`
3. 模式選 **「以鎖定模式啟動」** —— 不要選測試模式，那會在 30 天後自動把所有讀寫擋掉，網頁就死了
4. 進**規則**分頁，把下面這段整個貼上去，按「發布」：

```json
{
  "rules": {
    "luzhouVote": {
      "rounds": {
        "$round": {
          "tally": {
            ".read": true,
            ".write": true,
            "$dir": { ".validate": "newData.isNumber() && newData.val() >= 0" }
          },
          "votes": {
            "$uid": {
              ".read": true,
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

沒有帳號系統，所以是開放寫入的，但只開放這幾條路徑、值只能是 `"L"` / `"H"` 或非負整數，而且**沒有到期時間**。要防灌票得再加 Firebase Anonymous Auth。

### 2. 把兩個值填進 `index.html`

**專案設定 → 一般 → 新增網頁應用程式**，抄下 `apiKey`，連同資料庫網址填進檔案最上面：

```js
const FIREBASE = {
  databaseURL: "",   // https://你的專案-default-rtdb.asia-southeast1.firebasedatabase.app
  apiKey:      "",   // AIzaSy...
};
```

**沒填的話網頁不會顯示投票畫面**，只會顯示申請引導。這是刻意的 —— 大家一起投票的網頁，票數必須存在共用的地方，只存自己一票沒有意義。

---

## 它怎麼運作

1. 用**大橋頭站北向官方時刻表**算出下一班車幾點發、實際開往蘆洲還是迴龍。
2. 那班車發車前開放投票，**發車前 30 秒截止**。投票期間所有人的票數即時同步，長條圖跟著跳。
3. 截止後開票，比對民意 vs 時刻表，發車後 45 秒切到下一輪。
4. 每輪結果寫進當日紀錄，可以看今天蘆洲贏幾場、猜中幾次。

| | 班次 | 往蘆洲 | 往迴龍 | 首班 | 末班 |
|---|---|---|---|---|---|
| 平日 | 278 | 139 | 139 | 06:02 往蘆洲 | 00:48 往迴龍 |
| 假日 | 234 | 117 | 117 | 06:02 往蘆洲 | 00:48 往迴龍 |

---

## 為什麼同步的是「計數器」而不是「整份票單」

Firebase Realtime Database 的監聽規則是：**該節點一有變動，就把整份資料推給所有監聽者**。

如果每個人都監聽整份票單，一輪的流量會是「投票數 × 人數 × 每份票單大小」，也就是**人數的三次方**。實測 50 人同時投 50 票：

| 寫法 | 一輪流量 | 一個月（278 輪/天 × 30 天） |
|---|---|---|
| 監聽整份票單 | 654 KB | **5.1 GB** |
| 只監聽 `tally` | 36 KB | **284 MB** |

免費額度是 10 GB/月，第一種寫法人再多一點就會爆掉，而且人數越多差距拉得越開。

所以：

- **票數**存成 `tally = {L, H}` 兩個數字，用 `runTransaction` 原子累加，大家只監聽這兩個數字
- **自己投了什麼**存在 `votes/<uid>`，但**每個人只讀自己那一格**，不讀整份
- 改票是「搬一格」（前一個 −1、新的 +1），不是加一票
- 沒有「在線人數」功能 —— 心跳廣播是最貴的，而且沒人投票時也一直在燒流量

代價：如果有人在改票的瞬間斷線，計數器可能跟實際票數差一票。對一個惡搞投票來說可以接受，程式裡有失敗回滾。

---

## 隱藏功能

網址後面加 hash 就會出現，不用重新整理也生效：

| 網址 | 出現什麼 |
|---|---|
| `#tdx` | TDX 即時到站的設定欄位 |
| `#diag` | 診斷面板：`innerHeight` / `100dvh` 實測 / safe-area / standalone / DPR / 當前 tally |
| `#tdx,diag` | 兩個都開 |

手機版面出問題時，開 `#diag` 截圖，數字一比通常一眼看得出成因。

**示範模式**（設定面板裡）每 45 秒一輪，末班車過後想測試時用。它的票不會寫進正式紀錄，而且只有同樣打開的人會在同一輪裡。

---

## 資料存在哪

| 內容 | 位置 | 鍵名 |
|---|---|---|
| 票數計數器 | Firebase RTDB | `luzhouVote/rounds/<輪次ID>/tally` = `{L,H}` |
| 自己投了什麼 | Firebase RTDB | `luzhouVote/rounds/<輪次ID>/votes/<uid>` |
| 當日開票紀錄 | Firebase RTDB | `luzhouVote/history/<營運日>/<輪次ID>` |
| 匿名使用者 ID | localStorage | `lzv_uid` |
| 示範模式開關 | localStorage | `lzv_demo` |
| Firebase 本機覆寫 | localStorage | `lzv_fbUrl` / `lzv_fbKey` |
| TDX 設定 | localStorage | `lzv_tdxId` / `lzv_tdxSec` / `lzv_proxy` |

一個瀏覽器 = 一票（uid 存在 localStorage，清掉就能再投）。設定面板裡的 Firebase 欄位只是**本機測試用的覆寫**，正式值一定要寫進原始碼，別人打開才會生效。

### 免費額度

Spark（免費）方案不需要信用卡，也不會產生帳單 —— 超過就停止服務。Realtime Database 的上限是**同時連線 100 人**、儲存 1 GB、下載 10 GB/月。儲存空間這輩子用不完，真正的天花板是同時連線 100 人。

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
sw.js                   Service Worker
icon-192.png  icon-512.png  apple-touch-icon.png
README.md
.gitignore
```

Vercel：Add New → Project → Import repo →
**Framework Preset `Other`**、**Build Command 留空**、**Output Directory 留空** → Deploy。

之後 push 到 `main` 就自動重新部署。**改過 `index.html` 記得把 `sw.js` 的 `VERSION` 加一號**，否則使用者拿到舊快取。

### 加入主畫面

手機 Safari／Chrome 開網址 → 分享 → **加入主畫面**。之後是全螢幕、沒有網址列。

---

## 驗證做到哪

不是實機測試，是 headless Chromium 的自動化驗證。Firebase 的部分用攔截 `gstatic` 模組請求、換成記憶體版假資料庫（含流量計數）的方式測。

**靜態**：CSS 括號配對、標籤配對、JS/CSS 取用的 id 全部存在、無孤兒 id、module 語法、`sw.js` 語法。

**邏輯**：平日與假日各跑 23 小時逐 10 秒模擬 —— 278 / 234 個輪次各觸發**恰好一次**、無重複、相位無異常；最短投票視窗 90 秒（平日 07:39、假日 23:24）。

**計票正確性**：投票 → 資料庫存的是 `{L:1,H:0}`；改票是搬一格（`{L:0,H:1}`）而不是變兩票；取消後計數器歸零且自己那格被刪除；別人改動計數器時畫面即時同步；長條圖比例與百分比一致。

**流量**：模擬 50 人同時投 50 票，舊寫法一輪 654 KB、新寫法 36 KB，降為 **1/18**（人越多差距越大）。

**版面**：7 種尺寸（390×844 / 430×932 / 375×667 / 844×390 / 768×1024 / 1440×900 / 1920×1080）全部**水平溢出 0px**；三個主要按鈕各做 250 點 `elementFromPoint` 掃描，**750/750 全命中**；模擬 44px 瀏海後內容不被壓到；橫向專注模式在 390px 高度內**剛好塞得下不用捲動**。

---

## 已知限制

- **國定假日**只用星期判斷（六日 = 假日班表），中秋、國慶這種平日放假會抓錯班表。要精準得再接一份行事曆。
- 時刻表是 **2026-05-11 生效版**，北捷改點後要更新 `index.html` 裡的 `TT` 兩個字串。
- 00:48 收班後到隔天 06:02 顯示「今日已收班」，想繼續玩就開示範模式。
- 沒有帳號系統，清掉 localStorage 就能再投一票。
- 開票結果由「當下還開著網頁的人」寫入，如果那一刻沒人在線，那一輪不會留下紀錄。
- 計數器在極端情況（改票途中斷線）可能與實際票數差一票。

---

## 資料來源

- 班距與營運模式：[臺北大眾捷運公司－路線及班距](https://www.metro.taipei/cp.aspx?n=ead981369a065968&s=E153D917FDC2AC69)
- 大橋頭站時刻表（含迴龍／蘆洲終點標記）：[ericyu.org O12 大橋頭時刻表](https://ericyu.org/TaipeiMetroTime/stations/O12-a-1,2,3,4,5.html)（2026-05-11 生效），已與[交通小幫手 O12 時刻表](https://taiwanhelper.com/taipeiMetro/time/station/O12)逐筆比對一致
- 官方 PDF 原件：<https://web.metro.taipei/img/ALL/timetables/128a.PDF>
- Firebase 免費額度：[Firebase Pricing](https://firebase.google.com/pricing)
- TDX 授權方式：[TDX API 授權驗證與使用方式](https://motc-ptx.gitbook.io/tdx-xin-shou-zhi-yin/api-shi-yong-shuo-ming/api-shou-quan-yan-zheng-yu-shi-yong-fang-shi)

## 商標聲明

「臺北捷運」、中和新蘆線路線識別與相關標誌為臺北大眾捷運股份有限公司所有。本專案為非官方的粉絲惡搞作品，與臺北捷運公司無任何關聯，不提供任何真實的營運資訊，也不會影響列車實際行駛方向。
