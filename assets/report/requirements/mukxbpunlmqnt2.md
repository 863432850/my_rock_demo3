# 碳排放半年度报告（查看报告页）· 界面复刻提示词

> **使用方法**：把本文档全文连同你的入参（见「一、入参」）一起发给 AI，即可生成一个与原型完全一致的「碳排放半年度报告」报告页。  
> 本文档是**自包含**的：不依赖任何源代码、截图或外部资料；所有文案、颜色、尺寸、数据、计算规则均已逐字给出。  
> 同一份提示词同时兼容：**上半年 / 下半年**两种报告期、**2022—2026** 五个年度、**钢铁 / 发电 / 建材 / 化工**四个行业。

---

## 一、入参（JSON）

```json
{
  "companyName": "山西信发化工有限公司",
  "year": 2026,
  "half": 1
}
```

| 字段            | 类型     | 必填 | 取值与默认                  | 说明                                              |
| ------------- | ------ | -- | ---------------------- | ----------------------------------------------- |
| `companyName` | string | 否  | 默认 `"安阳钢铁股份有限公司"`      | 核算主体全称：① 出现在封面、工具条标题、报告概述中；② **用于推断所属行业**（规则见下） |
| `year`        | int    | 否  | 默认 `2026`，允许 2022—2026 | 报告年度；超出范围按 2026 处理                              |
| `half`        | int    | 否  | 默认 `1`，允许 `1` / `2`    | `1`=上半年（1—6 月），`2`=下半年（7—12 月）                  |

**行业推断规则（从 `companyName` 自动判断，没有单独的行业入参）**：按下列优先级逐行扫描企业名称，**第一个命中关键词的行即确定行业**；一行内命中任一关键词即算命中；全部未命中时按**钢铁**兜底。

| 优先级 | 行业 | 企业名称关键词（命中任一即归入）                        | 推断示例              |
| --- | -- | --------------------------------------- | ----------------- |
| 1   | 钢铁 | `钢`（涵盖钢铁、轧钢、特钢、不锈钢等）                    | 安阳钢铁股份有限公司 → 钢铁   |
| 2   | 发电 | `发电` / `电力` / `电厂` / `热电` / `火电` / `水电` | 华能国际电力股份有限公司 → 发电 |
| 3   | 建材 | `水泥` / `建材` / `混凝土` / `陶瓷` / `玻璃`       | 海螺水泥股份有限公司 → 建材   |
| 4   | 化工 | `化工` / `化学` / `化肥` / `氯碱` / `石化`        | 湖北宜化化工股份有限公司 → 化工 |

参考实现（行为必须与此一致，含优先级与兜底）：

```js
function inferIndustry(companyName) {
  var n = String(companyName || '');
  if (/钢/.test(n)) return 'steel';                          // 钢铁
  if (/发电|电力|电厂|热电|火电|水电/.test(n)) return 'power';     // 发电
  if (/水泥|建材|混凝土|陶瓷|玻璃/.test(n)) return 'building';      // 建材
  if (/化工|化学|化肥|氯碱|石化/.test(n)) return 'chemical';        // 化工
  return 'steel';                                            // 兜底：钢铁
}
```

推断出行业后，界面中**所有**与行业相关的名词（产品名、产量单位、强度单位、工序名、物料名、分析文案）都必须随行业切换，具体映射数据与文案规则见「2.5 数据规则」与「2.5.6 行业自适应文案规则」。**禁止把任何钢铁专有名词写死，也禁止要求调用方额外传行业字段。**

`year` 与 `half` 的组合共 10 个变体（5 年 × 上/下半年），全部由同一套渲染逻辑按入参取数生成，**不需要为不同年份/半年分别写页面**。其中一个特殊情况：**2026 年下半年是「进行中」的报告期**——当前演示时点为 2026-09，故该半年只有 7、8、9 三个月已发生，报告只统计这 3 个月，其余月份在逐月表中显示为灰色占位「—」且不计入合计（规则见 2.5.3）。其余 9 个变体都是完整 6 个月的报告期。

---

## 二、任务

### 2.1 交付物

- **唯一交付物**：一个自包含的 HTML 文件，文件名 `碳排放半年度报告.html`。
- 所有 CSS 写在 `<style id="brief-style">` 内，所有 JS 写在 `<script>` 内，数据直接内嵌在 JS 常量中。
- 仅允许两个 CDN 依赖（用于 PDF 导出，必须按此版本）：
  ```html
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
  ```
- 报告期由页面顶部两个常量决定（也可用 URL query `?year=2026&half=1` 覆盖）：
  ```js
  var YEAR = 2026;   // 来自入参 year
  var HALF = 1;      // 来自入参 half：1=上半年，2=下半年
  ```

### 2.2 页面整体布局

整页是一个**独立全屏页面**（没有平台顶部导航、没有侧边栏、没有面包屑）。结构为：顶部一条吸顶工具条 + 下方**三张 A4 纸面**（封面 / 目录 / 正文），三张纸面共用同一个容器类 `.brief-page`。

```
<body> 背景 #e9edf3
┌────────────────────────────────────────────────────────────────┐
│ .brief-toolbar（吸顶，打印时隐藏）                                  │
│ ← 返回碳排放半年度报告  {公司名}碳排放半年度报告（2026 年上半年）  [下载报告（PDF）] │
└────────────────────────────────────────────────────────────────┘
┌──────────────── .brief-page（纸面 1：封面 .brief-cover） ────────────────┐
│        [碳 排 放 半 年 度 报 告]     ← 胶囊形 kicker                      │
│        {公司名}                                                         │
│        碳排放半年度报告              ← h1，两行                            │
│        2026年1—6月                  ← 绿色大字（cover-month）              │
│        [碳排放 · 半年度报告]         ← 浅绿胶囊（cover-tab）               │
│        ────                        ← 绿色短粗线（cover-line）             │
│        数据期间：2026-01 至 2026-06  ← 底部灰字（cover-foot）              │
└───────────────────────────────────────────────────────────────────────┘
┌──────────────── .brief-page（纸面 2：目录 .brief-toc） ──────────────────┐
│  目  录                                                                 │
│  摘要 · 核心指标概览        → #sec-0                                     │
│  一、报告概述              → #sec-1                                     │
│  二、排放量汇总            → #sec-2                                     │
│  三、企业层级核算明细       → #sec-3                                     │
│  四、工序层级排放构成       → #sec-4                                     │
│  五、逐月排放与强度走势     → #sec-5                                     │
└───────────────────────────────────────────────────────────────────────┘
┌──────────────── .brief-page（纸面 3：正文） ────────────────────────────┐
│  ▎摘要 · 核心指标概览        (h1#sec-0)  5 张 KPI 卡 + 4 条要点          │
│  ▎一、报告概述             (h1#sec-1)  引言 + 3 行 kv 表 + （一）核算口径说明│
│  ▎二、排放量汇总           (h1#sec-2)  汇总表 + 勾稽框 + 图 1            │
│  ▎三、企业层级核算明细      (h1#sec-3)  表 2 + 表 3 + 勾稽框              │
│  ▎四、工序层级排放构成      (h1#sec-4)  图 2 + 构成表 + 口径说明 + （一）工序结构分析│
│  ▎五、逐月排放与强度走势    (h1#sec-5)  图 3 + 图 4 + 逐月表 + 3 条要点    │
└───────────────────────────────────────────────────────────────────────┘
```

**容器一致性（重要）**：三张纸面都是 `<div class="brief-page">`，修饰类（`brief-cover-wrap` / `brief-toc`）只追加、**不允许**单独覆盖 `width / margin / padding`。目录恰好 6 条、正文恰好 6 个 `<h1 class="brief-h1">`（id 依次为 `sec-0`…`sec-5`），章节数量、顺序、名称一字不差。


### 2.3 设计规格（完整 CSS，逐字使用）

主色为绿色 `#00b42a`。以下 CSS 逐字放入 `<style id="brief-style">`（其中 `.advice-list` 一组样式本页用不到，保留无害）：

