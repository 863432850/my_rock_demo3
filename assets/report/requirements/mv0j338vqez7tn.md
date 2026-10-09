# 碳交易差异分析 — 界面复刻提示词

> **数据口径（先读这条）**
>
> 1. **本报告的碳交易数据只能来自入参 `trade`，一律不兜底。** 入参给 `0` 就显示 `0`，字段或数组缺位同样按 `0` 处理；「全零入参生成全零页面」是**正确输出**。
> 2. **企业侧只采集"成交量 + 成交均价"两项。** 分解模型 `A = V × P` 里的**成交金额 A 由「成交量 × 成交均价」派生**（万t × 元/t = 万元），不是独立台账数据。
> 3. **期末持仓、逐笔成交明细、各交易所行情在实际业务中拿不到**，入参不设对应字段，正文也不得出现「持仓量」「持仓市值」「成交明细」「上海环境能源交易所」这类内容。
> 4. **对比口径**：环比基准 = 上月（`month = 1` 时**不存在**，环比整套降级为"不适用"）；同比基准 = 上年同期。
> 5. **交互项取残差**：`交互项 = 合计差异 − 量差效应 − 价差效应`。这样「三项之和 ≡ 合计差异 ≡ 总览表的成交金额差异」恒成立，**不会出现 0.01 级的对不上**。这是本报告与"教科书公式"的唯一有意差异，必须在文档中说明。
> 6. **着色是"收益视角"**：成交金额与成交量**增加 = 有利 = 绿**、减少 = 不利 = 红；**成交均价按名目方向**（涨红跌绿）。**不要照搬「碳排放差异分析」那种「正红负绿」的排放视角。**
> 7. 全篇禁止出现 `NaN`、`undefined`、`Infinity`、`∞`；也禁止出现「示例」「演示」「模拟」「占位」「待补充」等字样。
>
> 本文档描述「碳交易差异分析」（在「碳月报及差异分析」列表页选择碳交易页签 → 点击某个月份卡片的「差异分析」按钮后进入的全屏 A4 报告页）的完整界面规格。按「一、入参」给定 JSON 输入，严格按「二、任务」的规格生成与原型一模一样的界面。  
> 本文档是自包含的：不需要访问任何原项目源码。  
> 使用方法：把入参 JSON 改成目标值，连同本文档全文发给 AI 即可。
>
> 本页与「碳排放差异分析」共用同一套页面外壳与同一套差异分析版式（三张 A4 纸面 / 水位对比条 / 双向差异条 / 瀑布图 / 有利·不利双栏），**只有指标口径与数据不同**：本页把**成交金额**差异拆成「量差效应 + 价差效应 + 交互项」（金额 = 成交量 × 成交均价），并采用**收益视角**着色（金额增加 = 有利 = 绿）。

## 一、入参

```json
{
  "companyName": "河南安钢周口钢铁有限责任公司",
  "year": 2026,
  "month": 9,
  "trade": {
    "volume": {
      "cur":  [4.62, 3.85, 5.94, 4.78, 6.73, 5.31, 4.47, 6.12, 5.03, 7.24, 5.58, 4.41],
      "prev": [4.90, 4.08, 6.30, 5.07, 7.13, 5.63, 4.74, 6.49, 5.33, 7.67, 5.91, 4.67]
    },
    "price": {
      "cur":  [86.5, 88.2, 85.7, 89.4, 91.2, 88.6, 90.3, 92.1, 90.8, 93.5, 91.7, 94.2],
      "prev": [83.04, 84.67, 82.27, 85.82, 87.55, 85.06, 86.69, 88.42, 87.17, 89.76, 88.03, 90.43]
    }
  }
}
```

### 入参字段说明

| 字段                  | 类型         | 必填    | 说明                                                             |
| ------------------- | ---------- | ----- | -------------------------------------------------------------- |
| `companyName`       | string     | 是     | 企业名称；用于封面 H1 第一行、工具条标题、浏览器标签页标题                                |
| `year`              | number     | 是     | 年份（4 位）；只影响文案年号与文件名，**不参与取数**                                  |
| `month`             | number     | 是     | 月份 1–12；决定取哪个月（下标 `month − 1`）、环比/同比基准。**< 1 或 > 12 一律按 9 处理** |
| `trade`             | object     | **是** | **本企业碳交易数据块**（L1，零兜底）。整个对象缺失时按全 0 处理                           |
| `trade.volume`      | object     | 否     | 月度成交量（万tCO₂，2 位小数）。缺省按全 0                                      |
| `trade.volume.cur`  | number[12] | 否     | **当年 1–12 月的当月成交量**。**必须写满 12 个元素**                            |
| `trade.volume.prev` | number[12] | 否     | **上年同期 1–12 月的当月成交量**，是**同比基准**。**同样必须写满 12 个元素**              |
| `trade.price`       | object     | 否     | 月度成交均价（元/tCO₂，2 位小数）。缺省按全 0                                    |
| `trade.price.cur`   | number[12] | 否     | **当年 1–12 月的当月成交均价**。**必须写满 12 个元素**                           |
| `trade.price.prev`  | number[12] | 否     | **上年同期 1–12 月的当月成交均价**，同比基准                                    |

> **数据可得性说明**：本报告的企业侧数据与《碳交易月度报表》完全一致——只有**月度成交量**与**月度成交均价**两项。
>
> - **成交金额不在入参里**，而是分解模型的**派生量**：`A = round2(成交量 × 成交均价)`。不要要求使用者另填金额，也不要用金额反推量或价。
> - **期末持仓（配额 / CCER）拿不到**，正文不出现持仓量、持仓市值、持仓结构。
> - **逐笔成交明细拿不到**（需要交易流水台账），正文不出现逐笔明细表、交易方向、交易用途。
> - **各交易所行情拿不到**（属市场侧外部数据），正文不出现「上海环境能源交易所」「北京绿色交易所」等，也不做行情表。
> - **环比基准就是 `volume.cur` / `price.cur` 的相邻元素**（上月），**不是**额外字段；`month = 1` 时没有上月基数。
> - 逐日成交同样不在口径内，本报告最小粒度就是**月**。

### 数组填写规则

1. `volume.cur` / `volume.prev` / `price.cur` / `price.prev` **四个数组都必须写满 12 个元素**（下标 0 → 1 月，下标 11 → 12 月）。
2. **即使某月为 0 也要写 `0` 占位**——数组长度是"哪几月有数据、哪几月没有"的唯一依据；**严禁**用最后一个已有值向后外推，也**严禁**整体缩写成 3 个月、6 个月。
3. 数组长度**不足 12** 时，缺失位按 `0` 处理；长度**超过 12** 时只取前 12 个。
4. `volume.*` 用**万tCO₂**、保留 2 位小数；`price.*` 用**元/tCO₂**、保留 2 位小数。单位不要自行换算。
5. 元素必须是**数字**（不要写字符串、不要带千分位逗号、不要带单位文字）。
6. `price.*` 是**乘数**（不是分母）：某期为 `0` 时该期成交金额按 `0.00` 显示（`0 × 0 = 0`），**不存在除零**；但该期的**价格环比/同比写 `--`**（分母为 0）。
7. 上报口径：`cur` = 当年逐月、`prev` = **上年同期**逐月（不是"上月"）。

**全零入参示例**（"本期无数据"的正确输入形态；此时的正确输出见「附录 C · C2」）

```json
{
  "companyName": "河南安钢周口钢铁有限责任公司",
  "year": 2026,
  "month": 9,
  "trade": {
    "volume": { "cur": [0,0,0,0,0,0,0,0,0,0,0,0], "prev": [0,0,0,0,0,0,0,0,0,0,0,0] },
    "price":  { "cur": [0,0,0,0,0,0,0,0,0,0,0,0], "prev": [0,0,0,0,0,0,0,0,0,0,0,0] }
  }
}
```

### 入参带入规则

