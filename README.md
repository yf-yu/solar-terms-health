# 🌱 節氣養生 Solar Terms Health

一個結合傳統二十四節氣與中醫養生觀念的現代化小工具

🔗 **立即體驗：** [https://yf-yu.github.io/solar-terms-health/](https://yf-yu.github.io/solar-terms-health/)

## ✨ 核心功能

*   **📅 今日節氣**：自動計算當天所屬節氣，提供對應的飲食、作息、運動與注意事項。
*   **📖 節氣知識庫**：收錄完整的二十四節氣資訊，包含《黃帝內經》智慧與傳統穴位按摩建議。
*   **📝 個人日誌**：每日記錄喝水、睡眠、運動狀況與身體感覺，資料儲存於本機 (LocalStorage)。
*   **🧬 體質自測**：依據王琦教授「中醫九種體質學說」設計的 18 題測驗，提供專屬養生建議。
*   **🔔 提醒工具**：包含下個節氣倒數計時、養生計時器（冥想、泡腳等）與每日習慣打勾。
*   **📱 PWA 支援**：可「加入主畫面」作為獨立 App 使用，並支援 Service Worker 離線瀏覽。

## 🛠️ 技術棧

*   **前端**：原生 HTML5, CSS3, Vanilla JavaScript (無依賴任何框架)
*   **響應式設計 RWD**：全面使用 CSS `clamp()` 函數，完美適應 200px 到桌機大螢幕。
*   **資料儲存**：Web Storage API (LocalStorage)
*   **離線支援**：Service Worker (Cache API)
*   **部署**：GitHub Pages

## 📂 專案結構

solar-terms-health/
├── index.html          # 主頁面 (SEO 與結構化資料)
├── manifest.json       # PWA 應用程式設定檔
├── sw.js               # Service Worker (離線快取控制)
├── robots.txt          # 搜尋引擎爬蟲設定
├── css/
│   └── style.css       # 全站樣式 (含 RWD 與動畫)
├── js/
│   ├── data.js         # 24節氣、體質測驗等靜態資料
│   ├── app.js          # 核心邏輯 (節氣計算、導覽、日誌)
│   ├── tools.js        # 倒數計時、計時器、習慣打勾
│   └── constitution.js # 體質測驗邏輯與計分
└── icons/              # PWA 圖示與社群分享預覽圖

## ⚠️ 免責聲明 Disclaimer
本專案提供之節氣資訊、穴位按摩與體質測驗結果，均基於傳統中醫文化與養生知識整理，僅供參考與學術交流，不構成任何醫療診斷或治療建議。
若有任何健康疑慮或不適，請務必諮詢專業醫療人員。

## 📄 授權條款 License
採用 MIT License 授權
