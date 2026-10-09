# 碳交易月度报表 — 界面复刻提示词

> **数据口径（先读这条）**
>
> 1. **本报表的碳交易数据只能来自入参 `trade`，一律不兜底。** 入参给 `0` 就显示 `0`，字段或数组缺位同样按 `0` 处理；「全零入参生成全零页面」是**正确输出**。
> 2. **企业侧只采集"成交量 + 成交均价"两项。** 成交金额由「本月成交量 × 本月成交均价」**派生**（单位为万元），不是独立台账数据。
> 3. **期末持仓、逐笔成交明细、各交易所行情在实际业务中拿不到**，因此本报表**没有**「成交明细」「持仓与资产」「市场行情」章节，入参也**不设**对应字段。全文不得出现「持仓量」「持仓市值」「成交明细逐笔台账」「上海环境能源交易所 / 北京绿色交易所」这类内容。**不要自行补上**。
> 4. **环比基准 = 上月、同比基准 = 上年同期**。`month = 1` 时**没有上月基数**（不得拿上一年 12 月充数），环比相关一律写 `--` 并给替代文案。
> 5. 全绿/全红的语义按「交易视角」：**成交量与成交金额增加 = 有利 = 绿**、**减少 = 不利 = 红**；**成交均价按名目方向着色**（涨红跌绿，价格涨跌本身无绝对好坏）。
> 6. 全篇禁止出现 `NaN`、`undefined`、`Infinity`、`∞`；也禁止出现「示例」「演示」「模拟」「占位」「待补充」等字样。
> 7. 本报表只做**企业层级 · 月度**口径，**不含**逐笔流水、持仓台账、交易所行情。
>
> 本文档描述「碳交易月度报表」（在「碳月报及差异分析」列表页选择碳交易页签 → 点击某个月份卡片的「月度报表」按钮后进入的全屏 A4 报告页）的完整界面规格。按「一、入参」给定 JSON 输入，严格按「二、任务」的规格生成与原型一模一样的界面。  
> 本文档是自包含的：不需要访问任何原项目源码。  
> 使用方法：把入参 JSON 改成目标值，连同本文档全文发给 AI 即可。
>
> 本页与「碳排放月度报表」是**两个独立页面**，同属「月度报表」家族：页面外壳（工具条 / 三张 A4 纸面 / 封面 / 目录 / 章节标题 / 卡片 / 表格 / 下载）完全一致，**只有正文内容、数据、图表不同**。本页的核心指标是 成交量 / 成交均价 / 成交金额，不是排放量与排放强度。

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

| 字段                  | 类型         | 必填    | 说明                                                                     |
| ------------------- | ---------- | ----- | ---------------------------------------------------------------------- |
| `companyName`       | string     | 是     | 企业名称；用于封面 H1 第一行、工具条标题、浏览器标签页标题                                        |
| `year`              | number     | 是     | 年份（4 位）；只影响文案年号与文件名，**不参与取数**                                          |
| `month`             | number     | 是     | 月份 1–12；决定取哪个月（下标 `month − 1`）、年累计求和截止月、折线图高亮月。**< 1 或 > 12 一律按 9 处理** |
| `trade`             | object     | **是** | **本企业碳交易数据块**（L1，零兜底）。整个对象缺失时按全 0 处理                                   |
| `trade.volume`      | object     | 否     | 月度成交量（万tCO₂，2 位小数）。缺省按全 0                                              |
| `trade.volume.cur`  | number[12] | 否     | **当年 1–12 月的当月成交量**。**必须写满 12 个元素**                                    |
| `trade.volume.prev` | number[12] | 否     | **上年同期 1–12 月的当月成交量**，用于同比。**同样必须写满 12 个元素**                           |
| `trade.price`       | object     | 否     | 月度成交均价（元/tCO₂，2 位小数）。缺省按全 0                                            |
| `trade.price.cur`   | number[12] | 否     | **当年 1–12 月的当月成交均价**。**必须写满 12 个元素**                                   |
| `trade.price.prev`  | number[12] | 否     | **上年同期 1–12 月的当月成交均价**，用于同比                                            |

> **数据可得性说明**：本报表的企业侧数据只有**月度成交量**与**月度成交均价**两项。
>
> - **成交金额不在入参里**，由「成交量 × 成交均价」派生（万t × 元/t = 万元）——不要要求使用者另填金额，也不要用金额反推量或价。
> - **期末持仓（配额 / CCER）拿不到**，因此没有「持仓与资产」章节，也没有持仓结构图与持仓市值。
> - **逐笔成交明细拿不到**（需要交易流水台账），因此没有「成交明细」章节与明细表。
> - **各交易所行情拿不到**（属于市场侧外部数据，且本报表是企业月报），因此没有「市场行情」章节与行情表。
> - 逐日成交同样不在口径内，本报表最小粒度就是**月**。

### 数组填写规则

