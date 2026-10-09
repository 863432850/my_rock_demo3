# 碳排放差异分析 — 界面复刻提示词

> **数据口径（先读这条）**
>
> 1. **本报告的碳排放数据只能来自入参 `emission`，一律不兜底。** 入参给 `0` 就显示 `0`，字段或数组缺位同样按 `0` 处理；「全零入参生成全零页面」是**正确输出**。
> 2. **企业侧只采集"排放量 + 强度"两项。** 分解模型 `E = Q × I` 里的**产品产量 Q 由「排放量 ÷ 强度」派生**（保留 4 位小数），不是独立台账数据。
> 3. **排放源结构（化石燃料燃烧 / 工业生产过程 / 外购电力 / 外购热力、直接/间接占比）在实际业务中拿不到**，入参不设对应字段，正文也不得出现这类内容。
> 4. **对比口径**：环比基准 = 上月（`month = 1` 时**不存在**，环比整套降级为"不适用"）；同比基准 = 上年同期。
> 5. **交互项取残差**：`交互项 = 合计差异 − 产量效应 − 强度效应`。这样「三项之和 ≡ 合计差异 ≡ 总览表的排放量差异」恒成立，**不会出现 0.01 级的对不上**。这也是本报告与"教科书公式"的唯一有意差异，必须在文档中说明。
> 6. 全篇禁止出现 `NaN`、`undefined`、`Infinity`、`∞`；也禁止出现「示例」「演示」「模拟」「占位」「待补充」等字样。
> 7. 本报告只做**企业层级 · 月度**口径，**不含**逐日数据、工序级拆解，也不含碳交易内容。
>
> 本文档描述「碳排放差异分析」（在「碳月报及差异分析」列表页选择碳排放页签 → 点击某个月份卡片的「差异分析」按钮后进入的全屏 A4 报告页）的完整界面规格。按「一、入参」给定 JSON 输入，严格按「二、任务」的规格生成与原型一模一样的界面。  
> 本文档是自包含的：不需要访问任何原项目源码。  
> 使用方法：把入参 JSON 改成目标值，连同本文档全文发给 AI 即可。
>
> 本页与「碳排放月度报表」共用同一套页面外壳（工具条 / 三张 A4 纸面 / 封面 / 目录 / 章节标题 / 卡片 / 表格 / 下载），**正文内容完全不同**：本页做的是**两因素乘法模型差异分解**——把碳排放量差异拆成「产量效应 + 强度效应 + 交互项」，三项之和恒等于合计差异；并用**瀑布图**表现分解过程。

## 一、入参

```json
{
  "companyName": "河南安钢周口钢铁有限责任公司",
  "year": 2026,
  "month": 9,
  "emission": {
    "volume": {
      "cur":  [26.84, 24.62, 27.15, 26.38, 26.12, 25.83, 26.47, 26.90, 25.76, 26.31, 25.94, 26.68],
      "prev": [27.79, 25.48, 28.06, 27.28, 27.02, 26.72, 27.38, 27.83, 26.65, 27.22, 26.84, 27.60]
    },
    "intensity": {
      "cur":  [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663],
      "prev": [0.7696, 0.7664, 0.7729, 0.7722, 0.7738, 0.7745, 0.7750, 0.7754, 0.7747, 0.7753, 0.7749, 0.7755]
    }
  }
}
```

### 入参字段说明

| 字段                        | 类型         | 必填    | 说明                                                               |
| ------------------------- | ---------- | ----- | ---------------------------------------------------------------- |
| `companyName`             | string     | 是     | 企业名称；用于封面 H1 第一行、工具条标题、浏览器标签页标题                                  |
| `year`                    | number     | 是     | 年份（4 位）；只影响文案年号与文件名，**不参与取数**                                    |
| `month`                   | number     | 是     | 月份 1–12；决定取哪个月（下标 `month − 1`）、环比/同比基准。**< 1 或 > 12 一律按 9 处理**   |
| `emission`                | object     | **是** | **本企业碳排放数据块**（L1，零兜底）。整个对象缺失时按全 0 处理                             |
| `emission.volume`         | object     | 否     | 月度碳排放量（万tCO₂，2 位小数）。缺省按全 0                                       |
| `emission.volume.cur`     | number[12] | 否     | **当年 1–12 月的当月排放量**。**必须写满 12 个元素**                              |
| `emission.volume.prev`    | number[12] | 否     | **上年同期 1–12 月的当月排放量**，是**同比基准**。**同样必须写满 12 个元素**                |
| `emission.intensity`      | object     | 否     | 单位产品碳排放强度（tCO₂/t，4 位小数）。缺省按全 0                                   |
| `emission.intensity.cur`  | number[12] | 否     | **当年 1–12 月的当月强度**。**必须写满 12 个元素**。同时是**分解模型的分母**（产量 = 排放量 ÷ 强度） |
| `emission.intensity.prev` | number[12] | 否     | **上年同期 1–12 月的当月强度**，同比基准                                        |

> **数据可得性说明**：本报告的企业侧数据与《碳排放月度报表》完全一致——只有**月度碳排放量**与**单位产品碳排放强度**两项。
>
> - **产品产量不在入参里**，而是分解模型的**派生输入**：`Q = round4(排放量 ÷ 强度)`。不要要求使用者另填产量，也不要用产量反推入参。
> - **排放源结构拿不到**：化石燃料燃烧 / 生产过程 / 外购电力 / 外购热力拆解、直接/间接占比，在实际业务中无法获取，入参不设对应字段，正文也不出现这类内容。
> - **环比基准就是 `volume.cur` 的相邻元素**（上月），**不是**额外字段；`month = 1` 时没有上月基数。
> - 逐日数据同样拿不到，本报告最小粒度就是**月**。

### 数组填写规则

1. `volume.cur` / `volume.prev` / `intensity.cur` / `intensity.prev` **四个数组都必须写满 12 个元素**（下标 0 → 1 月，下标 11 → 12 月）。
2. **即使某月为 0 也要写 `0` 占位**——数组长度是"哪几月有数据、哪几月没有"的唯一依据；**严禁**用最后一个已有值向后外推，也**严禁**整体缩写成 3 个月、6 个月。
3. 数组长度**不足 12** 时，缺失位按 `0` 处理；长度**超过 12** 时只取前 12 个。
4. `volume.*` 用**万tCO₂**、保留 2 位小数；`intensity.*` 用 **tCO₂/t**、保留 4 位小数。单位不要自行换算。
5. 元素必须是**数字**（不要写字符串、不要带千分位逗号、不要带单位文字）。
6. `intensity.*` 是**分母**：某期（本期 / 上月 / 上年同期）为 `0`（或负）时，**该期的产品产量不可计算**，**该期的整套因素分解作废**（走"不可分解"说明），不要用替代值代入。
7. 上报口径：`cur` = 当年逐月、`prev` = **上年同期**逐月（不是"上月"）。

**全零入参示例**（"本期无数据"的正确输入形态；此时的正确输出见「附录 C · C2」）

```json
{
  "companyName": "河南安钢周口钢铁有限责任公司",
  "year": 2026,
  "month": 9,
  "emission": {
    "volume":    { "cur": [0,0,0,0,0,0,0,0,0,0,0,0], "prev": [0,0,0,0,0,0,0,0,0,0,0,0] },
    "intensity": { "cur": [0,0,0,0,0,0,0,0,0,0,0,0], "prev": [0,0,0,0,0,0,0,0,0,0,0,0] }
  }
}
```

### 入参带入规则

| JSON 字段                   | 影响位置                                            | 规则                                                                                                                           |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| companyName               | 封面 H1 第一行 / 工具条标题 / 浏览器标签页标题                    | 封面拼接为「{companyName}（换行）碳排放差异分析报告」；工具条标题为「{companyName}碳排放差异分析报告（{year}年{month}月）」；`document.title` = 「碳排放差异分析报告-{year}-{MM}」 |
| year                      | 封面年月、封面「数据期间」、下载文件名                             | 四位年份。**不参与取数**                                                                                                               |
| month                     | 封面年月、数据期间、取数下标、对比口径（上月 / 上年同期）                  | 取值 1–12；**< 1 或 > 12 一律按 9 处理**；`month` 决定取第 `month − 1` 个数组元素（0 基）；**`month = 1` 时环比整套降级**                                  |
| `emission.volume.cur`     | 摘要「本月碳排放量 / 环比差异 / 同比差异」卡、差异总览表、分解表与瀑布图的**本期值** | **L1 入参直取，零兜底**。`cur[month − 1]` = 本期值；**上月值 = `cur[month − 2]`（`month = 1` 时不存在）**                                          |
| `emission.volume.prev`    | 同比差异、总览表同比行、同比分解表                               | **L1 入参直取，零兜底**。`prev[month − 1]` = 上年同期值                                                                                    |
| `emission.intensity.cur`  | 摘要「本期排放强度」卡、分解表的强度效应与 Q1 派生                     | **L1 入参直取，零兜底**；同时是**分母**：产量 `Q = 排放量 ÷ 强度`                                                                                  |
| `emission.intensity.prev` | 同比分解表的强度效应与 Q0 派生                               | **L1 入参直取，零兜底**                                                                                                              |

> **绝对不要用到的其他数据**：产品产量台账、排放源拆解、逐日排放、碳交易数据（成交量 / 均价 / 金额 / 持仓）。本报告一律不出现。  
> **注意**：《碳排放月度报表》与本页**共用同一套入参结构**，但**口径相同、不要互相套用结论**——月报出的是"水平值 + 环比/同比"，本页出的是"差异 + 因素分解"，同一数字在两页应当一致。