```css
/* ===== 碳排放半年度报告（拟 A4 文档，可下载 PDF） ===== */
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #e9edf3;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif;
  color: #222;
}

/* 顶部工具条（打印/导出时不包含） */
.brief-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e8ee;
  box-shadow: 0 2px 8px rgba(20, 40, 30, 0.06);
}
.brief-toolbar .bt-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #00b42a;
  text-decoration: none;
  white-space: nowrap;
}
.brief-toolbar .bt-back:hover { text-decoration: underline; }
.brief-toolbar .bt-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.brief-toolbar .bt-actions { margin-left: auto; display: flex; gap: 8px; }
.brief-toolbar .bt-btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #00b42a;
  background: #00b42a;
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.brief-toolbar .bt-btn:hover { filter: brightness(1.06); }
.brief-toolbar .bt-btn svg { width: 14px; height: 14px; }

/* A4 纸面（三张纸面共用同一容器类，禁止单独覆盖宽度/内边距） */
.brief-page {
  width: 920px;
  margin: 22px auto 40px;
  background: #fff;
  box-shadow: 0 4px 24px rgba(20, 40, 30, 0.10);
  padding: 64px 72px 72px;
  line-height: 1.8;
}
.brief-page + .brief-page { margin-top: 18px; }

/* 封面 */
.brief-cover { text-align: center; padding: 118px 0 90px; position: relative; }
.brief-cover .cover-kicker {
  display: inline-block;
  font-size: 13px;
  letter-spacing: 6px;
  color: #00b42a;
  border: 1px solid #00b42a;
  border-radius: 20px;
  padding: 4px 18px 4px 24px;
  margin-bottom: 44px;
}
.brief-cover h1 {
  margin: 0 0 14px;
  font-size: 34px;
  letter-spacing: 2px;
  color: #1a1a1a;
  font-weight: 700;
  line-height: 1.5;
}
.brief-cover .cover-month {
  font-size: 20px;
  color: #00b42a;
  letter-spacing: 4px;
  font-weight: 600;
  margin-top: 10px;
}
.brief-cover .cover-tab {
  display: inline-block;
  margin-top: 16px;
  font-size: 14px;
  color: #1f7a3a;
  background: #e9f7ee;
  border: 1px solid #c8e8d2;
  border-radius: 16px;
  padding: 4px 18px;
  letter-spacing: 1px;
}
.brief-cover .cover-line {
  width: 120px;
  height: 3px;
  background: #00b42a;
  margin: 40px auto 0;
  border-radius: 2px;
}
.brief-cover .cover-foot {
  margin-top: 100px;
  font-size: 13px;
  color: #8a9199;
  line-height: 2;
}

/* 目录（只追加修饰类，禁止设 width/margin/padding） */
.brief-toc h2 { font-size: 20px; margin: 0 0 18px; letter-spacing: 2px; }
.brief-toc ol { margin: 0; padding: 0; list-style: none; }
.brief-toc .toc-l1 { font-size: 15px; font-weight: 600; margin: 12px 0 4px; }
.brief-toc a { color: inherit; text-decoration: none; }
.brief-toc a:hover { color: #00b42a; }

/* 章节标题 */
.brief-h1 {
  font-size: 21px;
  margin: 34px 0 14px;
  padding: 8px 0 8px 14px;
  border-left: 5px solid #00b42a;
  background: linear-gradient(90deg, #e9f7ee 0%, rgba(233, 247, 238, 0) 70%);
  letter-spacing: 1px;
}
.brief-h1:first-child { margin-top: 0; }
.brief-h2 {
  font-size: 16.5px;
  margin: 26px 0 10px;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 8px;
}
.brief-h2::before {
  content: "";
  width: 8px;
  height: 8px;
  background: #00b42a;
  border-radius: 2px;
  flex-shrink: 0;
}
.brief-p { font-size: 13.5px; color: #333; margin: 8px 0; }
.brief-p strong { color: #00b42a; }

/* 摘要 · 核心指标卡 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 14px 0 18px;
}
.kpi-card {
  border: 1px solid #e5eee8;
  border-radius: 8px;
  padding: 12px 14px;
  background: linear-gradient(160deg, #f4fbf6 0%, #ffffff 75%);
}
.kpi-card.is-self {
  border-color: #ffd591;
  background: linear-gradient(160deg, #fff7e8 0%, #ffffff 80%);
}
.kpi-card .kpi-name { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.kpi-card .kpi-val { font-size: 20px; font-weight: 700; color: #1a1a1a; font-variant-numeric: tabular-nums; }
.kpi-card .kpi-val small { font-size: 12px; font-weight: 400; color: #8a9199; margin-left: 2px; }
.kpi-card .kpi-delta { font-size: 11.5px; margin-top: 3px; }
.kpi-card .kpi-delta.is-pos { color: #d4380d; }
.kpi-card .kpi-delta.is-neg { color: #2ba471; }
.kpi-card .kpi-delta.is-flat { color: #98a1ab; }

/* 要点列表 */
.point-list { margin: 0; padding-left: 18px; font-size: 12.5px; color: #333; line-height: 1.9; }
.point-list li { margin: 3px 0; }

/* 横向条形图（纯 HTML/CSS） */
.hbars { margin: 8px 0 4px; }
.hbar-row { display: flex; align-items: center; gap: 10px; margin: 7px 0; font-size: 12.5px; }
.hbar-row .hbar-label { width: 172px; text-align: right; color: #444; flex-shrink: 0; }
.hbar-row .hbar-track { flex: 1; height: 16px; background: #f2f4f7; border-radius: 3px; overflow: hidden; }
.hbar-row .hbar-fill { height: 100%; border-radius: 3px; }
.hbar-row .hbar-val { width: 168px; color: #333; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.hbar-row.is-self .hbar-label,
.hbar-row.is-self .hbar-val { font-weight: 700; color: #b25f00; }

/* 图框 */
.chart-box {
  border: 1px solid #e8ebef;
  border-radius: 6px;
  padding: 12px 14px 6px;
  margin: 12px 0 4px;
  background: #fff;
}
.chart-box svg { width: 100%; height: auto; display: block; }
.chart-caption {
  text-align: center;
  font-size: 12.5px;
  color: #8a9199;
  margin: 4px 0 16px;
}

/* 表 */
.table-caption {
  font-size: 13px;
  color: #333;
  margin: 16px 0 6px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.table-caption .unit { font-size: 12px; color: #8a9199; }
.btable { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 6px; }
.btable th, .btable td {
  border: 1px solid #e3e7ec;
  padding: 6px 8px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.btable th { background: #e9f7ee; color: #1a1a1a; font-weight: 600; }
.btable tbody tr:nth-child(even) td { background: #fafcfb; }
.btable td.is-left, .btable th.is-left { text-align: left; }
.btable .is-pos { color: #d4380d; }
.btable .is-neg { color: #2ba471; }
.btable .is-self { background: #fff7e8 !important; font-weight: 600; }
.btable .is-sub td { background: #f4fbf6 !important; font-weight: 600; }
.btable tfoot td { background: #f4fbf6; font-weight: 600; }
.btable .txt-sm { font-size: 11.5px; color: #606266; }
/* 报告期未结束的月份：占位灰字，不计入合计 */
.btable tr.is-empty td { color: #c0c4cc; }
.btable-note { font-size: 12px; color: #98a1ab; margin: 2px 0 12px; line-height: 1.7; }

/* 勾稽式 */
.formula-box {
  margin: 10px 0 14px;
  padding: 11px 14px;
  border-radius: 6px;
  background: #f6fbf8;
  border: 1px dashed #b7e0c5;
  font-size: 12.5px;
  color: #1f7a3a;
  line-height: 1.95;
  font-variant-numeric: tabular-nums;
}
.formula-box b { color: #146b32; }
.formula-box .fm-title {
  display: block;
  font-weight: 600;
  color: #1f7a3a;
  margin-bottom: 2px;
}

/* 信息键值表 */
.kv-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.kv-table th, .kv-table td { border: 1px solid #e3e7ec; padding: 7px 10px; vertical-align: top; }
.kv-table th { background: #e9f7ee; color: #1a1a1a; font-weight: 600; width: 132px; text-align: left; }
.kv-table td { color: #333; }

/* 建议列表（本页未使用，保留） */
.advice-list { margin: 8px 0; padding: 0; list-style: none; counter-reset: advice; }
.advice-list li {
  counter-increment: advice;
  position: relative;
  padding: 8px 12px 8px 40px;
  margin: 6px 0;
  background: #f8faf9;
  border: 1px solid #edf1ee;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  line-height: 1.7;
}
.advice-list li::before {
  content: counter(advice);
  position: absolute;
  left: 12px;
  top: 9px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #00b42a;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

@media print {
  body { background: #fff; }
  .brief-toolbar { display: none; }
  .brief-page { width: auto; margin: 0; box-shadow: none; padding: 24px 8px; }
  .brief-cover { page-break-after: always; }
  .brief-toc { page-break-after: always; }
  .brief-h1 { page-break-after: avoid; }
  .chart-box, .btable, .formula-box { page-break-inside: avoid; }
}
```

**颜色语义（全篇统一，禁止反转）**：排放量类数字的角标/涨跌一律按**数值符号**着色——大于 0 用红 `#d4380d`（`.is-pos`）、小于 0 用绿 `#2ba471`（`.is-neg`）、等于 0 或无数据用灰 `#98a1ab`（`.is-flat`）。不按业务好坏做特殊调整（例如产量同比上升也显示红色角标，这是原型行为，保留）。

**工具函数**（JS 中实现，行为必须一致）：

```js
function fmt(n, d) { return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function r2(n) { return Math.round(n * 100) / 100; }
function r4(n) { return Math.round(n * 10000) / 10000; }
function wan(t) { return t / 10000; }                       // tCO₂ → 万tCO₂
function signed(n, d, unit) { /* 正数带 + 号："+1.52%"；负数 "-2.62%"；null 时返回 "—" */ }
function deltaCls(n) { return n > 0 ? 'is-pos' : n < 0 ? 'is-neg' : 'is-flat'; }
function yoyKpi(pct) { return (pct == null || isNaN(pct)) ? '同比 —' : '同比 ' + signed(pct, 2, '%'); }
function yoyPhrase(pct) {
  if (pct == null || isNaN(pct)) return '无上年同期数据，不计算同比';
  return '较上年同期' + (pct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(pct), 2) + '%';
}
```


### 2.4 区块逐一规格

下文用占位符表示运行期取值：`{ORG}`=companyName；`{YEAR}`=year；`{halfName}`=`上半年`/`下半年`；`{PERIOD_CN}`=`{YEAR}年1—6月`（half=1）或 `{YEAR}年7—12月`（half=2）；`{RANGE}`=数据期间（**精确到月**，上半年为 `{YEAR}-01 至 {YEAR}-06`，下半年为 `{YEAR}-07 至 {YEAR}-12`）；`{product}` / `{prodNoun}` / `{prodUnit}` / `{intUnit}` 等行业名词见 2.5.6。

#### 2.4.0 顶部工具条 `.brief-toolbar`

```html
<div class="brief-toolbar" id="brief-toolbar">
  <a class="bt-back" href="#">← 返回碳排放半年度报告</a>
  <span class="bt-title" id="bt-title">{ORG}碳排放半年度报告（{YEAR} 年{halfName}）</span>
  <div class="bt-actions">
    <button type="button" class="bt-btn" id="btn-download">
      ![svg](data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIGhlaWdodD0iMjQiPjxwYXRoIGQ9Ik0xMiAzdjEybTAgMGwtNC00bTQgNGw0LTQiLz48cGF0aCBkPSJNNCAyMWgxNiIvPjwvc3ZnPg==)
      下载报告（PDF）
    </button>
  </div>
</div>
```

浏览器标签页标题：`碳排放半年度报告-{YEAR}H1`（half=1）或 `碳排放半年度报告-{YEAR}H2`（half=2）。返回链接的 `href` 在单文件交付物中填 `#` 即可。

#### 2.4.1 纸面 1 · 封面 `.brief-cover`

```html
<div class="brief-page brief-cover-wrap"><div class="brief-cover">
  <div class="cover-kicker">碳 排 放 半 年 度 报 告</div>
  <h1>{ORG}<br/>碳排放半年度报告</h1>
  <div class="cover-month">{PERIOD_CN}</div>
  <div class="cover-tab">碳排放 · 半年度报告</div>
  <div class="cover-line"></div>
  <div class="cover-foot">数据期间：{RANGE}</div>
</div></div>
```