1. `volume.cur` / `volume.prev` / `price.cur` / `price.prev` **四个数组都必须写满 12 个元素**（下标 0 → 1 月，下标 11 → 12 月）。
2. **即使某月为 0 也要写 `0` 占位**——数组长度是"哪几月有数据、哪几月没有"的唯一依据；**严禁**用最后一个已有值向后外推，也**严禁**整体缩写成 3 个月、6 个月。
3. 数组长度**不足 12** 时，缺失位按 `0` 处理；长度**超过 12** 时只取前 12 个。
4. `volume.*` 用**万tCO₂**、保留 2 位小数；`price.*` 用**元/tCO₂**、保留 2 位小数。单位不要自行换算（不要改成吨、不要改成元/吨的倍数）。
5. 元素必须是**数字**（不要写字符串、不要带千分位逗号、不要带单位文字）。
6. `price.*` 是**乘数**：某月为 `0` 时该月**成交金额按 `0.00` 显示**（`0 × 0 = 0`，不存在除零问题）；但**该月的价格环比/同比写 `--`**（分母为 0）。
7. 上报口径：`cur` = 当年逐月、`prev` = **上年同期**逐月（不是"上月"）。上月值由 `cur` 的相邻元素取得（`month = 1` 时不存在）。

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

| JSON 字段             | 影响位置                                      | 规则                                                                                                                        |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| companyName         | 封面 H1 第一行 / 工具条标题 / 浏览器标签页标题              | 封面拼接为「{companyName}（换行）碳交易月报」；工具条标题为「{companyName}碳交易月报（{year}年{month}月）」；`document.title` = 「碳交易月报-{year}-{MM}」（MM 补零两位） |
| year                | 封面年月、封面「数据期间」、正文年号、下载文件名                  | 四位年份。**不参与取数**                                                                                                            |
| month               | 封面年月、数据期间、取数下标、年累计求和截止月、折线图高亮月、下载文件名      | 取值 1–12；**< 1 或 > 12 一律按 9 处理**；`month` 决定取第 `month − 1` 个数组元素（0 基）；**`month = 1` 时环比相关一律 `--`**                          |
| `trade.volume.cur`  | 本月成交量卡、年累计成交量卡、环比/同比金额变化卡、对比表「成交量」行、趋势折线图 | **L1 入参直取，零兜底**。`cur[month − 1]` = 本月值；`cur[0..month−1]` 求和 = 年累计；**上月值 = `cur[month − 2]`（`month = 1` 时不存在）**            |
| `trade.volume.prev` | 对比表「上年同期」列、同比相关                           | **L1 入参直取，零兜底**。`prev[month − 1]` = 上年同期值                                                                                 |
| `trade.price.cur`   | 本月成交均价卡、对比表「成交均价」行、趋势折线图                  | **L1 入参直取，零兜底**。同时作为**乘数**参与「成交金额 = 成交量 × 成交均价」                                                                           |
| `trade.price.prev`  | 对比表「上年同期」均价列、均价同比                         | **L1 入参直取，零兜底**                                                                                                           |

> **绝对不要用到的其他数据**：期末持仓台账（配额 / CCER）、逐笔成交明细、各交易所行情、碳排放量 / 强度 / 产品产量。本报表一律不出现。

### 运行期入参来源（URL 查询参数）

```
?month=2026-09&company=河南安钢周口钢铁有限责任公司&tvCur=…&tvPrev=…&tpCur=…&tpPrev=…
```

- `month` 形如 `YYYY-MM`，拆分为 `year` 与 `month`；不传时用 JSON 示例值 `2026-09`。
- `company` 覆盖 `companyName`。
- 四个数据数组用**逗号分隔的 12 个数**透传：`tvCur` = `trade.volume.cur`、`tvPrev` = `trade.volume.prev`、`tpCur` = `trade.price.cur`、`tpPrev` = `trade.price.prev`。**参数不传**用示例值；**参数传空**（如 `?tvCur=`）视为 12 个 0。
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
| 成交金额（环比/同比）   | 增加 = 增收（好）      | `is-neg`                      | 绿  | `deltaCls(-amtMomPct)` / `deltaCls(-amtYoyPct)` |

> **一致性说明**：原型中 KPI 卡的「本月成交量」「本月成交均价」两处曾传入与对比表相反的符号；本规格按上表**统一两处的着色**，使同一页内同一指标的颜色语义一致。除此之外一切照原型。
> **已移除的着色行**：持仓市值折算、市场行情「较上月」涨跌幅、成交明细「买入 / 卖出」——对应的数据与章节都不在本报表口径内（见「数据可得性说明」）。

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

- 标题「目　录」（20px、字距 2px），**4 个** `.toc-l1` 条目，点击平滑定位：

| 序号 | 目录文字          | 锚点       | 对应区块     |
| -- | ------------- | -------- | -------- |
| 1  | 摘要 · 本月核心指标概览 | `#sec-0` | 摘要       |
| 2  | 一、交易概况        | `#sec-1` | 一、交易概况   |
| 3  | 二、月度趋势回顾      | `#sec-2` | 二、月度趋势回顾 |
| 4  | 三、本月交易建议      | `#sec-3` | 三、本月交易建议 |