### 运行期入参来源（URL 查询参数）

```
?month=2026-09&company=河南安钢周口钢铁有限责任公司&evCur=…&evPrev=…&eiCur=…&eiPrev=…
```

- `month` 形如 `YYYY-MM`，拆分为 `year` 与 `month`；不传时用 JSON 示例值 `2026-09`。
- `company` 覆盖 `companyName`。
- 四个数据数组用**逗号分隔的 12 个数**透传：`evCur` = `emission.volume.cur`、`evPrev` = `emission.volume.prev`、`eiCur` = `emission.intensity.cur`、`eiPrev` = `emission.intensity.prev`。**参数不传**用示例值；**参数传空**（如 `?evCur=`）视为 12 个 0。
- 上游若附带 `?tab=emission` 之类的页签参数，**忽略即可**——本页只渲染「碳排放差异分析」（见 2.9 负面清单）。

## 二、任务

### 2.1 交付物

- **最终只交付一个文件：`碳排放差异分析.html`**。这是硬性要求——除这一个 HTML 文件外，不得再产出任何其他文件（包括但不限于：html2canvas.min.js、jspdf.umd.min.js 等库文件、单独的 CSS/JS 文件、说明文档、测试文件）。
- **单个自包含 HTML 文件**：CSS 写在 `<style>` 内、JS 写在 `<script>` 内；报告内容全部由 JS 按入参动态拼装，挂载到 `<div id="brief-root"></div>`。
- PDF 下载依赖 html2canvas + jsPDF：**必须在这个 HTML 文件内部通过 CDN `<script src="...">` 引用**：

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
```

- 页面结构固定为「工具条 + `#brief-root`」两块，`<body>` 末尾先引 CDN 两库，再引页面自身的渲染脚本。


### 2.2 页面整体布局

```
┌──────────────────────────────────────────────────────────────┐
│ 工具条（sticky 顶置，白底，下边线 #e4e8ee，padding 10px 20px）   │
│ ← 返回碳月报及差异分析 │ {企业名}碳排放差异分析报告（2026年9月） │ [下载报告（PDF）] │
├──────────────────────────────────────────────────────────────┤
│ 页面底 #e9edf3，内容水平居中                                   │
│  ┌────────────────────────────────────────────────┐          │
│  │ A4 纸面 1：封面（920px 宽白卡，阴影）              │          │
│  └────────────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────────────┐          │
│  │ A4 纸面 2：目录                                  │          │
│  └────────────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────────────┐          │
│  │ A4 纸面 3：正文（摘要 + 一~四章）                  │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- 页面背景 `#e9edf3`；纸面宽 **920px**、白底、阴影 `0 4px 24px rgba(20,40,30,0.10)`、内边距 `64px 72px 72px`、行高 1.8；首张纸面 `margin: 22px auto 40px`，后续纸面间隔 18px。
- **三张纸面（封面 / 目录 / 正文）共用同一个容器类 `.brief-page`，宽度、内边距、阴影、水平居中完全一致**。禁止给目录页单独设置 `width` / `margin` / `padding` / `max-width`。
- **无顶部导航、无侧栏、无面包屑、无列表页的月份卡片区**。
- 页面外壳与「碳排放月度报表」逐字相同，只是本页多了三类**差异分析专用**样式：`.wbars`（双向差异条）、`.lvl-bars`（水位对比条）、`.vs-cols`（有利/不利双栏）。**必须原样使用**：

```html
<div class="brief-toolbar" id="brief-toolbar">
  <a class="bt-back" href="monthly.html">← 返回碳月报及差异分析</a>
  <span class="bt-title" id="bt-title">差异分析报告</span>
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
  <div class="brief-page">……正文（摘要 + 一~四章）……</div>
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

/* 差异分解条形（以 0 为中心，支持正负双向） */
.wbars { margin: 10px 0 4px; }
.wbar-row { display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: 12.5px; }
.wbar-row .wbar-label { width: 120px; text-align: right; color: #444; flex-shrink: 0; }
.wbar-row .wbar-track { flex: 1; height: 18px; background: #f2f4f7; border-radius: 3px; position: relative; }
.wbar-row .wbar-track::before {
  content: ""; position: absolute; left: 50%; top: -2px; bottom: -2px;
  width: 1px; background: #dcdfe6;
}
.wbar-row .wbar-fill { position: absolute; top: 0; height: 100%; border-radius: 2px; }
.wbar-row .wbar-val { width: 130px; color: #333; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.wbar-row.is-pos .wbar-val { color: #d4380d; font-weight: 600; }
.wbar-row.is-neg .wbar-val { color: #2ba471; font-weight: 600; }

/* 水位对比条（本月 / 上月 / 上年同期，本月高亮） */
.lvl-bars { margin: 10px 0 4px; }
.lvl-row { display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: 12.5px; }
.lvl-row .lvl-label { width: 120px; text-align: right; color: #444; flex-shrink: 0; }
.lvl-row .lvl-track { flex: 1; height: 16px; background: #f2f4f7; border-radius: 3px; overflow: hidden; }
.lvl-row .lvl-fill { height: 100%; border-radius: 3px; }
.lvl-row .lvl-val { width: 150px; color: #333; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.lvl-row.is-cur .lvl-label, .lvl-row.is-cur .lvl-val { font-weight: 700; color: #b25f00; }

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

/* 有利 / 不利 双栏 */
.vs-cols { display: flex; gap: 14px; margin: 10px 0; }
.vs-col { flex: 1; min-width: 0; border-radius: 8px; padding: 14px 16px; }
.vs-col h3 { margin: 0 0 8px; font-size: 14.5px; }
.vs-col ul { margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.9; color: #333; }
.vs-col li { margin: 3px 0; }
.vs-col.is-good { background: #f4fbf6; border: 1px solid #d8efe0; }
.vs-col.is-good h3 { color: #1f7a3a; }
.vs-col.is-bad { background: #fff8f6; border: 1px solid #f6ddd6; }
.vs-col.is-bad h3 { color: #c53d1d; }

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

**生成后自查**：封面、目录、正文三张纸面的左边缘严格对齐成一条竖线；目录的「目　录」标题与摘要的「摘要 · 差异概览」标题左边缘也在同一竖线上。

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
| 弱文字                       | `#8a9199`、`#98a1ab`、`#6b7280`                  |
| 语义色 · 红（`is-pos`，**增排 = 不利**） | `#d4380d`                                   |
| 语义色 · 绿（`is-neg`，**减排 = 有利**） | `#2ba471`                                   |
| 中性说明行（`is-flat`）          | `#98a1ab`                                   |
| 本月高亮（橙）                   | 水位条 `#ff7d00`、文字 `#b25f00`、卡片底 `#fff7e8`、卡片边框 `#ffd591` |
| 上月（绿）                     | `#00b42a`                                   |
| 上年同期（蓝）                   | `#165dff`                                   |
| 瀑布图 · 基准柱                 | `#86909c`                                   |
| 瀑布图 · 本期柱                 | `#ff7d00`                                   |
| 瀑布图 · 因素柱（正=红 / 负=绿）       | `#f53f3f` / `#2ba471`                        |
| 有利栏                       | 底 `#f4fbf6`、边 `#d8efe0`、标题 `#1f7a3a`       |
| 不利栏                       | 底 `#fff8f6`、边 `#f6ddd6`、标题 `#c53d1d`       |
| 网格线 / 轴 / 连接虚线            | `#eef1f4` / `#dcdfe6` / `#c9d1d9`            |
| 表格边框 / 图框边框               | `#e3e7ec` / `#e8ebef`                       |
| 卡片边框                      | `#e5eee8`                                   |

**字体**：`-apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif`。
封面 H1 34px/700/字距 2px/行高 1.5；封面年月 20px/600/字距 4px 绿色；封面 kicker 13px/字距 6px 绿色圆角胶囊。
章节 H1 21px（左侧 5px 绿竖条 + `#e9f7ee` 向右渐隐背景，padding `8px 0 8px 14px`）；H2（`（一）…`/`（二）…` 小标题）16.5px（前置 8×8px 绿色小方块）；正文 13.5px；要点列表 12.5px/行高 1.9；表格 12.5px；双栏列表 12.5px；建议条目 13px；图题 12.5px 灰。

**图标**：仅工具条「下载报告（PDF）」按钮带一个 14px 线性 SVG 下载图标。正文无图标、**无 emoji**。

**着色语义（碳排放差异分析 · 关键）**：本页是碳排放维度，**正差异 = 增排 = 不利 = 红**，**负差异 = 减排 = 有利 = 绿**（与「碳交易差异分析」相反）。实现方式：`deltaCls(n)` = `n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : '')`，直接按数值符号给 class；瀑布图与双向条额外显式传 `positiveIsGood = false`。


### 2.4 区块逐一规格

**(1) 工具条**（sticky 顶置，白底，下边线 `#e4e8ee`，打印/下载 PDF 时隐藏）

- 左：链接「← 返回碳月报及差异分析」（13px，绿 `#00b42a`，href 指向 `monthly.html`）。
- 中：标题 14px/600 `#333`：`{companyName}碳排放差异分析报告（{year}年{month}月）`。
- 右：绿色实心按钮「下载报告（PDF）」（高 30px、圆角 4px、底 `#00b42a`、白字 13px、前置 14px 下载 SVG）。