| JSON 字段             | 影响位置                            | 规则                                                                                                                           |
| ------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| companyName         | 封面 H1 第一行 / 工具条标题 / 浏览器标签页标题    | 封面拼接为「{companyName}（换行）碳交易差异分析报告」；工具条标题为「{companyName}碳交易差异分析报告（{year}年{month}月）」；`document.title` = 「碳交易差异分析报告-{year}-{MM}」 |
| year                | 封面年月、封面「数据期间」、下载文件名             | 四位年份。**不参与取数**                                                                                                               |
| month               | 封面年月、数据期间、取数下标、对比口径（上月 / 上年同期）  | 取值 1–12；**< 1 或 > 12 一律按 9 处理**；`month` 决定取第 `month − 1` 个数组元素（0 基）；**`month = 1` 时环比整套降级**                                  |
| `trade.volume.cur`  | 摘要「本月成交量」卡、总览表「成交量」行、分解表的量差效应   | **L1 入参直取，零兜底**。`cur[month − 1]` = 本期值；**上月值 = `cur[month − 2]`（`month = 1` 时不存在）**                                          |
| `trade.volume.prev` | 同比差异、总览表同比相关、同比分解表              | **L1 入参直取，零兜底**。`prev[month − 1]` = 上年同期值                                                                                    |
| `trade.price.cur`   | 摘要「本月成交均价」卡、总览表「成交均价」行、分解表的价差效应 | **L1 入参直取，零兜底**；同时作为**乘数**参与「成交金额 = 成交量 × 成交均价」                                                                              |
| `trade.price.prev`  | 总览表「上年同期」均价列、同比分解表              | **L1 入参直取，零兜底**                                                                                                              |

> **绝对不要用到的其他数据**：期末持仓台账（配额 / CCER）、逐笔成交明细、各交易所行情、碳排放量 / 强度 / 产品产量。本报告一律不出现。  
> **注意**：《碳交易月度报表》与本页**共用同一套入参结构**，同一数字在两页应当一致；但**口径不要互相套用**——月报出"水平值 + 环比/同比"，本页出"差异 + 因素分解"。

### 运行期入参来源（URL 查询参数）

```
?month=2026-09&company=河南安钢周口钢铁有限责任公司&tvCur=…&tvPrev=…&tpCur=…&tpPrev=…
```

- `month` 形如 `YYYY-MM`，拆分为 `year` 与 `month`；不传时用 JSON 示例值 `2026-09`。
- `company` 覆盖 `companyName`。
- 四个数据数组用**逗号分隔的 12 个数**透传：`tvCur` = `trade.volume.cur`、`tvPrev` = `trade.volume.prev`、`tpCur` = `trade.price.cur`、`tpPrev` = `trade.price.prev`。**参数不传**用示例值；**参数传空**（如 `tvCur=`）视为 12 个 0。
- 上游若附带 `?tab=trade` 之类的页签参数，**忽略即可**——本页只渲染「碳交易差异分析」（见 2.9 负面清单）。

## 二、任务

### 2.1 交付物