封面**只有**这些元素：没有「核算边界」行、没有任何「锚点月/期末月」字样；数据期间**精确到月**（如 `数据期间：2026-01 至 2026-06`）。

#### 2.4.2 纸面 2 · 目录 `.brief-toc`

```html
<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>
  <li class="toc-l1"><a href="#sec-0">摘要 · 核心指标概览</a></li>
  <li class="toc-l1"><a href="#sec-1">一、报告概述</a></li>
  <li class="toc-l1"><a href="#sec-2">二、排放量汇总</a></li>
  <li class="toc-l1"><a href="#sec-3">三、企业层级核算明细</a></li>
  <li class="toc-l1"><a href="#sec-4">四、工序层级排放构成</a></li>
  <li class="toc-l1"><a href="#sec-5">五、逐月排放与强度走势</a></li>
</ol></div>
```

恰好 6 条，名称一字不差，**没有**第六章、第七章。

#### 2.4.3 摘要 · 核心指标概览（`sec-0`）

`<h1 class="brief-h1" id="sec-0">摘要 · 核心指标概览</h1>` 之后是 5 张 KPI 卡（`.kpi-grid`，3 列网格，5 张卡自然换行）+ 4 条要点（`.point-list`）。

5 张 KPI 卡（第 1、4 张带 `.is-self` 橙色高亮，其余为绿色普通卡）：

| # | 卡片类                | kpi-name          | kpi-val                                                 | kpi-delta                                               |
| - | ------------------ | ----------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 1 | `kpi-card is-self` | `{halfName}累计排放量` | `fmt(wan(totalEmission),2)` + `<small> 万tCO₂</small>`   | `deltaCls(yoyEmissionPct)` + `yoyKpi(yoyEmissionPct)`   |
| 2 | `kpi-card`         | `月均排放量`           | `fmt(wan(avgEmission),2)` + `<small> 万tCO₂/月</small>`   | `is-flat`，文案 `按 {availableCount} 个月平均`                  |
| 3 | `kpi-card`         | `半年累计{prodNoun}`  | `fmt(wan(totalProd),2)` + `<small> 万{prodUnit}</small>` | `deltaCls(yoyProdPct)` + `yoyKpi(yoyProdPct)`           |
| 4 | `kpi-card is-self` | `单位{product}碳排放量` | `fmt(unitIntensity,4)` + `<small> {intUnit}</small>`    | `deltaCls(yoyIntensityPct)` + `yoyKpi(yoyIntensityPct)` |
| 5 | `kpi-card`         | `发电设施排放占比`        | `fmt(powerShare,1)` + `<small> %</small>`               | `is-flat`，文案 `掺烧自产二次能源`                                 |

其中 `powerShare = halfSummary.power / halfSummary.total * 100`。**无上年数据时（2022 年）角标必须显示 `同比 —`，不得出现「同比 — %」这种半截文案。**

4 条要点（`.point-list`，`<strong>` 包数字）：

```html
<li>{PERIOD_CN}企业层级累计碳排放量 <strong>{fmt(wan(totalEmission),2)}</strong> 万tCO₂，{yoyPhrase(yoyEmissionPct)}。</li>
<li>单位{product}碳排放量 <strong>{fmt(unitIntensity,4)}</strong> {intUnit}，{yoyPhrase(yoyIntensityPct)}{有同比时接「，是本期减排成效的核心体现。」；无同比时接「。」}</li>
<li>企业层级排放总量 <strong>{fmt(totalEmission,2)}</strong> tCO₂，其中化石燃料燃烧排放 {fmt(cumFuelSum,2)} tCO₂、过程排放 {fmt(cumProcessSum,2)} tCO₂、含碳产品隐含排放扣减 {fmt(cumProductSum,2)} tCO₂。</li>
<li>核算边界覆盖{procShortNames} {N} 个工序及掺烧自产二次能源的化石燃料发电设施，发电设施排放占企业层级约 {fmt(powerShare,1)}%。</li>
```

钢铁 2026 上半年渲染效果（供比对）：

> - 2026年1—6月企业层级累计碳排放量 **731.01** 万tCO₂，较上年同期下降 2.62%。
> - 单位粗钢碳排放量 **2.0618** tCO₂/t，较上年同期下降 4.08%，是本期减排成效的核心体现。
> - 企业层级排放总量 **7,310,099.26** tCO₂，其中化石燃料燃烧排放 7,401,131.64 tCO₂、过程排放 195,054.79 tCO₂、含碳产品隐含排放扣减 286,087.17 tCO₂。
> - 核算边界覆盖焦化、烧结、炼铁、转炉炼钢 4 个工序及掺烧自产二次能源的化石燃料发电设施，发电设施排放占企业层级约 25.9%。

#### 2.4.4 一、报告概述（`sec-1`）

```html
<h1 class="brief-h1" id="sec-1">一、报告概述</h1>
<p class="brief-p">本报告为 {ORG} {YEAR} 年{halfName}碳排放核算结果，核算边界为企业层级，报告期 {RANGE起} 至 {RANGE止}，共 {availableCount} 个月。核算基准信息如下。</p>
```

接一张 `.kv-table`，**恰好 3 行**（不得增删行）：

| th（左列，宽 132px） | td                                                    |
| -------------- | ----------------------------------------------------- |
| 核算主体           | `{ORG}`                                               |
| 核算边界           | `企业层级：覆盖{procShortNames} {N} 个工序，以及掺烧自产二次能源的化石燃料发电设施` |
| 报告期            | `{PERIOD_CN}（{RANGE}）`                                |

钢铁示例第 2 行：`企业层级：覆盖焦化、烧结、炼铁、转炉炼钢 4 个工序，以及掺烧自产二次能源的化石燃料发电设施`；第 3 行：`2026年1—6月（2026-01 至 2026-06）`。

然后是小节标题与 3 条口径说明：

```html
<div class="brief-h2">（一）核算口径说明</div>
<ul class="point-list">
  <li><strong>企业层级排放总量</strong> = 化石燃料燃烧排放 + 过程排放 − 含碳产品隐含的排放，与月度存证「排放量汇总表」的企业层级口径一致。</li>
  <li><strong>工序层级排放总量</strong>为净额口径，与企业层级排放总量存在包含关系，不可与工序明细表直接相加（详见第四章口径说明）。</li>
  <li>含碳产品（{productNames}）在产品中固存的碳不计入排放，故在本报告中作为<strong>扣减项</strong>列示。</li>
</ul>
```

钢铁的 `{productNames}` = `粗钢、粗苯、煤焦油`。

#### 2.4.5 二、排放量汇总（`sec-2`）

```html
<h1 class="brief-h1" id="sec-2">二、排放量汇总</h1>
<p class="brief-p">下表给出<strong>{PERIOD_CN}半年度累计</strong>排放量汇总。四项构成按企业层级口径归集，三项分项之和与合计严格相等。</p>
<div class="table-caption"><span>排放量汇总表</span><span class="unit">单位：tCO₂</span></div>
```

**表 1 · 排放量汇总表**（`.btable`，4 列 × 4 数据行，无 tfoot）：

| 参数名称（`is-left`）        | `{PERIOD_CN}累计`            | 占企业层级比重             | 取值方式 |
| ---------------------- | -------------------------- | ------------------- | ---- |
| 企业层级排放总量（行加 `is-self`） | `fmt(totalEmission,2)`     | `100.0%`            | 计算值  |
| 其中：工序层级排放总量            | `fmt(halfSummary.proc,2)`  | `fmt(procShare,1)%` | 计算值  |
| 掺烧自产二次能源的化石燃料发电设施排放总量  | `fmt(halfSummary.power,2)` | `fmt(powShare,1)%`  | 计算值  |
| 其他排放总量                 | `fmt(halfSummary.other,2)` | `fmt(othShare,1)%`  | 计算值  |

占比均为该项 ÷ 企业层级排放总量 ×100，保留 1 位小数；三项占比之和 = 100.0%。表后注：

```html
<div class="btable-note">注：占比为「工序层级 / 发电设施 / 其他」三项占企业层级排放总量的比重，三项之和为 100.0%。</div>
```

勾稽框（数字逐字按公式渲染）：

```html
<div class="formula-box"><span class="fm-title">半年度累计勾稽关系（已校验通过）</span>
企业层级排放总量<br/>
&nbsp;&nbsp;= 化石燃料燃烧排放 + 过程排放 − 含碳产品隐含的排放<br/>
&nbsp;&nbsp;= {cumFuelSum} + {cumProcessSum} − {cumProductSum} = <b>{totalEmission} tCO₂</b><br/>
&nbsp;&nbsp;= 工序层级排放总量 + 掺烧自产二次能源发电设施排放总量 + 其他排放总量<br/>
&nbsp;&nbsp;= {proc} + {power} + {other} = <b>{totalEmission} tCO₂</b>
</div>
```

然后是**图 1**（横向条形图，总和归一 `hbarStruct`，见 2.6），3 根条，顺序与配色固定：

| 顺序 | 名称           | 值（万tCO₂）                 | 颜色        |
| -- | ------------ | ------------------------ | --------- |
| 1  | 其他排放总量       | `wan(halfSummary.other)` | `#722ed1` |
| 2  | 工序层级排放总量     | `wan(halfSummary.proc)`  | `#00b42a` |
| 3  | 掺烧自产二次能源发电设施 | `wan(halfSummary.power)` | `#165dff` |

图题：`（图 1）{PERIOD_CN}累计排放量构成（万tCO₂）`。

#### 2.4.6 三、企业层级核算明细（`sec-3`）

```html
<h1 class="brief-h1" id="sec-3">三、企业层级核算明细</h1>
<div class="brief-h2">（一）化石燃料燃烧排放明细</div>
<div class="table-caption"><span>化石燃料燃烧排放明细（{PERIOD_CN}）</span><span class="unit">单位：tCO₂</span></div>
```

**表 2 · 化石燃料燃烧排放明细**（`.btable`，6 列）：表头

```html
<th class="is-left">物料</th><th>消耗量</th><th>低位发热量</th><th>单位热值含碳量</th><th>排放量（tCO₂）</th><th>占比</th>
```