**(2) 封面**（第一张纸面，居中排版，`padding: 130px 0 90px`）

1. 胶囊 kicker：文字「碳 排 放 差 异 分 析」（13px、字距 6px、绿色、1px 绿边、圆角 20px、padding `4px 18px 4px 24px`）。
2. H1 两行：第一行 `{companyName}`，第二行 `碳排放差异分析报告`。
3. 封面年月：`{year}年{month}月`（20px 绿色、字距 4px、600）。
4. 页签胶囊：文字「碳排放 · 差异分析」（14px，字 `#1f7a3a`、底 `#e9f7ee`、边 `#c8e8d2`、圆角 16px、padding `4px 18px`）。
5. 装饰线：120×3px 绿色圆角横线，上间距 40px。
6. 底部（`margin-top: 110px`，13px `#8a9199`）：仅一行「数据期间：{year}-{MM}-01 至 {year}-{MM}-{月末日}」。**无编制单位、无编制日期、无落款**。

**(3) 目录**（第二张纸面；`.brief-toc` 不得带任何 `width`/`margin`/`padding`）

- 标题「目　录」（20px、字距 2px），**5 个** `.toc-l1` 条目（本页没有「五、」，改进措施就是第四章）：

| 序号 | 目录文字        | 锚点       |
| -- | ----------- | -------- |
| 1  | 摘要 · 差异概览   | `#sec-0` |
| 2  | 一、差异总览      | `#sec-1` |
| 3  | 二、差异因素分解    | `#sec-2` |
| 4  | 三、差异归因与影响   | `#sec-3` |
| 5  | 四、改进措施      | `#sec-4` |

**(4) 摘要 · 差异概览**（`<h1 class="brief-h1" id="sec-0">摘要 · 差异概览</h1>`）

1. **KPI 卡片区**：`.kpi-grid`，grid **3 列**、间距 10px，共 **6 张卡**；第 1 张卡加 `.is-self`（橙色高亮）。6 张卡依次为：

| # | 名称      | 数值（`<small>` 单位）                  | 说明行（模板）                                         | 说明行 class                     |
| - | ------- | -------------------------------- | ----------------------------------------------- | ---------------------------- |
| 1 | 本月碳排放量  | `{cur}` 万tCO₂（2 位小数）             | `{MONTH_CN}`                                    | `is-flat`；卡加 `.is-self`       |
| 2 | 环比差异    | `{signed(mom.d,2)}` 万tCO₂         | `较{PREV_LABEL} {signed(环比差异率, 2, '%')}`          | `deltaCls(mom.d)`            |
| 3 | 同比差异    | `{signed(yoy.d,2)}` 万tCO₂         | `较{YOY_CN} {signed(同比差异率, 2, '%')}`             | `deltaCls(yoy.d)`            |
| 4 | 环比主要动因  | `{产量｜强度｜--}`                     | `占差异 {fmt(各自占比,1)}%`（不可分解时写 `--`）              | `is-flat`                    |
| 5 | 同比主要动因  | `{产量｜强度｜--}`                     | `占差异 {fmt(各自占比,1)}%`（不可分解时写 `--`）               | `is-flat`                    |
| 6 | 本期排放强度  | `{i1}` tCO₂/t（**4 位小数**）          | `环比 {signed(强度环比, 2, '%')}`                     | `deltaCls(i1 − i0m)`         |

   > 第 4/5 张卡：比较 `|xEff|` 与 `|yEff|`，前者大 → 文字「产量」、占比取 `xShare`；否则 → 「强度」、占比取 `yShare`。
   > **不可分解时**（`month = 1`、或本期/上月/上年同期强度 ≤ 0）：第 2/4 张卡说明行写 `年度首月，无上月基数`（或 `本期强度为 0，无法分解`），第 4/5 张卡数值写 `--`；**不要把 `--` 塞进「占差异 --%」以外的句式**。

2. **要点列表** `.point-list`（4 条；加粗文字在正文里是绿色 `#00b42a`）：
   1. 本月碳排放量 `<strong>{cur}</strong>` 万tCO₂，较上月（`{PREV_LABEL}`）{增加|减少} `{abs(mom.d)}` 万tCO₂，`{signed(环比差异率, 2, '%')}`。
   2. 环比差异分解：产量效应 `{signed(mom.xEff,2)}`、强度效应 `{signed(mom.yEff,2)}`、交互项 `{signed(mom.cross,2)}` 万tCO₂，**三项之和恒等于合计差异 `{signed(mom.d,2)}` 万tCO₂**。
   3. 同比看，本月较上年同期（`{YOY_CN}`）{增加|减少} `{abs(yoy.d)}` 万tCO₂（`{signed(同比差异率, 2, '%')}`），主要动因为{产量变化|强度变化}。
   4. 本期单位产品碳排放强度 `{i1}` tCO₂/t；本月产品产量 <strong>`{q1}`</strong> 万t（按「排放量 ÷ 强度」推算）。
   > 「增加/减少」按 `d ≥ 0` 选择。
   > **不可计算时**（`month = 1` 或强度为 0）：对应片段整句替换为「本月为年度首月，无上月基数，环比差异不适用」/「本期或上年同期强度为 0 或缺失，无法完成因素分解」，**不要输出「减少 -- 万tCO₂」**。

**(5) 一、差异总览**（`id="sec-1"`）

1. 引导段 `.brief-p`：
   「本报告以「本月（`{MONTH_CN}`）」为分析对象，分别与「上月（`{PREV_LABEL}`）」和「上年同期（`{YOY_CN}`）」对比，量化碳排放量差异并逐层分解到产量与强度两个因素。」
   > `month = 1` 时改写为：本报告以「本月（{MONTH_CN}）」为分析对象，与「上年同期（{YOY_CN}）」对比（**本月为年度首月，无上月基数**），……
2. **碳排放差异总览表**：表题「碳排放差异总览表」+ 右单位「排放量/产量：万tCO₂、万t；强度：tCO₂/t」。6 列 4 行：

| 列   | 对比口径                   | 基准值             | 本期值                     | 差异                                   | 差异率                                   | 差异性质              |
| --- | ---------------------- | --------------- | ----------------------- | ------------------------------------ | ------------------------------------- | ----------------- |
| 行 1 | 排放量（环比 · 较{PREV_LABEL}） | `{prev}`        | `{cur}`（`.is-self`）     | `{signed(cur − prev, 2)}` class=`deltaCls(同左)` | `{signed(环比差异率, 2, '%')}` class=`deltaCls(同左)` | `增排`/`减排`/`不适用`   |
| 行 2 | 排放量（同比 · 较{YOY_CN}）    | `{yoy}`         | `{cur}`（`.is-self`）     | `{signed(cur − yoy, 2)}` class=`deltaCls(同左)` | `{signed(同比差异率, 2, '%')}` class=`deltaCls(同左)` | `增排`/`减排`/`不适用`   |
| 行 3 | 产品产量（环比）               | `{q0m}`（2 位）   | `{q1}`（2 位）            | `{signed(q1 − q0m, 2)}` class=`deltaCls(同左)` | `{signed((q1 − q0m) ÷ q0m × 100, 2, '%')}` class=`deltaCls(同左)` | `增产`/`减产`/`不适用`   |
| 行 4 | 碳排放强度（环比）              | `{i0m}`（4 位）   | `{i1}`（4 位）            | `{signed(i1 − i0m, 4)}` class=`deltaCls(同左)` | `{signed((i1 − i0m) ÷ i0m × 100, 2, '%')}` class=`deltaCls(同左)` | `强度上升`/`强度下降`/`不适用` |

   表注：「注：差异 = 本期值 − 基准值；差异率 = 差异 ÷ 基准值 × 100%；产品产量由「排放量 ÷ 单位产品碳排放强度」推算（保留 4 位小数），不是独立台账数据。**本月为年度首月，无上月基数，环比相关一律为 `--`。**（此句仅在 `month = 1` 时输出）」
3. **本月/上月/上年同期对比条**（`levelBars`，规格见 2.6 图 A），图题「（图）本月 / 上月 / 上年同期碳排放量对比」。`month = 1` 时「上月」行的标签为「上月（无上月基数）」、数值 `--`、条宽 0。

**(6) 二、差异因素分解**（`id="sec-2"`，本页**最核心**的一节）

1. 模型说明段 `.brief-p`：
   「碳排放量可拆解为两个因素的乘积：`<strong>碳排放量 E = 产品产量 Q × 单位产品碳排放强度 I</strong>`。当产量或强度发生变化时，排放量差异可按「两因素乘法模型」分解为三部分：」
2. 要点列表 3 条：
   1. `<strong>产量效应</strong>`＝（Q₁ − Q₀）× I₀：仅由产品产量变化引起的排放量变化。
   2. `<strong>强度效应</strong>`＝（I₁ − I₀）× Q₀：仅由单位产品碳排放强度变化引起的排放量变化（反映能效与能源结构改善）。
   3. `<strong>交互项</strong>`＝**合计差异 − 产量效应 − 强度效应**：把（Q₁ − Q₀）×（I₁ − I₀）的交叉影响与展示值的舍入残差一并归入交互项。
