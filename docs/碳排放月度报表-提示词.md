# 碳排放月度报表 — 界面复刻提示词

> 本文档描述「碳排放月度报表」（在「碳月报及差异分析」列表页选择碳排放页签 → 点击某个月份卡片的「月度报表」按钮后进入的全屏 A4 报告页）的完整界面规格。按「一、入参」给定 JSON 输入，严格按「二、任务」的规格生成与原型一模一样的界面。
> 本文档是自包含的：不需要访问任何原项目源码。
> 使用方法：把入参 JSON 改成目标值，连同本文档全文发给 AI 即可。

## 一、入参

```json
{
  "companyName": "河南安钢周口钢铁有限责任公司",   // 企业/主体名称，影响：封面 H1 第一行、工具条标题、浏览器标签页标题
  "year": 2026,                                   // 年份，影响：封面年月、封面「数据期间」、正文年号、下载文件名
  "month": 9                                      // 月份 1~12，影响：取数下标（决定取哪一个月）+ 同上所有年月文案
}
```

### 入参带入规则

| JSON 字段       | 影响位置                                              | 规则                                                                                                            |
| ------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| companyName   | 封面 H1 第一行 / 工具条标题 / 浏览器标签页标题                       | 封面拼接为「{companyName}（换行）碳排放月报」；工具条标题为「{companyName}碳排放月报（{year}年{month}月）」；`document.title` = 「碳排放月报-{year}-{MM}」（MM 补零两位） |
| year          | 封面年月、封面「数据期间」、正文「{Y} 年 1~12 月」表述、下载文件名              | 四位年份。**注意：year 不参与取数**——演示数据是一套固定的 12 个月序列，只按 month 取第 month 行；year 仅改变文案年号与文件名                                     |
| month         | 封面年月、数据期间、取数下标、趋势图高亮月、下载文件名                        | 取值 1~12；**< 1 或 > 12 一律按 9 处理**；`month` 用于取第 `month-1` 个数组元素（0 基下标）                                                  |

> **跨年细节**：`month = 1` 时，上月为**上一年 12 月**（标签形如「2025年12月」）；其余月份的上月为同年 `month-1` 月。上年同期恒为「{year-1}年{month}月」。

### 运行期入参来源（URL 查询参数）

页面读取 URL 查询参数作为入参来源，缺省回落至上表示例值——这样既能从列表页跳转透传，也能直接双击打开演示：

```
?month=2026-09&company=河南安钢周口钢铁有限责任公司
```

- `month` 形如 `YYYY-MM`，拆分为 `year` 与 `month`；不传时用 JSON 示例值 `2026-09`。
- `company` 覆盖 `companyName`。
- 上游若附带 `?tab=emission` 之类的页签参数，**忽略即可**——本页只渲染「碳排放月度报表」这一种报表（见 2.9 负面清单）。

## 二、任务

### 2.1 交付物

- **最终只交付一个文件：`碳排放月度报表.html`**。这是硬性要求——除这一个 HTML 文件外，不得再产出任何其他文件（包括但不限于：html2canvas.min.js、jspdf.umd.min.js 等库文件、单独的 CSS/JS 文件、说明文档、测试文件）。
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
│ ← 返回碳月报及差异分析 │ {企业名}碳排放月报（2026年9月） │ [下载报告（PDF）] │
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

- 页面背景 `#e9edf3`；纸面宽 **920px**、白底、阴影 `0 4px 24px rgba(20,40,30,0.10)`、内边距 `64px 72px 72px`、行高 1.8；首张纸面 `margin: 22px auto 40px`，后续纸面间隔 18px（`margin-top: 18px`）。
- **三张纸面（封面 / 目录 / 正文）共用同一个容器类 `.brief-page`，宽度、内边距、阴影、水平居中完全一致**。禁止给目录页单独设置 `width` / `margin` / `padding` / `max-width`——`.brief-toc` 只允许定义目录内部标题与列表的样式。目录内容区与正文一样左右各有 72px 内边距，不得贴到纸面边缘。
- **无顶部导航、无侧栏、无面包屑、无列表页的月份卡片区**（这是全屏独立报告页，只有一条 sticky 工具条）。
- 纸面容器的 HTML 结构与样式——**必须原样使用，不得改写**（目录页走样几乎都因为没遵守这一段）：

```html
<div class="brief-toolbar" id="brief-toolbar">
  <a class="bt-back" href="monthly.html">← 返回碳月报及差异分析</a>
  <span class="bt-title" id="bt-title">碳排放月报</span>
  <div class="bt-actions">
    <button type="button" class="bt-btn" id="btn-download">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 21h16"/></svg>
      下载报告（PDF）
    </button>
  </div>
</div>

<div id="brief-root"></div>
```