每个燃料物料一行：消耗量 = `fmt(r2(基准消耗量 × HALF_FACTOR), 2)` 并带单位小字（`<div class="txt-sm">{单位}</div>`，如 `t` 或 `10⁴Nm³`）；低位发热量列 = 数值 + `<div class="txt-sm">{GJ/t 或 GJ/10⁴Nm³}</div>`；单位热值含碳量列 = 数值 + `<div class="txt-sm">tC/GJ</div>`；排放量 = `fmt(r2(基准排放量 × HALF_FACTOR), 2)`；占比 = 该行排放量 ÷ 燃料小计 ×100（2 位小数，带 `%`）。数据行之后一行小计：

```html
<tr class="is-sub"><td class="is-left">小计</td><td>—</td><td>—</td><td>—</td><td>{fmt(cumFuelSum,2)}</td><td>100.00%</td></tr>
```

表后注（`{gasFuelsCn}` 为行业气体燃料名，多个用「、」连接）：

```html
<div class="btable-note">注：化石燃料燃烧排放量 = 消耗量 × 低位发热量 × 单位热值含碳量 × 44/12；{gasFuelsCn}的低位发热量单位为 GJ/10⁴Nm³，消耗量单位为 10⁴Nm³，其余物料为 t 与 GJ/t。</div>
```

```html
<div class="brief-h2">（二）过程排放与含碳产品隐含排放明细</div>
<div class="table-caption"><span>过程排放 / 含碳产品扣减明细（{PERIOD_CN}）</span><span class="unit">单位：tCO₂</span></div>
```

**表 3 · 过程排放 / 含碳产品扣减明细**（`.btable`，6 列）：表头

```html
<th>类别</th><th class="is-left">物料 / 产品</th><th>活动数据</th><th>排放因子（tCO₂/t）</th><th>排放量（tCO₂）</th><th>方向</th>
```

- 过程排放每个物料一行：类别列 `过程排放`；活动数据 = `fmt(r2(基准消耗量 × HALF_FACTOR), 2)`；排放因子照抄基准值；排放量 = `fmt(r2(基准排放量 × HALF_FACTOR), 2)`；方向列 `计入`。
- 过程排放小计行：`<tr class="is-sub"><td colspan="4" class="is-left">过程排放小计</td><td>{fmt(cumProcessSum,2)}</td><td>计入</td></tr>`
- 含碳产品每个产品一行：类别列 `含碳产品隐含`；排放量列加 `.is-neg`（绿色，数值本身为正、不额外加负号）；方向列 `扣减`。
- 含碳产品小计行：`<tr class="is-sub"><td colspan="4" class="is-left">含碳产品隐含排放小计</td><td class="is-neg">{fmt(cumProductSum,2)}</td><td>扣减</td></tr>`
- 表尾勾稽行放在 `<tfoot>`：

```html
<tfoot><tr><td colspan="4" class="is-left">企业层级排放总量 = 化石燃料燃烧 + 过程排放 − 含碳产品隐含</td><td>{fmt(totalEmission,2)}</td><td>—</td></tr></tfoot>
```

表后注：

```html
<div class="btable-note">注：过程排放 = 消耗量 × 排放因子；含碳产品隐含排放为产品中固存碳对应排放量，在核算中作为扣减项，故以负值列示。</div>
```

勾稽框：

```html
<div class="formula-box"><span class="fm-title">化石燃料燃烧 + 过程排放 − 含碳产品隐含</span>
{cumFuelSum} + {cumProcessSum} − {cumProductSum} = <b>{totalEmission} tCO₂</b><br/>
单位{product}碳排放量 = {totalEmission} ÷ {totalProd} = <b>{unitIntensity} {intUnit}</b>
</div>
```

#### 2.4.7 四、工序层级排放构成（`sec-4`）

```html
<h1 class="brief-h1" id="sec-4">四、工序层级排放构成</h1>
<p class="brief-p">工序层级按生产线归集燃料燃烧排放量，{PERIOD_CN}各工序合计 <strong>{fmt(cumLineTotal,2)}</strong> tCO₂。各工序排放量及其主要贡献物料如下。</p>
```

**图 2**（横向条形图，**最大值归一** `hbarCmp`，见 2.6）：5 根条，顺序 = 行业工序表顺序，颜色按序号循环 `['#00b42a','#165dff','#ff7d00','#722ed1','#86909c']`，第 1 根条带 `is-self` 高亮。值 = `wan(r2(工序基准合计 × HALF_FACTOR))`，保留 2 位小数。图题：`（图 2）工序层级燃料燃烧排放量（{PERIOD_CN}，万tCO₂）`。

**表 4 · 工序层级排放构成表**（`.btable`，4 列）：表头

```html
<th class="is-left">工序 / 生产线</th><th>燃料燃烧排放量</th><th>占工序合计比重</th><th class="is-left">主要排放物料（排放量 tCO₂）</th>
```

每个工序一行：排放量 = `fmt(r2(工序基准合计 × HALF_FACTOR), 2)`；占比 = 该工序 ÷ 工序合计 ×100（2 位小数带 `%`）；主要排放物料 = 该工序物料按排放量降序取前 3，`{物料名} {fmt(r2(物料基准值 × HALF_FACTOR),2)}`，用 `·` 连接（`<td class="is-left txt-sm">`）。最后合计行：

```html
<tr class="is-sub"><td class="is-left">合计</td><td>{fmt(cumLineTotal,2)}</td><td>100.00%</td><td class="is-left txt-sm">—</td></tr>
```

表后口径说明（`{secEnergyCn}` 为行业二次能源举例，见 2.5.6）：

```html
<div class="btable-note"><strong>口径说明：</strong>工序层级按「含本工序产出并转出至下游工序的二次能源」口径归集，{secEnergyCn}等在企业内部循环的二次能源不做转出互抵，因此工序合计（{fmt(cumLineTotal,2)} tCO₂）大于汇总表「工序层级排放总量」（{fmt(halfSummary.proc,2)} tCO₂，为净额口径）。本表仅用于工序之间的横向结构对比，不作为对外披露口径。</div>
```

然后是小节标题与 4 条结构分析（`top` = 除发电设施行外排放量最大的工序，`second` = 次大，`powerRow` = 名称为「掺烧自产二次能源的化石燃料发电设施」的那一行，`rest` = 除 top / second / powerRow 外的其余工序，`restNames` = rest 工序名用「与」连接；`{topHint}` / `{secondHint}` / `{restHint}` 为行业文案，见 2.5.6）：

```html
<div class="brief-h2">（一）工序结构分析</div>
<ul class="point-list">
  <li>{top.name}排放量最高（{fmt(top.value,2)} tCO₂，占比 {fmt(top.value/cumLineTotal*100,2)}%），{topHint}。</li>
  <li>{second.name}居次（{fmt(second.value,2)} tCO₂，占比 {fmt(second.value/cumLineTotal*100,2)}%），{secondHint}。</li>
  <li>掺烧自产二次能源的化石燃料发电设施排放 {fmt(powerRow.value,2)} tCO₂，占比 {fmt(powerRow.value/cumLineTotal*100,2)}%，对应企业层级汇总表中同名的独立口径项。</li>
  <li>{restNames}排放量相对较小（合计占比 {fmt(rest合计/cumLineTotal*100,2)}%），{restHint}。</li>
</ul>
```

钢铁 2026 上半年渲染效果（供比对）：

> - 炼铁工序排放量最高（10,023,529.43 tCO₂，占比 48.76%），主要来自高炉煤气与焦炭消耗。
> - 焦化工序居次（7,347,844.06 tCO₂，占比 35.72%），洗精煤与焦炭为主要排放物料。
> - 掺烧自产二次能源的化石燃料发电设施排放 1,891,883.80 tCO₂，占比 9.19%，对应企业层级汇总表中同名的独立口径项。
> - 烧结工序与转炉炼钢工序排放量相对较小（合计占比 6.32%），但烧结工序以无烟煤、焦炭为主，是燃料替代的重点方向。

#### 2.4.8 五、逐月排放与强度走势（`sec-5`）

```html
<h1 class="brief-h1" id="sec-5">五、逐月排放与强度走势</h1>
<p class="brief-p">{PERIOD_CN}逐月排放量介于 {fmt(wan(minM.emission),2)} ~ {fmt(wan(maxM.emission),2)} 万tCO₂ 之间，单位{product}碳排放量介于 {fmt(bestInt.intensity,4)} ~ {fmt(worstInt.intensity,4)} {intUnit} 之间，整体呈<strong>排放量随产量波动、强度持续下降</strong>的走势。</p>
```

`minM / maxM / bestInt / worstInt` 只在**已发生月份**（`has:true`）中取。

**图 3**：折线图（纯 SVG，规格见 2.6），数据 = 各月排放量（万tCO₂，刻度 1 位小数），图题 `（图 3）{PERIOD_CN}逐月碳排放量走势（万tCO₂）`。  
**图 4**：折线图，数据 = 各月单位产品碳排放量（刻度 4 位小数），图题 `（图 4）{PERIOD_CN}逐月单位{product}碳排放量走势（{intUnit}）`。

**表 5 · 逐月生产与排放数据表**（`.btable`，5 列）：caption `<span>逐月生产与排放数据表（{PERIOD_CN}）</span><span class="unit">产量：万{prodUnit}；强度：{intUnit}；排放量：万tCO₂</span>`，表头：

```html
<th>月份</th><th>{prodNoun}（万{prodUnit}）</th><th>单位{product}碳排放量（{intUnit}）</th><th>碳排放量（万tCO₂）</th><th>占半年累计比重</th>
```

- 已发生月份行：月份（`1月`…`12月`）｜`fmt(wan(prod),2)`｜`fmt(intensity,4)`｜`fmt(wan(emission),2)`｜`fmt(emission/totalEmission*100,2)%`。
- **未发生月份行（关键规则）**：`has:false` 的月份输出占位行 `<tr class="is-empty"><td>{label}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`，灰字，**不计入合计、不参与占比**。例如 2026 年下半年的 10月 / 11月 / 12月。
- 合计行放 `<tfoot>`：

```html
<tfoot><tr><td>合计</td><td>{fmt(wan(totalProd),2)}</td><td>{fmt(unitIntensity,4)}</td><td>{fmt(wan(totalEmission),2)}</td><td>100.00%</td></tr></tfoot>
```

表后注：

```html
<div class="btable-note">注：合计栏的「单位{product}碳排放量」为半年累计排放量 ÷ 半年累计{prodNoun}，非各月强度的算术平均。</div>
```