3. 收尾段：「由此**三项之和恒等于合计差异**（ΔE = 产量效应 + 强度效应 + 交互项），并与「差异总览表」的排放量差异完全一致——不会出现 0.01 级的对不上。」
   > **这是本报告与"教科书公式"的唯一有意差异**：教科书写 `交互项 = (Q₁−Q₀)×(I₁−I₀)`，但那样三项之和会与展示口径的 `ΔE` 差 0.01；因此改为**残差口径**。文档必须写清，否则接收方会按教科书公式实现并出现对不上。
4. **环比差异因素分解表**：表题「环比差异因素分解表（{PREV_LABEL} → {MONTH_CN}）」+ 右单位「单位：万tCO₂」。5 列 3 行 + `<tfoot>` 合计行：

| 列       | 差异来源 | 影响排放量                             | 占差异比重                | 方向                                  | 说明                                        |
| ------- | ---- | --------------------------------- | -------------------- | ----------------------------------- | ----------------------------------------- |
| 行 1     | 产量效应 | `{signed(mom.xEff,2)}` class=`deltaCls(mom.xEff)` | `{fmt(mom.xShare,1)}%` | `增排`/`减排`/`持平` class=`deltaCls(mom.xEff)` | 产量 `{q0m}` → `{q1}` 万t                    |
| 行 2     | 强度效应 | `{signed(mom.yEff,2)}` class=`deltaCls(mom.yEff)` | `{fmt(mom.yShare,1)}%` | `增排`/`减排`/`持平` class=`deltaCls(mom.yEff)` | 强度 `{i0m}` → `{i1}` tCO₂/t                 |
| 行 3     | 交互项  | `{signed(mom.cross,2)}` class=`deltaCls(mom.cross)` | `{fmt(mom.crossShare,1)}%` | `增排`/`减排`/`持平` class=`deltaCls(mom.cross)` | 产量与强度同时变化（含舍入残差）                          |
| 合计行（`<tfoot>`） | 合计差异 | `{signed(mom.d,2)}` class=`deltaCls(mom.d)` | `100.0%`             | `增排`/`减排`/`持平` class=`deltaCls(mom.d)` | 等于三项之和（校验通过）                              |

   - **方向词**：值 `< 0` → `减排`、`> 0` → `增排`、`= 0` → `持平`。
   - **占差异比重**：各因素影响绝对值 ÷ 三者绝对值之和；**三者之和恰为 0（差异为 0）时，三项占比与合计占比一律写 `--`**，不要写 `0.0%` / `100.0%`。
   - **交互项占比取残差**（`100 − 产量占比 − 强度占比`），保证表内三项占比之和恒为 `100.0%`。
   表注：「注：占差异比重按各因素影响绝对值 ÷ 三者绝对值之和计算；差异恰好为 0 时占比写 `--`。三项之和 = `{fmt(mom.xEff,2)}` + `{fmt(mom.yEff,2)}` + `{fmt(mom.cross,2)}` = `{fmt(mom.d, 2)}` 万tCO₂。」
5. **环比排放量差异瀑布图**（`waterfall`，纯 SVG，规格见 2.6 图 B），输入 `waterfall(mom.z0, [产量效应, 强度效应, 交互项], mom.z1, '万tCO₂', false)`；图题「（图）环比排放量差异瀑布图（{PREV_LABEL} → {MONTH_CN}）」。
   > 瀑布图内**效应柱的数值标签保留 2 位小数**（1 位会把 `-0.02` 显示成「-0.0」）；`-0` 归一化为 `0`。
6. **H2「（一）同比差异分解」**（`<h2 class="brief-h2">（一）同比差异分解</h2>`）：
   - 表题「同比差异因素分解表（{YOY_CN} → {MONTH_CN}）」+ 右单位「单位：万tCO₂」；
   - 5 列 3 行 + `<tfoot>` 合计行，结构与上面环比分解表**完全一致**，只是把 `mom.*` 换成 `yoy.*`、`q0m→q0y`、`i0m→i0y`；说明列分别为「产量 `{q0y}` → `{q1}` 万t」「强度 `{i0y}` → `{i1}` tCO₂/t」「产量与强度同时变化（含舍入残差）」「等于三项之和（校验通过）」；
   - **同比分解表后不加表注**（只有环比表有 note）。
7. **同比差异因素贡献图**（`wbars`，规格见 2.6 图 C），输入 `wbars([产量效应, 强度效应, 交互项], '万tCO₂', 2, false)`；图题「（图）同比差异因素贡献（{YOY_CN} → {MONTH_CN}）」。
8. **降级（不可分解）时的整段替换**——**满足任一条即触发**：
   - `month = 1`（无上月基数）→ 环比分解表、环比瀑布图**都不输出**，改为一段说明：「本月为年度首月，无上月基数，环比差异不做因素分解。」，瀑布图位置输出灰字占位「年度首月，无上月基数」。
   - 本期或上月强度为 0 / 缺失 → 环比分解整体不可做，说明改为「本期或上月单位产品碳排放强度为 0 或缺失，无法由「排放量 ÷ 强度」推算产品产量，环比因素分解不做。」，瀑布图位置输出灰字占位「强度为 0 或缺失，无法分解」。
   - 上年同期强度为 0 / 缺失 → 同比分解（表 + 条形图）同样降级，说明改为「上年同期单位产品碳排放强度为 0 或缺失，无法由「排放量 ÷ 强度」推算产品产量，同比因素分解不做。」
   - **「（二）分解结论」**：对应的段落整句替换（如「本月为年度首月，无上月基数，不做环比分解结论。」），**不要把 `--` 塞进原句式**。
9. **H2「（二）分解结论」**，两段成文：
   - 段 1：「环比看，本月排放量{增加|减少} `{abs(mom.d)}` 万tCO₂，其中产量效应 `{signed(mom.xEff,2)}` 万tCO₂（占 `{fmt(mom.xShare,1)}%`）、强度效应 `{signed(mom.yEff,2)}` 万tCO₂（占 `{fmt(mom.yShare,1)}%`）。」+ 二选一句子：
     - `|mom.xEff| ≥ |mom.yEff|` → 「产量变化是本月排放差异的**主导因素**，强度变化影响相对次要。」
     - 否则 → 「单位产品碳排放强度变化是本月排放差异的**主导因素**，反映能效或能源结构的实质变化。」
   - 段 2：「同比看，本月较上年同期{增加|减少} `{abs(yoy.d)}` 万tCO₂，产量效应 `{signed(yoy.xEff,2)}` 万tCO₂、强度效应 `{signed(yoy.yEff,2)}` 万tCO₂。」+ 二选一句 + 二选一句：
     - `yoy.yEff < 0` → 「强度效应为负（减排方向），说明单位产品碳排放强度同比下降，能效水平持续改善；」否则 → 「强度效应为正（增排方向），说明单位产品碳排放强度同比上升，需重点关注能效管控；」
     - `yoy.xEff > 0` → 「产量效应为正，产量同比增长是排放增加的主要来源。」否则 → 「产量效应为负，产量同比下降带动排放减少。」

**(7) 三、差异归因与影响**（`id="sec-3"`）

1. **左右双栏 `.vs-cols`**（左栏 `.vs-col.is-good` 标题「有利差异（减排方向）」，右栏 `.vs-col.is-bad` 标题「不利差异（增排方向）」）。**每条按条件判断，满足才列**；一条都不满足时列兜底句：
   - 左栏（`goodItems`）按顺序判断：
     1. `mom.yEff < 0` → 「环比强度效应 `{fmt(mom.yEff,2)}` 万tCO₂，单位产品碳排放强度较上月下降，能效管控见效。」
     2. `yoy.yEff < 0` → 「同比强度效应 `{fmt(yoy.yEff,2)}` 万tCO₂，强度同比下降，节能降碳成效延续。」
     3. `mom.d < 0` → 「本月排放量环比减少 `{fmt(abs(mom.d),2)}` 万tCO₂（`{fmt(abs(mom.d ÷ mom.z0 × 100),2)}%`），排放总量得到控制。」
     4. `|mom.cross| < |mom.d| × 0.15` → 「交互项影响较小（`{fmt(mom.cross,2)}` 万tCO₂），产量与强度未出现明显同向叠加放大。」
     5. 若一条都未命中 → 「本期各项差异指标未呈现改善方向，暂无突出优势项。」
   - 右栏（`badItems`）按顺序判断：
     1. `mom.yEff > 0` → 「环比强度效应 `{fmt(mom.yEff,2)}` 万tCO₂，单位产品碳排放强度较上月上升，能效出现回落。」
     2. `yoy.yEff > 0` → 「同比强度效应 `{fmt(yoy.yEff,2)}` 万tCO₂，强度同比上升，节能降碳压力加大。」
     3. `mom.d > 0` → 「本月排放量环比增加 `{fmt(mom.d,2)}` 万tCO₂（`{fmt(mom.d ÷ mom.z0 × 100,2)}%`），需排查增排环节。」
     4. `|mom.xEff| ≥ |mom.yEff|` → 「产量效应占差异比重 `{fmt(mom.xShare,1)}%`，排放对产量波动较为敏感，产量型增排风险需关注。」
     5. 若一条都未命中 → 见下面的"兜底句两态"。
   > 注意第 4 条兜底语与前面的「不利」语义**不同**：它是一条风险提示，不是缺陷，但同样放在右栏。
   > **兜底句两态**（必须区分，否则会在"没算出"时给出"算得很好"的结论）：
   > - **至少有一侧可分解**（`month > 1` 且本期/上期/同期强度都 > 0）→ 「各项分解指标方向均较优，暂无显著短板，需防范后续强度反弹。」
   > - **两侧都不可分解**（`month = 1`，或强度为 0/缺失）→ 左栏：「本月为年度首月，无上月基数，暂不作环比归因。」（强度为 0 时改为「本期或上月单位产品碳排放强度为 0 或缺失，无法完成环比归因。」）；右栏：「本期数据不足，暂不作短板评价。」