```html
<!-- #brief-root 内由 JS 生成的静态骨架（三张纸面） -->
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
  margin: 22px auto 40px;              /* auto = 水平居中，左右留白相等 */
  background: #fff;
  box-shadow: 0 4px 24px rgba(20, 40, 30, 0.10);
  padding: 64px 72px 72px;             /* 上下 64/72px，左右各 72px 空白 */
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
.brief-cover h1 {
  margin: 0 0 14px; font-size: 34px; letter-spacing: 2px;
  color: #1a1a1a; font-weight: 700; line-height: 1.5;
}
.brief-cover .cover-month {
  font-size: 20px; color: #00b42a; letter-spacing: 4px; font-weight: 600; margin-top: 10px;
}
.brief-cover .cover-tab {
  display: inline-block; margin-top: 16px; font-size: 14px; color: #1f7a3a;
  background: #e9f7ee; border: 1px solid #c8e8d2; border-radius: 16px;
  padding: 4px 18px; letter-spacing: 1px;
}
.brief-cover .cover-line { width: 120px; height: 3px; background: #00b42a; margin: 40px auto 0; border-radius: 2px; }
.brief-cover .cover-foot { margin-top: 110px; font-size: 13px; color: #8a9199; line-height: 2; }

/* 目录：只追加修饰类，绝对禁止设置 width / margin / padding / max-width */
.brief-toc h2 { font-size: 20px; margin: 0 0 18px; letter-spacing: 2px; }
.brief-toc ol { margin: 0; padding: 0; list-style: none; }   /* padding 必须为 0，否则列表自带左缩进 */
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
.brief-h2 {
  font-size: 16.5px; margin: 26px 0 10px; color: #1a1a1a;
  display: flex; align-items: center; gap: 8px;
}
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

**生成后自查**：封面、目录、正文三张纸面的左边缘在屏幕上严格对齐成一条竖线；目录的「目　录」标题与摘要的「摘要 · 本月核心指标概览」标题左边缘也在同一竖线上。若不齐，说明目录容器被单独设置了样式，必须改回共用 `.brief-page`。

### 2.3 设计规格

**色板**

| 用途                        | 色值                                          |
| ------------------------- | ------------------------------------------- |
| 主绿（封面强调 / 章节竖条 / 按钮 / 序号圆点） | `#00b42a`                                   |
| 页面底                       | `#e9edf3`                                   |
| 纸面 / 工具条底                 | `#ffffff`                                   |
| 章节标题渐变起 / 表头底 / 卡片渐变起     | `#e9f7ee`                                   |
| 卡片渐变底                     | `#f4fbf6 → #ffffff`                         |
| 正文                        | `#222` / `#333` / `#444` / `#1a1a1a`        |
| 弱文字                       | `#8a9199`、`#98a1ab`、`#6b7280`                |
| 语义色 · 红（`is-pos`，排放上升/不利） | `#d4380d`                                   |
| 语义色 · 绿（`is-neg`，排放下降/有利） | `#2ba471`                                   |
| 中性说明行（`is-flat`）          | `#98a1ab`                                   |
| 本月高亮（橙）                   | 条形 `#ff7d00`、文字 `#b25f00`、卡片底 `#fff7e8`、卡片边框 `#ffd591` |
| 上月（绿）                     | `#00b42a`                                   |
| 上年同期（蓝）                   | `#165dff`                                   |
| 排放源结构 · 第三色（橙）            | `#ff7d00`                                   |
| 排放源结构 · 第四色（紫）            | `#722ed1`                                   |
| 表格边框 / 图框边框               | `#e3e7ec` / `#e8ebef`                       |
| 卡片边框                      | `#e5eee8`                                   |

**字体**：`-apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif`。
封面 H1 34px/700/字距 2px/行高 1.5；封面年月 20px/600/字距 4px 绿色；封面 kicker 13px/字距 6px 绿色圆角胶囊。
章节 H1（`.brief-h1`）21px（左侧 5px 绿竖条 + `#e9f7ee` 向右渐隐背景，padding `8px 0 8px 14px`）；H2（`.brief-h2`）16.5px（前置 8×8px 绿色小方块，圆角 2px）；正文 13.5px；要点列表 12.5px/行高 1.9；表格 12.5px；建议条目 13px；图题 12.5px 灰。

**图标**：仅工具条「下载报告（PDF）」按钮带一个 14px 线性 SVG 下载图标（`stroke="currentColor"`、`fill="none"`、`stroke-width="2"`，路径见 2.2 的 HTML 原文）。正文无图标、**无 emoji**。

### 2.4 区块逐一规格

**(1) 工具条**（sticky 顶置，白底，下边线 `#e4e8ee`，打印/下载 PDF 时隐藏）

- 左：链接「← 返回碳月报及差异分析」（13px，绿 `#00b42a`，href 指向 `monthly.html`，可替换为任意返回页）。
- 中：标题 14px/600 `#333`：`{companyName}碳排放月报（{year}年{month}月）`。
- 右：绿色实心按钮「下载报告（PDF）」（高 30px、圆角 4px、底 `#00b42a`、白字 13px、前置 14px 下载 SVG）。