3 条要点（`months[0]` = 报告期首月，`lastAvail` = 最后一个已发生月份）：

```html
<ul class="point-list">
  <li>排放量最高月为 {maxM.label}（{fmt(wan(maxM.emission),2)} 万tCO₂），最低月为 {minM.label}（{fmt(wan(minM.emission),2)} 万tCO₂），月度波动主要来自{prodNoun}变化。</li>
  <li>单位{product}碳排放量由 {months[0].label} 的 {fmt(months[0].intensity,4)} {intUnit} 降至 {lastAvail.label} 的 {fmt(lastAvail.intensity,4)} {intUnit}，累计下降 {fmt((months[0].intensity-lastAvail.intensity)/months[0].intensity*100,2)}%。</li>
  <li>强度最优月为 {bestInt.label}（{fmt(bestInt.intensity,4)} {intUnit}），最差月为 {worstInt.label}（{fmt(worstInt.intensity,4)} {intUnit}）。</li>
</ul>
```


### 2.5 数据规则（唯一数据源）

**本节是所有数字的唯一来源。** 全部演示数据按行业给出 4 套「基准期明细」（对应某存证月份的实测口径），报告页的半年度数字全部由基准期数据按统一规则折算，**不得另行编造任何数字**。

通用常量：

```js
var C_TO_CO2 = 44 / 12;            // 碳 → 二氧化碳换算系数
var YEARS = [2026, 2025, 2024, 2023, 2022];
var CURRENT_YEAR = 2026;
var CURRENT_MONTH = 9;             // 演示设定的「当前月」，决定 2026 下半年只有 7—9 月有数据
/* 其他年份相对 2026 的修正系数 */
var YEAR_INT_FACTOR = { 2025: 1.0425, 2024: 1.0866, 2023: 1.1315, 2022: 1.1770 };
var YEAR_PROD_FACTOR = { 2025: 0.9850, 2024: 0.9760, 2023: 0.9640, 2022: 0.9520 };
```

#### 2.5.1-A 行业数据集 · 钢铁（steel）

```js
var STEEL = {
  product: '粗钢', prodNoun: '粗钢产量', prodUnit: 't', intUnit: 'tCO₂/t',
  baseProd: 595279.00,          // 基准月（6 月）粗钢产量，t
  targetIntensity: 2.0395,      // 基准月（6 月）单位粗钢碳排放量，tCO₂/t
  prodStep: 1,                  // 产量取整步长
  /* 化石燃料燃烧明细：[物料, 消耗量, 消耗量单位, 低位发热量, 发热量单位, 单位热值含碳量, 含碳量单位, 排放量] */
  BASE_FUEL: [
    ['无烟煤',   2317.68,   't',      25.024,  'GJ/t',      0.02749, 'tC/GJ', 5845.97],
    ['烟煤',     120188.43, 't',      23.736,  'GJ/t',      0.02618, 'tC/GJ', 273849.07],
    ['洗精煤',   300810.90, 't',      26.344,  'GJ/t',      0.02541, 'tC/GJ', 738331.47],
    ['焦炭',     66522.44,  't',      28.435,  'GJ/t',      0.02942, 'tC/GJ', 204049.48],
    ['焦炉煤气', 920.50,    '10⁴Nm³', 173.854, 'GJ/10⁴Nm³', 0.0121,  'tC/GJ', 7100.11]
  ],
  /* 过程排放明细：[物料, 消耗量(t), 排放因子(tCO₂/t), 排放量] */
  BASE_PROCESS: [
    ['高碳铬铁',     312.00,   0.348, 108.58],
    ['微碳锰铁',     1256.54,  0.004, 5.03],
    ['电炉高碳锰铁', 1301.32,  0.275, 357.86],
    ['锰硅合金',     6181.94,  0.092, 568.74],
    ['硅铁',         1798.22,  0.007, 12.59],
    ['钼铁合金',     20.54,    0.018, 0.37],
    ['镍铁',         0.00,     0.037, 0.00],
    ['废钢',         55461.56, 0.037, 2052.08],
    ['生铁',         9867.76,  0.172, 1697.25],
    ['电极',         371.22,   3.663, 1359.78],
    ['白云石',       53361.58, 0.476, 25400.11],
    ['石灰石',       1891.38,  0.440, 832.21]
  ],
  /* 含碳产品（扣减项）：[产品, 产量(t), 排放因子(tCO₂/t), 隐含排放量] */
  BASE_PRODUCT: [
    ['粗钢',   595279.00, 0.037, 22025.32],
    ['粗苯',   1878.22,   3.382, 6352.14],
    ['煤焦油', 7089.94,   2.699, 19135.75]
  ],
  /* 工序层级明细（按生产线归集）：[工序名, [[物料, 排放量]...], 工序合计] */
  BASE_PROCESS_LINE: [
    ['焦化工序',       [['洗精煤', 575054.11], ['焦炭', 469412.30], ['高炉煤气', 120522.54], ['焦炉煤气', 55683.25]], 1220672.20],
    ['烧结工序',       [['无烟煤', 49639.49], ['焦炭', 41167.53], ['焦炉煤气', 2360.35]], 93167.37],
    ['炼铁工序',       [['高炉煤气', 796719.68], ['焦炭', 625413.88], ['烟煤', 229008.30], ['焦粉', 10556.69], ['无烟煤', 3939.43], ['焦炉煤气', 706.69]], 1666344.67],
    ['转炉炼钢工序',   [['转炉煤气', 121677.72], ['焦炉煤气', 785.99], ['高炉煤气', 322.63]], 122786.34],
    ['掺烧自产二次能源的化石燃料发电设施', [['高炉煤气', 196949.27], ['转炉煤气', 106269.31], ['焦炉煤气', 10984.50]], 314203.08]
  ],
  /* 汇总表净额口径：工序层级 / 发电设施（其他 = 总量 − 这两项） */
  SUMMARY_SPLIT: [390764.54, 314203.08]
};
```

基准期合计（必须复算一致）：燃料小计 `1,229,176.10`；过程小计 `32,394.60`；含碳产品小计 `47,513.21`；**基准期企业层级排放总量 = 1,229,176.10 + 32,394.60 − 47,513.21 = `1,214,057.49` tCO₂**；工序明细合计 `3,417,173.66`（大于净额口径，见口径说明）。

#### 2.5.1-B 行业数据集 · 发电（power）

```js
var POWER = {
  product: '上网电量', prodNoun: '上网电量', prodUnit: 'MWh', intUnit: 'tCO₂/MWh',
  baseProd: 842900, targetIntensity: 1.0480, prodStep: 100,
  BASE_FUEL: [
    ['原煤',   372000, 't',      21.500,  'GJ/t',      0.02618, 'tC/GJ', 767754.68],
    ['天然气', 4200,   '10⁴Nm³', 389.31,  'GJ/10⁴Nm³', 0.01532, 'tC/GJ', 91849.13],
    ['柴油',   1200,   't',      42.652,  'GJ/t',      0.02020, 'tC/GJ', 3790.91],
    ['燃料油', 1600,   't',      41.816,  'GJ/t',      0.02110, 'tC/GJ', 5176.26]
  ],
  BASE_PROCESS: [
    ['石灰石（脱硫）', 24000, 0.440, 10560.00],
    ['石灰（脱硫）',   5200,  0.785, 4082.00],
    ['白云石（脱硫）', 3200,  0.476, 1523.20],
    ['尿素（脱硝）',   1800,  0.733, 1319.40]
  ],
  BASE_PRODUCT: [
    ['脱硫石膏', 38500, 0.024, 924.00],
    ['粉煤灰',   96000, 0.018, 1728.00]
  ],
  BASE_PROCESS_LINE: [
    ['1号燃煤机组',  [['原煤', 412000.00], ['柴油', 2300.00]], 414300.00],
    ['2号燃煤机组',  [['原煤', 398000.00], ['燃料油', 2900.00]], 400900.00],
    ['燃气轮机',     [['天然气', 68000.00]], 68000.00],
    ['余热锅炉',     [['天然气', 22000.00]], 22000.00],
    ['掺烧自产二次能源的化石燃料发电设施', [['原煤', 28000.00], ['天然气', 6000.00]], 34000.00]
  ],
  SUMMARY_SPLIT: [318000.00, 402000.00]
};
```

基准期合计：燃料小计 `868,570.98`；过程小计 `17,484.60`；含碳产品小计 `2,652.00`；**基准期企业层级排放总量 = `883,403.58` tCO₂**；工序明细合计 `939,200.00`。

#### 2.5.1-C 行业数据集 · 建材（building）

```js
var BUILDING = {
  product: '水泥熟料', prodNoun: '水泥熟料产量', prodUnit: 't', intUnit: 'tCO₂/t',
  baseProd: 145500, targetIntensity: 0.9120, prodStep: 100,
  BASE_FUEL: [
    ['烟煤',   18000, 't',      23.736,  'GJ/t',      0.02618, 'tC/GJ', 41012.96],
    ['无烟煤', 9600,  't',      25.024,  'GJ/t',      0.02749, 'tC/GJ', 24214.42],
    ['石油焦', 4200,  't',      32.500,  'GJ/t',      0.02750, 'tC/GJ', 13763.75],
    ['柴油',   260,   't',      42.652,  'GJ/t',      0.02020, 'tC/GJ', 821.36],
    ['天然气', 180,   '10⁴Nm³', 389.31,  'GJ/10⁴Nm³', 0.01532, 'tC/GJ', 3936.39]
  ],
  BASE_PROCESS: [
    ['石灰石',         105000, 0.440, 46200.00],
    ['白云石',         7200,   0.476, 3427.20],
    ['铁粉（配料）',   3000,   0.190, 570.00],
    ['粉煤灰（配料）', 4400,   0.008, 35.20],
    ['石膏（配料）',   5400,   0.015, 81.00],
    ['电极',           30,     3.663, 109.89]
  ],
  BASE_PRODUCT: [
    ['水泥产品（碳化固碳）', 102000, 0.012, 1224.00],
    ['混凝土制品',           18000,  0.015, 270.00]
  ],
  BASE_PROCESS_LINE: [
    ['生料制备',           [['柴油', 240.00], ['无烟煤', 3200.00]], 3440.00],
    ['熟料烧成（回转窑）', [['烟煤', 46000.00], ['无烟煤', 28000.00], ['石油焦', 16000.00], ['石灰石', 52000.00]], 142000.00],
    ['水泥粉磨',           [['柴油', 320.00]], 320.00],
    ['余热发电',           [['烟煤', 8200.00]], 8200.00],
    ['掺烧自产二次能源的化石燃料发电设施', [['烟煤', 6400.00], ['天然气', 2200.00]], 8600.00]
  ],
  SUMMARY_SPLIT: [58000.00, 26000.00]
};
```