2. **敏感性说明段** `.brief-p`：
   「敏感性说明：排放量对产量与强度的敏感度分别为 `<strong>I₀ = {i0m}</strong>` tCO₂/t（产量每变动 1 万t，排放变动 `{fmt(i0m,2)}` 万tCO₂）和 `<strong>Q₀ = {fmt(q0m,2)}</strong>` 万t（强度每变动 0.001 tCO₂/t，排放变动 `{fmt(q0m × 0.001, 2)}` 万tCO₂）。因此，在产量刚性增长的情况下，`<strong>压降强度是控制排放增量的关键抓手</strong>`。」
   （`i0m` 按 4 位小数展示，`q0m` 与 `q0m×0.001` 按 2 位小数展示。）

**(8) 四、改进措施**（`id="sec-4"`，`<ol class="advice-list">`，4 条，文案**逐字**如下，变量代入数值）

1. `<strong>锁定强度改善目标：</strong>`本月强度 `{i1}` tCO₂/t，环比 `{signed((i1 − i0m) ÷ i0m × 100, 2, '%')}`（不可计算时写「环比不适用」），建议设定下月强度不高于 `{min(i1, i0m)}` tCO₂/t（`i0m` 为 `--` 时取 `i1`）的管控目标，并将强度指标纳入月度考核。**（当 `mom.yEff > 0` 时追加一句）**「本月强度效应为增排方向，须重点排查能效回落环节。」
2. `<strong>削峰产量型增排：</strong>`{产量效应占环比差异 `{fmt(mom.xShare,1)}%`，}建议在高产月份同步加强能源调度与用能定额管理，避免产量增长直接抬升排放总量。**（`mom.xShare` 为 `--` 时去掉前面的从句，直接说「建议……」——不要把 `--` 塞进数字位）**
3. `<strong>强化结构降碳：</strong>`持续提高清洁燃料与绿电使用比例，优化能源结构以压降强度效应，从源头减少排放对产量的依赖。
4. `<strong>建立差异监测闭环：</strong>`按月开展「产量—强度」双因素差异分解，对强度效应转正的月份及时预警、限期整改，形成「月度分解—季度评估—年度考核」的闭环管理。


### 2.5 数据规则（唯一数据源）

全部数值由入参 + 以下公式推出。**无随机数、无种子**——同一入参必得完全一致的结果。
（下文 `fmt(n,d)` = 千分位 + 固定 d 位小数；`signed(n,d,unit)` = 正数前置 `+`；`round2` / `round4` = 四舍五入到 2 / 4 位小数。）

**(1) 入参数组**（L1 直取，零兜底）：

```javascript
// 读 12 元素数组：参数缺失 → 用示例值；参数存在但为空 → 12 个 0；元素非数字 → 0；
// 长度不足按 0 补、超长截断；严禁用最后一个已有值向后外推
var VOL_CUR  = readSeries('evCur',  [26.84, 24.62, 27.15, 26.38, 26.12, 25.83, 26.47, 26.90, 25.76, 26.31, 25.94, 26.68]); // emission.volume.cur    万tCO₂
var VOL_PREV = readSeries('evPrev', [27.79, 25.48, 28.06, 27.28, 27.02, 26.72, 27.38, 27.83, 26.65, 27.22, 26.84, 27.60]); // emission.volume.prev   万tCO₂
var INT_CUR  = readSeries('eiCur',  [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663]); // emission.intensity.cur  tCO₂/t
var INT_PREV = readSeries('eiPrev', [0.7696, 0.7664, 0.7729, 0.7722, 0.7738, 0.7745, 0.7750, 0.7754, 0.7747, 0.7753, 0.7749, 0.7755]); // emission.intensity.prev tCO₂/t
```

**(2) 日期派生**：

```javascript
var MONTH = '2026-09';                 // 来自 URL ?month=
var Y = 2026, M = 9;                   // 拆分 MONTH；M < 1 或 M > 12 时 M = 9
var MONTH_CN = Y + '年' + M + '月';      // 例：2026年9月
var HAS_PREV = M > 1;                  // M = 1 时没有上月基数
var PM = M === 1 ? 0 : M - 1;
var PREV_CN = (M === 1 ? Y - 1 : Y) + '年' + PM + '月';   // 仅 HAS_PREV 时可用
var PREV_LABEL = HAS_PREV ? PREV_CN : '无上月基数';        // 所有「上月」标签一律用它，避免拼出「2025年0月」
var YOY_CN = (Y - 1) + '年' + M + '月';                   // 例：2025年9月
```

**(3) 本期 / 基准取值与「产品产量」派生**：

```javascript
// 排放量：L1 直取
var cur  = round2(VOL_CUR[M - 1]);                     // 本期
var prev = HAS_PREV ? round2(VOL_CUR[PM - 1]) : null;  // 上月（M = 1 → --）
var yoy  = round2(VOL_PREV[M - 1]);                    // 上年同期

// 强度：L1 直取，⚠ 必须 round4 —— 用 round2 会把 0.7655 抹成 0.77
var i1  = round4(INT_CUR[M - 1]);
var i0m = HAS_PREV ? round4(INT_CUR[PM - 1]) : null;
var i0y = round4(INT_PREV[M - 1]);

// 产品产量 Q = 排放量 ÷ 强度（唯一算法；强度 ≤ 0 → null，对应那一侧的整套分解作废）
var q1  = (i1  != null && i1  > 0) ? round4(cur  / i1)  : null;
var q0m = (i0m != null && i0m > 0) ? round4(prev / i0m) : null;
var q0y = (i0y != null && i0y > 0) ? round4(yoy  / i0y) : null;
```

**(4) 两因素乘法模型分解（核心算法，原样实现）**：

`Z = X × Y`，基准为下标 0、本期为下标 1。**为让「三项之和 ≡ 合计差异 ≡ 总览表差异」恒成立，交互项取残差**：

```
Z1 = round(dec)(X1 × Y1) ； Z0 = round(dec)(X0 × Y0) ； ΔZ = round(dec)(Z1 − Z0)
X效应 = round(dec)((X1 − X0) × Y0)
Y效应 = round(dec)((Y1 − Y0) × X0)
交互项 = round(dec)(ΔZ − X效应 − Y效应)        ← 残差口径（含交叉影响与舍入残差）
占差异比重 = |该项| ÷ (|X效应| + |Y效应| + |交互项|) × 100%    （分母为 0 → null，渲染 --）
交互项占比 = 100 − X效应占比 − Y效应占比            ← 取残差，保证三项占比之和恒为 100.0%
```

```javascript
function decompose(x0, y0, x1, y1, dec) {
  if (x0 == null || y0 == null || x1 == null || y1 == null) {
    return { z0: null, z1: null, d: null, xEff: null, yEff: null, cross: null,
             xShare: null, yShare: null, crossShare: null, x0: x0, y0: y0, x1: x1, y1: y1, valid: false };
  }
  var k = Math.pow(10, dec);
  function rd(n) { return Math.round(n * k) / k; }
  var z0 = rd(x0 * y0), z1 = rd(x1 * y1);
  var d = rd(z1 - z0);
  var xEff = rd((x1 - x0) * y0);
  var yEff = rd((y1 - y0) * x0);
  var cross = rd(d - xEff - yEff);
  var absSum = Math.abs(xEff) + Math.abs(yEff) + Math.abs(cross);
  function share(v) { return absSum ? Math.round(Math.abs(v) / absSum * 1000) / 10 : null; }
  var xShare = share(xEff), yShare = share(yEff);
  var crossShare = (xShare == null) ? null : Math.round((100 - xShare - yShare) * 10) / 10;
  return { z0: z0, z1: z1, d: d, xEff: xEff, yEff: yEff, cross: cross,
           xShare: xShare, yShare: yShare, crossShare: crossShare,
           x0: x0, y0: y0, x1: x1, y1: y1, valid: true };
}
```

> **三项之和必须等于合计差异**——按**展示精度**（`dec` 位小数）相等：`round(dec)(xEff + yEff + cross) === round(dec)(ΔZ)`。
> 注意不要写成"浮点严格相等"（`xEff + yEff + cross === d`）：残差口径保证的是**舍入后**相等，浮点尾差本身无意义。
> ⚠️ **不要用教科书的 `交互项 = (X1−X0)×(Y1−Y0)`**：那样三项之和会与展示口径的 `ΔZ` 差 0.01，表格里会出现「三项之和 ≠ 合计差异」。本报告有意改用残差口径，这是与教科书公式的唯一差异。

**(5) 本期 / 基准值（碳排放口径）**：

```javascript
var mom = decompose(q0m, i0m, q1, i1, 2);   // 环比：上月 → 本月
var yoy = decompose(q0y, i0y, q1, i1, 2);   // 同比：上年同期 → 本月

var momDiff     = (prev == null) ? null : round2(cur - prev);   // 环比差异（= mom.d）
var yoyDiff     = round2(cur - yoy);                            // 同比差异（= yoy.d）
var momDiffPct  = (prev == null || !(prev > 0)) ? null : round2((cur - prev) / prev * 100);
var yoyDiffPct  = (yoy > 0) ? round2((cur - yoy) / yoy * 100) : null;
var momIntenPct = (i0m == null || !(i0m > 0)) ? null : round2((i1 - i0m) / i0m * 100);

var momWord = (momDiff == null) ? null : (momDiff >= 0 ? '增加' : '减少');
var yoyWord = (yoyDiff >= 0) ? '增加' : '减少';
```

