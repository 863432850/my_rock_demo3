# 碳交易月度报表 — 界面复刻提示词

> 本文档描述「碳交易月度报表」（在「碳月报及差异分析」列表页选择碳交易页签 → 点击某个月份卡片的「月度报表」按钮后进入的全屏 A4 报告页）的完整界面规格。按「一、入参」给定 JSON 输入，严格按「二、任务」的规格生成与原型一模一样的界面。  
> 本文档是自包含的：不需要访问任何原项目源码。  
> 使用方法：把入参 JSON 改成目标值，连同本文档全文发给 AI 即可。
>
> 本页与「碳排放月度报表」是**两个独立页面**，同属「月度报表」家族：页面外壳（工具条 / 三张 A4 纸面 / 封面 / 目录 / 章节标题 / 卡片 / 表格 / 下载）完全一致，**只有正文内容、数据、图表不同**。本页的核心指标是 成交量 / 成交均价 / 成交金额 / 持仓，不是排放量与排放强度。

## 一、入参

```json
{
  "companyName": "河南安钢周口钢铁有限责任公司",   // 企业/主体名称，影响：封面 H1 第一行、工具条标题、浏览器标签页标题
  "year": 2026,                                   // 年份，影响：封面年月、封面「数据期间」、正文年号、下载文件名
  "month": 9                                      // 月份 1~12，影响：取数下标（决定取哪一个月）+ 同上所有年月文案
}
```

### 入参带入规则

| JSON 字段     | 影响位置                                 | 规则                                                                                                                        |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| companyName | 封面 H1 第一行 / 工具条标题 / 浏览器标签页标题         | 封面拼接为「{companyName}（换行）碳交易月报」；工具条标题为「{companyName}碳交易月报（{year}年{month}月）」；`document.title` = 「碳交易月报-{year}-{MM}」（MM 补零两位） |
| year        | 封面年月、封面「数据期间」、正文年号、下载文件名             | 四位年份。**注意：year 不参与取数**——演示数据是一套固定的 12 个月序列，只按 month 取第 month 行；year 仅改变文案年号与文件名                                           |
| month       | 封面年月、数据期间、取数下标、年累计求和截止月、折线图高亮月、下载文件名 | 取值 1~12；**< 1 或 > 12 一律按 9 处理**；`month` 用于取第 `month-1` 个数组元素（0 基下标）                                                       |

> **跨年细节**：`month = 1` 时，上月为**上一年 12 月**（标签形如「2025年12月」）；其余月份的上月为同年 `month-1` 月。上年同期恒为「{year-1}年{month}月」。

### 运行期入参来源（URL 查询参数）

```
?month=2026-09&company=河南安钢周口钢铁有限责任公司
```

- `month` 形如 `YYYY-MM`，拆分为 `year` 与 `month`；不传时用 JSON 示例值 `2026-09`。
- `company` 覆盖 `companyName`。
- 上游若附带 `?tab=trade` 之类的页签参数，**忽略即可**——本页只渲染「碳交易月度报表」这一种报表（见 2.9 负面清单）。

## 二、任务

### 2.1 交付物

- **最终只交付一个文件：`碳交易月度报表.html`**。这是硬性要求——除这一个 HTML 文件外，不得再产出任何其他文件（包括但不限于：html2canvas.min.js、jspdf.umd.min.js 等库文件、单独的 CSS/JS 文件、说明文档、测试文件）。
- **单个自包含 HTML 文件**：CSS 写在 `<style>` 内、JS 写在 `<script>` 内；报告内容全部由 JS 按入参动态拼装，挂载到 `<div id="brief-root"></div>`。
- PDF 下载依赖 html2canvas + jsPDF：**必须在这个 HTML 文件内部通过 CDN `<script src="...">` 引用**，不要把库文件作为产物交付，也不要求使用者手动准备库文件。引用方式固定为：

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
```

- 页面结构固定为「工具条 + `#brief-root`」两块，`<body>` 末尾先引 CDN 两库，再引页面自身的渲染脚本。


### 2.2 页面整体布局

```
┌──────────────────────────────────────────────────────────────┐
│ 工具条（sticky 顶置，白底，下边线 #e4e8ee，padding 10px 20px）   │
│ ← 返回碳月报及差异分析 │ {企业名}碳交易月报（2026年9月） │ [下载报告（PDF）] │
├──────────────────────────────────────────────────────────────┤
│ 页面底 #e9edf3，内容水平居中                                   │
│  ┌────────────────────────────────────────────────┐          │
│  │ A4 纸面 1：封面（920px 宽白卡，阴影）              │          │
│  └────────────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────────────┐          │
│  │ A4 纸面 2：目录                                  │          │
│  └────────────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────────────┐          │
│  │ A4 纸面 3：正文（摘要 + 一~五章）                  │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- 页面背景 `#e9edf3`；纸面宽 **920px**、白底、阴影 `0 4px 24px rgba(20,40,30,0.10)`、内边距 `64px 72px 72px`、行高 1.8；首张纸面 `margin: 22px auto 40px`，后续纸面间隔 18px。
- **三张纸面（封面 / 目录 / 正文）共用同一个容器类 `.brief-page`，宽度、内边距、阴影、水平居中完全一致**。禁止给目录页单独设置 `width` / `margin` / `padding` / `max-width`——`.brief-toc` 只允许定义目录内部标题与列表的样式。
- **无顶部导航、无侧栏、无面包屑、无列表页的月份卡片区**（这是全屏独立报告页，只有一条 sticky 工具条）。
- 页面外壳与「碳排放月度报表」**逐字相同**，必须原样使用下面这段 HTML / CSS：