基准期合计：燃料小计 `83,748.88`；过程小计 `50,423.29`；含碳产品小计 `1,494.00`；**基准期企业层级排放总量 = `132,678.17` tCO₂**；工序明细合计 `162,560.00`。

#### 2.5.1-D 行业数据集 · 化工（chemical）

```js
var CHEMICAL = {
  product: '合成氨', prodNoun: '合成氨产量', prodUnit: 't', intUnit: 'tCO₂/t',
  baseProd: 62000, targetIntensity: 1.8600, prodStep: 100,
  BASE_FUEL: [
    ['原料煤',   31000, 't',      22.800,  'GJ/t',      0.02650, 'tC/GJ', 68677.40],
    ['天然气',   1800,  '10⁴Nm³', 389.31,  'GJ/10⁴Nm³', 0.01532, 'tC/GJ', 39363.91],
    ['焦炉煤气', 2600,  '10⁴Nm³', 173.854, 'GJ/10⁴Nm³', 0.0121,  'tC/GJ', 20054.64],
    ['燃料油',   520,   't',      41.816,  'GJ/t',      0.02110, 'tC/GJ', 1682.29]
  ],
  BASE_PROCESS: [
    ['石灰石',         8600, 0.440, 3784.00],
    ['白云石',         1800, 0.476, 856.80],
    ['电极',           120,  3.663, 439.56],
    ['碳酸钠',         3200, 0.415, 1328.00],
    ['催化剂（镍基）', 80,   1.200, 96.00]
  ],
  BASE_PRODUCT: [
    ['尿素',     18000, 0.733, 13194.00],
    ['甲醇',     4200,  1.375, 5775.00],
    ['碳酸氢铵', 3600,  0.560, 2016.00]
  ],
  BASE_PROCESS_LINE: [
    ['造气',           [['原料煤', 42000.00], ['天然气', 12000.00]], 54000.00],
    ['变换与净化',     [['焦炉煤气', 6200.00], ['原料煤', 8000.00]], 14200.00],
    ['氨合成',         [['天然气', 18000.00]], 18000.00],
    ['尿素与碳铵生产', [['燃料油', 3400.00]], 3400.00],
    ['掺烧自产二次能源的化石燃料发电设施', [['原料煤', 26000.00], ['焦炉煤气', 4800.00]], 30800.00]
  ],
  SUMMARY_SPLIT: [46000.00, 32000.00]
};
```

基准期合计：燃料小计 `129,778.24`；过程小计 `6,504.36`；含碳产品小计 `20,985.00`；**基准期企业层级排放总量 = `115,297.60` tCO₂**；工序明细合计 `120,400.00`。

#### 2.5.2 逐月数据生成规则（所有行业共用）

逐月产量 / 强度由「基准月值 × 逐月乘数」生成。乘数表与行业无关（12 个月固定的季节节奏）：

```js
/* 上半年（1—6 月）产量乘数、强度乘数 */
var MH1P = [0.9718085, 0.9446044, 1.0101468, 0.9958354, 1.0339418, 1.0];
var MH1I = [1.0227998, 1.0274577, 1.0099534, 1.0061770, 1.0008335, 1.0];
/* 下半年（7—12 月）产量乘数、强度乘数 */
var MH2P = [1.0228813, 1.0272491, 1.0143183, 1.0264011, 1.0119651, 1.0181329];
var MH2I = [0.9993047, 0.9959696, 0.9936749, 0.9912233, 0.9893601, 0.9867124];
```

生成规则（对报告年 `year`、半年 `half`，行业数据集 `IND`）：

1. 2026 年各月：
   - 月产量 `prod = round(baseProd × 乘数P[i] / prodStep) × prodStep`（钢铁 `prodStep=1` 即四舍五入到整数吨）；
   - 月强度 `intensity = r4(targetIntensity × 乘数I[i])`；
   - 月排放量 `emission = r2(prod × intensity)`；
   - **特例**：2026 年上半年 6 月（i=5）的排放量直接改写为基准期企业层级排放总量 `baseTotal`（明细合计），不用 `prod × intensity`。
2. 非 2026 年（2022—2025）各月：先按上一步算出该月 2026 年的 `prod / intensity`，再
   - `prod = round(prod × YEAR_PROD_FACTOR[year])`；
   - `intensity = r4(intensity × YEAR_INT_FACTOR[year])`；
   - `emission = r2(prod × intensity)`（无特例改写）。
3. 每月记录 `{ no, label: no + '月', prod, intensity, emission, has }`。`has` 规则见 2.5.3。

#### 2.5.3 半年聚合与「未发生月份」规则

- `availCount`：仅当 `year == 2026 && half == 2` 时 `availCount = CURRENT_MONTH - 6 = 3`（即 2026 下半年只有 7、8、9 月已发生）；其余所有 (year, half) 组合 `availCount = 6`。
- 月份序号 `no`：上半年为 1—6，下半年为 7—12。`has` = 该月在半年内的位置 < availCount，即上半年全部 `has:true`；2026 下半年的 10月、11月、12月 `has:false`。
- `complete = (availCount == 6)`；`availableCount = complete ? 6 : availCount`。
- 聚合（**只用 `has:true` 的月份**）：
  - `totalEmission = r2(Σ emission)`（complete 时取 6 个月，否则取前 availCount 个月）；
  - `totalProd = Σ prod`（整数）；
  - `avgEmission = r2(totalEmission / availableCount)`；
  - `unitIntensity = r4(totalEmission / totalProd)`。
- **`has:false` 的月份在表格里必须渲染为 `—` 占位行（`.is-empty`），不计入合计与占比**；在折线图里不参与连线（横轴标签仍以灰色保留）。

#### 2.5.4 同比规则

- 上一年 = `year - 1`。若 `YEAR_INT_FACTOR[year - 1]` 不存在（即 2022 年），`hasPrev = false`：KPI 角标显示 `同比 —`，要点句用「无上年同期数据，不计算同比」。
- 否则按同一套规则构建上年同半年的数据；**若本半年 incomplete（2026 下半年），上年也只取前 `availCount` 个月**（同口径对比）。
- `yoyEmissionPct = r2((totalEmission − 上年同期) / 上年同期 × 100)`；`yoyProdPct` 同理；强度同比 = 本年 `unitIntensity` 对上年 `r4(上年排放/上年产量)` 的相对变化。

#### 2.5.5 半年度折算（HALF_FACTOR 与倒挤）

报告正文所有「基准期明细」都按同一个系数折算为半年度累计口径：

```js
var HALF_FACTOR = totalEmission / baseTotal;             // baseTotal = 基准期企业层级排放总量（如钢铁 1,214,057.49）
function scaleSum(rows, idx) { return r2(rows.reduce(function (a, r) { return a + r2(r[idx] * HALF_FACTOR); }, 0)); }

var cumFuelSum = scaleSum(BASE_FUEL, 7);                 // 化石燃料燃烧（半年累计）
var cumProcessSum = scaleSum(BASE_PROCESS, 3);           // 过程排放（半年累计）
/* 含碳产品隐含排放取倒挤值，保证「燃烧 + 过程 − 含碳产品 = 企业层级总量」严格成立 */
var cumProductSum = r2(cumFuelSum + cumProcessSum - totalEmission);
var cumLineTotal = scaleSum(BASE_PROCESS_LINE, 2);       // 工序明细合计（半年累计）

/* 汇总表净额口径三项（保证「三项之和 = 企业层级合计」严格成立） */
var proc = r2(SUMMARY_SPLIT[0] * HALF_FACTOR);
var power = r2(SUMMARY_SPLIT[1] * HALF_FACTOR);
var other = r2(totalEmission - proc - power);
var halfSummary = { proc: proc, power: power, other: other, total: totalEmission };
```

明细表每一行（燃料/过程/含碳产品/工序/工序物料）的显示值同样为 `r2(行基准值 × HALF_FACTOR)`，逐行四舍五入到 2 位小数。**含碳产品小计必须用倒挤值 `cumProductSum`**，不能用逐行之和（否则勾稽式会出现尾差）。

#### 2.5.6 行业自适应文案规则

界面中所有行业相关文案必须从下表取词，**禁止写死**：

| 文案占位符                                                  | 钢铁                        | 发电                             | 建材                                  | 化工                                          |
| ------------------------------------------------------ | ------------------------- | ------------------------------ | ----------------------------------- | ------------------------------------------- |
| `{product}`                                            | 粗钢                        | 上网电量                           | 水泥熟料                                | 合成氨                                         |
| `{prodNoun}`（KPI 卡 3、表 5 列名、合计注）                       | 粗钢产量                      | 上网电量                           | 水泥熟料产量                              | 合成氨产量                                       |
| `{prodUnit}`                                           | t                         | MWh                            | t                                   | t                                           |
| `{intUnit}`                                            | tCO₂/t                    | tCO₂/MWh                       | tCO₂/t                              | tCO₂/t                                      |
| `{procShortNames}`（核算边界：4 个非发电设施工序，顿号连接；钢铁需去掉末尾「工序」二字） | 焦化、烧结、炼铁、转炉炼钢             | 1号燃煤机组、2号燃煤机组、燃气轮机、余热锅炉        | 生料制备、熟料烧成（回转窑）、水泥粉磨、余热发电            | 造气、变换与净化、氨合成、尿素与碳铵生产                        |
| `{productNames}`（概述口径说明第 3 条）                          | 粗钢、粗苯、煤焦油                 | 脱硫石膏、粉煤灰                       | 水泥产品（碳化固碳）、混凝土制品                    | 尿素、甲醇、碳酸氢铵                                  |
| `{gasFuelsCn}`（表 2 注）                                  | 焦炉煤气                      | 天然气                            | 天然气                                 | 天然气、焦炉煤气                                    |
| `{secEnergyCn}`（第四章口径说明）                               | 焦炭、焦炉煤气、高炉煤气、转炉煤气         | 高温蒸汽、余热烟气                      | 窑尾余热                                | 合成气、反应余热                                    |
| `{topHint}`                                            | 主要来自高炉煤气与焦炭消耗             | 主要来自原煤消耗                       | 主要来自石灰石分解与煤、石油焦燃料消耗                 | 主要来自原料煤与天然气消耗（含原料用能）                        |
| `{secondHint}`                                         | 洗精煤与焦炭为主要排放物料             | 原煤与燃料油为主要排放物料                  | 以窑尾余热回收发电为主，排放量相对可控                 | 以合成气压缩与回路循环为主                               |
| `{restHint}`                                           | 但烧结工序以无烟煤、焦炭为主，是燃料替代的重点方向 | 但燃气轮机以天然气为主，是可推进燃料替代与掺氢改造的重点方向 | 但生料制备与水泥粉磨以柴油、无烟煤为主，是燃料替代与电能替代的重点方向 | 但变换与净化、尿素与碳铵生产用能以焦炉煤气与燃料油为主，是原料替代与余热回收的重点方向 |