> 环比与同比都按 **2 位小数**（`dec = 2`）分解。`mom.d === momDiff`、`yoy.d === yoyDiff` 必须完全成立（见 2.5(8) 的自检）。
> **不可分解时**（`mom.valid === false`）：环比分解表与瀑布图**都不输出**，改为整句说明（见 2.4(6) 第 8 条）；同比同理。

**(6) 数值格式**：排放量 / 产量 2 位小数 + 千分位；**强度 4 位小数**；百分数 2 位小数（占比 1 位小数）。
单位统一：**万tCO₂ / 万t / tCO₂/t**。

**(7) 零值与缺值处理（除零保护，必须实现）**

`emission` 整体缺失、或其子数组全为 0，都属**合法输入**，报告须正常渲染，不得报错、不得留空、不得填数：

| 情形 | 正确输出 | 错误输出（禁止） |
| --- | --- | --- |
| `volume.cur` 全为 0 | 本月排放量 `0.00`、环比/同比差异 `0.00`、差异率 `--`；水位图三条 0 宽条 | 为了"报告好看"自动编一组正常数据 |
| `intensity.cur` 本期为 0 | 本期强度显示 `0.0000`，**产品产量 `--`**，环比/同比分解**整体作废**（走"不可分解"整句说明） | 把产量算成 `Infinity`；或用别的期强度顶上 |
| 差异率分母为 0 | 差异率 `--` | `NaN` / `∞` |
| 占差异比重分母为 0（差异恰为 0） | 三项占比与合计占比**一律 `--`** | 写 `0.0%` / `100.0%` |
| `month = 1` | 本月、同比相关照常；**环比整套降级**（总览表环比行 `--`、环比分解表与瀑布图不输出、改整句说明），上月标签写「无上月基数」 | 拿上一年 12 月当"上月"，或把上月写成「2025年0月」 |
| 数组长度 < 12 | 缺失位按 `0` 处理 | 用最后一个已有值向后外推 |

> 实现提示：判断顺序必须是「**先判存在性与零值 → 再算派生量 → 最后格式化**」。格式化函数遇到 `null` / `NaN` / `Infinity` 必须返回 `--`，同时把 `-0` 归一化为 `0`（否则会显示成「-0.0」）。

**声明：本节是所有数字的唯一来源，生成时不要另编数据。**

**(8) 校验参考**（用来自检；若你的结果与下表不符，说明取数下标或分解公式被改动了）：

**A. 入参 `month=9`（year=2026，基准：上月 2026年8月 / 上年同期 2025年9月）**

| 项目 | 值 |
| --- | --- |
| 本期 `cur` / `i1` / `q1` | 25.76 万tCO₂ / 0.7655 tCO₂/t / 33.6512 万t |
| 环比基准 `prev` / `i0m` / `q0m` | 26.90 万tCO₂ / 0.7662 tCO₂/t / 35.1083 万t |
| 同比基准 `yoy` / `i0y` / `q0y` | 26.65 万tCO₂ / 0.7747 tCO₂/t / 34.4004 万t |
| 环比 ΔE / 环比差异率 | **−1.14** 万tCO₂ / −4.24 % |
| 环比三项：产量效应 / 强度效应 / 交互项（合计） | **−1.12 / −0.02 / 0.00**（−1.14） |
| 环比占比：产量 / 强度 / 交互（%） | 98.2 / 1.8 / 0.0 |
| 同比 ΔE / 同比差异率 | **−0.89** 万tCO₂ / −3.34 % |
| 同比三项：产量效应 / 强度效应 / 交互项（合计） | **−0.58 / −0.32 / +0.01**（−0.89） |
| 同比占比：产量 / 强度 / 交互（%） | 63.7 / 35.2 / 1.1 |
| 环比 / 同比 主要动因 | 产量（98.2%） / 产量（63.7%） |
| 强度环比 | −0.09 % |
| 敏感性 `I₀` / `Q₀` | 0.7662 tCO₂/t（→ 0.77 万tCO₂ 每 1 万t） / 35.11 万t（→ 0.04 万tCO₂ 每 0.001 强度） |
| 建议中 `min(i1, i0m)` | 0.7655 |

**B. 入参 `month=1`（year=2026，无上月基数；上年同期 = 2025年1月）**

| 项目 | 值 |
| --- | --- |
| 本期 `cur` / `i1` / `q1` | 26.84 万tCO₂ / 0.7605 tCO₂/t / 35.2926 万t |
| 环比 | **整套降级**：`prev`、`i0m`、`q0m`、环比差异与差异率、环比分解表、瀑布图**全部 `--` / 不输出**，上月标签「无上月基数」 |
| 同比基准 `yoy` / `i0y` / `q0y` | 27.79 万tCO₂ / 0.7696 tCO₂/t / 36.1097 万t |
| 同比 ΔE / 同比差异率 | **−0.95** 万tCO₂ / −3.42 % |
| 同比三项：产量效应 / 强度效应 / 交互项（合计） | **−0.63 / −0.33 / +0.01**（−0.95） |
| 归因栏 | 左栏首条「本月为年度首月，无上月基数，暂不作环比归因。」；右栏首条「本期数据不足，暂不作短板评价。」 |

### 2.6 图表规格

本报告共 **3 种图**：2 种纯 HTML/CSS（水位对比条、双向差异条）+ 1 种纯 SVG（瀑布图）。**均不使用图表库。**
统一容器 `.chart-box`（白底、1px 边框 `#e8ebef`、圆角 6px、padding `12px 14px 6px`）；图题 `.chart-caption`（居中 12.5px 灰，位于图框**下方**，上下间距 `4px 0 16px`）。

**图 A：本月/上月/上年同期水位对比条（`levelBars`）——最大值归一，本月高亮**

- 容器 `.lvl-bars`；每行 `.lvl-row`（flex、gap 10px、上下 margin 8px、12.5px）= 名称标签（宽 120px、右对齐）→ 轨道（`flex:1`、高 16px、底 `#f2f4f7`、圆角 3px、`overflow:hidden`）→ 数值（宽 150px、tabular-nums）。
- 条宽 = `max(1, value ÷ 行内最大值 × 100)%`；数值格式 = `fmt(value, 2) + ' 万tCO₂'`。
- 固定 3 行；本月行加 `.is-cur`（名称与数值加粗、色 `#b25f00`）：

| # | 行标签            | 取值        | 条色        | 特殊            |
| - | -------------- | --------- | --------- | ------------- |
| 1 | 本月（{MONTH_CN}） | `cur`     | `#ff7d00` | 加 `.is-cur`    |
| 2 | 上月（{PREV_LABEL}） | `prev`    | `#00b42a` | —             |
| 3 | 上年同期（{YOY_CN}） | `yoy`     | `#165dff` | —             |

> 值为 `null` 时条宽 0、数值显示 `--`。**`month = 1` 时**第 2 行标签为「上月（无上月基数）」、数值 `--`、条宽 0。

**图 B：环比排放量差异瀑布图（`waterfall`）——纯 SVG，纵轴按差异量级缩放**

- 画布 `viewBox="0 0 760 300"`，`preserveAspectRatio="xMidYMid meet"`；外边距 `PL=66, PR=24, PT=24, PB=46`。
- **柱子序列**（共 5 根）：`基准值`（`mom.z0`，灰 `#86909c`）→ `产量效应` → `强度效应` → `交互项` → `本期值`（`mom.z1`，橙 `#ff7d00`）。
- **因素柱配色**：本页 `positiveIsGood = false`，故 **正值 = 红 `#f53f3f`（增排）**、**负值 = 绿 `#2ba471`（减排）**。
- **纵轴（关键，容易做错）**：只取「差异轨迹」的值域——即 `[基准值, 本期值]` 加上每根因素柱的 `from` 与 `to`，**不包含 0**；再上下留白（下留 `span × 0.22`、上留 `span × 0.16`，`span = max − min`，为 0 时取 1）。**基准柱与本期柱改为「自轴底起绘」，只有因素柱是浮动柱**（`from = (kind === 'eff') ? st.from : 轴底值`），柱高下限 2px。
  > 这样做的原因：差异量级远小于基期总量（如基期 26.90、差异仅 −1.14），若按 0 起轴，因素柱会被压成 1~2px 的细线而看不见。**不要改成从 0 起轴。**
- **网格与刻度**：5 条水平线（`g = 0..4`，值 = `轴底 + 全幅 × g / 4`），线色 `#eef1f4`；刻度文字 `x = PL − 8`、10px `#98a1ab`、`text-anchor="end"`、`toFixed(1)`。
- **柱宽**：`slot = 内宽 ÷ 5`，`bw = min(74, slot × 0.56)`，圆角 `rx = 3`。
- **柱顶数值标签**：因素柱显示 `{signed(value 保留 **2** 位小数)}`（如 `-1.12`、`0.00`），基准/本期柱显示其总量（2 位小数）；10.5px、`#333`、600、居中，位于柱顶上方 6px。
  > ⚠️ **必须用 2 位小数**：1 位小数会把 `-0.02` 显示成「-0.0」，`0` 也可能显示成「-0.0」。同时对 `-0` 做归一化（`-0 === 0 → 0`）。