**(4) 摘要 · 本月核心指标概览**（`<h1 class="brief-h1" id="sec-0">摘要 · 本月核心指标概览</h1>`）

1. **KPI 卡片区**：`.kpi-grid`，grid **3 列**、间距 10px，共 **6 张卡**。每卡三行：名称（12px 灰）→ 大数值（20px/700，单位放 `<small>` 12px 灰）→ 说明行（11.5px）。第 1 张卡加 `.is-self`（橙色高亮）。6 张卡依次为：

| # | 名称     | 数值（单位）                     | 说明行（模板）                                         | 说明行 class                            |
| - | ------ | -------------------------- | ----------------------------------------------- | ------------------------------------ |
| 1 | 本月成交量  | `{volCur}` 万tCO₂（2 位小数）    | `环比 {signed(volMomPct,2,'%')}`                  | `deltaCls(-volMomPct)`；卡加 `.is-self` |
| 2 | 本月成交均价 | `{prCur}` 元/tCO₂（2 位小数）    | `环比 {signed(prMomPct,2,'%')}`                   | `deltaCls(prMomPct)`                 |
| 3 | 本月成交金额 | `{amtCur}` 万元（2 位小数）        | `按「成交量 × 成交均价」推算`                                | `is-flat`                            |
| 4 | 年累计成交量 | `{cumVol}` 万tCO₂（2 位小数）    | `截至 {MONTH_CN}`                                 | `is-flat`                            |
| 5 | 环比金额变化 | `{signed(momAmtDiff,2)}` 万元 | `环比 {signed(amtMomPct,2,'%')}`                  | `deltaCls(-amtMomPct)`               |
| 6 | 同比金额变化 | `{signed(yoyAmtDiff,2)}` 万元 | `环比 {signed(amtYoyPct,2,'%')}`                  | `deltaCls(-amtYoyPct)`               |

> 第 3 张卡的数值是**派生量**：`amtCur = round2(volCur × prCur)`。
> **`month = 1` 时**（没有上月基数）：第 1、2、5 张卡的说明行改为 `年度首月，无上月基数`（灰字 `is-flat`），数值本身照常显示。
> **百分比不可计算时**（分母为 0 或 `month = 1`）：说明行写 `--`（灰字），**不要把 `--` 塞进「环比 --%」之外的原句式**。

2. **要点列表** `.point-list`（12.5px，4 条；加粗文字在正文里是绿色 `#00b42a`）：
   1. 本月碳市场成交 `<strong>{volCur}</strong>` 万tCO₂，成交均价 `<strong>{prCur}</strong>` 元/tCO₂，成交金额 `{amtCur}` 万元。
   2. 成交量 `{环比增加|减少 x%}`，`{同比增加|减少 y%}`。
   3. 成交均价 `{环比上涨|下跌 x%}`，`{同比上涨|下跌 y%}`。
   4. 年累计成交量 `<strong>{cumVol}</strong>` 万tCO₂，按当前进度推演全年约 `{cumVol ÷ month × 12}` 万tCO₂。
   > 「增加/减少」「上涨/下跌」按符号选择（`≥0` 取前者），数值取绝对值、2 位小数带 `%`。
   > **百分比不可计算时（分母为 0 或 `month = 1`）**：该片段整句替换为「环比不适用」/「本月为年度首月，无上月基数」/「上年同期基数无效」，**不要输出「环比下降 --%」**。

**(5) 一、交易概况**（`id="sec-1"`）

1. 引导段 `.brief-p`：  
   「本月为 `{MONTH_CN}`，企业通过全国碳排放权交易市场及区域试点市场开展配额与 CCER 交易，成交 `{volCur}` 万tCO₂，成交均价 `{prCur}` 元/tCO₂，成交金额 `{amtCur}` 万元。与上月及上年同期对比如下表。」
   > `{PREV_LABEL}` = 上月标签；**`month = 1` 时为「无上月基数」**（不得拼成「2025年0月」）。
2. **月度交易对比表**：表题「月度交易对比表」+ 右单位「成交量：万tCO₂；均价：元/tCO₂；金额：万元」。6 列 3 行：

| 列   | 指标   | 本月（{MONTH_CN}）         | 上月（{PREV_LABEL}） | 环比                                                       | 上年同期（{YOY_CN}） | 同比                                                       |
| --- | ---- | ---------------------- | ------------- | -------------------------------------------------------- | -------------- | -------------------------------------------------------- |
| 行 1 | 成交量  | `{volCur}`（`.is-self`） | `{volPrev}`   | `{signed(volMomPct,2,'%')}` class=`deltaCls(-volMomPct)` | `{volYoy}`     | `{signed(volYoyPct,2,'%')}` class=`deltaCls(-volYoyPct)` |
| 行 2 | 成交均价 | `{prCur}`（`.is-self`）  | `{prPrev}`    | `{signed(prMomPct,2,'%')}` class=`deltaCls(prMomPct)`    | `{prYoy}`      | `{signed(prYoyPct,2,'%')}` class=`deltaCls(prYoyPct)`    |
| 行 3 | 成交金额 | `{amtCur}`（`.is-self`） | `{amtPrev}`   | `{signed(amtMomPct,2,'%')}` class=`deltaCls(-amtMomPct)` | `{amtYoy}`     | `{signed(amtYoyPct,2,'%')}` class=`deltaCls(-amtYoyPct)` |

   表注：「注：成交金额 = 成交量（万t）× 成交均价（元/t），单位为万元，属派生的量价联动口径，不是独立台账数据；「金额 / 成交量」行按「收益视角」着色（增加为绿、减少为红），均价行按名目方向着色。**本月为年度首月，无上月基数，环比相关一律为 `--`。**（此句仅在 `month = 1` 时输出）」  