四个行业的 top / second / powerRow / rest 划分（按 2.4.7 的规则从工序表推出，结果应与此一致）：

| 行业 | top       | second | rest（restNames） |
| -- | --------- | ------ | --------------- |
| 钢铁 | 炼铁工序      | 焦化工序   | 烧结工序与转炉炼钢工序     |
| 发电 | 1号燃煤机组    | 2号燃煤机组 | 燃气轮机与余热锅炉       |
| 建材 | 熟料烧成（回转窑） | 余热发电   | 生料制备与水泥粉磨       |
| 化工 | 造气        | 氨合成    | 变换与净化与尿素与碳铵生产   |

> 注：化工的 restNames 按「名称用『与』连接」规则渲染为 `变换与净化与尿素与碳铵生产`（名称本身含「与」字，照规则连接即可，不做特殊处理）。

### 2.6 图表规格

本报告共 **4 张图**：图 1、图 2 为纯 HTML/CSS 横向条形图；图 3、图 4 为纯 SVG 折线图。**禁止引入任何图表库**（ECharts / Chart.js 等）。

**横向条形图两种归一方式**（结构均为 `.hbars > .hbar-row > (.hbar-label + .hbar-track>.hbar-fill + .hbar-val)`）：

- `hbarStruct`（总和归一，用于**图 1**）：条宽 % = 值 ÷ 各项之和 ×100（`toFixed(1)`）；右侧数值格式 `{fmt(value,2)} 万tCO₂（{pct}%）`（值后附占比）。
- `hbarCmp`（最大值归一，用于**图 2**）：条宽 % = `Math.max(0.6, 值 ÷ 最大值 × 100)`；右侧数值格式 `{fmt(value,2)} 万tCO₂`（不附占比）。带 `self:true` 的行加 `.is-self`（橙棕粗字 `#b25f00`）。

**折线图 `lineChartN(points, unit, dec)`**（points = `[{ label, value, has, isCur }]`）：

- `<svg viewBox="0 0 760 250" preserveAspectRatio="xMidYMid meet">`，内边距 `PL=66, PR=24, PT=26, PB=38`。
- 纵轴范围：取 `has:true` 点的 min/max，上下各外延 `span × 0.20`（**纵轴不从 0 起**，否则小差异被压平）。
- 5 条横向网格线（`stroke="#eef1f4"`），纵轴刻度 5 个（`font-size="10" fill="#98a1ab"`，按 `dec` 位小数格式化），纵轴单位写在左上（`fill="#b0b8c1"`）。
- 横轴标签：全部 6 个月份都显示（`font-size="10.5"`，已发生 `fill="#98a1ab"`，未发生 `fill="#d0d5db"`），**横轴 6 个点位均分**，与是否有数据无关。
- 折线：仅连接 `has:true` 的点（`<polyline fill="none" stroke="#00b42a" stroke-width="2.2" stroke-linejoin="round">`）。
- 数据点：普通点 `r=3`、白填充、绿边（`stroke="#00b42a" stroke-width="2"`）；高亮点（`isCur`）`r=5`、橙色 `fill/stroke="#ff7d00"`，上方 13px 处显示数值标签（`font-size="11" fill="#b25f00" font-weight="700"`）。
- `isCur` 规则：`has && no === (half === 1 ? 6 : 12)`——即**只高亮报告期最后一个月**（上半年 6 月 / 下半年 12 月）；2026 下半年 12 月未发生，故下半年报告**没有高亮点**（这是正确行为，不要「修正」它）。
- 每个图外套 `<div class="chart-box">`，图题用 `.chart-caption`。

### 2.7 表格规格

本报告共 **5 张 `.btable`**：表 1 排放量汇总表（4 列，首行 `is-self`）；表 2 化石燃料燃烧明细（6 列，`is-sub` 小计行）；表 3 过程排放 / 含碳产品明细（6 列，两个 `is-sub` 小计行 + `tfoot` 勾稽行）；表 4 工序构成表（4 列，`is-sub` 合计行）；表 5 逐月数据表（5 列，`tfoot` 合计行 + 可能的 `is-empty` 占位行）。通用规则：

- 表头 `<th>` 绿底 `#e9f7ee`；斑马纹 `tbody tr:nth-child(even)` 底色 `#fafcfb`；文本列加 `is-left`；单位小字用 `<div class="txt-sm">`。
- 小计 / 合计行：`is-sub`（浅绿 `#f4fbf6` 加粗）或放 `<tfoot>`（同色系加粗）。
- 方向列只出现 `计入` / `扣减` 两种文案；扣减列数字加 `.is-neg`（绿色）。
- 所有数字 `font-variant-numeric: tabular-nums`（CSS 已含），千分位分隔。
- **合计必须等于各行之和**（未发生月份不算行）。自检：表 5 合计排放量 = 各已发生月之和；占比列已发生月之和 = 100.00%。

### 2.8 下载导出

- 点击 `#btn-download`：按钮禁用并显示 `正在生成 PDF…`；用 `html2canvas` 逐个截取 `#brief-root .brief-page`（`scale: 2, backgroundColor: '#ffffff'`），按 A4（210×297mm）切片（`jsPDF('p','mm','a4')`，JPEG 质量 0.92），逐页 `addImage`。
- 文件名：`碳排放半年度报告-{YEAR}年{halfName}.pdf`（如 `碳排放半年度报告-2026年上半年.pdf`）。正文通常导出约 7 页（封面 1 + 目录 1 + 正文约 5）。
- 若 CDN 依赖加载失败或生成出错：降级为 `window.print()`（`@media print` 已隐藏工具条、纸面去阴影）。
- 完成后恢复按钮可用状态与原始文案。

### 2.9 不要做什么

1. **不要交付多个文件**——唯一交付物是自包含的单个 HTML 文件（除 2 个 CDN 依赖外不得引用任何本地资源）。
2. **不要出现平台外壳**——本页是独立全屏子页：没有顶部导航栏、没有侧边栏、没有面包屑、没有模块切换。
3. **不要出现「核算锚点月」「报告期末月」「基准月」等概念**——全篇任何位置（封面、概述、正文、注释）都不允许出现这类字样；数据期间一律**精确到月**（`2026-01 至 2026-06`），不要写成具体日期。
4. **不要第六章、第七章**——已彻底删除「六、参数取值与数据质量」「七、结论与下半年工作建议」，目录与正文都只有 摘要 + 五章。
5. **报告概述的 kv 表不要多出这些行**：核算方法、主要能源品种、主要含碳产品、核算锚点月、排放因子来源——kv 表恰好 3 行（核算主体 / 核算边界 / 报告期）。
6. **不要把未发生月份当有数渲染**——`has:false` 的月份必须输出 `—` 占位行（`.is-empty` 灰字），不计入合计、不参与占比、不参与折线连接。
7. **不要把颜色语义搞反**——排放类数字按数值符号着色（正红负绿），不要因为「产量上升是好事」就改成绿色。
8. **不要写死钢铁行业名词**——产品名、产量单位、强度单位、工序名、物料名、分析文案必须全部按 `industry` 入参走 2.5.6 的映射；切换行业后不允许残留「粗钢」「焦化」等钢铁词。
9. **不要引入图表库**——折线图手写 SVG、条形图纯 HTML/CSS；不要给折线图纵轴从 0 起始。
10. **不要改动章节结构**——目录 6 条、正文 6 个 `brief-h1`、5 张表、4 张图，数量与顺序固定；不要自行新增「结论」「建议」「附录」等小节。
11. **不要编造数字**——所有数字必须能按 2.5 的规则从行业数据集复算出来；含碳产品小计必须倒挤；勾稽式必须严格成立。

---

## 附：校验参考（实测期望值）

以下数字均按 2.5 的规则实算得出，用于生成后自检。`—` 表示该项不适用。

### A · 钢铁（steel）

| 指标                                             | 2026 上半年                                           | 2026 下半年（仅 7—9 月）                        |
| ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| 累计排放量 totalEmission（tCO₂）                      | 7,310,099.26                                       | 3,706,678.08                             |
| 月均排放量 avgEmission（tCO₂）                        | 1,218,349.88                                       | 1,235,559.36                             |
| 累计粗钢产量 totalProd（t）                            | 3,545,479                                          | 1,824,200                                |
| 单位粗钢碳排放量（tCO₂/t）                               | 2.0618                                             | 2.0319                                   |
| 同比：排放 / 强度 / 产量                                | −2.62% / −4.08% / +1.52%                           | −2.61% / −4.08% / +1.52%                 |
| HALF_FACTOR                                    | 6.021213                                           | 3.053132                                 |
| cumFuelSum / cumProcessSum / cumProductSum（倒挤） | 7,401,131.64 / 195,054.79 / 286,087.17             | 3,752,837.19 / 98,905.01 / 145,064.12    |
| 汇总三项：工序 / 发电设施 / 其他                            | 2,352,876.70 / 1,891,883.80 / 3,065,338.76         | 1,193,055.82 / 959,303.56 / 1,554,318.70 |
| cumLineTotal（工序明细合计）                           | 20,575,531.92                                      | 10,433,083.11                            |
| 发电设施排放占比                                       | 25.9%                                              | 25.9%                                    |
| KPI 渲染：累计 / 月均 / 产量 / 强度                       | 731.01 万tCO₂ / 121.83 万tCO₂/月 / 354.55 万t / 2.0618 | 370.67 / 123.56 / 182.42 / 2.0319        |