- **柱底名称标签**：`基准值` / `产量效应` / `强度效应` / `交互项` / `本期值`，10.5px `#606266`、居中，位于 `y = H − 26`。
- **连接虚线**：相邻柱之间在「当前柱顶值」高度画 1px 虚线（`#c9d1d9`、`stroke-dasharray="3 3"`），把瀑布逐级串起来。
- **图下脚注**（SVG 之外的一行 div，12px `#98a1ab`、居中）：「单位：`{unit}` · 纵轴按差异量级缩放，基准/本期柱自轴底起绘」。
- **无数据态**：当环比（或同比）分解不可做时（`month = 1`、或强度 ≤ 0），**不画图**，图框内居中输出一行灰字：`month = 1` 时为「年度首月，无上月基数」，强度为 0/缺失时为「强度为 0 或缺失，无法分解」（13px `#98a1ab`，垂直居中，占位高度 150px）。

**图 C：同比差异因素贡献（`wbars`，双向差异条）——以 0 为中心**

- 容器 `.wbars`；每行 `.wbar-row`（flex、gap 10px、上下 margin 8px、12.5px）= 名称标签（宽 120px、右对齐）→ 轨道（`flex:1`、高 18px、底 `#f2f4f7`、圆角 3px、`position:relative`）→ 数值（宽 130px、tabular-nums）。
- 轨道正中有一条 1px 竖向轴线（`::before`，`left:50%`、上下各外扩 2px、色 `#dcdfe6`）作为 0 基准。
- 每条 `.wbar-fill` 绝对定位：**正值 → `left:50%` 向右伸**，**负值 → `right:50%` 向左伸**；宽 = `max(0.4, |value| ÷ 最大绝对值 × 50)%`（单侧最多占轨道一半）。值为 `null` 时条宽 0、填色 `#c9d1d9`。
- 填充色：本页 `positiveIsGood = false` → **正值红 `#f53f3f`、负值绿 `#2ba471`**；行 class 同时给 `is-pos` / `is-neg`，`is-pos` 的数值文字为红 `#d4380d`、`is-neg` 为绿 `#2ba471`，均 600 字重。
- 数值格式 = `signed(value, 2) + ' 万tCO₂'`；不可计算时 `--`。
- 固定 3 行：`产量效应`（`yoy.xEff`）、`强度效应`（`yoy.yEff`）、`交互项`（`yoy.cross`）。
- **无数据态**：同比分解不可做时同上，输出灰字占位「上年同期强度为 0 或缺失，无法分解」。

> 图 C 与图 A 都是横向条，但**图 C 以 0 为中心双向伸展、图 A 单向最大值归一**，不要混用实现。

### 2.7 表格规格

- 统一 `.btable`：宽 100%、`border-collapse: collapse`、12.5px；单元格 1px 边框 `#e3e7ec`、padding `6px 8px`、居中、`tabular-nums`；表头底 `#e9f7ee`、600 字重；斑马纹偶数行底 `#fafcfb`；`<tfoot>` 行底 `#f4fbf6`、600 字重。
- 语义色 class：`.is-pos` → `#d4380d`（红，增排/增产/强度上升）；`.is-neg` → `#2ba471`（绿，减排/减产/强度下降）；`.is-self` → 底 `#fff7e8` 加粗（本期列）。
- 表题行 `.table-caption`（左表名 13px `#333` + 右单位 12px `#8a9199`）；表注 `.btable-note`（12px `#98a1ab`）。
- 本报告共 **3 张表**（`month = 1` 或分解不可做时，第 2 张不输出，变为 **2 张**）：
  1. **碳排放差异总览表**：6 列 4 行（2.4(5)）——注意此表**没有** `<tfoot>`。
  2. **环比差异因素分解表（{PREV_LABEL} → {MONTH_CN}）**：5 列 3 行 + `<tfoot>` 合计行（2.4(6)4）。
  3. **同比差异因素分解表（{YOY_CN} → {MONTH_CN}）**：5 列 3 行 + `<tfoot>` 合计行（2.4(6)6）。

### 2.8 下载（PDF）

- 触发：点击工具条右侧「下载报告（PDF）」按钮。
- 点击后按钮置灰并把文字替换为「正在生成 PDF…」；用 html2canvas（`scale: 2`、`backgroundColor: '#ffffff'`、`logging: false`）逐张渲染 `#brief-root .brief-page`，按 A4（210×297mm）高度切片后写入 jsPDF（JPEG 质量 0.92，首张之外逐页 `addPage`），完成后恢复按钮文字。实现与「碳排放月度报表」**逐字相同**（见该文档 2.8 的代码块），**仅文件名不同**。
- 文件名模板：`碳排放差异分析报告-{year}年{month}月.pdf`（例：`碳排放差异分析报告-2026年9月.pdf`）。
- **降级**：`window.jspdf?.jsPDF` 或 `window.html2canvas` 任一不存在 → 直接 `window.print()`（依赖 2.2 的 `@media print`）。

### 2.9 不要做什么（负面清单）

- **不要交付多个文件**——最终产物有且只有一个 `碳排放差异分析.html`；不要把 html2canvas / jsPDF 等库文件、拆分的 CSS/JS 文件、说明文档作为产物一起给出。
- 不要顶部导航、侧栏、面包屑、页签（tab）切换条、月份卡片列表、搜索/筛选条件区——本页只有「工具条 + 三张 A4 纸面」。
- **不要实现碳交易差异分析**：本页只有「碳排放差异分析」，指标是碳排放量（万tCO₂）、产品产量（万t）、单位产品碳排放强度（tCO₂/t）；**不得出现** 成交量/成交均价/成交金额/持仓/CEA/CCER、「量差效应」「价差效应」、「增收/减收」等碳交易内容；`?tab=` 参数一律忽略。
- **不要写成「月度报表」**：本页不做「本月/上月/上年同期 三列并排的现状描述」，而是**差异分解**——必须有因素分解表（含 `<tfoot>` 合计行与「校验通过」字样）、瀑布图、双向差异条、有利/不利双栏；目录里必须有「二、差异因素分解」「三、差异归因与影响」。
- **不要让目录页（或任何一张纸面）与其他纸面宽度/内边距不一致**——常见错误是把目录内容贴到纸面左边缘；三张纸面必须同宽 920px、同内边距 `64px 72px 72px`、同水平居中，且必须用 2.2 给出的同一份容器 CSS。
- 不要「编制单位」「编制日期」「编制说明」等落款文字（封面底部只有「数据期间」一行）。
- 不要出现行业特定字眼（高炉 / 烧结 / 转炉 / 炼铁 / 轧钢 / 熟料 / 机组等）——报告对企业通用。
- **不要混淆红绿语义**：本页 **正差异（增排）= 红（`.is-pos` / `#d4380d`）**、**负差异（减排）= 绿（`.is-neg` / `#2ba471`）**；瀑布图因素柱同样「正红负绿」。**不要照搬「碳交易差异分析」那种「正绿负红」的收益视角。**
- **不要用教科书的交互项公式**：必须按 2.5(4) 的**残差口径** `交互项 = 合计差异 − 产量效应 − 强度效应`，否则「三项之和 ≠ 合计差异」，表格自相矛盾。
- **不要给入参兜底**：`emission.*` 给 `0` 就显示 `0`；缺位按 `0` 处理。**严禁**用行业均值、相邻期插值、等比放大或联网检索"补"一组排放量或强度，也严禁用别的期强度反推产量。
- **不要把 `--` 塞进原句式的数字位**：不可计算时整句改写（如「环比不适用」「本月为年度首月，无上月基数」「本期强度为 0，无法分解」），不要生成「减少 -- 万tCO₂」「占差异 --%」这类句子。
- **不要出现排放源结构相关内容**：不写「化石燃料燃烧」「工业生产过程」「外购电力」「外购热力」「直接排放占比」「范围一 / 范围二」，也不画排放源图表——这类数据在入参里不存在。
- **不要把瀑布图改成从 0 起轴**（会让因素柱消失），也不要给基准柱/本期柱做浮动柱。
- 不要引入图表库（ECharts / Chart.js / Highcharts）；水位条与双向条用纯 HTML/CSS，瀑布图用纯 SVG。
- 不要使用 emoji。
- 不要「生成报告」「查看报告」「导出 Excel」「打印」「删除」等按钮；工具条只有返回链接和「下载报告（PDF）」。
- 不要「功能建设中 / 敬请期待」等占位文字（本页是成品报告页）。
- 不要自由发挥「美化」——色值、字号、间距、文案、图表配色一律以本文档为准。

---

## 附录 A · 量级锚点与自检

**单位产品碳排放强度（tCO₂/t）的合理区间**——用于判断入参是否"一眼假"，**不是用来填数**：

| 行业 / 工艺路线 | 单位产品碳排放强度 | 说明 |
| --- | --- | --- |
| 钢铁（长流程，高炉—转炉） | 1.8 ~ 2.32 tCO₂/t 粗钢 | 世界钢铁协会全球平均约 1.92；国家温室气体排放因子数据库（第二版）转炉粗钢直接强度约 1.6048 |
| 钢铁（短流程，电炉） | 0.63 ~ 0.76 tCO₂/t 粗钢 | 以电力间接排放为主 |
| 水泥（熟料） | 0.85 ~ 0.90 tCO₂/t 熟料 | 其中工艺过程约占 0.52 ~ 0.55 |
| 火力发电 | 0.75 ~ 0.90 tCO₂/MWh | 随煤质与机组效率波动 |
| 电解铝 | 10 ~ 13 tCO₂/t 铝（含电力间接） | 电力结构影响极大 |