```html
<div class="brief-toolbar" id="brief-toolbar">
  <a class="bt-back" href="monthly.html">← 返回碳月报及差异分析</a>
  <span class="bt-title" id="bt-title">碳交易月报</span>
  <div class="bt-actions">
    <button type="button" class="bt-btn" id="btn-download">
      ![svg](data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIGhlaWdodD0iMjQiPjxwYXRoIGQ9Ik0xMiAzdjEybTAgMGwtNC00bTQgNGw0LTQiLz48cGF0aCBkPSJNNCAyMWgxNiIvPjwvc3ZnPg==)
      下载报告（PDF）
    </button>
  </div>
</div>

<div id="brief-root"></div>
```

```html

<div id="brief-root">
  <div class="brief-page brief-cover-wrap">……封面……</div>
  <div class="brief-page brief-toc">……目录……</div>
  <div class="brief-page">……正文（摘要 + 一~五章）……</div>
</div>
```

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #e9edf3;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif;
  color: #222;
}

/* 顶部工具条（下载 PDF 时不包含） */
.brief-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 14px;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e8ee;
  box-shadow: 0 2px 8px rgba(20, 40, 30, 0.06);
}
.brief-toolbar .bt-back {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: #00b42a; text-decoration: none; white-space: nowrap;
}
.brief-toolbar .bt-back:hover { text-decoration: underline; }
.brief-toolbar .bt-title {
  font-size: 14px; font-weight: 600; color: #333;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.brief-toolbar .bt-actions { margin-left: auto; display: flex; gap: 8px; }
.brief-toolbar .bt-btn {
  height: 30px; padding: 0 14px; border-radius: 4px; font-size: 13px;
  cursor: pointer; border: 1px solid #00b42a; background: #00b42a; color: #fff;
  display: inline-flex; align-items: center; gap: 5px;
}
.brief-toolbar .bt-btn:hover { filter: brightness(1.06); }
.brief-toolbar .bt-btn svg { width: 14px; height: 14px; }

/* A4 纸面（三张纸面共用同一容器类） */
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
.brief-cover { text-align: center; padding: 130px 0 90px; position: relative; }
.brief-cover .cover-kicker {
  display: inline-block; font-size: 13px; letter-spacing: 6px; color: #00b42a;
  border: 1px solid #00b42a; border-radius: 20px; padding: 4px 18px 4px 24px;
  margin-bottom: 44px;
}
.brief-cover h1 { margin: 0 0 14px; font-size: 34px; letter-spacing: 2px; color: #1a1a1a; font-weight: 700; line-height: 1.5; }
.brief-cover .cover-month { font-size: 20px; color: #00b42a; letter-spacing: 4px; font-weight: 600; margin-top: 10px; }
.brief-cover .cover-tab {
  display: inline-block; margin-top: 16px; font-size: 14px; color: #1f7a3a;
  background: #e9f7ee; border: 1px solid #c8e8d2; border-radius: 16px;
  padding: 4px 18px; letter-spacing: 1px;
}
.brief-cover .cover-line { width: 120px; height: 3px; background: #00b42a; margin: 40px auto 0; border-radius: 2px; }
.brief-cover .cover-foot { margin-top: 110px; font-size: 13px; color: #8a9199; line-height: 2; }

/* 目录：只追加修饰类，绝对禁止设置 width / margin / padding / max-width */
.brief-toc h2 { font-size: 20px; margin: 0 0 18px; letter-spacing: 2px; }
.brief-toc ol { margin: 0; padding: 0; list-style: none; }
.brief-toc .toc-l1 { font-size: 15px; font-weight: 600; margin: 12px 0 4px; }
.brief-toc .toc-l2 { font-size: 13.5px; color: #555; margin: 2px 0 2px 22px; }
.brief-toc a { color: inherit; text-decoration: none; }
.brief-toc a:hover { color: #00b42a; }

/* 章节标题 */
.brief-h1 {
  font-size: 21px; margin: 34px 0 14px; padding: 8px 0 8px 14px;
  border-left: 5px solid #00b42a;
  background: linear-gradient(90deg, #e9f7ee 0%, rgba(233, 247, 238, 0) 70%);
  letter-spacing: 1px;
}
.brief-h2 { font-size: 16.5px; margin: 26px 0 10px; color: #1a1a1a; display: flex; align-items: center; gap: 8px; }
.brief-h2::before { content: ""; width: 8px; height: 8px; background: #00b42a; border-radius: 2px; flex-shrink: 0; }
.brief-p { font-size: 13.5px; color: #333; margin: 8px 0; }
.brief-p strong { color: #00b42a; }

/* 摘要 · 核心指标卡 */
.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0 18px; }
.kpi-card { border: 1px solid #e5eee8; border-radius: 8px; padding: 12px 14px; background: linear-gradient(160deg, #f4fbf6 0%, #ffffff 75%); }
.kpi-card.is-self { border-color: #ffd591; background: linear-gradient(160deg, #fff7e8 0%, #ffffff 80%); }
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

/* 横向条形图 */
.hbars { margin: 8px 0 4px; }
.hbar-row { display: flex; align-items: center; gap: 10px; margin: 7px 0; font-size: 12.5px; }
.hbar-row .hbar-label { width: 150px; text-align: right; color: #444; flex-shrink: 0; }
.hbar-row .hbar-track { flex: 1; height: 16px; background: #f2f4f7; border-radius: 3px; overflow: hidden; }
.hbar-row .hbar-fill { height: 100%; border-radius: 3px; }
.hbar-row .hbar-val { width: 150px; color: #333; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.hbar-row.is-self .hbar-label,
.hbar-row.is-self .hbar-val { font-weight: 700; color: #b25f00; }

/* 图框 */
.chart-box { border: 1px solid #e8ebef; border-radius: 6px; padding: 12px 14px 6px; margin: 12px 0 4px; background: #fff; }
.chart-box svg { width: 100%; height: auto; display: block; }
.chart-caption { text-align: center; font-size: 12.5px; color: #8a9199; margin: 4px 0 16px; }

/* 表 */
.table-caption { font-size: 13px; color: #333; margin: 16px 0 6px; display: flex; justify-content: space-between; align-items: baseline; }
.table-caption .unit { font-size: 12px; color: #8a9199; }
.btable { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 6px; }
.btable th, .btable td { border: 1px solid #e3e7ec; padding: 6px 8px; text-align: center; font-variant-numeric: tabular-nums; }
.btable th { background: #e9f7ee; color: #1a1a1a; font-weight: 600; }
.btable tbody tr:nth-child(even) td { background: #fafcfb; }
.btable .is-pos { color: #d4380d; }
.btable .is-neg { color: #2ba471; }
.btable .is-self { background: #fff7e8 !important; font-weight: 600; }
.btable tfoot td { background: #f4fbf6; font-weight: 600; }
.btable-note { font-size: 12px; color: #98a1ab; margin: 2px 0 12px; }

/* 建议列表 */
.advice-list { margin: 8px 0; padding: 0; list-style: none; counter-reset: advice; }
.advice-list li {
  counter-increment: advice; position: relative;
  padding: 8px 12px 8px 40px; margin: 6px 0;
  background: #f8faf9; border: 1px solid #edf1ee; border-radius: 6px;
  font-size: 13px; color: #333; line-height: 1.7;
}
.advice-list li::before {
  content: counter(advice); position: absolute; left: 12px; top: 9px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #00b42a; color: #fff; font-size: 11px; line-height: 18px; text-align: center;
}

@media print {
  body { background: #fff; }
  .brief-toolbar { display: none; }
  .brief-page { width: auto; margin: 0; box-shadow: none; padding: 24px 8px; }
  .brief-cover { page-break-after: always; }
  .brief-toc { page-break-after: always; }
  .brief-h1 { page-break-after: avoid; }
  .chart-box, .btable { page-break-inside: avoid; }
}
```

**生成后自查**：封面、目录、正文三张纸面的左边缘严格对齐成一条竖线；目录的「目　录」标题与摘要的「摘要 · 本月核心指标概览」标题左边缘也在同一竖线上。

### 2.3 设计规格

**色板**

| 用途                          | 色值                                                     |
| --------------------------- | ------------------------------------------------------ |
| 主绿（封面强调 / 章节竖条 / 按钮 / 序号圆点） | `#00b42a`                                              |
| 页面底                         | `#e9edf3`                                              |
| 纸面 / 工具条底                   | `#ffffff`                                              |
| 章节标题渐变起 / 表头底 / 卡片渐变起       | `#e9f7ee`                                              |
| 卡片渐变底                       | `#f4fbf6 → #ffffff`                                    |
| 正文                          | `#222` / `#333` / `#444` / `#1a1a1a`                   |
| 弱文字                         | `#8a9199`、`#98a1ab`、`#6b7280`                          |
| 语义色 · 红（`is-pos`）           | `#d4380d`                                              |
| 语义色 · 绿（`is-neg`）           | `#2ba471`                                              |
| 中性说明行（`is-flat`）            | `#98a1ab`                                              |
| 本月高亮（橙）                     | 条形 `#ff7d00`、文字 `#b25f00`、卡片底 `#fff7e8`、卡片边框 `#ffd591` |
| 上月（绿）                       | `#00b42a`                                              |
| 上年同期（蓝）                     | `#165dff`                                              |
| 表格边框 / 图框边框                 | `#e3e7ec` / `#e8ebef`                                  |
| 卡片边框                        | `#e5eee8`                                              |

**字体**：`-apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif`。  
封面 H1 34px/700/字距 2px/行高 1.5；封面年月 20px/600/字距 4px 绿色；封面 kicker 13px/字距 6px 绿色圆角胶囊。  
章节 H1 21px（左侧 5px 绿竖条 + `#e9f7ee` 向右渐隐背景，padding `8px 0 8px 14px`）；H2 16.5px（前置 8×8px 绿色小方块）；正文 13.5px；要点列表 12.5px/行高 1.9；表格 12.5px；建议条目 13px；图题 12.5px 灰。

**图标**：仅工具条「下载报告（PDF）」按钮带一个 14px 线性 SVG 下载图标。正文无图标、**无 emoji**。

**着色语义（碳交易月报 · 重要）**：本页是**交易/金额**口径，不是排放口径，红绿映射按下面统一规则（`deltaCls(n)` = `n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : '')`）：

| 指标            | 方向              | class                         | 颜色 | 实现（传参）                                          |
| ------------- | --------------- | ----------------------------- | -- | ----------------------------------------------- |
| 成交量（环比/同比）    | 增加 = 放量（好）      | `is-neg`                      | 绿  | `deltaCls(-volMomPct)` / `deltaCls(-volYoyPct)` |
| 成交均价（环比/同比）   | 上涨 = 采购成本上升（不利） | `is-pos`                      | 红  | `deltaCls(prMomPct)` / `deltaCls(prYoyPct)`     |
| 成交金额、持仓市值折算   | 增加 = 增收（好）      | `is-neg`                      | 绿  | `deltaCls(-amtMomPct)` / `deltaCls(-amtYoyPct)` |
| 市场行情「较上月」涨跌幅  | 上涨 = 价格上行       | `is-pos`                      | 红  | `deltaCls(chg)`                                 |
| 成交明细「买入 / 卖出」 | 买入 = 资金流出       | 买入 `is-pos`（红）、卖出 `is-neg`（绿） | —  | 按方向字面量直接给 class                                 |

> **一致性说明**：原型中 KPI 卡的「本月成交量」「本月成交均价」两处曾传入与对比表相反的符号；本规格按上表**统一两处的着色**，使同一页内同一指标的颜色语义一致。除此之外一切照原型。


### 2.4 区块逐一规格

**(1) 工具条**（sticky 顶置，白底，下边线 `#e4e8ee`，打印/下载 PDF 时隐藏）

- 左：链接「← 返回碳月报及差异分析」（13px，绿 `#00b42a`，href 指向 `monthly.html`）。
- 中：标题 14px/600 `#333`：`{companyName}碳交易月报（{year}年{month}月）`。
- 右：绿色实心按钮「下载报告（PDF）」（高 30px、圆角 4px、底 `#00b42a`、白字 13px、前置 14px 下载 SVG）。

**(2) 封面**（第一张纸面，`<div class="brief-page brief-cover-wrap"><div class="brief-cover">…`，居中排版，`padding: 130px 0 90px`）

1. 胶囊 kicker：文字「碳 交 易 月 报」（13px、字距 6px、绿色、1px 绿边、圆角 20px、padding `4px 18px 4px 24px`）。
2. H1 两行：第一行 `{companyName}`，第二行 `碳交易月报`。
3. 封面年月：`{year}年{month}月`（20px 绿色、字距 4px、600）。
4. 页签胶囊：文字「碳交易 · 月度报表」（14px，字 `#1f7a3a`、底 `#e9f7ee`、边 `#c8e8d2`、圆角 16px、padding `4px 18px`）。
5. 装饰线：120×3px 绿色圆角横线，上间距 40px。
6. 底部（`margin-top: 110px`，13px `#8a9199`）：仅一行「数据期间：{year}-{MM}-01 至 {year}-{MM}-{月末日}」。**无编制单位、无编制日期、无落款**。

**(3) 目录**（第二张纸面，`<div class="brief-page brief-toc">`；`.brief-toc` 不得带任何 `width`/`margin`/`padding`）

- 标题「目　录」（20px、字距 2px），6 个 `.toc-l1` 条目，点击平滑定位：

| 序号 | 目录文字          | 锚点       | 对应区块     |
| -- | ------------- | -------- | -------- |
| 1  | 摘要 · 本月核心指标概览 | `#sec-0` | 摘要       |
| 2  | 一、交易概况        | `#sec-1` | 一、交易概况   |
| 3  | 二、成交明细        | `#sec-2` | 二、成交明细   |
| 4  | 三、持仓与资产       | `#sec-3` | 三、持仓与资产  |
| 5  | 四、市场行情        | `#sec-4` | 四、市场行情   |
| 6  | 五、本月交易建议      | `#sec-5` | 五、本月交易建议 |

**(4) 摘要 · 本月核心指标概览**（`<h1 class="brief-h1" id="sec-0">摘要 · 本月核心指标概览</h1>`）

1. **KPI 卡片区**：`.kpi-grid`，grid **3 列**、间距 10px，共 **6 张卡**。每卡三行：名称（12px 灰）→ 大数值（20px/700，单位放 `<small>` 12px 灰）→ 说明行（11.5px）。第 1 张卡加 `.is-self`（橙色高亮）。6 张卡依次为：

| # | 名称     | 数值（单位）                     | 说明行（模板）                                         | 说明行 class                            |
| - | ------ | -------------------------- | ----------------------------------------------- | ------------------------------------ |
| 1 | 本月成交量  | `{volCur}` 万tCO₂           | `环比 {signed(volMomPct,2,'%')}`                  | `deltaCls(-volMomPct)`；卡加 `.is-self` |
| 2 | 本月成交均价 | `{prCur}` 元/tCO₂           | `环比 {signed(prMomPct,2,'%')}`                   | `deltaCls(prMomPct)`                 |
| 3 | 本月成交金额 | `{amtCur}` 万元              | `量价联动口径`                                        | `is-flat`                            |
| 4 | 年累计成交量 | `{cumVol}` 万tCO₂           | `截至 {MONTH_CN}`                                 | `is-flat`                            |
| 5 | 期末持仓量  | `{holdTotal}` 万tCO₂（1 位小数） | `配额 {holdAllowance} + CCER {holdCCER}`（各 1 位小数） | `is-flat`                            |
| 6 | 期末持仓市值 | `{holdValue}` 万元           | `按本月均价折算`                                       | `is-neg`                             |

1. **要点列表** `.point-list`（12.5px，4 条；加粗文字在正文里是绿色 `#00b42a`）：
   1. 本月碳市场成交 `<strong>{volCur}</strong>` 万tCO₂，成交均价 `<strong>{prCur}</strong>` 元/tCO₂，成交金额 `{amtCur}` 万元。
   2. 成交量环比{增加|减少} `{abs(volMomPct)}`%，同比{增加|减少} `{abs(volYoyPct)}`%。
   3. 成交均价环比{上涨|下跌} `{abs(prMomPct)}`%，价格整体处于全国碳市场合理区间。
   4. 期末持仓 `{holdTotal}` 万tCO₂，市值 `{holdValue}` 万元，可覆盖年度履约需求并保留一定交易弹性。
   > 「增加/减少」「上涨/下跌」按符号选择（`≥0` 取前者），数值取绝对值、2 位小数带 `%`。

**(5) 一、交易概况**（`id="sec-1"`）

1. 引导段 `.brief-p`：  
   「本月为 `{MONTH_CN}`，企业通过全国碳排放权交易市场及区域试点市场开展配额与 CCER 交易，累计成交 `{volCur}` 万tCO₂，成交金额 `{amtCur}` 万元，成交均价 `{prCur}` 元/tCO₂。与上月及上年同期对比如下表。」
2. **月度交易对比表**：表题「月度交易对比表」+ 右单位「成交量：万tCO₂；均价：元/tCO₂；金额：万元」。6 列 3 行：

| 列   | 指标   | 本月（{MONTH_CN}）         | 上月（{PREV_CN}） | 环比                                                       | 上年同期（{YOY_CN}） | 同比                                                       |
| --- | ---- | ---------------------- | ------------- | -------------------------------------------------------- | -------------- | -------------------------------------------------------- |
| 行 1 | 成交量  | `{volCur}`（`.is-self`） | `{volPrev}`   | `{signed(volMomPct,2,'%')}` class=`deltaCls(-volMomPct)` | `{volYoy}`     | `{signed(volYoyPct,2,'%')}` class=`deltaCls(-volYoyPct)` |
| 行 2 | 成交均价 | `{prCur}`（`.is-self`）  | `{prPrev}`    | `{signed(prMomPct,2,'%')}` class=`deltaCls(prMomPct)`    | `{prYoy}`      | `{signed(prYoyPct,2,'%')}` class=`deltaCls(prYoyPct)`    |
| 行 3 | 成交金额 | `{amtCur}`（`.is-self`） | `{amtPrev}`   | `{signed(amtMomPct,2,'%')}` class=`deltaCls(-amtMomPct)` | `{amtYoy}`     | `{signed(amtYoyPct,2,'%')}` class=`deltaCls(-amtYoyPct)` |

表注：「注：成交金额 = 成交量（万t）× 成交均价（元/t），单位为万元；环比、同比算法同排放报表。」  
3\. **成交金额对比条形图**（`cmpBars`，规格见 2.6 图 A），图题「（图）本月 / 上月 / 上年同期成交金额对比」。

**(6) 二、成交明细**（`id="sec-2"`）

**本月成交明细表**：表题「本月成交明细」+ 右单位「数量：万tCO₂；价格：元/tCO₂」。7 列 6 行 + 合计行：

| 列     | 成交日期                    | 交易方向                                | 交易品种  | 数量           | 成交均价         | 成交金额（万元）            | 交易用途  |
| ----- | ----------------------- | ----------------------------------- | ----- | ------------ | ------------ | ------------------- | ----- |
| 行数据来源 | 2.5 的 `DEAL_ROWS[i][0]` | `[1]`，买入→`is-pos`(红)、卖出→`is-neg`(绿) | `[2]` | `fmt([3],2)` | `fmt([4],2)` | `fmt([3]×[4],2)`    | `[5]` |
| 合计行   | 合计（`colspan="5"`）       | —                                   | —     | —            | —            | `{sumAmt}`（6 行金额之和） | —     |

表注：「注：成交明细为演示数据；买入用于履约补仓与储备建仓，卖出为盈余配额择机变现。」

**(7) 三、持仓与资产**（`id="sec-3"`）

1. 引导段 `.brief-p`：  
   「截至目前，企业碳资产持仓合计 `<strong>{holdTotal}</strong>` 万tCO₂，按本月成交均价 `{prCur}` 元/tCO₂ 折算，持仓市值约 `<strong>{holdValue}</strong>` 万元。持仓结构如下。」
2. **期末碳资产持仓结构图**（`structBars`，总和归一，规格见 2.6 图 B），图题「（图）期末碳资产持仓结构（{MONTH_CN}）」。
3. **要点列表** 3 条：
   1. 配额持仓 `{holdAllowance}` 万tCO₂，占总持仓 `{holdAllowance ÷ holdTotal × 100}`%，是履约与交易的主要资产。
   2. CCER 持仓 `{holdCCER}` 万tCO₂，占总持仓 `{holdCCER ÷ holdTotal × 100}`%，具备低成本抵销优势。
   3. 本月成交量 `{volCur}` 万tCO₂，约占期末持仓的 `{volCur ÷ holdTotal × 100}`%，交易活跃度适中。

**(8) 四、市场行情**（`id="sec-4"`）

1. 引导段 `.brief-p`：「本月全国及各区域试点碳市场行情如下表，为企业后续交易择时提供参考。」
2. **主要碳市场行情一览表**：表题「主要碳市场行情一览（{MONTH_CN}）」+ 右单位「均价：元/tCO₂；成交量/成交额：万t / 百万元」。5 列 8 行：

| 列   | 市场名称                | 成交均价                                        | 成交量          | 成交额          | 较上月                                         |
| --- | ------------------- | ------------------------------------------- | ------------ | ------------ | ------------------------------------------- |
| 行 i | `MARKET_ROWS[i][0]` | `fmt(MARKET_ROWS[i][1],2)`（`.is-self` 橙底加粗） | `fmt([2],1)` | `fmt([3],1)` | `{signed(chg,2,'%')}` class=`deltaCls(chg)` |

- `chg`（较上月涨跌幅）**按行号 i 推演**：`chg = (i % 2 === 0 ? 1 : -1) × (0.5 + (i % 3) × 0.7)`，保留 2 位小数。8 行依次为 `+0.50 / −1.20 / +1.90 / −0.50 / +1.20 / −1.90 / +0.50 / −1.20`（%）。
- 表注：「注：行情数据为演示数据；「较上月」为各市场成交均价环比涨跌幅。」

1. **{year} 年逐月成交均价走势图**（`lineChart`，纯 SVG，规格见 2.6 图 C），图题「（图）{year} 年逐月成交均价走势（元/tCO₂）」。
   > 原型此图题文字硬编码为「2026 年」，与本页其它位置按入参取年的写法不一致；**本规格统一按入参年份 `{year}` 取值**，使 year 变化时图表标题与数据一致。

**(9) 五、本月交易建议**（`id="sec-5"`，`<ol class="advice-list">`，4 条，文案**逐字**如下，变量代入数值）

1. `<strong>把握价格窗口：</strong>`本月成交均价 `{prCur}` 元/tCO₂，环比{上涨|下跌} `{abs(prMomPct)}`%，建议建立价格监测机制，在低位建仓、高位择机变现盈余配额。
2. `<strong>优化量价节奏：</strong>`本月成交量 `{volCur}` 万tCO₂，建议按履约进度分月平滑采购，避免期末集中购碳推高成本。
3. `<strong>用好 CCER 抵销：</strong>`CCER 价格低于配额价，建议在合规比例内提高 CCER 抵销使用比例，降低整体履约成本。
4. `<strong>盘活存量资产：</strong>`期末持仓市值 `{holdValue}` 万元，建议在保障履约的前提下，审慎开展碳质押等碳金融业务，提升资产流动性与收益。

### 2.5 数据规则（唯一数据源）

全部数值由以下写死序列与公式推出。**无随机数、无种子**——同一入参必得完全一致的结果。**不要另编数字。**

**(1) 固定序列（12 个月，下标 0~~11 对应 1~~12 月）**：

```javascript
// 逐月成交量（万tCO₂）
var TRADE_VOL = [42.6, 38.2, 55.4, 47.8, 62.3, 51.5, 44.9, 58.7, 49.3, 66.1, 53.8, 45.2];

// 逐月成交均价（元/tCO₂）
var TRADE_PRICE = [86.5, 88.2, 85.7, 89.4, 91.2, 88.6, 90.3, 92.1, 90.8, 93.5, 91.7, 94.2];
```

**(2) 常量**：

```javascript
var YOY_VOL_FACTOR   = 1.06;   // 上年同期成交量 = 本月成交量 × 1.06
var YOY_PRICE_FACTOR = 0.96;   // 上年同期成交均价 = 本月成交均价 × 0.96
var HOLD_ALLOWANCE   = 120.4;  // 期末配额持仓（万tCO₂）
var HOLD_CCER        = 18.6;   // 期末 CCER 持仓（万tCO₂）
var GREEN            = '#00b42a';
```

**(3) 固定明细表**：

`DEAL_ROWS`（本月成交明细，逐笔，7 列 = 日期 / 方向 / 品种 / 数量(万tCO₂) / 均价(元/tCO₂) / 用途）：

```
['2026-09-03', '买入', 'CEA（配额）', 18.5, 89.6, '履约补仓']
['2026-09-08', '卖出', 'CEA（配额）',  6.2, 91.4, '盈余变现']
['2026-09-12', '买入', 'CCER',        5.4, 68.5, '低成本抵销']
['2026-09-17', '卖出', 'CEA（配额）',  4.8, 92.8, '择机交易']
['2026-09-22', '买入', 'CEA（配额）',  9.6, 90.1, '储备建仓']
['2026-09-26', '买入', 'CCER',        4.8, 70.2, '低成本抵销']
```

每行金额 = `数量 × 均价`（`+(a*b).toFixed(2)`）；**6 行金额合计 = 4241.54 万元**（固定值，用于合计行）。

`MARKET_ROWS`（主要碳市场行情，4 列 = 市场名称 / 成交均价(元/tCO₂) / 成交量(万t) / 成交额(百万元)）：

```
['全国碳排放权交易市场（CEA）', 90.8,  8.9, 172.5]
['上海环境能源交易所',         90.2,  6.4,  68.3]
['北京绿色交易所',             92.6,  3.1,  24.7]
['广东碳排放权交易所',         88.4, 12.6,  41.2]
['湖北碳排放权交易中心',       87.1,  7.8,  19.6]
['天津排放权交易所',           89.3,  2.4,   9.8]
['深圳排放权交易所',           93.5,  1.9,   6.2]
['重庆碳排放权交易中心',       86.2,  4.2,  11.4]
```

**(4) 入参与日期派生**：

```javascript
var MONTH = '2026-09';                 // 来自 URL ?month=
var Y = 2026, M = 9;                   // 拆分 MONTH；M < 1 或 M > 12 时 M = 9
var MONTH_CN = Y + '年' + M + '月';      // 例：2026年9月
var PM = (M === 1) ? 12 : M - 1;
var PY = (M === 1) ? Y - 1 : Y;
var PREV_CN = PY + '年' + PM + '月';     // 例：2026年8月（M=1 时为 2025年12月）
var YOY_CN  = (Y - 1) + '年' + M + '月'; // 例：2025年9月
```

**(5) 派生指标**（逐条实现；`fmt(n,d)` = 千分位 + 固定 d 位小数，`signed(n,d,unit)` = 正数前置 `+`）：

```javascript
var volCur  = TRADE_VOL[M - 1],  volPrev = TRADE_VOL[PM - 1];
var prCur   = TRADE_PRICE[M - 1], prPrev = TRADE_PRICE[PM - 1];
var amtCur  = +(volCur * prCur).toFixed(2);        // 万元 = 万t × 元/t
var amtPrev = +(volPrev * prPrev).toFixed(2);

var volYoy = +(volCur * YOY_VOL_FACTOR).toFixed(2);    // 上年同期成交量
var prYoy  = +(prCur  * YOY_PRICE_FACTOR).toFixed(2);  // 上年同期成交均价
var amtYoy = +(volYoy * prYoy).toFixed(2);

var holdTotal = +(HOLD_ALLOWANCE + HOLD_CCER).toFixed(1);   // 139.0
var holdValue = +(holdTotal * prCur).toFixed(2);            // 期末持仓市值（按本月均价折算）

var cumVol = 0; for (var i = 0; i < M; i++) cumVol += TRADE_VOL[i];  // 年累计成交量（1~M 月求和）
cumVol = +cumVol.toFixed(2);

var volMomPct = +((volCur - volPrev) / volPrev * 100).toFixed(2);
var volYoyPct = +((volCur - volYoy)  / volYoy  * 100).toFixed(2);
var prMomPct  = +((prCur  - prPrev)  / prPrev  * 100).toFixed(2);
var prYoyPct  = +((prCur  - prYoy)   / prYoy   * 100).toFixed(2);
var amtMomPct = +((amtCur - amtPrev) / amtPrev * 100).toFixed(2);
var amtYoyPct = +((amtCur - amtYoy)  / amtYoy  * 100).toFixed(2);

// 成交明细合计
var sumAmt = 0;
DEAL_ROWS.forEach(function (r) { sumAmt += +(r[3] * r[4]).toFixed(2); });
```

**(6) 数值格式**：金额（成交金额、市值）2 位小数、千分位；成交量/均价 2 位小数（持仓量 1 位小数）；百分数 2 位小数（占比 1 位小数）；单位统一 成交量=万tCO₂、均价=元/tCO₂、金额=万元。

**声明：本节是所有数字的唯一来源，生成时不要另编数据。**

**(7) 校验参考**（用来自检；若你的结果与下表不符，说明取数下标或派生公式被改动了）：

| 入参 companyName=河南安钢周口钢铁有限责任公司                 | `month=9`（year=2026）        | `month=1`（year=2026）             |
| --------------------------------------------- | --------------------------- | -------------------------------- |
| 本月标签 `MONTH_CN` / 上月 `PREV_CN` / 同期 `YOY_CN`  | 2026年9月 / 2026年8月 / 2025年9月 | 2026年1月 / **2025年12月** / 2025年1月 |
| 本月成交量 `volCur` / 上月 `volPrev` / 上年同期 `volYoy` | 49.3 / 58.7 / 52.26         | 42.6 / 45.2 / 45.16              |
| 本月均价 `prCur` / 上月 `prPrev` / 上年同期 `prYoy`     | 90.8 / 92.1 / 87.17         | 86.5 / 94.2 / 83.04              |
| 本月成交金额 `amtCur` / 上月 / 上年同期                   | 4476.44 / 5406.27 / 4555.5  | 3684.9 / 4257.84 / 3750.09       |
| 成交量环比 / 同比（%）                                 | −16.01 / −5.66              | −5.75 / −5.67                    |
| 均价环比 / 同比（%）                                  | −1.41 / 4.16                | −8.17 / 4.17                     |
| 金额环比 / 同比（%）                                  | −17.2 / −1.74               | −13.46 / −1.74                   |
| 年累计成交量 `cumVol`（万tCO₂）                        | 450.7                       | 42.6                             |
| 期末持仓量 `holdTotal` / 市值 `holdValue`（万元）        | 139.0 / 12621.2             | 139.0 / 12023.5                  |
| 持仓占比（配额 / CCER，%）                             | 86.6 / 13.4                 | 86.6 / 13.4                      |
| 成交量占期末持仓（%）                                   | 35.5                        | 30.6                             |
| 成交明细 6 行合计金额（万元）                              | 4241.54                     | 4241.54（明细表与月份无关）                |

### 2.6 图表规格

本报告共 **3 种图**：2 种纯 HTML/CSS 横向条形图（不用 SVG、不用图表库）+ 1 种纯 SVG 折线图（不用图表库）。  
统一容器 `.chart-box`（白底、1px 边框 `#e8ebef`、圆角 6px、padding `12px 14px 6px`）；图题 `.chart-caption`（居中 12.5px 灰，位于图框**下方**，上下间距 `4px 0 16px`）。

**图 A：本月/上月/上年同期成交金额对比图（`cmpBars`）——最大值归一**

- 容器 `.hbars`；每行 `.hbar-row`（flex、gap 10px、上下 margin 7px、12.5px）= 名称标签（宽 150px、**右对齐**）→ 轨道（`flex:1`、高 16px、底 `#f2f4f7`、圆角 3px、`overflow:hidden`）→ 数值（宽 150px、tabular-nums）。
- 条宽 = `value ÷ 行内最大值 × 100%`，**下限 0.5%**；数值格式 = `fmt(value, 2) + ' 万元'`。
- 固定 3 行，顺序与配色不可变：

| # | 行标签            | 取值        | 条色        | 特殊           |
| - | -------------- | --------- | --------- | ------------ |
| 1 | 本月（{MONTH_CN}） | `amtCur`  | `#ff7d00` | 加 `.is-self` |
| 2 | 上月（{PREV_CN}）  | `amtPrev` | `#00b42a` | —            |
| 3 | 上年同期（{YOY_CN}） | `amtYoy`  | `#165dff` | —            |

**图 B：期末碳资产持仓结构图（`structBars`）——总和归一**

- 复用 `.hbars`/`.hbar-row` 结构，但条宽 = `value ÷ 各项之和 × 100%`（各条之和 = 100%），不加 0.5% 下限。
- 数值格式 = `fmt(value, 1) + ' 万tCO₂（{pct}%）'`，如「120.4 万tCO₂（86.6%）」。
- 固定 2 行：

| # | 行标签     | 取值                     | 条色        |
| - | ------- | ---------------------- | --------- |
| 1 | CEA（配额） | `holdAllowance`（120.4） | `#00b42a` |
| 2 | CCER    | `holdCCER`（18.6）       | `#165dff` |

> 图 A 与图 B 的条宽基准、数值格式都不同（最大值归一 vs 总和归一、2 位小数 vs 1 位小数、无占比 vs 带括号占比），**不要用同一个函数应付两图**。

**图 C：{year} 年逐月成交均价走势（`lineChart`）——纯 SVG**

- 画布 `viewBox="0 0 760 240"`，`preserveAspectRatio="xMidYMid meet"`，外边距 `PL=52, PR=18, PT=18, PB=34`。
- 输入数据 = `TRADE_PRICE`（12 项），即**成交均价**序列（不是成交量）。
- **纵轴**：`min/max` 取自输入序列，上下各留 `span × 0.15` 余量（`span = max − min`，为 0 时取 1）；5 条水平网格线（值 = `min + range × g / 4`，`g = 0..4`），线色 `#eef1f4`、宽 1；刻度文字 `x = PL − 8`、10px `#98a1ab`、`text-anchor="end"`、`toFixed(1)`。
- **横轴**：12 个刻度，`X(i) = PL + iw × i / 11`；标签 `1月`…`12月`，10px `#98a1ab`，`y = H − 12`。
- **折线**：`<polyline>`，`fill="none"`、`stroke="#00b42a"`、`stroke-width="2.2"`、`stroke-linejoin="round"`。
- **数据点**：当前月（`i === M−1`）半径 5、填充 `#ff7d00`、描边 `#ff7d00`，点上方 `y − 12` 标数值（11px、`#b25f00`、700、居中、2 位小数）；其余月份半径 3、填充 `#fff`、描边 `#00b42a`、宽 2。
- 纵轴**不要求从 0 起**，按数据范围自适应即可。

### 2.7 表格规格

- 统一 `.btable`：宽 100%、`border-collapse: collapse`、12.5px；单元格 1px 边框 `#e3e7ec`、padding `6px 8px`、居中、`tabular-nums`；表头底 `#e9f7ee`、600 字重；斑马纹偶数行底 `#fafcfb`；`<tfoot>` 行底 `#f4fbf6`、600 字重。
- 语义色 class：`.is-pos` → `#d4380d`（红）；`.is-neg` → `#2ba471`（绿）；`.is-self` → 底 `#fff7e8` 加粗。各列具体用哪个 class 见 2.4 与 2.3「着色语义」表。
- 表题行 `.table-caption`（左表名 13px `#333` + 右单位 12px `#8a9199`）；表注 `.btable-note`（12px `#98a1ab`）。
- 本报告共 **3 张表**：
  1. **月度交易对比表**：6 列 3 行（2.4(5)）。
  2. **本月成交明细**：7 列 6 行 + `<tfoot>` 合计行（2.4(6)）。
  3. **主要碳市场行情一览（{MONTH_CN}）**：5 列 8 行（2.4(8)）。

### 2.8 下载（PDF）

- 触发：点击工具条右侧「下载报告（PDF）」按钮。
- 点击后按钮置灰并把文字替换为「正在生成 PDF…」；用 html2canvas（`scale: 2`、`backgroundColor: '#ffffff'`、`logging: false`）逐张渲染 `#brief-root .brief-page`，按 A4（210×297mm）高度切片后写入 jsPDF（JPEG 质量 0.92，首张之外逐页 `addPage`），完成后恢复按钮文字。实现与「碳排放月度报表」**逐字相同**（见该文档 2.8 的代码块），**仅文件名不同**。
- 文件名模板：`碳交易月报-{year}年{month}月.pdf`（例：`碳交易月报-2026年9月.pdf`）。
- **降级**：`window.jspdf?.jsPDF` 或 `window.html2canvas` 任一不存在 → 直接 `window.print()`（依赖 2.2 的 `@media print`）。

### 2.9 不要做什么（负面清单）

- **不要交付多个文件**——最终产物有且只有一个 `碳交易月度报表.html`；不要把 html2canvas / jsPDF 等库文件、拆分的 CSS/JS 文件、说明文档作为产物一起给出。
- 不要顶部导航、侧栏、面包屑、页签（tab）切换条、月份卡片列表、搜索/筛选条件区——本页只有「工具条 + 三张 A4 纸面」。
- **不要实现碳排放月报**：本页只有「碳交易月度报表」一种报表，不出现碳排放量、单位产品碳排放强度（tCO₂/t）、排放源结构（化石燃料燃烧/外购电力…）、排放类型（直接/间接）等内容；`?tab=` 参数一律忽略，不做页签分流。
- **不要让目录页（或任何一张纸面）与其他纸面宽度/内边距不一致**——常见错误是把目录内容贴到纸面左边缘；三张纸面必须同宽 920px、同内边距 `64px 72px 72px`、同水平居中，且必须用 2.2 给出的同一份容器 CSS。
- 不要「编制单位」「编制日期」「编制说明」等落款文字（封面底部只有「数据期间」一行）。
- 不要出现行业特定字眼（高炉 / 烧结 / 转炉 / 炼铁 / 轧钢 / 熟料 / 机组等）——报告对企业通用。
- **不要混用红绿语义**：按 2.3「着色语义」表统一——成交量↑=绿、成交金额↑=绿、成交均价↑=红、市场行情涨=红、买入=红/卖出=绿。特别注意：**不要给「成交量」用排放报告那种「增=红」的映射**。
- 不要引入图表库（ECharts / Chart.js / Highcharts）；横向条形图用纯 HTML/CSS，折线图用纯 SVG。
- 不要使用 emoji。
- 不要「生成报告」「查看报告」「导出 Excel」「打印」「删除」「立即交易」等按钮；工具条只有返回链接和「下载报告（PDF）」。
- 不要「功能建设中 / 敬请期待」等占位文字（本页是成品报告页）。
- 不要自由发挥「美化」——色值、字号、间距、文案、图表配色一律以本文档为准。