**(2) 封面**（第一张纸面：`<div class="brief-page brief-cover-wrap"><div class="brief-cover">…` ，居中排版，`padding: 130px 0 90px`）

1. 胶囊 kicker：文字「碳 排 放 月 报」（字间用半角空格分隔，13px、字距 6px、绿色、1px 绿边、圆角 20px、padding `4px 18px 4px 24px`）。
2. H1 两行（`<br/>` 换行）：第一行 `{companyName}`，第二行 `碳排放月报`。
3. 封面年月：`{year}年{month}月`（20px 绿色、字距 4px、600）。
4. 页签胶囊：文字「碳排放 · 月度报表」（14px，字 `#1f7a3a`、底 `#e9f7ee`、边 `#c8e8d2`、圆角 16px、padding `4px 18px`）。
5. 装饰线：120×3px 绿色圆角横线，上间距 40px。
6. 底部（`margin-top: 110px`，13px `#8a9199`）：仅一行「数据期间：{year}-{MM}-01 至 {year}-{MM}-{月末日}」（MM 两位补零；月末日 = `new Date(year, month, 0).getDate()`）。**无编制单位、无编制日期、无落款**。

**(3) 目录**（第二张纸面：`<div class="brief-page brief-toc">`）

- 容器与内部样式严格按 2.2 的 CSS 原文：`.brief-toc` 不得带任何 `width`/`margin`/`padding`。
- 标题「目　录」（「目」「录」之间用两个 `&nbsp;`；20px、字距 2px）。
- 6 个锚点条目，全部 `.toc-l1` 级别（15px/600），点击平滑定位：

| 序号 | 目录文字             | 锚点        | 对应区块                    |
| -- | ---------------- | --------- | ----------------------- |
| 1  | 摘要 · 本月核心指标概览    | `#sec-0`  | 摘要                      |
| 2  | 一、月度排放概况         | `#sec-1`  | 一、月度排放概况                |
| 3  | 二、排放结构分析         | `#sec-2`  | 二、排放结构分析                |
| 4  | 三、月度趋势回顾         | `#sec-3`  | 三、月度趋势回顾                |
| 5  | 四、数据明细           | `#sec-4`  | 四、数据明细                  |
| 6  | 五、本月工作建议         | `#sec-5`  | 五、本月工作建议（正文里存在，目录中一并列出） |

**(4) 摘要 · 本月核心指标概览**（`<h1 class="brief-h1" id="sec-0">摘要 · 本月核心指标概览</h1>`）

1. **KPI 卡片区**：`.kpi-grid`，grid **3 列**、间距 10px，共 **6 张卡**。每卡三行：名称（12px 灰）→ 大数值（20px/700，单位放 `<small>` 12px 灰）→ 说明行（11.5px）。第 1 张卡加 `.is-self`（橙色高亮：边框 `#ffd591`、底 `#fff7e8→#fff`）。6 张卡依次为：

| # | 名称         | 数值（`<small>` 单位）        | 说明行（模板）                        | 说明行 class                    |
| - | ---------- | ----------------------- | ------------------------------ | --------------------------- |
| 1 | 本月碳排放量     | `{cur}` 万tCO₂           | `环比 {signed(momEmissionPct,2,'%')}` | `deltaCls(momEmissionPct)`；卡加 `.is-self` |
| 2 | 年累计排放量     | `{annualEmission}` 万tCO₂ | `截至 {MONTH_CN}`                | `is-flat`                   |
| 3 | 单位产品碳排放强度  | `{curIntensity}` tCO₂/t（4 位小数） | `环比 {signed(momIntensityPct,2,'%')}` | `deltaCls(momIntensityPct)`  |
| 4 | 本月产品产量     | `{output}` 万t（2 位小数）     | `月度产量口径`                       | `is-flat`                   |
| 5 | 直接排放占比     | `62.0 %`                | `燃料燃烧 + 生产过程`                  | `is-neg`                    |
| 6 | 间接排放占比     | `38.0 %`                | `外购电力 + 外购热力`                  | `is-flat`                   |

> 第 5/6 张卡的数值是**写死的常量** `fmt(62,1)` / `fmt(38,1)`（即 62.0 / 38.0），与 2.5 的排放源占比之和一致（0.44+0.18=0.62、0.26+0.12=0.38）。