**量级自检用法**：由「排放量 ÷ 强度 = 产品产量」反推一个月产量，判断是否符合该企业产能。本项目示例：月排放 25 ~ 27 万tCO₂、强度 ≈ 0.766 tCO₂/t → 月产品产量 ≈ 33 ~ 35 万t（年 ≈ 300 ~ 320 万tCO₂）。
若反推出的产量明显超出企业产能（差一个数量级），说明入参量级可疑，**应如实呈现并在文案中提示存疑**，**不要**替它改成"合理值"。

> ⚠️ **本报告的产量是派生量，不是入参**：`Q = round4(排放量 ÷ 强度)`。因此**强度既是指标也是分母**，为 0 时整套分解作废——不要试图用别的期强度或行业均值顶上。

## 附录 B · 兜底生成规则

> **适用范围：无。本报告全篇为 L1 入参直取 + 派生计算，不存在任何兜底生成。**
> 排放量与强度一律不兜底；产品产量是**派生量**，其唯一算法见 2.5(3)。

**B1 各量的合法来源**

| 量 | 合法来源 | 无效时 |
| --- | --- | --- |
| 本期 / 上月 / 上年同期排放量 | 入参 `volume.cur` / `volume.prev` | `--` |
| 本期 / 上月 / 上年同期强度 | 入参 `intensity.cur` / `intensity.prev` | `--` |
| 产品产量 `q1` / `q0m` / `q0y` | **派生**：对应期排放量 ÷ 对应期强度（round4） | 强度 ≤ 0 → `null` → 该侧分解**整套作废** |
| 三项效应与占比 | `decompose()`（2.5(4) 残差口径） | 任一分量为 `null` → 全部 `--` |

**B2 派生量必须用唯一算法**

- 产品产量**只能**由「排放量 ÷ 强度」得到，**不得**由年产量按月份比例拆分、不得用行业平均产量顶替、**不得**反向修正排放量或强度。
- 交互项**只能**用残差口径（`ΔZ − X效应 − Y效应`），不得改用教科书公式（会导致三项之和对不上 `ΔZ`）。
- 占比分母为 0（差异恰为 0）时写 `--`，不得写 `0.0%`。

**B3 降级路径汇总**

| 触发条件 | 降级结果 |
| --- | --- |
| `volume.cur` 全 0 | 排放量类数值 `0.00`，差异率 `--`，**页面照常渲染**（这是正确输出） |
| 本期或上月强度 ≤ 0 | 环比：产量 `--`、环比分解表与瀑布图不输出、改整句说明；同比视上年同期强度而定 |
| 上年同期强度 ≤ 0 | 同比分解降级（同上） |
| `month = 1` | 环比**整套**降级：总览表环比行 `--`、环比分解表与瀑布图不输出、上月标签「无上月基数」；同比照常 |
| 差异恰为 0 | 三项占比与合计占比 `--`；`合计差异 0.00`；方向词「持平」 |

## 附录 C · 期望值（自检用）

### C1 正常入参

入参为「一、入参」给出的那份（`month = 9`、`year = 2026`）。期望值如下（**必须逐一吻合**）：

| 位置 | 期望值 |
| --- | --- |
| 卡 1 本月碳排放量 | `25.76` 万tCO₂；说明行「2026年9月」 |
| 卡 2 环比差异 | `-1.14` 万tCO₂；说明行「较2026年8月 -4.24 %」 |
| 卡 3 同比差异 | `-0.89` 万tCO₂；说明行「较2025年9月 -3.34 %」 |
| 卡 4 环比主要动因 | 产量；「占差异 98.2%」 |
| 卡 5 同比主要动因 | 产量；「占差异 63.7%」 |
| 卡 6 本期排放强度 | `0.7655` tCO₂/t；说明行「环比 -0.09 %」 |
| 总览表 · 排放量（环比） | 26.90 ｜ 25.76 ｜ -1.14 ｜ -4.24 % ｜ 减排 |
| 总览表 · 排放量（同比） | 26.65 ｜ 25.76 ｜ -0.89 ｜ -3.34 % ｜ 减排 |
| 总览表 · 产品产量（环比） | 35.11 ｜ 33.65 ｜ -1.46 ｜ -4.15 % ｜ 减产 |
| 总览表 · 碳排放强度（环比） | 0.7662 ｜ 0.7655 ｜ -0.0007 ｜ -0.09 % ｜ 强度下降 |
| 环比分解表三行 | 产量效应 -1.12（98.2%，减排）｜ 强度效应 -0.02（1.8%，减排）｜ 交互项 0.00（0.0%，持平） |
| 环比分解表合计行 | `-1.14` 万tCO₂，100.0%，减排 |
| 环比表注三项之和 | `-1.12 + -0.02 + 0.00 = -1.14 万tCO₂` |
| 同比分解表三行 | 产量效应 -0.58（63.7%）｜ 强度效应 -0.32（35.2%）｜ 交互项 +0.01（1.1%） |
| 同比分解表合计行 | `-0.89` 万tCO₂，100.0% |
| 分解结论 · 段 1 | 「环比看，本月排放量减少 1.14 万tCO₂，其中产量效应 -1.12 万tCO₂（占 98.2%）、强度效应 -0.02 万tCO₂（占 1.8%）。产量变化是本月排放差异的**主导因素**……」 |
| 敏感性段 | `I₀ = 0.7662` tCO₂/t（→ 0.77 万tCO₂ 每 1 万t）、`Q₀ = 35.11` 万t（→ 0.04 万tCO₂ 每 0.001 强度） |
| 目录 | 5 条：摘要 · 差异概览 / 一、差异总览 / 二、差异因素分解 / 三、差异归因与影响 / 四、改进措施 |
| 表格总数 | **3 张** |

### C2 全零入参（`emission` 四组数组全为 0）

| 位置 | 期望结果 |
| --- | --- |
| 卡 1 本月碳排放量 | `0.00` 万tCO₂ |
| 卡 2 / 卡 3 环比、同比差异 | `0.00` / `0.00` 万tCO₂，差异率 `--` |
| 卡 4 / 卡 5 主要动因 | `--`，占比 `--` |
| 卡 6 本期排放强度 | `0.0000` tCO₂/t |
| 总览表 | 本企业与基准值均为 `0.00` / `0.0000`；差异率列 `--`；差异性质列「不适用」 |
| 分解表 | **不输出**（强度为 0，无法派生产量）→ 改为整句说明「本期或上月单位产品碳排放强度为 0 或缺失，无法由「排放量 ÷ 强度」推算产品产量，环比因素分解不做。」；瀑布图位置为灰字占位 |
| 归因栏 | 左栏「本期或上月单位产品碳排放强度为 0 或缺失，无法完成环比归因。」；右栏「本期数据不足，暂不作短板评价。」 |
| 表格总数 | **1 张**（只剩总览表） |

> **判定标准：出现任何一个非 0 的排放量或强度数字，即为不合格。**

### C3 删掉整个 `emission` 字段

结果应与 **C2 完全一致**：正常渲染、不报错、不填数。

## 附录 D · 交付前自检清单

1. 用 C1 入参生成后，**逐项对照附录 C1**——6 张 KPI 卡、总览表 4 行、两张分解表、瀑布图、结论段都吻合。
2. 全文搜 `NaN`、`undefined`、`Infinity`、`∞`，**必须 0 命中**；也**不得出现「-0.0」**。
3. 全文搜 `示例`、`演示`、`模拟`、`占位`、`待补充`——**必须 0 命中**。
4. 目录 5 条锚点与正文标题一一对应，点击可定位。
5. **【恒等式必测】逐张分解表核对：三项之和 === 合计差异 === 总览表对应的排放量差异**（本项目 `month = 9` 时环比 −1.14、同比 −0.89，必须逐字符相等，不允许 0.01 的差）。
6. **【占比必测】每张分解表的三项占比之和 === `100.0%`**（交互项取残差保证）；差异恰为 0 时三项占比与合计占比必须都是 `--`。
7. 产品产量的四处（入参派生、总览表行 3、分解表说明列、敏感性的 `Q₀`）**口径一致**，且等于 `round4(排放量 ÷ 强度)`。
8. 强度显示**恒为 4 位小数**（不得出现 `0.77`、`0.765` 这类位数不足的输出）。
9. 瀑布图**因素柱的数值标签保留 2 位小数**，且**纵轴不包含 0、基准/本期柱自轴底起绘**。
10. 同一入参渲染两次，结果**逐字符一致**。
11. **【零兜底必测】用 C2（全零入参）跑一遍**，逐项对照附录 C2。
12. **【必测】把 `emission` 整个字段删掉再跑一遍**，结果应与 C2 一致。
13. **【必测】用 `month = 1` 跑一遍**：环比相关全部 `--`、「上月」标签为「无上月基数」、**不出现「2025年0月」**、环比分解表与瀑布图不输出且给整句说明、同比分解照常。
14. 页面只交付**一个** HTML 文件，库走 CDN；全篇无 emoji、无图表库、无外部图片。