3\. **成交金额对比条形图**（`cmpBars`，规格见 2.6 图 A），图题「（图）本月 / 上月 / 上年同期成交金额对比」。

**(6) 二、月度趋势回顾**（`id="sec-2"`）

1. 引导段 `.brief-p`：「下图为 `{year}` 年 1~12 月成交量与成交均价走势（橙点为当前月 `{month}` 月）。」
   > **`volume.cur` 全为 0 时**，引导段改写为：「下图为 `{year}` 年 1~12 月成交量与成交均价走势（橙点为当前月 `{month}` 月）。本期未提供逐月成交数据，趋势暂不可绘制。」
2. **两张 12 月折线图**（`lineChart`，纯 SVG，规格见 2.6 图 B），依次：
   - 图题「（图）`{year}` 年逐月成交量走势（万tCO₂）」，数据 = `volume.cur`
   - 图题「（图）`{year}` 年逐月成交均价走势（元/tCO₂）」，数据 = `price.cur`
   > **序列全为 0 时该图进入"无数据态"**：不画折线，图框内居中一行灰字「本期暂无数据」（见 2.6）。
3. **要点列表** 3 条：
   1. 本月成交量 `{volCur}` 万tCO₂，在全年逐月成交序列中位列第 `{rank}` 位。
   2. 全年成交量最高月为 `{maxMonth}` 月（`{max}` 万tCO₂），最低月为 `{minMonth}` 月（`{min}` 万tCO₂）。
   3. 成交均价全年保持在 `{min(price.cur)}` ~ `{max(price.cur)}` 元/tCO₂ 区间，价格中枢整体平稳。
   > `{rank}` = 把 12 个月的 `volume.cur` 按降序排序后，当前月所在名次（1 基）。`{maxMonth}`/`{minMonth}` 取最大值/最小值的下标 +1（并列取第一个）。

**(7) 三、本月交易建议**（`id="sec-3"`，`<ol class="advice-list">`，4 条，文案**逐字**如下，变量代入数值）

1. `<strong>把握价格窗口：</strong>`本月成交均价 `{prCur}` 元/tCO₂，`{环比上涨|下跌 x%}`，建议建立价格监测与分批建仓机制，在价格低位增配、高位择机变现盈余配额。
2. `<strong>优化量价节奏：</strong>`本月成交量 `{volCur}` 万tCO₂，`{环比增加|减少 x%}`，建议按履约进度制定分月交易计划，避免期末集中购碳推高成本，也避免量能大起大落放大金额波动。
3. `<strong>用好 CCER 抵销：</strong>`CCER 成交价通常低于配额价，建议在合规抵销比例内提高 CCER 使用比例，降低整体履约成本。
4. `<strong>建立差异跟踪机制：</strong>`按月开展「量—价」双因素差异分解（见《碳交易差异分析报告》），对价差效应连续为负的月份及时复盘交易策略，形成「月度分解—策略调整—效果回评」的闭环。

> 第 1、2 条里的百分比片段在不可计算时整句替换为「环比不适用」，**不要输出「环比下跌 --%」**。

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

**(3) 本期 / 基准取值与派生**：

```javascript
var volCur  = round2(VOL_CUR[M - 1]);                      // 本月成交量
var volPrev = HAS_PREV ? round2(VOL_CUR[PM - 1]) : null;   // 上月成交量（M = 1 → --）
var volYoy  = round2(VOL_PREV[M - 1]);                     // 上年同期成交量

var prCur   = round2(PRC_CUR[M - 1]);                      // 本月成交均价
var prPrev  = HAS_PREV ? round2(PRC_CUR[PM - 1]) : null;   // 上月成交均价
var prYoy   = round2(PRC_PREV[M - 1]);                     // 上年同期成交均价

// 成交金额 = 成交量 × 成交均价（唯一算法；万t × 元/t = 万元）
var amtCur  = round2(volCur * prCur);
var amtPrev = (volPrev == null || prPrev == null) ? null : round2(volPrev * prPrev);
var amtYoy  = round2(volYoy * prYoy);

// 年累计成交量（1~M 月求和；入参给 0 就是 0）
var cumVol = round2(VOL_CUR.slice(0, M).reduce(function (a, b) { return a + b; }, 0));
var annualProjected = round2(cumVol / M * 12);             // 全年推演

// 环比 / 同比百分比：分母必须 > 0，否则 null（渲染为 --）
function pctOf(a, b) { return (a == null || b == null || !(b > 0)) ? null : round2((a - b) / b * 100); }
var volMomPct = pctOf(volCur, volPrev);   // M = 1 时 volPrev 为 null → --
var volYoyPct = pctOf(volCur, volYoy);
var prMomPct  = pctOf(prCur, prPrev);
var prYoyPct  = pctOf(prCur, prYoy);
var amtMomPct = pctOf(amtCur, amtPrev);
var amtYoyPct = pctOf(amtCur, amtYoy);
var momAmtDiff = (amtPrev == null) ? null : round2(amtCur - amtPrev);
var yoyAmtDiff = round2(amtCur - amtYoy);
```