2. **要点列表** `.point-list`（12.5px，4 条；`**…**` 表示加粗，加粗文字在正文里是绿色 `#00b42a`）：
   1. 本月碳排放量 `<strong>{cur}</strong>` 万tCO₂，环比{上升|下降} `{abs(momEmissionPct)}`%，同比{上升|下降} `{abs(yoyEmissionPct)}%`。
   2. 单位产品碳排放强度 `<strong>{curIntensity}</strong>` tCO₂/t，环比{上升|下降} `{abs(momIntensityPct)}%`。
   3. 年累计排放量 `<strong>{annualEmission}</strong>` 万tCO₂，按当前强度推演全年排放约 `{annualEmission ÷ month × 12}` 万tCO₂。
   4. 排放结构以直接排放为主（占比 62.0%），其中化石燃料燃烧占 44.0%，是减排重点方向。
   > 「环比上升/下降」按对应百分比的符号选择：`≥0` 用「上升」，`<0` 用「下降」；数值取绝对值、保留 2 位小数并带 `%`。

**(5) 一、月度排放概况**（`id="sec-1"`）

1. 引导段 `.brief-p`：
   「本月为 `{MONTH_CN}`，企业产品产量 `{output}` 万t，碳排放量 `{cur}` 万tCO₂，单位产品碳排放强度 `{curIntensity}` tCO₂/t。与上月（`{PREV_CN}`）及上年同期（`{YOY_CN}`）对比如下表。」
2. **月度排放对比表**：表题行 `.table-caption` 左「月度排放对比表」、右单位「排放量：万tCO₂；强度：tCO₂/t；产量：万t」。6 列 2 行：

| 列   | 指标        | 本月（{MONTH_CN}） | 上月（{PREV_CN}）   | 环比                              | 上年同期（{YOY_CN}）   | 同比                              |
| --- | --------- | -------------- | --------------- | ------------------------------- | ---------------- | ------------------------------- |
| 行 1 | 碳排放量      | `{cur}`（`.is-self` 橙底加粗） | `{prev}`        | `{signed(momEmissionPct,2,'%')}` class=`deltaCls(momEmissionPct)` | `{yoy}`          | `{signed(yoyEmissionPct,2,'%')}` class=`deltaCls(yoyEmissionPct)` |
| 行 2 | 单位产品碳排放强度 | `{curIntensity}`（4 位，`.is-self`） | `{prevIntensity}`（4 位） | `{signed(momIntensityPct,2,'%')}` class=`deltaCls(momIntensityPct)` | `{yoyIntensity}`（4 位） | `{signed(yoyIntensityPct,2,'%')}` class=`deltaCls(yoyIntensityPct)` |

   表注 `.btable-note`：「注：环比 =（本月 − 上月）÷ 上月 × 100%；同比 =（本月 − 上年同期）÷ 上年同期 × 100%；单位产品碳排放强度按当月产品产量口径计算。」
3. **对比条形图**（`cmpBars`，规格见 2.6 图 A），图题「（图）本月 / 上月 / 上年同期碳排放量对比」。

**(6) 二、排放结构分析**（`id="sec-2"`）

1. 引导段 `.brief-p`：
   「本月碳排放按排放源拆解如下：直接排放（化石燃料燃烧、工业生产过程）合计 `<strong>{directSum}</strong>` 万tCO₂，占 `{directSum ÷ cur × 100}`%；间接排放（外购电力、外购热力）合计 `<strong>{indirectSum}</strong>` 万tCO₂，占 `{indirectSum ÷ cur × 100}`%。」
   （`directSum` = 前两类占比之和 0.62 × cur，`indirectSum` = 后两类之和 0.38 × cur；占比保留 1 位小数。）
2. **排放源结构条形图**（`structBars`，总和归一，规格见 2.6 图 B），图题「（图）本月碳排放源结构分布（{MONTH_CN}）」。
3. **要点列表** 4 条（排放源顺序固定，依次对应 2.5 的 `SRC_RATIO` 键序）：
   1. `<strong>化石燃料燃烧</strong>`是最大排放源，本月 `{cur×0.44}` 万tCO₂，占比 44.0%，可通过燃料替代与能效提升压降。
   2. `<strong>外购电力</strong>`本月 `{cur×0.26}` 万tCO₂，占比 26.0%，绿电采购与绿证消纳是主要改善路径。
   3. `<strong>工业生产过程</strong>`本月 `{cur×0.18}` 万tCO₂，占比 18.0%，与产量高度相关，需通过原料替代与工艺优化降低。
   4. `<strong>外购热力</strong>`本月 `{cur×0.12}` 万tCO₂，占比 12.0%，建议提升余热回收利用率。

**(7) 三、月度趋势回顾**（`id="sec-3"`）

1. 引导段 `.brief-p`：
   「下图为 `{year}` 年 1~12 月碳排放量走势（橙点为当前月 `{month}` 月）。全年度各月排放量介于 `{min(EMISSION)}` ~ `{max(EMISSION)}` 万tCO₂ 之间，整体波动平稳。」