- **最终只交付一个文件：`碳交易差异分析.html`**。这是硬性要求——除这一个 HTML 文件外，不得再产出任何其他文件（包括但不限于：html2canvas.min.js、jspdf.umd.min.js 等库文件、单独的 CSS/JS 文件、说明文档、测试文件）。
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
│ ← 返回碳月报及差异分析 │ {企业名}碳交易差异分析报告（2026年9月） │ [下载报告（PDF）] │
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
- 页面外壳与「碳排放差异分析」**逐字相同**（含 `.wbars` / `.lvl-bars` / `.vs-cols` 三类差异分析专用样式）。**必须原样使用**：

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
/* 碳交易 · 收益视角：正 = 增收 = 绿，负 = 减收 = 红（覆盖默认，使文字与条色一致） */
.wbar-row.is-pos .wbar-val { color: #2ba471; font-weight: 600; }
.wbar-row.is-neg .wbar-val { color: #d4380d; font-weight: 600; }

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

| 用途                          | 色值                                          |
| --------------------------- | ------------------------------------------- |
| 主绿（封面强调 / 章节竖条 / 按钮 / 序号圆点）   | `#00b42a`                                   |
| 页面底                         | `#e9edf3`                                   |
| 纸面 / 工具条底                   | `#ffffff`                                   |
| 章节标题渐变起 / 表头底 / 卡片渐变起       | `#e9f7ee`                                   |
| 卡片渐变底                       | `#f4fbf6 → #ffffff`                         |
| 正文                          | `#222` / `#333` / `#444` / `#1a1a1a`        |
| 弱文字                         | `#8a9199`、`#98a1ab`、`#6b7280`                  |
| 语义色 · 绿（`is-neg`，**增收 = 有利**） | `#2ba471`                                   |
| 语义色 · 红（`is-pos`，**减收 = 不利**） | `#d4380d`                                   |
| 中性说明行（`is-flat`）            | `#98a1ab`                                   |
| 本月高亮（橙）                     | 水位条 `#ff7d00`、文字 `#b25f00`、卡片底 `#fff7e8`、卡片边框 `#ffd591` |
| 上月（绿）                       | `#00b42a`                                   |
| 上年同期（蓝）                     | `#165dff`                                   |
| 瀑布图 · 基准柱                   | `#86909c`                                   |
| 瀑布图 · 本期柱                   | `#ff7d00`                                   |
| 瀑布图 · 因素柱（正 = 绿 / 负 = 红）     | `#2ba471` / `#f53f3f`                        |
| 有利栏                         | 底 `#f4fbf6`、边 `#d8efe0`、标题 `#1f7a3a`       |
| 不利栏                         | 底 `#fff8f6`、边 `#f6ddd6`、标题 `#c53d1d`       |
| 网格线 / 轴 / 连接虚线              | `#eef1f4` / `#dcdfe6` / `#c9d1d9`            |
| 表格边框 / 图框边框                 | `#e3e7ec` / `#e8ebef`                       |
| 卡片边框                        | `#e5eee8`                                   |

**字体**：`-apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif`。
封面 H1 34px/700/字距 2px/行高 1.5；封面年月 20px/600/字距 4px 绿色；封面 kicker 13px/字距 6px 绿色圆角胶囊。
章节 H1 21px（左侧 5px 绿竖条 + `#e9f7ee` 向右渐隐背景，padding `8px 0 8px 14px`）；H2（`（一）…`/`（二）…`）16.5px（前置 8×8px 绿色小方块）；正文 13.5px；要点列表 12.5px/行高 1.9；表格 12.5px；双栏列表 12.5px；建议条目 13px；图题 12.5px 灰。

**图标**：仅工具条「下载报告（PDF）」按钮带一个 14px 线性 SVG 下载图标。正文无图标、**无 emoji**。

**着色语义（碳交易差异分析 · 关键，与碳排放差异分析相反）**：本页是**收益视角**，**正差异 = 增收 = 有利 = 绿**，**负差异 = 减收 = 不利 = 红**。实现口径（`deltaCls(n)` = `n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : '')`）：

| 位置                    | 着色口径        | 实现（传参）                                                |
| --------------------- | ----------- | ----------------------------------------------------- |
| KPI 卡「环比/同比差异」        | 金额增绿、减红     | `deltaCls(-mom.d)` / `deltaCls(-yoy.d)`                |
| 总览表「成交金额」差异列          | 金额增绿、减红     | `deltaCls(-mom.d)` / `deltaCls(-yoy.d)`                |
| 总览表「成交量」差异列           | 放量绿、缩量红     | `deltaCls(-(v1 − v0m))`                                |
| 总览表「成交均价」差异列          | 价涨红、价跌绿（采购成本口径） | `deltaCls(p1 − p0m)`                                   |
| 分解表「影响金额」「方向」「合计」列    | 增收绿、减收红     | `deltaCls(-xEff)` / `deltaCls(-yEff)` / `deltaCls(-cross)` / `deltaCls(-d)` |
| 双向差异条 `.wbar-fill` 与数值 | 正绿负红        | `positiveIsGood = true`（正 `#2ba471`、负 `#f53f3f`），并覆盖 `.wbar-val` 文字色 |
| 瀑布图因素柱                | 正绿负红        | `positiveIsGood = true`                                |

> **一致性说明**：原型 `.wbar-val` 的文字色固定为「正红负绿」，与本页「收益视角」的条色（正绿负红）相反；本规格在 2.2 的 CSS 中**显式覆盖**这两条规则，使双向差异条的**文字与条色方向一致**。除此之外一切照原型。


### 2.4 区块逐一规格

**(1) 工具条**（sticky 顶置，白底，下边线 `#e4e8ee`，打印/下载 PDF 时隐藏）

- 左：链接「← 返回碳月报及差异分析」（13px，绿 `#00b42a`，href 指向 `monthly.html`）。
- 中：标题 14px/600 `#333`：`{companyName}碳交易差异分析报告（{year}年{month}月）`。
- 右：绿色实心按钮「下载报告（PDF）」（高 30px、圆角 4px、底 `#00b42a`、白字 13px、前置 14px 下载 SVG）。

**(2) 封面**（第一张纸面，居中排版，`padding: 130px 0 90px`）

1. 胶囊 kicker：文字「碳 交 易 差 异 分 析」（13px、字距 6px、绿色、1px 绿边、圆角 20px、padding `4px 18px 4px 24px`）。
2. H1 两行：第一行 `{companyName}`，第二行 `碳交易差异分析报告`。
3. 封面年月：`{year}年{month}月`（20px 绿色、字距 4px、600）。
4. 页签胶囊：文字「碳交易 · 差异分析」（14px，字 `#1f7a3a`、底 `#e9f7ee`、边 `#c8e8d2`、圆角 16px、padding `4px 18px`）。
5. 装饰线：120×3px 绿色圆角横线，上间距 40px。
6. 底部（`margin-top: 110px`，13px `#8a9199`）：仅一行「数据期间：{year}-{MM}-01 至 {year}-{MM}-{月末日}」。**无编制单位、无编制日期、无落款**。

**(3) 目录**（第二张纸面；`.brief-toc` 不得带任何 `width`/`margin`/`padding`）

- 标题「目　录」（20px、字距 2px），**5 个** `.toc-l1` 条目：

| 序号 | 目录文字        | 锚点       |
| -- | ----------- | -------- |
| 1  | 摘要 · 差异概览   | `#sec-0` |
| 2  | 一、差异总览      | `#sec-1` |
| 3  | 二、差异因素分解    | `#sec-2` |
| 4  | 三、差异归因与影响   | `#sec-3` |
| 5  | 四、改进措施      | `#sec-4` |

**(4) 摘要 · 差异概览**（`<h1 class="brief-h1" id="sec-0">摘要 · 差异概览</h1>`）

1. **KPI 卡片区**：`.kpi-grid`，grid **3 列**、间距 10px，共 **6 张卡**；第 1 张卡加 `.is-self`。6 张卡依次为：

| # | 名称      | 数值（`<small>` 单位）                     | 说明行（模板）                                         | 说明行 class            |
| - | ------- | ---------------------------------- | ----------------------------------------------- | ------------------- |
| 1 | 本月成交金额  | `{a1}` 万元（2 位小数）                   | `{MONTH_CN}`                                    | `is-flat`；卡加 `.is-self` |
| 2 | 环比差异    | `{signed(mom.d,2)}` 万元              | `较{PREV_LABEL} {signed(环比差异率, 2, '%')}`         | `deltaCls(-mom.d)`  |
| 3 | 同比差异    | `{signed(yoy.d,2)}` 万元              | `较{YOY_CN} {signed(同比差异率, 2, '%')}`             | `deltaCls(-yoy.d)`  |
| 4 | 环比主要动因  | `{量差｜价差｜--}`                         | `占差异 {fmt(各自占比,1)}%`（不可分解时写 `--`）              | `is-flat`           |
| 5 | 本月成交量   | `{v1}` 万tCO₂（2 位小数）                | `环比 {signed(成交量环比, 2, '%')}`                    | `is-flat`           |
| 6 | 本月成交均价  | `{p1}` 元/tCO₂（2 位小数）               | `环比 {signed(均价环比, 2, '%')}`                     | `is-flat`           |

   > 第 4 张卡：比较 `|xEff|` 与 `|yEff|`，前者大 → 文字「量差」、占比取 `xShare`；否则 → 「价差」、占比取 `yShare`。
   > **`month = 1` 时**（没有上月基数）：第 2 张卡说明行改 `年度首月，无上月基数`；第 4 张卡数值写 `--`、占比 `--`；第 5、6 张卡的环比小字写 `环比不适用`。**不要把 `--` 塞进「占差异 --%」以外的句式**。

2. **要点列表** `.point-list`（4 条；加粗文字在正文里是绿色 `#00b42a`）：
   1. 本月成交金额 `<strong>{a1}</strong>` 万元，较上月（`{PREV_LABEL}`）{增加|减少} `{abs(mom.d)}` 万元，`{signed(环比差异率, 2, '%')}`。
   2. 金额差异分解：量差效应 `{signed(mom.xEff,2)}`、价差效应 `{signed(mom.yEff,2)}`、交互项 `{signed(mom.cross,2)}` 万元，**三项之和恒等于合计差异 `{signed(mom.d,2)}` 万元**。
   3. 同比看，本月较上年同期（`{YOY_CN}`）{增加|减少} `{abs(yoy.d)}` 万元（`{signed(同比差异率, 2, '%')}`），主要动因为{成交量变化|成交均价变化}。
   4. 本月成交量 `{v1}` 万tCO₂、成交均价 `{p1}` 元/tCO₂，成交金额由「成交量 × 成交均价」推算。
   > 「增加/减少」按 `d ≥ 0` 选择；第 3 条动因按 `|yoy.xEff| ≥ |yoy.yEff|` 选择。
   > **不可计算时**（`month = 1`）：对应片段整句替换为「本月为年度首月，无上月基数，环比差异不适用」，**不要输出「减少 -- 万元」**。

**(5) 一、差异总览**（`id="sec-1"`）

1. 引导段 `.brief-p`：
   「本报告以「本月（`{MONTH_CN}`）」碳交易情况为分析对象，分别与「上月（`{PREV_LABEL}`）」和「上年同期（`{YOY_CN}`）」对比，以`<strong>成交金额</strong>`为核心指标，量化差异并分解到成交量与成交均价两个因素。」
   > `month = 1` 时改写为：……与「上年同期（{YOY_CN}）」对比（**本月为年度首月，无上月基数**），……
2. **碳交易差异总览表**：表题「碳交易差异总览表」+ 右单位「成交量：万tCO₂；均价：元/tCO₂；金额：万元」。6 列 4 行：

| 列   | 对比口径                 | 基准值            | 本期值                    | 差异                                                     | 差异率                                                    | 差异性质      |
| --- | -------------------- | -------------- | ---------------------- | ------------------------------------------------------ | ------------------------------------------------------ | --------- |
| 行 1 | 成交金额（环比 · 较{PREV_LABEL}） | `{a0m}`        | `{a1}`（`.is-self`）      | `{signed(a1 − a0m, 2)}` class=`deltaCls(-(a1 − a0m))`      | `{signed(环比差异率, 2, '%')}` class=`deltaCls(-(a1 − a0m))`      | `增加`/`减少`/`不适用` |
| 行 2 | 成交金额（同比 · 较{YOY_CN}）  | `{a0y}`        | `{a1}`（`.is-self`）      | `{signed(a1 − a0y, 2)}` class=`deltaCls(-(a1 − a0y))`      | `{signed(同比差异率, 2, '%')}` class=`deltaCls(-(a1 − a0y))`      | `增加`/`减少`/`不适用` |
| 行 3 | 成交量（环比）              | `{v0m}`        | `{v1}`                 | `{signed(v1 − v0m, 2)}` class=`deltaCls(-(v1 − v0m))`      | `{signed((v1 − v0m) ÷ v0m × 100, 2, '%')}` class=`deltaCls(-(v1 − v0m))` | `放量`/`缩量`/`不适用` |
| 行 4 | 成交均价（环比）             | `{p0m}`        | `{p1}`                 | `{signed(p1 − p0m, 2)}` class=`deltaCls(p1 − p0m)`         | `{signed((p1 − p0m) ÷ p0m × 100, 2, '%')}` class=`deltaCls(p1 − p0m)` | `价涨`/`价跌`/`不适用` |

   表注（**逐字**）：「注：成交金额 = 成交量（万t）× 成交均价（元/t），属派生的量价联动口径，不是独立台账数据；金额差异的正负以「收益视角」着色——金额增加为绿色（有利），减少为红色（不利）；量、价差异仍按名目方向着色。**本月为年度首月，无上月基数，环比相关一律为 `--`。**（此句仅在 `month = 1` 时输出）」
   > 实现口径以 2.3「着色语义」表为准：金额列与成交量列用**收益视角**（`deltaCls(-差额)`），成交均价列用**价格方向**（`deltaCls(差额)`）。
3. **本月/上月/上年同期对比条**（`levelBars`，规格见 2.6 图 A），图题「（图）本月 / 上月 / 上年同期成交金额对比」。`month = 1` 时「上月」行的标签为「上月（无上月基数）」、数值 `--`、条宽 0。

**(6) 二、差异因素分解**（`id="sec-2"`，本页**最核心**的一节）

1. 模型说明段 `.brief-p`：
   「成交金额可拆解为两个因素的乘积：`<strong>成交金额 A = 成交量 V × 成交均价 P</strong>`。金额差异按「两因素乘法模型」分解为三部分：」
2. 要点列表 3 条：
   1. `<strong>量差效应</strong>`＝（V₁ − V₀）× P₀：仅由成交量变化引起的金额变化。
   2. `<strong>价差效应</strong>`＝（P₁ − P₀）× V₀：仅由成交均价变化引起的金额变化（反映市场行情与择时能力）。
   3. `<strong>交互项</strong>`＝**合计差异 − 量差效应 − 价差效应**：把（V₁ − V₀）×（P₁ − P₀）的交叉影响与展示值的舍入残差一并归入交互项。
3. 收尾段：「由此**三项之和恒等于合计差异**（ΔA = 量差效应 + 价差效应 + 交互项），并与「差异总览表」的成交金额差异完全一致——不会出现 0.01 级的对不上。」
   > **这是本报告与"教科书公式"的唯一有意差异**：教科书写 `交互项 = (V₁−V₀)×(P₁−P₀)`，但那样三项之和会与展示口径的 `ΔA` 差 0.01；因此改为**残差口径**。文档必须写清。
4. **环比差异因素分解表**：表题「环比差异因素分解表（{PREV_LABEL} → {MONTH_CN}）」+ 右单位「单位：万元」。5 列 3 行 + `<tfoot>` 合计行：

| 列       | 差异来源 | 影响金额                            | 占差异比重                 | 方向                                | 说明                            |
| ------- | ---- | ------------------------------- | --------------------- | --------------------------------- | ----------------------------- |
| 行 1     | 量差效应 | `{signed(mom.xEff,2)}` class=`deltaCls(-mom.xEff)` | `{fmt(mom.xShare,1)}%` | `增收`/`减收`/`持平` class=`deltaCls(-mom.xEff)` | 成交量 `{v0m}` → `{v1}` 万tCO₂     |
| 行 2     | 价差效应 | `{signed(mom.yEff,2)}` class=`deltaCls(-mom.yEff)` | `{fmt(mom.yShare,1)}%` | `增收`/`减收`/`持平` class=`deltaCls(-mom.yEff)` | 成交均价 `{p0m}` → `{p1}` 元/tCO₂   |
| 行 3     | 交互项  | `{signed(mom.cross,2)}` class=`deltaCls(-mom.cross)` | `{fmt(mom.crossShare,1)}%` | `增收`/`减收`/`持平` class=`deltaCls(-mom.cross)` | 量与价同时变化（含舍入残差）                |
| 合计行（`<tfoot>`） | 合计差异 | `{signed(mom.d,2)}` class=`deltaCls(-mom.d)` | `100.0%`              | `增收`/`减收`/`持平` class=`deltaCls(-mom.d)` | 等于三项之和（校验通过）                  |

   - **方向词**：值 `< 0` → `减收`、`> 0` → `增收`、`= 0` → `持平`。
   - **占差异比重**：各因素影响绝对值 ÷ 三者绝对值之和；**三者之和恰为 0（差异为 0）时，三项占比与合计占比一律写 `--`**，不要写 `0.0%` / `100.0%`。
   - **交互项占比取残差**（`100 − 量差占比 − 价差占比`），保证表内三项占比之和恒为 `100.0%`。
   表注：「注：占差异比重按各因素影响绝对值 ÷ 三者绝对值之和计算；差异恰好为 0 时占比写 `--`。三项之和 = `{fmt(mom.xEff,2)}` + `{fmt(mom.yEff,2)}` + `{fmt(mom.cross,2)}` = `{fmt(mom.d, 2)}` 万元。」
5. **环比成交金额差异瀑布图**（`waterfall`，纯 SVG，规格见 2.6 图 B），输入 `waterfall(mom.z0, [量差效应, 价差效应, 交互项], mom.z1, '万元', true)`；图题「（图）环比成交金额差异瀑布图（{PREV_LABEL} → {MONTH_CN}）」。
   > 瀑布图内**效应柱的数值标签保留 2 位小数**（1 位会把 `-0.02` 显示成「-0.0」）；`-0` 归一化为 `0`。
6. **H2「（一）同比差异分解」**：
   - 表题「同比差异因素分解表（{YOY_CN} → {MONTH_CN}）」+ 右单位「单位：万元」；
   - 5 列 3 行 + `<tfoot>` 合计行，结构与环比分解表**完全一致**，只是把 `mom.*` 换成 `yoy.*`、`v0m→v0y`、`p0m→p0y`；说明列分别为「成交量 `{v0y}` → `{v1}` 万tCO₂」「成交均价 `{p0y}` → `{p1}` 元/tCO₂」「量与价同时变化（含舍入残差）」「等于三项之和（校验通过）」；
   - **同比分解表后不加表注**（只有环比表有 note）。
7. **同比差异因素贡献图**（`wbars`，规格见 2.6 图 C），输入 `wbars([量差效应, 价差效应, 交互项], '万元', 2, true)`；图题「（图）同比差异因素贡献（{YOY_CN} → {MONTH_CN}）」。
8. **降级（不可分解）时的整段替换**：
   - `month = 1`（无上月基数）→ 环比分解表、环比瀑布图**都不输出**，改为一段说明：「本月为年度首月，无上月基数，环比差异不做因素分解。」，瀑布图位置输出灰字占位「年度首月，无上月基数」。
   - 本期或上月量/价缺失 → 说明改为「本期或上月成交量／成交均价数据不足，无法完成环比因素分解。」，瀑布图位置输出灰字占位「本期数据不足，无法绘制瀑布图」。
   - 上年同期量/价缺失 → 同比分解（表 + 条形图）同样降级。
   - **「（二）分解结论」**：对应段落整句替换（如「本月为年度首月，无上月基数，不做环比分解结论。」），**不要把 `--` 塞进原句式**。
9. **H2「（二）分解结论」**，两段成文：
   - 段 1：「环比看，本月成交金额{增加|减少} `{abs(mom.d)}` 万元，其中量差效应 `{signed(mom.xEff,2)}` 万元（占 `{fmt(mom.xShare,1)}%`）、价差效应 `{signed(mom.yEff,2)}` 万元（占 `{fmt(mom.yShare,1)}%`）。」+ 二选一句：
     - `|mom.xEff| ≥ |mom.yEff|` → 「成交量的变化是金额差异的**主导因素**，交易规模扩张/收缩驱动金额变动。」
     - 否则 → 「成交均价的变化是金额差异的**主导因素**，市场行情与择时能力对金额影响更显著。」
   - 段 2：「同比看，本月较上年同期{增加|减少} `{abs(yoy.d)}` 万元，量差效应 `{signed(yoy.xEff,2)}` 万元、价差效应 `{signed(yoy.yEff,2)}` 万元。」+ 二选一句 + 二选一句：
     - `yoy.yEff > 0` → 「价差效应为正，说明本月成交均价高于上年同期，价格上行带来正向贡献；」否则 → 「价差效应为负，说明本月成交均价低于上年同期，价格下行对金额形成拖累；」
     - `yoy.xEff > 0` → 「同时成交量同比增长，量价共同推动金额上升。」否则 → 「同时成交量同比下降，量的收缩抵消了部分价格影响。」

**(7) 三、差异归因与影响**（`id="sec-3"`）

1. **左右双栏 `.vs-cols`**（左栏 `.vs-col.is-good` 标题「有利差异（增收方向）」，右栏 `.vs-col.is-bad` 标题「不利差异（减收方向）」）。**每条按条件判断，满足才列**：
   - 左栏（`goodItems`）按顺序判断：
     1. `mom.yEff > 0` → 「环比价差效应 +`{fmt(mom.yEff,2)}` 万元，本月成交均价高于上月，择时交易取得价格优势。」
     2. `mom.d > 0` → 「本月成交金额环比增加 `{fmt(mom.d,2)}` 万元（`{fmt(mom.d ÷ mom.z0 × 100,2)}%`），交易规模稳步扩大。」
     3. `yoy.yEff > 0` → 「同比价差效应 +`{fmt(yoy.yEff,2)}` 万元，成交均价高于上年同期，价格中枢上移。」
     4. `v1 > v0m` → 「本月成交量 `{fmt(v1,2)}` 万tCO₂，较上月增加 `{fmt(v1 − v0m,2)}` 万tCO₂，交易活跃度提升。」
     5. 若一条都未命中 → 「本期量价指标未呈现正向贡献，暂无突出优势项。」
   - 右栏（`badItems`）按顺序判断：
     1. `mom.yEff < 0` → 「环比价差效应 `{fmt(mom.yEff,2)}` 万元，本月成交均价低于上月，存在择时优化空间。」
     2. `mom.d < 0` → 「本月成交金额环比减少 `{fmt(abs(mom.d),2)}` 万元（`{fmt(abs(mom.d ÷ mom.z0 × 100),2)}%`），交易规模有所收缩。」
     3. `v1 < v0m` → 「本月成交量 `{fmt(v1,2)}` 万tCO₂，较上月减少 `{fmt(v0m − v1,2)}` 万tCO₂，放量不足。」
     4. `|mom.xEff| ≥ |mom.yEff|` → 「量差效应占差异比重 `{fmt(mom.xShare,1)}%`，金额对成交量波动敏感，需稳定交易节奏。」
     5. 若一条都未命中 → 见下面的"兜底句两态"。
   > 注意 `+` 号是**写死在文案里**的前缀（因为这两句只在值为正时出现）。
   > **兜底句两态**（必须区分，否则会在"没算出"时给出"算得很好"的结论）：
   > - **至少有一侧可分解**（`month > 1`）→ 左栏「本期量价指标未呈现正向贡献，暂无突出优势项。」、右栏「各项量价指标方向均较优，暂无显著短板，需防范价格回调风险。」
   > - **两侧都不可分解**（`month = 1` 或量价数据不足）→ 左栏「本月为年度首月，无上月基数，暂不作环比归因。」（数据不足时改为「本期或上月成交量／成交均价数据不足，无法完成环比归因。」）；右栏「本期数据不足，暂不作短板评价。」
2. **敏感性说明段** `.brief-p`：
   「敏感性说明：成交金额对成交量与均价的敏感度分别为 `<strong>P₀ = {fmt(p0m,2)}</strong>` 元/tCO₂（成交量每变动 1 万t，金额变动 `{fmt(p0m,2)}` 万元）和 `<strong>V₀ = {fmt(v0m,2)}</strong>` 万tCO₂（均价每变动 1 元/t，金额变动 `{fmt(v0m,2)}` 万元）。因此，在成交量相对稳定的情况下，`<strong>把握价格窗口、提升择时能力是增厚交易金额的关键</strong>`。」
   > `month = 1`（或上月量/价缺失）时，前半句整句替换为「本月无上月基数（或上月均价无效），无法给出环比敏感度；」，后半句照常保留。

**(8) 四、改进措施**（`id="sec-4"`，`<ol class="advice-list">`，4 条，文案**逐字**如下，变量代入数值）

1. `<strong>强化择时交易：</strong>`本月成交均价 `{fmt(p1,2)}` 元/tCO₂，环比 `{signed((p1 − p0m) ÷ p0m × 100, 2, '%')}`（不可计算时写「环比不适用」），建议建立碳价监测与分批建仓机制，在价格低位增配、高位择机变现盈余配额。**（当 `mom.yEff < 0` 时追加一句）**「本月价差效应为减收方向，须重点提升择时能力。」
2. `<strong>稳定交易节奏：</strong>`{量差效应占环比差异 `{fmt(mom.xShare,1)}%`，}建议按履约进度制定分月交易计划，避免量能大起大落导致金额波动。**（`mom.xShare` 为 `--` 时去掉前面的从句，直接说「建议……」——不要把 `--` 塞进数字位）**
3. `<strong>优化量价组合：</strong>`结合全国及各试点市场价差，优先在低价市场完成采购、在高价市场择机卖出，提升整体量价组合收益。
4. `<strong>建立差异跟踪机制：</strong>`按月开展「量—价」双因素差异分解，对价差效应连续为负的月份及时复盘交易策略，形成「月度分解—策略调整—效果回评」的闭环。


### 2.5 数据规则（唯一数据源）

全部数值由入参 + 以下公式推出。**无随机数、无种子**——同一入参必得完全一致的结果。
（下文 `fmt(n,d)` = 千分位 + 固定 d 位小数；`signed(n,d,unit)` = 正数前置 `+`；`round2` = 四舍五入到 2 位小数。）

**(1) 入参数组**（L1 直取，零兜底）：

```javascript
// 读 12 元素数组：参数缺失 → 用示例值；参数存在但为空 → 12 个 0；元素非数字 → 0；
// 长度不足按 0 补、超长截断；严禁用最后一个已有值向后外推
var VOL_CUR  = readSeries('tvCur',  [4.62, 3.85, 5.94, 4.78, 6.73, 5.31, 4.47, 6.12, 5.03, 7.24, 5.58, 4.41]);  // trade.volume.cur   万tCO₂
var VOL_PREV = readSeries('tvPrev', [4.90, 4.08, 6.30, 5.07, 7.13, 5.63, 4.74, 6.49, 5.33, 7.67, 5.91, 4.67]);  // trade.volume.prev  万tCO₂
var PRC_CUR  = readSeries('tpCur',  [86.5, 88.2, 85.7, 89.4, 91.2, 88.6, 90.3, 92.1, 90.8, 93.5, 91.7, 94.2]);  // trade.price.cur    元/tCO₂
var PRC_PREV = readSeries('tpPrev', [83.04, 84.67, 82.27, 85.82, 87.55, 85.06, 86.69, 88.42, 87.17, 89.76, 88.03, 90.43]); // trade.price.prev 元/tCO₂
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

**(3) 本期 / 基准取值与「成交金额」派生**：

```javascript
var v1  = round2(VOL_CUR[M - 1]);                      // 本月成交量
var v0m = HAS_PREV ? round2(VOL_CUR[PM - 1]) : null;   // 上月成交量（M = 1 → --）
var v0y = round2(VOL_PREV[M - 1]);                     // 上年同期成交量

var p1  = round2(PRC_CUR[M - 1]);                      // 本月成交均价
var p0m = HAS_PREV ? round2(PRC_CUR[PM - 1]) : null;   // 上月成交均价
var p0y = round2(PRC_PREV[M - 1]);                     // 上年同期成交均价

// 成交金额 = 成交量 × 成交均价（唯一算法；万t × 元/t = 万元）
var a1  = round2(v1 * p1);
var a0m = (v0m == null || p0m == null) ? null : round2(v0m * p0m);
var a0y = round2(v0y * p0y);
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
> ⚠️ **不要用教科书的 `交互项 = (X1−X0)×(Y1−Y0)`**：那样三项之和会与展示口径的 `ΔZ` 差 0.01，表格里会出现「三项之和 ≠ 合计差异」。本报告有意改用残差口径。

**(5) 本期 / 基准值（碳交易口径）**：

```javascript
var mom = decompose(v0m, p0m, v1, p1, 2);   // 环比：上月 → 本月（金额 = 量 × 价，单位 万元）
var yoy = decompose(v0y, p0y, v1, p1, 2);   // 同比：上年同期 → 本月

var momDiff     = (a0m == null) ? null : round2(a1 - a0m);   // 环比差异（= mom.d）
var yoyDiff     = round2(a1 - a0y);                          // 同比差异（= yoy.d）
var momDiffPct  = (a0m == null || !(a0m > 0)) ? null : round2((a1 - a0m) / a0m * 100);
var yoyDiffPct  = (a0y > 0) ? round2((a1 - a0y) / a0y * 100) : null;
var volMomPct   = (v0m == null || !(v0m > 0)) ? null : round2((v1 - v0m) / v0m * 100);
var prMomPct    = (p0m == null || !(p0m > 0)) ? null : round2((p1 - p0m) / p0m * 100);

var momWord = (momDiff == null) ? null : (momDiff >= 0 ? '增加' : '减少');
var yoyWord = (yoyDiff >= 0) ? '增加' : '减少';
```

> 环比与同比都按 **2 位小数**（`dec = 2`）分解。`mom.d === momDiff`、`yoy.d === yoyDiff` 必须完全成立（见 2.5(8) 的自检）。
> **不可分解时**（`mom.valid === false`）：环比分解表与瀑布图**都不输出**，改为整句说明（见 2.4(6) 第 8 条）；同比同理。

**(6) 数值格式**：成交量、成交均价、成交金额一律 **2 位小数 + 千分位**；百分数 2 位小数（占比 1 位小数）。
单位统一：**万tCO₂ / 元/tCO₂ / 万元**。持仓、市值、百万元等本报表**不出现**。

**(7) 零值与缺值处理（除零保护，必须实现）**

`trade` 整体缺失、或其子数组全为 0，都属**合法输入**，报告须正常渲染，不得报错、不得留空、不得填数：

| 情形 | 正确输出 | 错误输出（禁止） |
| --- | --- | --- |
| `volume.cur` / `price.cur` 全为 0 | 成交金额 `0.00`、环比/同比差异 `0.00`、差异率 `--`；水位图三条 0 宽条；分解表三项均为 `0.00` 且**占比全 `--`** | 为了"报告好看"自动编一组正常数据 |
| `price.cur` 某月为 0 | 该月均价显示 `0.00`（数值序列零兜底），该月**成交金额 `0.00`**（`0 × 0 = 0`，**不存在除零**）；但该月均价环比/同比写 `--` | 把均价写成 `--`；或把金额算成 `Infinity` |
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
| 本期 `v1` / `p1` / `a1` | 5.03 万tCO₂ / 90.80 元/tCO₂ / **456.72 万元** |
| 环比基准 `v0m` / `p0m` / `a0m` | 6.12 万tCO₂ / 92.10 元/tCO₂ / 563.65 万元 |
| 同比基准 `v0y` / `p0y` / `a0y` | 5.33 万tCO₂ / 87.17 元/tCO₂ / 464.62 万元 |
| 环比 ΔA / 环比差异率 | **−106.93** 万元 / −18.97 % |
| 环比三项：量差效应 / 价差效应 / 交互项（合计） | **−100.39 / −7.96 / +1.42**（−106.93） |
| 环比占比：量差 / 价差 / 交互（%） | 91.5 / 7.3 / 1.2 |
| 同比 ΔA / 同比差异率 | **−7.90** 万元 / −1.70 % |
| 同比三项：量差效应 / 价差效应 / 交互项（合计） | **−26.15 / +19.35 / −1.10**（−7.90） |
| 同比占比：量差 / 价差 / 交互（%） | 56.1 / 41.5 / 2.4 |
| 环比 / 同比 主要动因 | 量差（91.5%） / 量差（56.1%） |
| 成交量环比 / 均价环比 | −17.81 % / −1.41 % |
| 敏感性 `P₀` / `V₀` | 92.10 元/tCO₂（→ 92.10 万元 每 1 万t） / 6.12 万tCO₂（→ 6.12 万元 每 1 元/t） |

**B. 入参 `month=1`（year=2026，无上月基数；上年同期 = 2025年1月）**

| 项目 | 值 |
| --- | --- |
| 本期 `v1` / `p1` / `a1` | 4.62 万tCO₂ / 86.50 元/tCO₂ / **399.63 万元** |
| 环比 | **整套降级**：`v0m`、`p0m`、`a0m`、环比差异与差异率、环比分解表、瀑布图**全部 `--` / 不输出**，上月标签「无上月基数」 |
| 同比基准 `v0y` / `p0y` / `a0y` | 4.90 万tCO₂ / 83.04 元/tCO₂ / 406.90 万元 |
| 同比 ΔA / 同比差异率 | **−7.27** 万元 / −1.79 % |
| 同比三项：量差效应 / 价差效应 / 交互项（合计） | **−23.25 / +16.95 / −0.97**（−7.27） |
| 同比占比：量差 / 价差 / 交互（%） | 56.5 / 41.2 / 2.3 |
| 归因栏 | 左栏首条「本月为年度首月，无上月基数，暂不作环比归因。」；右栏首条「本期数据不足，暂不作短板评价。」 |

### 2.6 图表规格

本报告共 **3 种图**：2 种纯 HTML/CSS（水位对比条、双向差异条）+ 1 种纯 SVG（瀑布图）。**均不使用图表库。**
统一容器 `.chart-box`（白底、1px 边框 `#e8ebef`、圆角 6px、padding `12px 14px 6px`）；图题 `.chart-caption`（居中 12.5px 灰，位于图框**下方**，上下间距 `4px 0 16px`）。

**图 A：本月/上月/上年同期成交金额对比条（`levelBars`）——最大值归一，本月高亮**

- 容器 `.lvl-bars`；每行 `.lvl-row`（flex、gap 10px、上下 margin 8px、12.5px）= 名称标签（宽 120px、右对齐）→ 轨道（`flex:1`、高 16px、底 `#f2f4f7`、圆角 3px、`overflow:hidden`）→ 数值（宽 150px、tabular-nums）。
- 条宽 = `max(1, value ÷ 行内最大值 × 100)%`；数值格式 = `fmt(value, 2) + ' 万元'`。
- 固定 3 行；本月行加 `.is-cur`：

| # | 行标签            | 取值        | 条色        | 特殊         |
| - | -------------- | --------- | --------- | ---------- |
| 1 | 本月（{MONTH_CN}） | `a1`      | `#ff7d00` | 加 `.is-cur` |
| 2 | 上月（{PREV_LABEL}） | `a0m`     | `#00b42a` | —          |
| 3 | 上年同期（{YOY_CN}） | `a0y`     | `#165dff` | —          |

> 值为 `null` 时条宽 0、数值显示 `--`。**`month = 1` 时**第 2 行标签为「上月（无上月基数）」、数值 `--`、条宽 0。

**图 B：环比成交金额差异瀑布图（`waterfall`）——纯 SVG，纵轴按差异量级缩放**

- 画布 `viewBox="0 0 760 300"`，`preserveAspectRatio="xMidYMid meet"`；外边距 `PL=66, PR=24, PT=24, PB=46`。
- **柱子序列**（共 5 根）：`基准值`（`mom.z0`，灰 `#86909c`）→ `量差效应` → `价差效应` → `交互项` → `本期值`（`mom.z1`，橙 `#ff7d00`）。
- **因素柱配色**：本页 `positiveIsGood = true`，故 **正值 = 绿 `#2ba471`（增收，有利）**、**负值 = 红 `#f53f3f`（减收，不利）**。
- **纵轴（关键，容易做错）**：只取「差异轨迹」的值域——即 `[基准值, 本期值]` 加上每根因素柱的 `from` 与 `to`，**不包含 0**；再上下留白（下留 `span × 0.22`、上留 `span × 0.16`，`span = max − min`，为 0 时取 1）。**基准柱与本期柱改为「自轴底起绘」，只有因素柱是浮动柱**（`from = (kind === 'eff') ? st.from : 轴底值`），柱高下限 2px。
  > 原因：差异量级远小于基期总量（如基期 563.65、差异仅 −106.93），若按 0 起轴，因素柱会被压成细线而看不见。**不要改成从 0 起轴。**
- **网格与刻度**：5 条水平线（`g = 0..4`，值 = `轴底 + 全幅 × g / 4`），线色 `#eef1f4`；刻度文字 `x = PL − 8`、10px `#98a1ab`、`text-anchor="end"`、`toFixed(1)`。
- **柱宽**：`slot = 内宽 ÷ 5`，`bw = min(74, slot × 0.56)`，圆角 `rx = 3`。
- **柱顶数值标签**：因素柱显示 `{signed(value 保留 **2** 位小数)}`（如 `-100.39`、`0.00`），基准/本期柱显示其总量（2 位小数）；10.5px、`#333`、600、居中，位于柱顶上方 6px。
  > ⚠️ **必须用 2 位小数**：1 位小数会把 `-0.02` 显示成「-0.0」，`0` 也可能显示成「-0.0」。同时对 `-0` 做归一化（`-0 === 0 → 0`）。
- **柱底名称标签**：`基准值` / `量差效应` / `价差效应` / `交互项` / `本期值`，10.5px `#606266`、居中，位于 `y = H − 26`。
- **连接虚线**：相邻柱之间在「当前柱顶值」高度画 1px 虚线（`#c9d1d9`、`stroke-dasharray="3 3"`）。
- **图下脚注**（SVG 之外的一行 div，12px `#98a1ab`、居中）：「单位：`{unit}` · 纵轴按差异量级缩放，基准/本期柱自轴底起绘」。
- **无数据态**：当环比（或同比）分解不可做时（`month = 1`、或量/价缺失），**不画图**，图框内居中输出一行灰字：`month = 1` 时为「年度首月，无上月基数」，数据不足时为「本期数据不足，无法绘制瀑布图」（13px `#98a1ab`，垂直居中，占位高度 150px）。

**图 C：同比差异因素贡献（`wbars`，双向差异条）——以 0 为中心**

- 容器 `.wbars`；每行 `.wbar-row`（flex、gap 10px、上下 margin 8px、12.5px）= 名称标签（宽 120px、右对齐）→ 轨道（`flex:1`、高 18px、底 `#f2f4f7`、圆角 3px、`position:relative`）→ 数值（宽 130px、tabular-nums）。
- 轨道正中有一条 1px 竖向轴线（`::before`，`left:50%`、上下各外扩 2px、色 `#dcdfe6`）作为 0 基准。
- 每条 `.wbar-fill` 绝对定位：**正值 → `left:50%` 向右伸**，**负值 → `right:50%` 向左伸**；宽 = `max(0.4, |value| ÷ 最大绝对值 × 50)%`（单侧最多占轨道一半）。值为 `null` 时条宽 0、填色 `#c9d1d9`。
- 填充色：本页 `positiveIsGood = true` → **正值绿 `#2ba471`、负值红 `#f53f3f`**；行 class 同时给 `is-pos` / `is-neg`，并按 2.2 的 CSS 覆盖使 `is-pos` 数值文字为绿、`is-neg` 为红，均 600 字重。
- 数值格式 = `signed(value, 2) + ' 万元'`；不可计算时 `--`。
- 固定 3 行：`量差效应`（`yoy.xEff`）、`价差效应`（`yoy.yEff`）、`交互项`（`yoy.cross`）。
- **无数据态**：同比分解不可做时同上，输出灰字占位「上年同期数据不足」。

> 图 C 与图 A 都是横向条，但**图 C 以 0 为中心双向伸展、图 A 单向最大值归一**，不要混用实现。

### 2.7 表格规格

- 统一 `.btable`：宽 100%、`border-collapse: collapse`、12.5px；单元格 1px 边框 `#e3e7ec`、padding `6px 8px`、居中、`tabular-nums`；表头底 `#e9f7ee`、600 字重；斑马纹偶数行底 `#fafcfb`；`<tfoot>` 行底 `#f4fbf6`、600 字重。
- 语义色 class：`.is-pos` → `#d4380d`（红）、`.is-neg` → `#2ba471`（绿）；本页按 2.3「着色语义」表的表达式传参——**金额与量用收益视角（增绿）**、**价用价格方向（涨红）**。`.is-self` → 底 `#fff7e8` 加粗（本期列）。
- 表题行 `.table-caption`（左表名 13px `#333` + 右单位 12px `#8a9199`）；表注 `.btable-note`（12px `#98a1ab`）。
- 本报告共 **3 张表**（`month = 1` 或分解不可做时，第 2 张不输出，变为 **2 张**）：
  1. **碳交易差异总览表**：6 列 4 行（2.4(5)）——**没有** `<tfoot>`。
  2. **环比差异因素分解表（{PREV_LABEL} → {MONTH_CN}）**：5 列 3 行 + `<tfoot>` 合计行（2.4(6)4）。
  3. **同比差异因素分解表（{YOY_CN} → {MONTH_CN}）**：5 列 3 行 + `<tfoot>` 合计行（2.4(6)6）。

### 2.8 下载（PDF）

- 触发：点击工具条右侧「下载报告（PDF）」按钮。
- 点击后按钮置灰并把文字替换为「正在生成 PDF…」；用 html2canvas（`scale: 2`、`backgroundColor: '#ffffff'`、`logging: false`）逐张渲染 `#brief-root .brief-page`，按 A4（210×297mm）高度切片后写入 jsPDF（JPEG 质量 0.92，首张之外逐页 `addPage`），完成后恢复按钮文字。实现与「碳排放月度报表」**逐字相同**（见该文档 2.8 的代码块），**仅文件名不同**。
- 文件名模板：`碳交易差异分析报告-{year}年{month}月.pdf`（例：`碳交易差异分析报告-2026年9月.pdf`）。
- **降级**：`window.jspdf?.jsPDF` 或 `window.html2canvas` 任一不存在 → 直接 `window.print()`（依赖 2.2 的 `@media print`）。

### 2.9 不要做什么（负面清单）

- **不要交付多个文件**——最终产物有且只有一个 `碳交易差异分析.html`；不要把 html2canvas / jsPDF 等库文件、拆分的 CSS/JS 文件、说明文档作为产物一起给出。
- 不要顶部导航、侧栏、面包屑、页签（tab）切换条、月份卡片列表、搜索/筛选条件区——本页只有「工具条 + 三张 A4 纸面」。
- **不要实现碳排放差异分析**：本页只有「碳交易差异分析」，指标是成交金额（万元）、成交量（万tCO₂）、成交均价（元/tCO₂）；**不得出现** 碳排放量、单位产品碳排放强度（tCO₂/t）、产品产量（万t）、「产量效应」「强度效应」、「增排/减排」等碳排放内容；`?tab=` 参数一律忽略。
- **不要写成「月度报表」**：本页不做「本月/上月/上年同期 三列并排的现状描述」，而是**差异分解**——必须有因素分解表（含 `<tfoot>` 合计行与「校验通过」字样）、瀑布图、双向差异条、有利/不利双栏；目录里必须有「二、差异因素分解」「三、差异归因与影响」。
- **不要让目录页（或任何一张纸面）与其他纸面宽度/内边距不一致**——常见错误是把目录内容贴到纸面左边缘；三张纸面必须同宽 920px、同内边距 `64px 72px 72px`、同水平居中，且必须用 2.2 给出的同一份容器 CSS。
- 不要「编制单位」「编制日期」「编制说明」等落款文字（封面底部只有「数据期间」一行）。
- 不要出现行业特定字眼（高炉 / 烧结 / 转炉 / 炼铁 / 轧钢 / 熟料 / 机组等）——报告对企业通用。
- **不要混淆红绿语义**：本页是**收益视角**，**正差异（增收）= 绿（`.is-neg` / `#2ba471`）**、**负差异（减收）= 红（`.is-pos` / `#d4380d`）**；瀑布图与双向差异条因素色同样「正绿负红」。**不要照搬「碳排放差异分析」那种「正红负绿」的增排/减排口径。**
- **不要把同比分解的精度改成 2 位小数**（同比必须 `dec = 4`，否则差异会被抹平）；也不要把瀑布图改成从 0 起轴。
  > ⚠️ **更正**：本页**环比与同比统一用 `dec = 2`**（见 2.5(4)(5)）。上一版曾要求同比用 4 位小数，那是入参为"万元"量级时的权宜做法；现在金额与量价统一为 2 位小数展示，**分解也统一用 2 位小数**，并通过"交互项取残差"保证恒等式成立。**不要再用 4 位小数。**
- **不要用教科书的交互项公式**：必须按 2.5(4) 的**残差口径** `交互项 = 合计差异 − 量差效应 − 价差效应`，否则「三项之和 ≠ 合计差异」，表格自相矛盾。
- **不要给入参兜底**：`trade.*` 给 `0` 就显示 `0`；缺位按 `0` 处理。**严禁**用上月值、行业均价、相邻期插值或联网检索"补"一组成交量或均价。
- **不要把 `--` 塞进原句式的数字位**：不可计算时整句改写（如「环比不适用」「本月为年度首月，无上月基数」），不要生成「减少 -- 万元」「占差异 --%」这类句子。
- **不要出现持仓、成交明细、市场行情相关内容**：不写「期末持仓量」「持仓市值」「持仓结构」「配额持仓 / CCER 持仓」「成交明细」「逐笔」「交易用途」「市场行情」「上海环境能源交易所」「北京绿色交易所」等，也不画持仓结构图、不做明细表与行情表——这类数据在入参里不存在。
- 不要引入图表库（ECharts / Chart.js / Highcharts）；水位条与双向条用纯 HTML/CSS，瀑布图用纯 SVG。
- 不要使用 emoji。
- 不要「生成报告」「查看报告」「导出 Excel」「打印」「删除」「立即交易」等按钮；工具条只有返回链接和「下载报告（PDF）」。
- 不要「功能建设中 / 敬请期待」等占位文字（本页是成品报告页）。
- 不要自由发挥「美化」——色值、字号、间距、文案、图表配色一律以本文档为准。

---

## 附录 A · 量级锚点与自检

**成交量 / 成交均价的合理量级**——用于判断入参是否"一眼假"，**不是用来填数**：

| 指标 | 合理量级 | 说明 |
| --- | --- | --- |
| 全国碳市场配额（CEA）成交均价 | 大致 **60 ~ 100 元/tCO₂** | 2023 年起长期在 70~100 元区间波动；低于 50 或高于 120 应提示存疑 |
| CCER 成交价 | 通常为 CEA 的 **80% ~ 95%** | 抵销资源，价格一般低于配额 |
| 单一控排企业月成交量 | **当月履约量的 5% ~ 30%** | 履约型企业的交易量通常显著小于其年度排放量 |
| 月成交金额 | 成交量（万t）× 均价（元/t）= **万元** | 例：5 万t × 90 元/t = 450 万元 |

**量级自检用法**：本报告的示例中，企业年排放约 320 万tCO₂（月均约 26 万tCO₂，见《碳排放月度报表》），
月成交量 4 ~ 7 万tCO₂ ⇒ 年成交约 50 ~ 85 万tCO₂，约为年履约量的 **15% ~ 25%**，属合理区间。
若月成交量达到月排放量的数倍，说明入参量级可疑，**应如实呈现并在文案中提示存疑**，**不要**替它改成"合理值"。

> ⚠️ **本报告的成交金额是派生量，不是入参**：`A = round2(成交量 × 成交均价)`（万t × 元/t = 万元）。
> 反过来也不要接收"成交金额"作为入参——量与价才是稳定口径。

**为什么本报告不收持仓、成交明细、交易所行情**：期末持仓需要持仓台账与逐笔勾稽；逐笔成交明细属另一套交易流水系统；
各交易所行情属**市场侧**公开数据，与本报告"企业月度交易"口径不同源。三类都没有等价替代口径，故不出现。

## 附录 B · 兜底生成规则

> **适用范围：无。本报告全篇为 L1 入参直取 + 派生计算，不存在任何兜底生成。**
> 成交量与成交均价一律不兜底；成交金额是**派生量**，其唯一算法见 2.5(3)。

**B1 各量的合法来源**

| 量 | 合法来源 | 无效时 |
| --- | --- | --- |
| 本期 / 上月 / 上年同期成交量 | 入参 `volume.cur` / `volume.prev` | `--` |
| 本期 / 上月 / 上年同期成交均价 | 入参 `price.cur` / `price.prev` | `--` |
| 成交金额 `a1` / `a0m` / `a0y` | **派生**：对应期成交量 × 对应期均价（round2） | 任一因子为 `--` → `--` |
| 三项效应与占比 | `decompose()`（2.5(4) 残差口径） | 任一分量为 `null` → 全部 `--` |

**B2 派生量必须用唯一算法**

- 成交金额**只能**由「成交量 × 成交均价」得到，**不得**用月均值乘以天数推算、**不得**用行业均价顶替、**不得**反向修正量或价。
- 交互项**只能**用残差口径（`ΔZ − X效应 − Y效应`），不得改用教科书公式。
- 占比分母为 0（差异恰为 0）时写 `--`，不得写 `0.0%`。

**B3 降级路径汇总**

| 触发条件 | 降级结果 |
| --- | --- |
| `volume.cur` / `price.cur` 全 0 | 金额与量价相关数值 `0.00`，差异率 `--`，占比 `--`，**页面照常渲染**（这是正确输出） |
| 上月的量或价缺失 | 环比：分解表与瀑布图不输出、改整句说明；同比视上年同期而定 |
| 上年同期的量或价缺失 | 同比分解降级（同上） |
| `month = 1` | 环比**整套**降级：总览表环比行 `--`、环比分解表与瀑布图不输出、上月标签「无上月基数」；同比照常 |
| 差异恰为 0 | 三项占比与合计占比 `--`；`合计差异 0.00`；方向词「持平」 |

## 附录 C · 期望值（自检用）

### C1 正常入参

入参为「一、入参」给出的那份（`month = 9`、`year = 2026`）。期望值如下（**必须逐一吻合**）：

| 位置 | 期望值 |
| --- | --- |
| 卡 1 本月成交金额 | `456.72` 万元；说明行「2026年9月」 |
| 卡 2 环比差异 | `-106.93` 万元；说明行「较2026年8月 -18.97 %」 |
| 卡 3 同比差异 | `-7.90` 万元；说明行「较2025年9月 -1.70 %」 |
| 卡 4 环比主要动因 | 量差；「占差异 91.5%」 |
| 卡 5 本月成交量 | `5.03` 万tCO₂；说明行「环比 -17.81 %」 |
| 卡 6 本月成交均价 | `90.80` 元/tCO₂；说明行「环比 -1.41 %」 |
| 总览表 · 成交金额（环比） | 563.65 ｜ 456.72 ｜ -106.93 ｜ -18.97 % ｜ 减少 |
| 总览表 · 成交金额（同比） | 464.62 ｜ 456.72 ｜ -7.90 ｜ -1.70 % ｜ 减少 |
| 总览表 · 成交量（环比） | 6.12 ｜ 5.03 ｜ -1.09 ｜ -17.81 % ｜ 缩量 |
| 总览表 · 成交均价（环比） | 92.10 ｜ 90.80 ｜ -1.30 ｜ -1.41 % ｜ 价跌 |
| 环比分解表三行 | 量差效应 -100.39（91.5%，减收）｜ 价差效应 -7.96（7.3%，减收）｜ 交互项 +1.42（1.2%，增收） |
| 环比分解表合计行 | `-106.93` 万元，100.0%，减收 |
| 环比表注三项之和 | `-100.39 + -7.96 + 1.42 = -106.93 万元` |
| 同比分解表三行 | 量差效应 -26.15（56.1%）｜ 价差效应 +19.35（41.5%）｜ 交互项 -1.10（2.4%） |
| 同比分解表合计行 | `-7.90` 万元，100.0% |
| 敏感性段 | `P₀ = 92.10` 元/tCO₂（→ 92.10 万元 每 1 万t）、`V₀ = 6.12` 万tCO₂（→ 6.12 万元 每 1 元/t） |
| 目录 | 5 条：摘要 · 差异概览 / 一、差异总览 / 二、差异因素分解 / 三、差异归因与影响 / 四、改进措施 |
| 表格总数 | **3 张** |

### C2 全零入参（`trade` 四组数组全为 0）

| 位置 | 期望结果 |
| --- | --- |
| 卡 1 本月成交金额 | `0.00` 万元 |
| 卡 2 / 卡 3 环比、同比差异 | `0.00` / `0.00` 万元，差异率 `--` |
| 卡 4 环比主要动因 | `--`，占比 `--` |
| 卡 5 / 卡 6 成交量、均价 | `0.00` / `0.00`，环比小字 `--` |
| 总览表 | 本企业与基准值均为 `0.00`；差异率列 `--`；差异性质列「不适用」 |
| 分解表 | **照常输出**：三项均为 `0.00`，**占比列全 `--`**，合计差异 `0.00`，方向词「持平」 |
| 瀑布图 | 照常绘制（基准/本期/三项均为 0，柱高下限 2px） |
| 归因栏 | 左栏「本期量价指标未呈现正向贡献，暂无突出优势项。」；右栏「各项量价指标方向均较优，暂无显著短板，需防范价格回调风险。」 |
| 表格总数 | **3 张**（与 C1 相同——碳交易侧的分解不需要除法，全零时仍可分解） |

> **判定标准：出现任何一个非 0 的成交量、均价或金额，即为不合格。**
> **注意与《碳排放差异分析》的差别**：碳排放侧的分解需要「排放量 ÷ 强度」，强度为 0 时分解作废（表格变为 1 张）；碳交易侧是「量 × 价」的乘法模型，**没有除法，全零时仍照常输出分解表**，只是占比写 `--`。

### C3 删掉整个 `trade` 字段

结果应与 **C2 完全一致**：正常渲染、不报错、不填数。

## 附录 D · 交付前自检清单

1. 用 C1 入参生成后，**逐项对照附录 C1**——6 张 KPI 卡、总览表 4 行、两张分解表、瀑布图、结论段都吻合。
2. 全文搜 `NaN`、`undefined`、`Infinity`、`∞`，**必须 0 命中**；也**不得出现「-0.0」**。
3. 全文搜 `示例`、`演示`、`模拟`、`占位`、`待补充`——**必须 0 命中**。
4. 目录 5 条锚点与正文标题一一对应，点击可定位。
5. **【恒等式必测】逐张分解表核对：三项之和 === 合计差异 === 总览表对应的成交金额差异**（本项目 `month = 9` 时环比 −106.93、同比 −7.90，必须逐字符相等，不允许 0.01 的差）。
6. **【占比必测】每张分解表的三项占比之和 === `100.0%`**（交互项取残差保证）；差异恰为 0 时三项占比与合计占比必须都是 `--`。
7. 成交金额的三处（卡 1、总览表行 1/2、对比图）数值**完全一致**，且等于 `round2(成交量 × 成交均价)`。
8. 成交量、成交均价、成交金额**一律 2 位小数**，单位分别为 万tCO₂ / 元/tCO₂ / 万元。
9. 瀑布图**因素柱的数值标签保留 2 位小数**，且**纵轴不包含 0、基准/本期柱自轴底起绘**。
10. 同一入参渲染两次，结果**逐字符一致**。
11. **【零兜底必测】用 C2（全零入参）跑一遍**，逐项对照附录 C2（分解表照常输出、占比全 `--`）。
12. **【必测】把 `trade` 整个字段删掉再跑一遍**，结果应与 C2 一致。
13. **【必测】用 `month = 1` 跑一遍**：环比相关全部 `--`、「上月」标签为「无上月基数」、**不出现「2025年0月」**、环比分解表与瀑布图不输出且给整句说明、同比分解照常。
14. **【口径必测】全文搜 `持仓`、`成交明细`、`逐笔`、`行情`、`交易所`、`市值`——必须 0 命中**。
15. 页面只交付**一个** HTML 文件，库走 CDN；全篇无 emoji、无图表库、无外部图片。