**(4) 位置派生**（趋势回顾的要点用）：

```
rank     = 把 VOL_CUR 按降序排序后，下标 M−1 所在的名次（1 基；并列取第一个）
maxMonth = VOL_CUR 最大值下标 + 1 ；minMonth = VOL_CUR 最小值下标 + 1
```

**(5) 数值格式**：成交量、成交均价、成交金额一律 **2 位小数 + 千分位**；百分数 2 位小数。
单位统一：**成交量 = 万tCO₂、成交均价 = 元/tCO₂、成交金额 = 万元**。持仓、市值、百万元等本报表**不出现**。

**(6) 零值与缺值处理（除零保护，必须实现）**

`trade` 整体缺失、或其子数组全为 0，都属**合法输入**，报告须正常渲染，不得报错、不得留空、不得填数：

| 情形 | 正确输出 | 错误输出（禁止） |
| --- | --- | --- |
| `volume.cur` 全为 0 | 本月成交量 `0.00`、年累计 `0.00`、环比/同比金额变化 `0.00`；对比条形图三条 0 宽条 | 为了"报告好看"自动编一组正常数据 |
| `price.cur` 某月为 0 | 该月均价显示 `0.00`（数值序列零兜底），**该月成交金额 `0.00`**（`0 × 0 = 0`，**不存在除零**）；但该月均价环比/同比写 `--`（分母为 0） | 把均价写成 `--`（数值序列给 0 就该显示 0） |
| 环比分母（上月成交量 / 上月均价 / 上月金额）为 0 | 环比 `--` | `NaN` / `∞` |
| 同比分母（上年同期值）为 0 | 同比 `--` | `NaN` / `∞` |
| `month = 1` | 本月、年累计、两张趋势图照常；**所有环比相关一律 `--`**，上月标签写「无上月基数」 | 拿上一年 12 月当"上月"，或把上月写成「2025年0月」 |
| 某序列全为 0 时的折线图 | 该图进入**无数据态**：不画折线，图框内居中一行灰字「本期暂无数据」（两张图各自独立判定） | 画一条贴轴直线却不说明无数据 |
| 数组长度 < 12 | 缺失位按 `0` 处理 | 用最后一个已有值向后外推 |

> 实现提示：判断顺序必须是「**先判存在性与零值 → 再算派生量 → 最后格式化**」。格式化函数遇到 `null` / `NaN` / `Infinity` 必须返回 `--`，不得输出 `0.00` 或 `∞`；同时把 `-0` 归一化为 `0`（否则会显示成「-0.0」）。

**声明：本节是所有数字的唯一来源，生成时不要另编数据。**

**(7) 校验参考**（用来自检；若你的结果与下表不符，说明取数下标或派生公式被改动了）：

| 入参 companyName=河南安钢周口钢铁有限责任公司 | `month=9`（year=2026） | `month=1`（year=2026） |
| --------------------------------- | ------------------ | ------------------ |
| 本月标签 `MONTH_CN` / 上月 `PREV_LABEL` / 同期 `YOY_CN` | 2026年9月 / 2026年8月 / 2025年9月 | 2026年1月 / **无上月基数** / 2025年1月 |
| 本月成交量 `volCur` / 上月 / 上年同期（万tCO₂） | 5.03 / 6.12 / 5.33 | 4.62 / `--` / 4.90 |
| 本月均价 `prCur` / 上月 / 上年同期（元/tCO₂） | 90.80 / 92.10 / 87.17 | 86.50 / `--` / 83.04 |
| 本月成交金额 `amtCur` / 上月 / 上年同期（万元） | 456.72 / 563.65 / 464.62 | 399.63 / `--` / 406.90 |
| 成交量环比 / 同比（%） | −17.81 / −5.63 | `--` / −5.71 |
| 均价环比 / 同比（%） | −1.41 / +4.16 | `--` / +4.17 |
| 金额环比 / 同比（%） | −18.97 / −1.70 | `--` / −1.79 |
| 环比金额变化 / 同比金额变化（万元） | −106.93 / −7.90 | `--` / −7.27 |
| 年累计成交量 `cumVol` / 全年推演（万tCO₂） | 46.85 / 62.47 | 4.62 / 55.44 |
| 趋势图：本月排名 / 最高月 / 最低月 | 第 7 位 / 10 月 7.24 / 2 月 3.85 | 第 9 位 / 10 月 7.24 / 2 月 3.85 |
| `volume.cur` 最小值 ~ 最大值 | 3.85 ~ 7.24 | 同左 |
| `price.cur` 最小值 ~ 最大值 | 85.70 ~ 94.20 | 同左 |