2. **12 月折线图**（`lineChart`，纯 SVG，规格见 2.6 图 C），图题「（图）`{year}` 年逐月碳排放量走势（万tCO₂）」。
3. **要点列表** 3 条：
   1. 本月排放量 `{cur}` 万tCO₂，在全年逐月序列中位列第 `{rank}` 位。
   2. 全年排放量最高月为 `{maxMonth}` 月（`{max}` 万tCO₂），最低月为 `{minMonth}` 月（`{min}` 万tCO₂）。
   3. 月度间排放量差异主要来自产品产量的季节波动，单位产品碳排放强度全年保持在 `{min(INTENSITY)}` ~ `{max(INTENSITY)}` tCO₂/t 区间。
   > `{rank}` = 把 12 个月的 `EMISSION` 按降序排序后，当前月所在的名次（1 基）。`{maxMonth}`/`{minMonth}` 取 `EMISSION` 最大值/最小值的下标 +1（若并列取第一个）。

**(8) 四、数据明细**（`id="sec-4"`）

1. **本月排放数据明细表**：表题「本月排放数据明细（按排放源）」+ 右单位「排放量：万tCO₂」。6 列 4 行 + 合计行（`<tfoot>`）：

| 列    | 排放源                | 排放类型          | 本月排放量            | 占比                          | 上月排放量            | 环比                       |
| ---- | ------------------ | ------------- | ---------------- | --------------------------- | ---------------- | ------------------------ |
| 行 i | `{srcName 去括号}`     | `直接排放`/`间接排放` | `{cur × ratio}`  | `{ratio×100}%`（1 位小数）       | `{prev × ratio}` | `{signed(momPct,2,'%')}` class=`deltaCls(momPct)` |
| 合计行 | 合计                 | —             | `{cur}`          | `100.0%`                    | `{prev}`         | `{signed(momEmissionPct,2,'%')}` class=`deltaCls(momEmissionPct)` |

   - 排放源名称 = 2.5 的 `SRC_RATIO` 键**去掉尾部括号及括号内容**（如「化石燃料燃烧（直接）」→「化石燃料燃烧」）。
   - 排放类型 = 名称含「直接」→「直接排放」，否则「间接排放」。
   - 行内环比 `momPct` = `(cur×ratio − prev×ratio) ÷ (prev×ratio) × 100`，保留 2 位小数。
   - `<tfoot>` 行整体加浅绿底 `#f4fbf6`、600 字重。
2. 表注：「注：各排放源环比按「本月排放量 − 上月排放量 ÷ 上月排放量 × 100%」计算；排放类型分为直接排放（范围一）与间接排放（范围二）。」

**(9) 五、本月工作建议**（`id="sec-5"`，`<ol class="advice-list">`，4 条，文案**逐字**如下，变量代入数值）

1. `<strong>紧盯强度指标：</strong>`本月单位产品碳排放强度 `{curIntensity}` tCO₂/t，环比{上升|下降} `{abs(momIntensityPct)}`%，建议将强度纳入月度绩效考核，防止反弹。
2. `<strong>压降燃料燃烧排放：</strong>`化石燃料燃烧占本月排放 44.0%，建议提高清洁燃料替代比例、优化燃烧控制，持续降低单位产品燃料消耗。
3. `<strong>提升绿电消纳：</strong>`外购电力占本月排放 26.0%，建议扩大绿电采购与分布式光伏自发自用规模，降低外购电力排放因子。
4. `<strong>完善计量台账：</strong>`按排放源逐月核对活动数据与排放因子，确保月度排放数据可追溯、可核证，为年度履约与核查打好基础。

### 2.5 数据规则（唯一数据源）

全部数值由以下写死序列与公式推出。**无随机数、无种子**——同一入参必得完全一致的结果；不同 `month` 取不同月份行。**不要另编数字。**

**(1) 固定序列（12 个月，下标 0~11 对应 1~12 月）**：

```javascript
// 2026 年逐月单位产品碳排放强度（tCO₂/t）
var INTENSITY_2026 = [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663];

// 2026 年逐月产品产量（万t）
var OUTPUT_2026 = [648.2, 641.5, 669.8, 656.4, 673.1, 662.7, 659.4, 661.2, 658.83, 667.5, 655.9, 649.0];

// 月度排放量（万tCO₂）= 当月产量 × 当月强度（结果保留 2 位小数）
var EMISSION = OUTPUT_2026.map(function (q, i) { return +(q * INTENSITY_2026[i]).toFixed(2); });
```

推导出的 `EMISSION` 12 项固定为：

```
492.96, 485.81, 511.53, 500.83, 514.65, 507.16, 504.97, 506.61, 504.33, 511.37, 502.22, 497.33
```

**(2) 常量**：

```javascript
var YOY_OUTPUT_DIV       = 1.055;  // 去年同期产量 = 本月产量 ÷ 1.055
var YOY_INTENSITY_FACTOR = 1.012;  // 去年同期强度 = 本月强度 × 1.012（去年强度更高）
var GREEN                = '#00b42a';

// 排放源结构占比（通用口径，非行业特定；键的顺序即表格/图表中的展示顺序）
var SRC_RATIO = {
  '化石燃料燃烧（直接）': 0.44,
  '工业生产过程（直接）': 0.18,
  '外购电力（间接）':     0.26,
  '外购热力（间接）':     0.12
};
var SRC_COLORS = ['#00b42a', '#165dff', '#ff7d00', '#722ed1'];  // 与 SRC_RATIO 键顺序一一对应
```