逐月表（产量 万t ｜ 强度 ｜ 排放 万tCO₂ ｜ 占比）：

| 月份    | 上半年                                 | 下半年                                 |
| ----- | ----------------------------------- | ----------------------------------- |
| 首月    | 1月：57.85 ｜ 2.0860 ｜ 120.68 ｜ 16.51% | 7月：60.89 ｜ 2.0380 ｜ 124.09 ｜ 33.48% |
| 第 2 月 | 2月：56.23 ｜ 2.0955 ｜ 117.83 ｜ 16.12% | 8月：61.15 ｜ 2.0312 ｜ 124.21 ｜ 33.51% |
| 第 3 月 | 3月：60.12 ｜ 2.0598 ｜ 123.84 ｜ 16.94% | 9月：60.38 ｜ 2.0266 ｜ 122.37 ｜ 33.01% |
| 第 4 月 | 4月：59.28 ｜ 2.0521 ｜ 121.65 ｜ 16.64% | 10月：—（is-empty 占位）                  |
| 第 5 月 | 5月：61.54 ｜ 2.0412 ｜ 125.62 ｜ 17.18% | 11月：—（is-empty 占位）                  |
| 第 6 月 | 6月：59.53 ｜ 2.0395 ｜ 121.41 ｜ 16.61% | 12月：—（is-empty 占位）                  |
| 合计    | 354.55 ｜ 2.0618 ｜ 731.01 ｜ 100.00%  | 182.42 ｜ 2.0319 ｜ 370.67 ｜ 100.00%  |

其他年份抽查：2025 上半年 累计 7,506,541.53 tCO₂、强度 2.1495（同比 −3.17% / −4.06% / +0.92%）；2022 上半年 `hasPrev=false`，三个同比角标均为「同比 —」。

### B · 发电（power）

| 指标                                             | 2026 上半年                                            | 2026 下半年（仅 7—9 月）                      |
| ---------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| 累计排放量（tCO₂）                                    | 5,319,236.28                                        | 2,697,205.48                           |
| 月均排放量（tCO₂）                                    | 886,539.38                                          | 899,068.49                             |
| 累计上网电量（MWh）                                    | 5,020,600                                           | 2,583,100                              |
| 单位上网电量碳排放量（tCO₂/MWh）                           | 1.0595                                              | 1.0442                                 |
| 同比：排放 / 强度 / 产量                                | −2.62% / −4.07% / +1.52%                            | −2.62% / −4.08% / +1.52%               |
| HALF_FACTOR                                    | 6.021298                                            | 3.053197                               |
| cumFuelSum / cumProcessSum / cumProductSum（倒挤） | 5,229,924.77 / 105,279.99 / 15,968.48               | 2,651,918.62 / 53,383.93 / 8,097.07    |
| 汇总三项：工序 / 发电设施 / 其他                            | 1,914,772.79 / 2,420,561.83 / 983,901.66            | 970,916.76 / 1,227,385.34 / 498,903.38 |
| cumLineTotal                                   | 5,655,203.15                                        | 2,867,562.96                           |
| 发电设施排放占比                                       | 45.5%                                               | 45.5%                                  |
| KPI 渲染：累计 / 月均 / 产量 / 强度                       | 531.92 万tCO₂ / 88.65 万tCO₂/月 / 502.06 万MWh / 1.0595 | 269.72 / 89.91 / 258.31 / 1.0442       |

逐月表（上半年 1—6 月，产量 万MWh）：81.91 ｜ 1.0719 ｜ 87.80 ｜ 16.51% ／ 79.62 ｜ 1.0768 ｜ 85.73 ｜ 16.12% ／ 85.15 ｜ 1.0584 ｜ 90.12 ｜ 16.94% ／ 83.94 ｜ 1.0545 ｜ 88.51 ｜ 16.64% ／ 87.15 ｜ 1.0489 ｜ 91.41 ｜ 17.19% ／ 84.29 ｜ 1.0480 ｜ 88.34 ｜ 16.61%；合计 502.06 ｜ 1.0595 ｜ 531.92 ｜ 100.00%。下半年 7—9 月：86.22 ｜ 1.0473 ｜ 90.30 ｜ 33.48% ／ 86.59 ｜ 1.0438 ｜ 90.38 ｜ 33.51% ／ 85.50 ｜ 1.0414 ｜ 89.04 ｜ 33.01%；10—12 月 `—` 占位；合计 258.31 ｜ 1.0442 ｜ 269.72 ｜ 100.00%。

其他年份抽查：2025 上半年 累计 5,462,131.95 tCO₂、强度 1.1045（同比 −3.17% / −4.06% / +0.92%）；2022 同比角标「同比 —」。

### C · 建材（building）

| 指标                                             | 2026 上半年                                        | 2026 下半年（仅 7—9 月）                   |
| ---------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| 累计排放量（tCO₂）                                    | 798,966.95                                      | 405,162.29                          |
| 月均排放量（tCO₂）                                    | 133,161.16                                      | 135,054.10                          |
| 累计水泥熟料产量（t）                                    | 866,600                                         | 445,900                             |
| 单位水泥熟料碳排放量（tCO₂/t）                             | 0.9220                                          | 0.9086                              |
| 同比：排放 / 强度 / 产量                                | −2.62% / −4.07% / +1.52%                        | −2.61% / −4.08% / +1.52%            |
| HALF_FACTOR                                    | 6.021842                                        | 3.053722                            |
| cumFuelSum / cumProcessSum / cumProductSum（倒挤） | 504,322.52 / 303,641.08 / 8,996.65              | 255,745.82 / 153,978.72 / 4,562.25  |
| 汇总三项：工序 / 发电设施 / 其他                            | 349,266.82 / 156,567.89 / 293,132.24            | 177,115.89 / 79,396.78 / 148,649.62 |
| cumLineTotal                                   | 978,910.61                                      | 496,413.09                          |
| 发电设施排放占比                                       | 19.6%                                           | 19.6%                               |
| KPI 渲染：累计 / 月均 / 产量 / 强度                       | 79.90 万tCO₂ / 13.32 万tCO₂/月 / 86.66 万t / 0.9220 | 40.52 / 13.51 / 44.59 / 0.9086      |

逐月表（上半年）：14.14 ｜ 0.9328 ｜ 13.19 ｜ 16.51% ／ 13.74 ｜ 0.9370 ｜ 12.87 ｜ 16.11% ／ 14.70 ｜ 0.9211 ｜ 13.54 ｜ 16.95% ／ 14.49 ｜ 0.9176 ｜ 13.30 ｜ 16.64% ／ 15.04 ｜ 0.9128 ｜ 13.73 ｜ 17.18% ／ 14.55 ｜ 0.9120 ｜ 13.27 ｜ 16.61%；合计 86.66 ｜ 0.9220 ｜ 79.90 ｜ 100.00%。下半年 7—9 月：14.88 ｜ 0.9114 ｜ 13.56 ｜ 33.47% ／ 14.95 ｜ 0.9083 ｜ 13.58 ｜ 33.52% ／ 14.76 ｜ 0.9062 ｜ 13.38 ｜ 33.01%；10—12 月 `—` 占位；合计 44.59 ｜ 0.9086 ｜ 40.52 ｜ 100.00%。

其他年份抽查：2025 上半年 累计 820,439.43 tCO₂、强度 0.9611（同比 −3.17% / −4.06% / +0.92%）；2022 同比角标「同比 —」。

### D · 化工（chemical）

| 指标                                             | 2026 上半年                                        | 2026 下半年（仅 7—9 月）                   |
| ---------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| 累计排放量（tCO₂）                                    | 694,396.99                                      | 352,097.61                          |
| 月均排放量（tCO₂）                                    | 115,732.83                                      | 117,365.87                          |
| 累计合成氨产量（t）                                     | 369,300                                         | 190,000                             |
| 单位合成氨碳排放量（tCO₂/t）                              | 1.8803                                          | 1.8531                              |
| 同比：排放 / 强度 / 产量                                | −2.62% / −4.08% / +1.52%                        | −2.62% / −4.08% / +1.52%            |
| HALF_FACTOR                                    | 6.022649                                        | 3.053816                            |
| cumFuelSum / cumProcessSum / cumProductSum（倒挤） | 781,608.80 / 39,173.48 / 126,385.29             | 396,318.81 / 19,863.13 / 64,084.33  |
| 汇总三项：工序 / 发电设施 / 其他                            | 277,041.86 / 192,724.77 / 224,630.36            | 140,475.52 / 97,722.10 / 113,899.99 |
| cumLineTotal                                   | 725,126.95                                      | 367,679.39                          |
| 发电设施排放占比                                       | 27.8%                                           | 27.8%                               |
| KPI 渲染：累计 / 月均 / 产量 / 强度                       | 69.44 万tCO₂ / 11.57 万tCO₂/月 / 36.93 万t / 1.8803 | 35.21 / 11.74 / 19.00 / 1.8531      |

逐月表（上半年）：6.03 ｜ 1.9024 ｜ 11.47 ｜ 16.52% ／ 5.86 ｜ 1.9111 ｜ 11.20 ｜ 16.13% ／ 6.26 ｜ 1.8785 ｜ 11.76 ｜ 16.93% ／ 6.17 ｜ 1.8715 ｜ 11.55 ｜ 16.63% ／ 6.41 ｜ 1.8616 ｜ 11.93 ｜ 17.18% ／ 6.20 ｜ 1.8600 ｜ 11.53 ｜ 16.60%；合计 36.93 ｜ 1.8803 ｜ 69.44 ｜ 100.00%。下半年 7—9 月：6.34 ｜ 1.8587 ｜ 11.78 ｜ 33.47% ／ 6.37 ｜ 1.8525 ｜ 11.80 ｜ 33.51% ／ 6.29 ｜ 1.8482 ｜ 11.63 ｜ 33.02%；10—12 月 `—` 占位；合计 19.00 ｜ 1.8531 ｜ 35.21 ｜ 100.00%。

其他年份抽查：2025 上半年 累计 713,075.11 tCO₂、强度 1.9603（同比 −3.17% / −4.06% / +0.92%）；2022 同比角标「同比 —」。