> **基准随 `month` 变化**：上表只对应该套入参。换 `month` 必须按 2.5(3) 重算，不得沿用。

### 2.6 图表规格

本报告共 **2 种图**：1 种纯 HTML/CSS 横向条形图（不用 SVG、不用图表库）+ 1 种纯 SVG 折线图（不用图表库）。  
统一容器 `.chart-box`（白底、1px 边框 `#e8ebef`、圆角 6px、padding `12px 14px 6px`）；图题 `.chart-caption`（居中 12.5px 灰，位于图框**下方**，上下间距 `4px 0 16px`）。

**图 A：本月/上月/上年同期成交金额对比图（`cmpBars`）——最大值归一**

- 容器 `.hbars`；每行 `.hbar-row`（flex、gap 10px、上下 margin 7px、12.5px）= 名称标签（宽 150px、**右对齐**）→ 轨道（`flex:1`、高 16px、底 `#f2f4f7`、圆角 3px、`overflow:hidden`）→ 数值（宽 150px、tabular-nums）。
- 条宽 = `value ÷ 行内最大值 × 100%`，**下限 0.5%**；数值格式 = `fmt(value, 2) + ' 万元'`。值为 `null` 时条宽 0、数值显示 `--`。
- 固定 3 行，顺序与配色不可变：

| # | 行标签            | 取值        | 条色        | 特殊           |
| - | -------------- | --------- | --------- | ------------ |
| 1 | 本月（{MONTH_CN}） | `amtCur`  | `#ff7d00` | 加 `.is-self` |
| 2 | 上月（{PREV_LABEL}） | `amtPrev` | `#00b42a` | —            |
| 3 | 上年同期（{YOY_CN}） | `amtYoy`  | `#165dff` | —            |

> **`month = 1` 时**第 2 行的标签为「上月（无上月基数）」，数值显示 `--`、条宽 0。

**图 B：{year} 年逐月走势（`lineChart`）——纯 SVG，共两张**

两张图共用同一套画法与参数，**只是输入序列与图题不同**：

| 图 | 输入数据 | 图题 |
| -- | --- | --- |
| B-1 | `volume.cur`（12 项，成交量） | （图）`{year}` 年逐月成交量走势（万tCO₂） |
| B-2 | `price.cur`（12 项，成交均价） | （图）`{year}` 年逐月成交均价走势（元/tCO₂） |

- 画布 `viewBox="0 0 760 240"`，`preserveAspectRatio="xMidYMid meet"`，外边距 `PL=52, PR=18, PT=18, PB=34`。
- **纵轴**：`min/max` 取自输入序列，上下各留 `span × 0.15` 余量（`span = max − min`，为 0 时取 1）；5 条水平网格线（值 = `min + range × g / 4`，`g = 0..4`），线色 `#eef1f4`、宽 1；刻度文字 `x = PL − 8`、10px `#98a1ab`、`text-anchor="end"`、`toFixed(1)`。
- **横轴**：12 个刻度，`X(i) = PL + iw × i / 11`；标签 `1月`…`12月`，10px `#98a1ab`，`y = H − 12`。
- **折线**：`<polyline>`，`fill="none"`、`stroke="#00b42a"`、`stroke-width="2.2"`、`stroke-linejoin="round"`。
- **数据点**：当前月（`i === M−1`）半径 5、填充 `#ff7d00`、描边 `#ff7d00`，点上方 `y − 12` 标数值（11px、`#b25f00`、700、居中、2 位小数）；其余月份半径 3、填充 `#fff`、描边 `#00b42a`、宽 2。
- 纵轴**不要求从 0 起**，按数据范围自适应即可。
- **无数据态**：当输入序列 **12 个元素全为 0** 时，该图**不画折线、不画网格与刻度**，图框内居中输出一行灰字「本期暂无数据」（13px `#98a1ab`，垂直居中，占位高度 150px）。两张图各自独立判定。

### 2.7 表格规格