**(3) 入参与日期派生**：

```javascript
var MONTH = '2026-09';                 // 来自 URL ?month=
var Y = 2026, M = 9;                   // 拆分 MONTH；M < 1 或 M > 12 时 M = 9
var MONTH_CN = Y + '年' + M + '月';      // 例：2026年9月
var PM = (M === 1) ? 12 : M - 1;       // 上月月份
var PY = (M === 1) ? Y - 1 : Y;        // 上月所属年份
var PREV_CN  = PY + '年' + PM + '月';   // 上月标签，例：2026年8月（M=1 时为 2025年12月）
var YOY_CN   = (Y - 1) + '年' + M + '月'; // 上年同期标签，例：2025年9月
```

**(4) 派生指标**（逐条实现；`fmt(n,d)` = 千分位 + 固定 d 位小数，`signed(n,d,unit)` = 正数前置 `+`）：

```javascript
var cur  = EMISSION[M - 1];                              // 本月排放量
var prev = EMISSION[PM - 1];                             // 上月排放量
var yoyOutput    = +(OUTPUT_2026[M - 1] / YOY_OUTPUT_DIV).toFixed(2);   // 去年同期产量
var yoyIntensity = INTENSITY_2026[M - 1] * YOY_INTENSITY_FACTOR;        // 去年同期强度（不先舍入，参与相乘）
var yoy          = +(yoyOutput * yoyIntensity).toFixed(2);              // 上年同期排放量
var yoyIntensityShown = +yoyIntensity.toFixed(4);                       // 展示用（4 位小数）

var curIntensity  = INTENSITY_2026[M - 1];
var prevIntensity = INTENSITY_2026[PM - 1];

var annualEmission = 0; for (var i = 0; i < M; i++) annualEmission += EMISSION[i];  // 年累计（1~M 月求和）
annualEmission = +annualEmission.toFixed(2);

var momEmissionPct   = +((cur - prev) / prev * 100).toFixed(2);
var yoyEmissionPct   = +((cur - yoy) / yoy * 100).toFixed(2);
var momIntensityPct  = +((curIntensity - prevIntensity) / prevIntensity * 100).toFixed(2);
var yoyIntensityPct  = +((curIntensity - yoyIntensity) / yoyIntensity * 100).toFixed(2);
var annualProjected  = +(annualEmission / M * 12).toFixed(2);           // 全年推演

// 排放源派生
var directSum = 0, indirectSum = 0;
Object.keys(SRC_RATIO).forEach(function (name) {
  var v = cur * SRC_RATIO[name];
  if (name.indexOf('直接') >= 0) directSum += v; else indirectSum += v;
});
```

**(5) 数值格式**：排放量/产量 2 位小数、千分位；强度 4 位小数；百分数 2 位小数（占比 1 位小数）；单位统一 排放量=万tCO₂、强度=tCO₂/t、产量=万t。

**声明：本节是所有数字的唯一来源，生成时不要另编数据。**

**(6) 校验参考**（用来自检；若你的结果与下表不符，说明取数下标或派生公式被改动了）：

| 入参 companyName=河南安钢周口钢铁有限责任公司 | `month=9`（year=2026） | `month=1`（year=2026） |
| --------------------------------- | ------------------- | ------------------- |
| 本月标签 `MONTH_CN` / 上月 `PREV_CN` / 同期 `YOY_CN` | 2026年9月 / 2026年8月 / 2025年9月 | 2026年1月 / **2025年12月** / 2025年1月 |
| 本月碳排放量 `cur`（万tCO₂） | 504.33 | 492.96 |
| 上月排放量 `prev` | 506.61 | 497.33 |
| 上年同期排放量 `yoy` | 483.78 | 472.87 |
| 环比 `momEmissionPct` / 同比 `yoyEmissionPct`（%） | −0.45 / 4.25 | −0.88 / 4.25 |
| 本月强度 `curIntensity` / 上月强度 | 0.7655 / 0.7662 | 0.7605 / 0.7663 |
| 上年同期强度 `yoyIntensityShown` | 0.7747 | 0.7696 |
| 强度环比 `momIntensityPct` / 强度同比 `yoyIntensityPct`（%） | −0.09 / −1.19 | −0.76 / −1.19 |
| 年累计 `annualEmission` / 全年推演（万tCO₂） | 4528.85 / 6038.47 | 492.96 / 5915.52 |
| 排放源（直接合计 / 间接合计，万tCO₂） | 312.68 / 191.65 | 305.64 / 187.32 |
| 趋势图：本月排名 / 最高月 / 最低月 | 第 7 位 / 5 月 514.65 / 2 月 485.81 | 第 11 位 / 5 月 514.65 / 2 月 485.81 |
| `EMISSION` 最小值 ~ 最大值 | 485.81 ~ 514.65 | 485.81 ~ 514.65 |
| `INTENSITY` 最小值 ~ 最大值 | 0.7573 ~ 0.7663 | 0.7573 ~ 0.7663 |

