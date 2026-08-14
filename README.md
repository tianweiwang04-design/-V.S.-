# 列車行駛方向投票

> 幹等等就要上車了 大家可以多投蘆洲嗎不然我回不了家

台北捷運中和新蘆線在**大橋頭**分岔，往蘆洲或往迴龍全看時刻表。這是一個大家可以**一起即時投票**決定方向的網頁 —— 雖然北捷不予理會。

梗出自 [@yenn0625\_ 的 Threads 貼文](https://www.threads.com/share/J4j-kw6eg/)。**純娛樂，不影響任何實際營運。**

---

## 部署前要做的兩件事

### 1. 建 Realtime Database 並貼上規則

1. <https://console.firebase.google.com/> 建專案
2. **Build → Realtime Database → 建立資料庫**，位置選 `asia-southeast1`
3. 模式選 **「以鎖定模式啟動」** —— 不要選測試模式，那會在 30 天後自動擋掉所有讀寫
4. 進**規則**分頁，`Cmd + A` **全選刪掉**，只貼 `database.rules.json` 這一份，按**發布**

> 常見錯誤：把新規則貼在舊的 `{ ".read": false, ".write": false }` 下面，變成兩個並排的 JSON 物件 → 整份無效，網頁會一直「送出失敗」。整份只能有一個 `{` 開頭、一個 `}` 結尾。

**不需要開 Authentication。**

### 2. 填設定

**專案設定 → 一般 → 新增網頁應用程式**，抄下 `apiKey`，連同資料庫網址填進 `index.html` 最上面：

```js
const FIREBASE = {
  databaseURL: "",   // https://你的專案-default-rtdb.asia-southeast1.firebasedatabase.app
  apiKey:      "",   // AIzaSy...
};
```

`databaseURL` 要用**資料庫網址**（結尾 `.firebasedatabase.app`），不是 `.firebaseapp.com`。沒填的話網頁不會顯示投票畫面，只會顯示申請引導。

---

## 兩個功能

### 投票

1. 用**大橋頭站北向官方時刻表**算出下一班車幾點發、實際開往蘆洲還是迴龍。
2. 發車前 30 秒截止投票，投票期間所有人的票數即時同步。
3. 截止後開票，比對民意 vs 時刻表，發車後 45 秒切到下一輪。
4. 每輪結果寫進當日紀錄，可以看今天蘆洲贏幾場、猜中幾次。

| | 班次 | 往蘆洲 | 往迴龍 | 首班 | 末班 |
|---|---|---|---|---|---|
| 平日 | 278 | 139 | 139 | 06:02 往蘆洲 | 00:48 往迴龍 |
| 假日 | 234 | 117 | 117 | 06:02 往蘆洲 | 00:48 往迴龍 |

### 站別班次查詢

選你所在的車站（南勢角 O01 ～ 大橋頭 O12），會顯示**接下來 3 班的時間與方向**，並標出哪一班對應現在正在投票的那一輪。

**若已經在行駛中的車上，請選下一站** —— 那才是你接下來會停靠的地方。

只提供這 12 站，因為過了大橋頭就已經在支線上，方向早就定了，沒什麼好投的。

#### 站別時間怎麼算的（以及誤差）

網頁裡只存大橋頭一份時刻表，其他站是用**行駛時間往回推**：

```
你的站的到站時間 = 大橋頭發車時間 − 該站到大橋頭的行駛分鐘數
```

行駛分鐘數是從官方各站時刻表**實測**出來的：南勢角 26、古亭 16、忠孝新生 10、行天宮 6、大橋頭 0，其餘依站距內插：

| 站 | 分 | 站 | 分 | 站 | 分 |
|---|---|---|---|---|---|
| O01 南勢角 | 26 | O05 古亭 | 16 | O09 行天宮 | 6 |
| O02 景安 | 24 | O06 東門 | 13 | O10 中山國小 | 4 |
| O03 永安市場 | 21 | O07 忠孝新生 | 10 | O11 民權西路 | 2 |
| O04 頂溪 | 19 | O08 松江南京 | 8 | O12 大橋頭 | 0 |

拿 4 個站、共 49 個實際班次回頭對照，**最大誤差 1 分鐘，方向判定 100% 正確**（方向是逐班對應大橋頭時刻表，不受時間誤差影響）。畫面上標示為「約」與「誤差約 ±2 分」。

---

## 隱藏功能

網址後面加 hash 就會出現，不用重新整理也生效：

| 網址 | 出現什麼 |
|---|---|
| `#tdx` | TDX 即時到站的設定欄位 |
| `#diag` | 診斷面板：版面尺寸實測、safe-area、standalone、目前站別與偏移、票數、最後一個錯誤 |
| `#tdx,diag` | 兩個都開 |

**錯誤會直接顯示在畫面上**，並附白話原因（規則沒發布、網址填錯…），手機不用開主控台也查得到。

**示範模式**（設定面板裡）每 45 秒一輪，末班車過後想測試時用。

---

## 資安

沒有登入，所以**任何人都能寫進資料庫**。防線放在「限制能寫什麼」而不是「限制誰能寫」：

### 前端把資料庫內容當成不可信

- 所有進 `innerHTML` 的外部字串都先過 `esc()`（`& < > " '`）
- 開票紀錄再加一層形狀白名單：`t` 必須符合 `HH:MM`、`win` 只能 `L/H/-`、`dest` 只能 `L/H`、票數必須是非負數字 —— 不合的**整列丟掉**
- 票數讀回來 `Math.max(0, Math.floor(...))` 清洗，歷史列數上限 400
- 沒有 `eval`、`new Function`、`document.write`

### 資料庫規則

- 根節點 `.read` / `.write` 預設 **false**，只開放 `luzhouVote/` 底下用得到的路徑
- `tally` 只接受 `L` / `H` 兩個 0〜1,000,000 的整數，`$other` 直接 `false` 擋掉多餘欄位
- `history` 每個欄位逐一驗證格式、多餘欄位擋掉，而且是 **write-once**（`!data.exists()`）—— 寫進去不能改也不能刪
- 輪次 ID 必須符合 `YYYYMMDD-HHMM` 或 `demo-<數字>`，uid 長度上限 32 —— 不能亂開路徑塞資料

### 傳輸與瀏覽器層

- **CSP**：`default-src 'none'`，只允許從 `gstatic.com` 載腳本、只允許連 Firebase 與 TDX；`frame-ancestors 'none'`、`base-uri 'none'`、`form-action 'none'`
- **`vercel.json`**：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`Permissions-Policy`、HSTS

### 關於 apiKey

Firebase 的 `apiKey` **本來就是公開識別碼，不是密碼**。安全性靠資料庫規則，不是靠藏金鑰。想再收一層可以到 Google Cloud Console → 憑證，把這把 Web API key 限制成只能從你的網域呼叫。

### 沒有登入的代價（誠實說明）

拿掉匿名登入之後，以下這些就防不了：

- **可以冒用別人的 uid 格子**（`votes/<uid>` 誰都能寫）—— 不過那格只影響那個人自己畫面上的「已投」狀態，不影響票數
- **可以直接呼叫 API 改 `tally` 的數字**，規則只驗格式不驗「有沒有真的投票」
- **清掉瀏覽器資料就能再投一票**
- 灌票沒有速率限制

對一個惡搞投票，我覺得這個交換是合理的 —— 但如果哪天真的被灌爆，最小的修法是加回 Firebase 匿名登入，規則把 `.write` 改成 `auth != null`、`votes/$uid` 改成 `auth.uid === $uid`。

### 驗證做到哪

- **XSS 是實際打過的**：把 `<img onerror>`、`<svg onload>`、`<script>`、超大數字、`__proto__` 五種 payload 寫進假資料庫，確認沒有 alert、DOM 零注入、prototype 沒被污染、不合格的列整列丟掉、合法的列照常顯示。
- **規則是靜態審查，沒跑過模擬器**（模擬器 jar 下載被網路擋住）。做了 JSON 驗證、客戶端每條路徑對照規則授權、逐條檢查寫入條件。建議你發布後用主控台的「規則模擬工具」實測：未登入寫 `luzhouVote/xxx` 應拒絕、重複寫同一筆 history 應拒絕。

---

## 為什麼同步的是「計數器」而不是「整份票單」

Realtime Database 的監聽是：**節點一有變動，就把整份資料推給所有監聽者**。如果每個人都監聽整份票單，流量是人數的三次方。實測 50 人同時投 50 票：

| 寫法 | 一輪 | 一個月（278 輪/天 × 30 天） |
|---|---|---|
| 監聽整份票單 | 654 KB | **5.1 GB** |
| 只監聽 `tally` | 36 KB | **284 MB** |

免費額度 10 GB/月。所以票數存成 `tally = {L, H}` 用 `runTransaction` 累加，自己投了什麼另外記在 `votes/<uid>`、只讀自己那格。改票是「搬一格」不是加一票。

---

## 資料存在哪

| 內容 | 位置 | 鍵名 |
|---|---|---|
| 票數計數器 | Firebase RTDB | `luzhouVote/rounds/<輪次ID>/tally` = `{L,H}` |
| 自己投了什麼 | Firebase RTDB | `luzhouVote/rounds/<輪次ID>/votes/<uid>` |
| 當日開票紀錄 | Firebase RTDB | `luzhouVote/history/<營運日>/<輪次ID>` |
| 匿名 ID | localStorage | `lzv_uid` |
| 選的車站 | localStorage | `lzv_station` |
| 示範模式開關 | localStorage | `lzv_demo` |
| Firebase 本機覆寫 | localStorage | `lzv_fbUrl` / `lzv_fbKey` |
| TDX 設定 | localStorage | `lzv_tdxId` / `lzv_tdxSec` / `lzv_proxy` |

### 免費額度

Spark（免費）方案不需要信用卡，也不會產生帳單 —— 超過就停止服務。Realtime Database 上限是**同時連線 100 人**、儲存 1 GB、下載 10 GB/月。真正的天花板是同時連線 100 人。

---

## 接 TDX 即時到站（可選）

預設用內建時刻表就夠了。網址加 `#tdx` 開設定欄位。

- 取 token：`POST https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token`
- 即時到站：`GET .../v2/Rail/Metro/LiveBoard/TRTC?$filter=StationID eq 'O12'`（O12 = 大橋頭）

瀏覽器直打 TDX 會被 CORS 擋（設定裡填 proxy 前綴）；secret 放前端等於公開，只用測試金鑰。抓不到自動退回內建時刻表。TDX 回傳的內容一樣有跳脫處理。

---

## 部署

純靜態，全部放**根目錄**（Service Worker 必須和 `index.html` 同層）：

```
index.html              應用本體（單一檔案，含 CSS 與 JS）
manifest.webmanifest    PWA 設定
sw.js                   Service Worker
vercel.json             安全標頭設定
database.rules.json     Firebase 規則（給你貼用，也留一份在 repo 追蹤變更）
icon-192.png  icon-512.png  apple-touch-icon.png
README.md  .gitignore
```

Vercel：Add New → Project → Import repo → **Framework Preset `Other`**、Build Command 與 Output Directory **都留空** → Deploy。

**改過 `index.html` 記得把 `sw.js` 的 `VERSION` 加一號**（目前 `v5`），否則使用者拿到舊快取。

手機 Safari／Chrome 開網址 → 分享 → **加入主畫面**，會變全螢幕沒網址列。

---

## 驗證做到哪

headless Chromium 的自動化驗證，Firebase 用攔截 `gstatic` 模組、換成記憶體版假資料庫的方式測。

**靜態**：CSS 括號、標籤配對、JS/CSS 取用的 id 全部存在、module 與 `sw.js` 語法、規則與 vercel JSON 格式。

**時刻表邏輯**：平日與假日各跑 23 小時逐 10 秒模擬 —— 278 / 234 個輪次各觸發**恰好一次**、無重複、相位無異常；最短投票視窗 90 秒。

**站別偏移**：4 個站、49 個實際班次回頭對照，最大誤差 1 分、方向 100% 正確。

**計票**：投票→改票→取消→開票→下一輪跑完整輪；改票是搬一格不是變兩票；別人改動計數器時畫面即時同步；長條圖比例與百分比一致。

**站別查詢**：12 站選單、切站後時間與標題同步、對應輪次標示「投票中」、選擇會記住、無水平溢出、零 JS 錯誤。

**版面**：7 種尺寸（390×844 / 430×932 / 375×667 / 844×390 / 768×1024 / 1440×900 / 1920×1080）全部水平溢出 0px；三個主要按鈕各做 250 點 `elementFromPoint` 掃描，750/750 全命中；模擬 44px 瀏海不被壓到；橫向專注模式在 390px 高度內剛好塞得下。

---

## 已知限制

- **國定假日**只用星期判斷（六日 = 假日班表），中秋、國慶這種平日放假會抓錯班表。
- 時刻表是 **2026-05-11 生效版**，北捷改點後要更新 `index.html` 裡的 `TT` 兩個字串。
- 站別到站時間是推算，誤差約 ±2 分（實測最大 1 分）。
- 開票結果由「當下還開著網頁的人」寫入，那一刻沒人在線就不會留下紀錄。
- 計數器在極端情況（改票途中斷線）可能與實際票數差一票。

---

## 資料來源

- 班距與營運模式：[臺北大眾捷運公司－路線及班距](https://www.metro.taipei/cp.aspx?n=ead981369a065968&s=E153D917FDC2AC69)
- 大橋頭站時刻表（含迴龍／蘆洲終點標記）：[ericyu.org O12 大橋頭](https://ericyu.org/TaipeiMetroTime/stations/O12-a-1,2,3,4,5.html)（2026-05-11 生效），已與[交通小幫手 O12](https://taiwanhelper.com/taipeiMetro/time/station/O12)逐筆比對一致
- 站別行駛時間校正：[O01 南勢角](https://ericyu.org/TaipeiMetroTime/stations/O01-a-1,2,3,4,5.html)、[O05 古亭](https://ericyu.org/TaipeiMetroTime/stations/O05-a-1,2,3,4,5.html)、[O07 忠孝新生](https://ericyu.org/TaipeiMetroTime/stations/O07-a-1,2,3,4,5.html)、[O09 行天宮](https://ericyu.org/TaipeiMetroTime/stations/O09-a-1,2,3,4,5.html)
- 官方 PDF 原件：<https://web.metro.taipei/img/ALL/timetables/128a.PDF>
- Firebase 免費額度：[Firebase Pricing](https://firebase.google.com/pricing)
- TDX 授權方式：[TDX API 授權驗證與使用方式](https://motc-ptx.gitbook.io/tdx-xin-shou-zhi-yin/api-shi-yong-shuo-ming/api-shou-quan-yan-zheng-yu-shi-yong-fang-shi)

## 商標聲明

「臺北捷運」、中和新蘆線路線識別與相關標誌為臺北大眾捷運股份有限公司所有。本專案為非官方的粉絲惡搞作品，與臺北捷運公司無任何關聯，不提供任何真實的營運資訊，也不會影響列車實際行駛方向。