- 统一 `.btable`：宽 100%、`border-collapse: collapse`、12.5px；单元格 1px 边框 `#e3e7ec`、padding `6px 8px`、居中、`tabular-nums`；表头底 `#e9f7ee`、600 字重；斑马纹偶数行底 `#fafcfb`；`<tfoot>` 行底 `#f4fbf6`、600 字重。
- 语义色 class：`.is-pos` → `#d4380d`（红）；`.is-neg` → `#2ba471`（绿）；`.is-self` → 底 `#fff7e8` 加粗。各列具体用哪个 class 见 2.4 与 2.3「着色语义」表。
- 表题行 `.table-caption`（左表名 13px `#333` + 右单位 12px `#8a9199`）；表注 `.btable-note`（12px `#98a1ab`）。
- 本报告共 **1 张表**：
  1. **月度交易对比表**：6 列 3 行（2.4(5)）。**没有成交明细表、没有持仓结构表、没有市场行情表**（这三类数据拿不到，见「数据可得性说明」）。

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
- **不要出现持仓、成交明细、市场行情相关内容**：不写「期末持仓量」「持仓市值」「持仓结构」「配额持仓 / CCER 持仓」「成交明细」「逐笔」「交易用途」「市场行情」「上海环境能源交易所」「北京绿色交易所」「广东碳排放权交易所」等，也不画持仓结构图、不做明细表与行情表。章节固定为 **摘要 + 一~三章**。
- **不要引入本报表没有的企业数据**：期末持仓台账（配额 / CCER）、逐笔成交流水、各交易所行情、碳排放量 / 单位产品碳排放强度 / 产品产量 / 排放源结构。成交金额只作为**派生量**出现（= 成交量 × 成交均价），不得写成台账口径。
- **不要给入参兜底**：`trade.*` 给 `0` 就显示 `0`；缺位按 `0` 处理。**严禁**用上月值、行业均价、相邻期插值或联网检索"补"一组成交量或均价。
- **不要把 `--` 塞进原句式的数字位**：不可计算时整句改写（如「环比不适用」「本月为年度首月，无上月基数」），不要生成「环比下跌 --%」「约 -- 万元」这类句子。
- **不要混用红绿语义**：按 2.3「着色语义」表统一——成交量↑=绿、成交金额↑=绿、成交均价↑=红。特别注意：**不要给「成交量」用排放报告那种「增=红」的映射**。
- 不要引入图表库（ECharts / Chart.js / Highcharts）；横向条形图用纯 HTML/CSS，折线图用纯 SVG。
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

**量级自检用法**：本报表的示例中，企业年排放约 320 万tCO₂（月均约 26 万tCO₂，见《碳排放月度报表》），
月成交量 4 ~ 7 万tCO₂ ⇒ 年成交约 50 ~ 85 万tCO₂，约为年履约量的 **15% ~ 25%**，属合理区间。
若月成交量达到月排放量的数倍（如月成交 200 万tCO₂ 而月排放 26 万tCO₂），说明入参量级可疑，
**应如实呈现并在文案中提示存疑**，**不要**替它改成"合理值"。

> ⚠️ **不要把"价格逐日波动"当成不收金额的理由用在错的地方**：本报表**收的是量与价**这两项稳定口径，
> 金额只是它们的派生量（定量价即得金额）；反过来，**不要**把"成交金额"当成入参直接接收。

**为什么本报表不收持仓、成交明细、交易所行情**：
- 期末持仓（配额 / CCER）需要持仓台账与发放/核销记录，且与交易流水必须逐笔勾稽，月度口径下取不到；
- 逐笔成交明细需要交易流水台账，属另一套系统；
- 各交易所行情属**市场侧**公开数据（不是企业自有数据），且与本报表"企业月度交易"口径不同源。
三类数据都**没有等价的替代口径**，因此整章删除而不是"填 `--`"。

## 附录 B · 兜底生成规则

> **适用范围：无。本报表全篇为 L1 入参直取，不存在任何兜底生成。**
> 成交量、成交均价、以及由二者派生的成交金额，**一律不兜底、不推算、不检索替换**。

**B1 四个量各自的合法来源**

| 量 | 合法来源 | 无效时 |
| --- | --- | --- |
| 本月/上月/上年同期成交量 | 入参 `volume.cur` / `volume.prev` | `--` |
| 本月/上月/上年同期成交均价 | 入参 `price.cur` / `price.prev` | `--` |
| 本月/上月/上年同期成交金额 | **派生**：成交量 × 成交均价（round2） | 任一因子为 `--` → `--` |
| 年累计成交量 | `volume.cur` 前 `month` 项求和 | —（全 0 就得 0） |

**B2 派生量必须用唯一算法**

- 成交金额**只能**由「成交量 × 成交均价」得到（万t × 元/t = 万元），
  **不得**用月均值乘以天数推算、**不得**用行业均价顶替、**不得**反向修正量或价。
- 年累计成交量 = `volume.cur` 前 `month` 个元素求和（不是乘 12、不是取 `prev`）。

**B3 本企业数据缺失或为 0 时的降级**

- `volume.cur` / `price.cur` 全 0 → 相关数值显示 `0.00`，对应折线图进入「本期暂无数据」态，**这是正确输出**。
- 价格某月为 0 → 该月均价显示 `0.00`、金额显示 `0.00`；但该月的价格环比/同比为 `--`（分母为 0）。
- 环比分母为 0 → 环比 `--`；同比分母为 0 → 同比 `--`。
- `month = 1` → 环比整套 `--`（见 2.4(4)/2.4(5)），**其余照常**。

## 附录 C · 期望值（自检用）

### C1 正常入参

入参为「一、入参」给出的那份（`month = 9`、`year = 2026`）。期望值如下（**必须逐一吻合**）：