### 2.6 图表规格

本报告共 **3 种图**：2 种纯 HTML/CSS 横向条形图（不用 SVG、不用图表库）+ 1 种纯 SVG 折线图（不用图表库）。
统一容器 `.chart-box`（白底、1px 边框 `#e8ebef`、圆角 6px、padding `12px 14px 6px`）；图题 `.chart-caption`（居中 12.5px 灰，位于图框**下方**，上下间距 `4px 0 16px`）。

**图 A：本月/上月/上年同期对比图（`cmpBars`）——最大值归一**

- 容器 `.hbars`；每行 `.hbar-row`（flex、gap 10px、上下 margin 7px、12.5px）= 名称标签（宽 150px、**右对齐**）→ 轨道（`flex:1`、高 16px、底 `#f2f4f7`、圆角 3px、`overflow:hidden`）→ 数值（宽 150px、tabular-nums）。
- 条宽 = `value ÷ 行内最大值 × 100%`，**下限 0.5%**；数值格式 = `fmt(value, 2) + ' 万tCO₂'`。
- 固定 3 行，顺序与配色不可变：

| # | 行标签              | 取值        | 条色        | 特殊               |
| - | ---------------- | --------- | --------- | ---------------- |
| 1 | 本月（{MONTH_CN}）   | `cur`     | `#ff7d00` | 加 `.is-self`（名称与数值加粗、色 `#b25f00`） |
| 2 | 上月（{PREV_CN}）    | `prev`    | `#00b42a` | —                |
| 3 | 上年同期（{YOY_CN}）   | `yoy`     | `#165dff` | —                |

**图 B：本月碳排放源结构分布图（`structBars`）——总和归一**

- 复用 `.hbars`/`.hbar-row` 结构，但**条宽基准不同**：条宽 = `value ÷ 各项之和 × 100%`（各条之和 = 100%），不加 0.5% 下限。
- 数值格式 = `fmt(value, 2) + ' 万tCO₂（{pct}%）'`，如「221.91 万tCO₂（44.0%）」。
- 固定 4 行，顺序 = `SRC_RATIO` 的键序，条色依次取 `SRC_COLORS`：

| # | 行标签          | 取值              | 条色        |
| - | ------------ | --------------- | --------- |
| 1 | 化石燃料燃烧（直接）   | `cur × 0.44`    | `#00b42a` |
| 2 | 工业生产过程（直接）   | `cur × 0.18`    | `#165dff` |
| 3 | 外购电力（间接）     | `cur × 0.26`    | `#ff7d00` |
| 4 | 外购热力（间接）     | `cur × 0.12`    | `#722ed1` |

> 图 A 与图 B 的条宽基准、数值格式都不同（最大值归一 vs 总和归一、无括号占比 vs 带括号占比），**不要用同一个函数应付两图**。

**图 C：{year} 年逐月碳排放量走势（`lineChart`）——纯 SVG**

- 画布 `viewBox="0 0 760 240"`，`preserveAspectRatio="xMidYMid meet"`，外边距 `PL=52, PR=18, PT=18, PB=34`。
- **纵轴（Y）**：`min/max` 取自 12 个月排放量，向上/下各留 `span × 0.15` 余量（`span = max − min`，为 0 时取 1）；画 5 条水平网格线（`g = 0..4`，值 = `min + range × g / 4`），线色 `#eef1f4`、宽 1；刻度文字在左侧 `x = PL − 8`、10px `#98a1ab`、`text-anchor="end"`、`toFixed(1)`。
- **横轴（X）**：12 个刻度，`X(i) = PL + iw × i / 11`；标签 `1月`…`12月`，10px `#98a1ab`，位于 `y = H − 12`。
- **折线**：`<polyline>`，`fill="none"`、`stroke="#00b42a"`、`stroke-width="2.2"`、`stroke-linejoin="round"`。
- **数据点**：每月一个 `<circle>`。当前月（`i === M−1`）半径 5、填充 `#ff7d00`、描边 `#ff7d00`，并在点上方 `y − 12` 处标数值（11px、`#b25f00`、700、居中、2 位小数）；其余月份半径 3、填充 `#fff`、描边 `#00b42a`、宽 2。
- 纵轴**不要求从 0 起**，按数据范围自适应即可（这是原型行为，不要改成 0 起）。

### 2.7 表格规格