| 位置 | 期望值 |
| --- | --- |
| 卡 1 本月成交量 | `5.03` 万tCO₂；说明行「环比 -17.81 %」 |
| 卡 2 本月成交均价 | `90.80` 元/tCO₂；说明行「环比 -1.41 %」 |
| 卡 3 本月成交金额 | `456.72` 万元；说明行「按「成交量 × 成交均价」推算」 |
| 卡 4 年累计成交量 | `46.85` 万tCO₂；说明行「截至 2026年9月」 |
| 卡 5 环比金额变化 | `-106.93` 万元；说明行「环比 -18.97 %」 |
| 卡 6 同比金额变化 | `-7.90` 万元；说明行「环比 -1.70 %」 |
| 对比表 · 成交量行 | 5.03 ｜ 6.12 ｜ -17.81 % ｜ 5.33 ｜ -5.63 % |
| 对比表 · 成交均价行 | 90.80 ｜ 92.10 ｜ -1.41 % ｜ 87.17 ｜ +4.16 % |
| 对比表 · 成交金额行 | 456.72 ｜ 563.65 ｜ -18.97 % ｜ 464.62 ｜ -1.70 % |
| 对比图三行数值 | 本月 456.72 / 上月 563.65 / 上年同期 464.62（单位 万元） |
| 趋势要点 1 | 本月成交量 5.03 万tCO₂，位列第 **7** 位 |
| 趋势要点 2 | 最高月 **10 月（7.24）**，最低月 **2 月（3.85）** |
| 趋势要点 3 | 均价全年区间 85.70 ~ 94.20 元/tCO₂ |
| 目录 | 4 条：摘要 · 本月核心指标概览 / 一、交易概况 / 二、月度趋势回顾 / 三、本月交易建议 |

> `month = 1` 时的期望值见 2.5(7) 的右列（环比全 `--`、上月标签「无上月基数」、第 9 位）。

### C2 全零入参（`trade` 四组数组全为 0）

| 位置 | 期望结果 |
| --- | --- |
| 卡 1 本月成交量 | `0.00` 万tCO₂，说明行 `--` |
| 卡 2 本月成交均价 | `0.00` 元/tCO₂，说明行 `--` |
| 卡 3 本月成交金额 | `0.00` 万元（`0 × 0`，**不是 `--`**） |
| 卡 4 年累计成交量 | `0.00` 万tCO₂ |
| 卡 5 / 卡 6 环比、同比金额变化 | `0.00` / `0.00` 万元，说明行 `--` |
| 对比表 | 三行本企业与基准值均为 `0.00`，环比与同比列全 `--` |
| 对比条形图 | 三条 0 宽条，数值 `0.00` |
| 两张趋势折线图 | **均不画折线**，各自图框内居中一行灰字「本期暂无数据」 |
| 引导段与要点 | 整段按"全 0 / 无数据"措辞输出，趋势引导段改为「本期未提供逐月成交数据，趋势暂不可绘制。」 |

> **判定标准：出现任何一个非 0 的成交量、均价或金额，即为不合格。**

### C3 删掉整个 `trade` 字段

结果应与 **C2 完全一致**：正常渲染、不报错、不填数。

## 附录 D · 交付前自检清单

1. 用 C1 入参生成后，**逐项对照附录 C1**——6 张 KPI 卡、对比表 3 行、对比图、趋势要点、目录都吻合。
2. 全文搜 `NaN`、`undefined`、`Infinity`、`∞`，**必须 0 命中**。
3. 全文搜 `示例`、`演示`、`模拟`、`占位`、`待补充`——**必须 0 命中**。
4. 目录 4 条锚点与正文标题一一对应，点击可定位。
5. **【口径必测】全文搜 `持仓`、`成交明细`、`逐笔`、`行情`、`交易所`、`市值`——必须 0 命中**（数据可得性收缩的验收项）。
6. 成交金额的三处（卡 3、对比表行 3、对比图）数值**完全一致**，且等于 `round2(成交量 × 成交均价)`。
7. 年累计 = `volume.cur` 前 `month` 项之和（逐值核对，不要用乘 12 的结果）。
8. 成交量、成交均价、成交金额**一律 2 位小数**，单位分别为 万tCO₂ / 元/tCO₂ / 万元。
9. 同一入参渲染两次，结果**逐字符一致**。
10. **【零兜底必测】用 C2（全零入参）跑一遍**，逐项对照附录 C2。
11. **【必测】把 `trade` 整个字段删掉再跑一遍**，结果应与 C2 一致。
12. **【必测】用 `month = 1` 跑一遍**：环比相关全部 `--`、「上月」标签为「无上月基数」、**不出现「2025年0月」**、两张趋势图各自只有 1 月一个实点。
13. 把 `volume.cur` 改成明显偏大 / 偏小的值，确认成交量、金额、两张趋势图都随之变化且逻辑自洽。
14. 页面只交付**一个** HTML 文件，库走 CDN；全篇无 emoji、无图表库、无外部图片。