- 统一 `.btable`：宽 100%、`border-collapse: collapse`、12.5px；单元格 1px 边框 `#e3e7ec`、padding `6px 8px`、居中、`tabular-nums`；表头底 `#e9f7ee`、600 字重；斑马纹偶数行底 `#fafcfb`；`<tfoot>` 行底 `#f4fbf6`、600 字重。
- 语义色 class：`.is-pos` → `#d4380d`（红，排放上升/不利）；`.is-neg` → `#2ba471`（绿，排放下降/有利）；`.is-self` → 底 `#fff7e8` 加粗（本月列）。
- 表题行 `.table-caption`（左表名 13px `#333` + 右单位 12px `#8a9199`）；表注 `.btable-note`（12px `#98a1ab`）。
- 本报告共 **2 张表**：
  1. **月度排放对比表**：6 列 2 行（列定义见 2.4(5)）。
  2. **本月排放数据明细（按排放源）**：6 列 4 行 + `<tfoot>` 合计行（列定义见 2.4(8)）。

### 2.8 下载（PDF）

- 触发：点击工具条右侧「下载报告（PDF）」按钮。
- 点击后按钮置灰（`disabled`）并把文字替换为「正在生成 PDF…」；用 html2canvas（`scale: 2`、`backgroundColor: '#ffffff'`、`logging: false`）**逐张**渲染 `#brief-root .brief-page`，按 A4 高度切片：

```javascript
var pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
var PAGE_W = 210, PAGE_H = 297;
var pages = document.querySelectorAll('#brief-root .brief-page');
var first = true;
var chain = Promise.resolve();
pages.forEach(function (el) {
  chain = chain.then(function () {
    return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false }).then(function (canvas) {
      var pxPerMm = canvas.width / PAGE_W;
      var sliceH = Math.floor(PAGE_H * pxPerMm);
      var y = 0;
      while (y < canvas.height) {
        var h = Math.min(sliceH, canvas.height - y);
        var part = document.createElement('canvas');
        part.width = canvas.width; part.height = h;
        var ctx = part.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, part.width, part.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, h / pxPerMm);
        y += h;
      }
    });
  });
});
chain.then(function () {
  pdf.save('碳排放月报-' + Y + '年' + M + '月.pdf');
}).catch(function () {
  window.print();                                   // 生成失败 → 降级打印
}).then(function () {
  btn.disabled = false; btn.textContent = '下载报告（PDF）';   // 恢复按钮
});
```

- 文件名模板：`碳排放月报-{year}年{month}月.pdf`（例：`碳排放月报-2026年9月.pdf`）。
- **降级**：`window.jspdf?.jsPDF` 或 `window.html2canvas` 任一不存在 → 直接 `window.print()`（此时依赖 2.2 的 `@media print`：隐藏工具条、纸面去阴影、封面与目录后强制分页、图表与表格避免跨页断裂）。

### 2.9 不要做什么（负面清单）

- **不要交付多个文件**——最终产物有且只有一个 `碳排放月度报表.html`；不要把 html2canvas / jsPDF 等库文件、拆分的 CSS/JS 文件、说明文档作为产物一起给出。
- 不要顶部导航、侧栏、面包屑、页签（tab）切换条、月份卡片列表、搜索/筛选条件区——本页只有「工具条 + 三张 A4 纸面」。
- **不要实现碳交易月报**：本页只有「碳排放月度报表」一种报表，不出现成交量、成交均价、成交金额、持仓、成交明细、市场行情等碳交易内容；`?tab=` 参数一律忽略，不做页签分流。
- **不要让目录页（或任何一张纸面）与其他纸面宽度/内边距不一致**——常见错误是把目录内容贴到纸面左边缘；三张纸面必须同宽 920px、同内边距 `64px 72px 72px`、同水平居中，且必须用 2.2 给出的同一份容器 CSS，不得为目录另写容器样式。
- 不要「编制单位」「编制日期」「编制说明」「审核/批准」等落款文字（封面底部只有「数据期间」一行）。
- 不要出现行业特定字眼（高炉 / 烧结 / 转炉 / 炼铁 / 轧钢 / 熟料 / 机组 / 电解槽等）——排放源只用 2.5 给定的 4 类通用口径，报告对各类企业通用。
- **不要混淆红绿语义**：本报告是碳排放维度，**排放上升 = 不利 = 红（`.is-pos` / `#d4380d`）**，**排放下降 = 有利 = 绿（`.is-neg` / `#2ba471`）**。不要照搬「碳资产/碳交易」那种「高 = 绿」的映射。
- 不要引入图表库（ECharts / Chart.js / Highcharts）；横向条形图用纯 HTML/CSS，折线图用纯 SVG。
- 不要使用 emoji。
- 不要「生成报告」「查看报告」「导出 Excel」「打印」「删除」等按钮；工具条只有返回链接和「下载报告（PDF）」。
- 不要「功能建设中 / 敬请期待」等占位文字（本页是成品报告页）。
- 不要自由发挥「美化」——色值、字号、间距、文案、图表配色一律以本文档为准。
