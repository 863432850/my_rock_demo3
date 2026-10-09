# 碳排放月度报表 — 界面复刻提示词

> **数据口径（先读这条）**
>
> 1. **本报表的碳排放数据只能来自入参 `emission`，一律不兜底。** 入参给 `0` 就显示 `0`，字段或数组缺位同样按 `0` 处理；「全零入参生成全零页面」是**正确输出**，不是缺陷。
> 2. **企业侧只采集"排放量 + 强度"两项。** 产品产量由「本月排放量 ÷ 本月强度」**派生**（保留 4 位小数），不是独立台账数据。
> 3. **排放源结构（化石燃料燃烧 / 工业生产过程 / 外购电力 / 外购热力，或直接/间接占比）在实际业务中拿不到**，因此本报表**没有**「排放结构分析」章节，入参也**不设**对应字段，全文不得出现「化石燃料燃烧」「外购电力」「直接排放占比」这类内容。**不要自行补上**。
> 4. **环比基准 = 上月、同比基准 = 上年同期**。`month = 1` 时**没有上月基数**（不得拿上一年 12 月充数），环比相关一律写 `--` 并给替代文案。
> 5. 全篇禁止出现 `NaN`、`undefined`、`Infinity`、`∞`；也禁止出现「示例」「演示」「模拟」「占位」「待补充」等字样。
> 6. 本报表只做**企业层级 · 月度**口径，**不含**逐日数据、工序级拆解，也不含碳交易内容。
>
> 本文档描述「碳排放月度报表」（在「碳月报及差异分析」列表页选择碳排放页签 → 点击某个月份卡片的「月度报表」按钮后进入的全屏 A4 报告页）的完整界面规格。按「一、入参」给定 JSON 输入，严格按「二、任务」的规格生成与原型一模一样的界面。  
> 本文档是自包含的：不需要访问任何原项目源码。  
> 使用方法：把入参 JSON 改成目标值，连同本文档全文发给 AI 即可。

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

| 字段                        | 类型         | 必填    | 说明                                                                      |
| ------------------------- | ---------- | ----- | ----------------------------------------------------------------------- |
| `companyName`             | string     | 是     | 企业名称；用于封面 H1 第一行、工具条标题、浏览器标签页标题                                         |
| `year`                    | number     | 是     | 年份（4 位）；只影响文案年号与文件名，**不参与取数**（取数只按 `month` 取数组下标）                       |
| `month`                   | number     | 是     | 月份 1–12；决定取哪个月（下标 `month − 1`）、趋势图高亮月、封面年月与数据期间。**< 1 或 > 12 一律按 9 处理** |
| `emission`                | object     | **是** | **本企业碳排放数据块**（L1，零兜底）。整个对象缺失时按全 0 处理                                    |
| `emission.volume`         | object     | 否     | 月度碳排放量（万tCO₂，2 位小数）。缺省按全 0                                              |
| `emission.volume.cur`     | number[12] | 否     | **当年 1–12 月的当月排放量**。**必须写满 12 个元素**（见「数组填写规则」）                          |
| `emission.volume.prev`    | number[12] | 否     | **上年同期 1–12 月的当月排放量**，用于「上年同期」列与同比。**同样必须写满 12 个元素**                    |
| `emission.intensity`      | object     | 否     | 单位产品碳排放强度（tCO₂/t，4 位小数）。缺省按全 0                                          |
| `emission.intensity.cur`  | number[12] | 否     | **当年 1–12 月的当月强度**。**必须写满 12 个元素**                                      |
| `emission.intensity.prev` | number[12] | 否     | **上年同期 1–12 月的当月强度**，用于同比                                               |

> **数据可得性说明**：本报表的企业侧数据只有**月度碳排放量**与**单位产品碳排放强度**两项。
>
> - **产品产量不在入参里**，由「本月排放量 ÷ 本月强度」派生（保留 4 位小数）——不要要求使用者另填产量，也不要用产量反推入参。
> - **排放源结构拿不到**：化石燃料燃烧 / 工业生产过程 / 外购电力 / 外购热力的拆解、以及「直接排放占比 / 间接排放占比」，在实际业务中无法获取，因此入参**不设** `emission.sources` 之类字段，正文也**没有**「排放结构分析」章节与对应图表。**不要自行补上**。
> - 逐日排放明细同样拿不到，本报表最小粒度就是**月**。

### 数组填写规则

1. `volume.cur` / `volume.prev` / `intensity.cur` / `intensity.prev` **四个数组都必须写满 12 个元素**（下标 0 → 1 月，下标 11 → 12 月）。
2. **即使某月为 0 也要写 `0` 占位**——数组长度是"哪几月有数据、哪几月没有"的唯一依据；**严禁**用最后一个已有值向后外推，也**严禁**整体缩写成 3 个月、6 个月。
3. 数组长度**不足 12** 时，缺失位按 `0` 处理；长度**超过 12** 时只取前 12 个。
4. `volume.*` 用**万tCO₂**、保留 2 位小数；`intensity.*` 用 **tCO₂/t**、保留 4 位小数。单位不要自行换算（不要改成吨、不要改成 kgCO₂）。
5. 元素必须是**数字**（不要写字符串、不要带千分位逗号、不要带单位文字）。
6. `intensity.*` 是**分母**：某月为 `0`（或负）时，该月的**产品产量**不可计算，写 `--`（排放量本身仍按 `0` 或给定值正常显示）。
7. 上报口径：`cur` = 当年逐月、`prev` = **上年同期**逐月（不是"上月"）。上月值由 `cur` 的相邻元素取得（`month = 1` 时不存在）。

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

| JSON 字段                   | 影响位置                                    | 规则                                                                                                                        |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `companyName`             | 封面 H1 第一行 / 工具条标题 / 浏览器标签页标题            | 封面拼接为「{companyName}（换行）碳排放月报」；工具条标题为「{companyName}碳排放月报（{year}年{month}月）」；`document.title` = 「碳排放月报-{year}-{MM}」（MM 补零两位） |
| `year`                    | 封面年月、封面「数据期间」、正文「{Y} 年 1~12 月」表述、下载文件名  | 四位年份。**不参与取数**                                                                                                            |
| `month`                   | 封面年月、数据期间、取数下标、趋势图高亮月、下载文件名             | 取值 1–12；非法值按 9 处理；`month` 决定取第 `month − 1` 个数组元素（0 基）；**`month = 1` 时环比相关一律 `--`**                                        |
| `emission.volume.cur`     | 本月碳排放量卡、年累计排放量卡、环比/同比变化卡、对比表「本月」行、趋势折线图 | **L1 入参直取，零兜底**。`cur[month − 1]` = 本月值；`cur[0..month−1]` 求和 = 年累计；**上月值 = `cur[month − 2]`（`month = 1` 时不存在）**            |
| `emission.volume.prev`    | 对比表「上年同期」列、同比差异与同比变化卡、上年同期对比条           | **L1 入参直取，零兜底**。`prev[month − 1]` = 上年同期值                                                                                 |
| `emission.intensity.cur`  | 单位产品碳排放强度卡、对比表强度行、趋势要点里的强度区间            | **L1 入参直取，零兜底**。同时作为**分母**参与「产品产量 = 排放量 ÷ 强度」                                                                             |
| `emission.intensity.prev` | 对比表「上年同期」强度列、强度同比                       | **L1 入参直取，零兜底**，不参与产量派生                                                                                                   |

> **绝对不要用到的其他数据**：产品产量台账、排放源拆解、逐日排放、碳交易数据（成交量/均价/金额/持仓）。本报表一律不出现。

### 运行期入参来源（URL 查询参数）

页面读取 URL 查询参数作为入参来源，缺省回落上表示例值——这样既能从列表页跳转透传，也能直接双击打开演示：

```
?month=2026-09&company=河南安钢周口钢铁有限责任公司&evCur=…&evPrev=…&eiCur=…&eiPrev=…
```

- `month` 形如 `YYYY-MM`，拆分为 `year` 与 `month`；不传时用 JSON 示例值 `2026-09`。
- `company` 覆盖 `companyName`。
- 四个数据数组用**逗号分隔的 12 个数**透传：`evCur` = `emission.volume.cur`、`evPrev` = `emission.volume.prev`、`eiCur` = `emission.intensity.cur`、`eiPrev` = `emission.intensity.prev`。**参数不传**用示例值；**参数传空**（如 `?evCur=`）视为 12 个 0。
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
- **4 个**锚点条目，全部 `.toc-l1` 级别（15px/600），点击平滑定位：

| 序号 | 目录文字             | 锚点        | 对应区块                    |
| -- | ---------------- | --------- | ----------------------- |
| 1  | 摘要 · 本月核心指标概览    | `#sec-0`  | 摘要                      |
| 2  | 一、月度排放概况         | `#sec-1`  | 一、月度排放概况                |
| 3  | 二、月度趋势回顾         | `#sec-2`  | 二、月度趋势回顾                |
| 4  | 三、本月工作建议         | `#sec-3`  | 三、本月工作建议（正文里存在，目录中一并列出） |

**(4) 摘要 · 本月核心指标概览**（`<h1 class="brief-h1" id="sec-0">摘要 · 本月核心指标概览</h1>`）

1. **KPI 卡片区**：`.kpi-grid`，grid **3 列**、间距 10px，共 **6 张卡**。每卡三行：名称（12px 灰）→ 大数值（20px/700，单位放 `<small>` 12px 灰）→ 说明行（11.5px）。第 1 张卡加 `.is-self`（橙色高亮：边框 `#ffd591`、底 `#fff7e8→#fff`）。6 张卡依次为：

| # | 名称         | 数值（`<small>` 单位）        | 说明行（模板）                        | 说明行 class                    |
| - | ---------- | ----------------------- | ------------------------------ | --------------------------- |
| 1 | 本月碳排放量     | `{cur}` 万tCO₂（2 位小数）    | `环比 {signed(momEmissionPct,2,'%')}` | `deltaCls(momEmissionPct)`；卡加 `.is-self` |
| 2 | 年累计排放量     | `{cum}` 万tCO₂（2 位小数）    | `截至 {MONTH_CN}`                | `is-flat`                   |
| 3 | 单位产品碳排放强度  | `{curIntensity}` tCO₂/t（4 位小数） | `环比 {signed(momIntensityPct,2,'%')}` | `deltaCls(momIntensityPct)`  |
| 4 | 本月产品产量     | `{output}` 万t（2 位小数）     | `按「排放量 ÷ 强度」推算`                | `is-flat`                   |
| 5 | 环比排放变化     | `{signed(momEmissionDiff,2)}` 万tCO₂ | `环比 {signed(momEmissionPct,2,'%')}` | `deltaCls(momEmissionPct)`   |
| 6 | 同比排放变化     | `{signed(yoyEmissionDiff,2)}` 万tCO₂ | `环比 {signed(yoyEmissionPct,2,'%')}` | `deltaCls(yoyEmissionPct)`   |

> 第 4 张卡的数值是**派生量**：`output = round4(本月排放量 ÷ 本月强度)`；强度 ≤ 0 时写 `--`，说明行仍为「按「排放量 ÷ 强度」推算」。
> **`month = 1` 时**（没有上月基数）：第 1、5 张卡的说明行改为 `年度首月，无上月基数`（灰字 `is-flat`），数值本身照常显示；第 3 张卡说明行同理。
> **强度为 0 或缺失时**：第 3 张卡说明行写 `--`（灰字）。

2. **要点列表** `.point-list`（12.5px，4 条；`**…**` 表示加粗，加粗文字在正文里是绿色 `#00b42a`）：
   1. 本月碳排放量 `<strong>{cur}</strong>` 万tCO₂，`{环比上升|下降 x%}`，`{同比上升|下降 y%}`。
   2. 单位产品碳排放强度 `<strong>{curIntensity}</strong>` tCO₂/t，`{环比上升|下降 x%}`，`{同比上升|下降 y%}`。
   3. 本月产品产量 `<strong>{output}</strong>` 万t（按「本月排放量 ÷ 本月强度」推算）。
   4. 年累计排放量 `<strong>{cum}</strong>` 万tCO₂，按当前进度推演全年约 `{cum ÷ month × 12}` 万tCO₂。
   > 「环比上升/下降」按百分比符号选择：`≥0` 用「上升」、`<0` 用「下降」；数值取绝对值、保留 2 位小数并带 `%`。
   > **百分比不可计算时（分母为 0 或 `month = 1`）**：该片段整句替换为「环比不适用」/「本月为年度首月，无上月基数」/「上年同期基数无效」，**不要把 `--` 塞进「环比下降 --%」这种句式**。

**(5) 一、月度排放概况**（`id="sec-1"`）

1. 引导段 `.brief-p`：
   「本月为 `{MONTH_CN}`，企业碳排放量 `{cur}` 万tCO₂，单位产品碳排放强度 `{curIntensity}` tCO₂/t，对应产品产量 `{output}` 万t。与上月（`{PREV_LABEL}`）及上年同期（`{YOY_CN}`）对比如下表。」
   > `{PREV_LABEL}` = 上月标签；**`month = 1` 时为「无上月基数」**（不得拼成「2025年0月」）。
2. **月度排放对比表**：表题行 `.table-caption` 左「月度排放对比表」、右单位「排放量：万tCO₂；强度：tCO₂/t；产量：万t」。6 列 **3 行**：

| 列   | 指标        | 本月（{MONTH_CN}） | 上月（{PREV_LABEL}）   | 环比                              | 上年同期（{YOY_CN}）   | 同比                              |
| --- | --------- | -------------- | --------------- | ------------------------------- | ---------------- | ------------------------------- |
| 行 1 | 碳排放量      | `{cur}`（`.is-self` 橙底加粗） | `{prev}`        | `{signed(momEmissionPct,2,'%')}` class=`deltaCls(momEmissionPct)` | `{yoy}`          | `{signed(yoyEmissionPct,2,'%')}` class=`deltaCls(yoyEmissionPct)` |
| 行 2 | 单位产品碳排放强度 | `{curIntensity}`（4 位，`.is-self`） | `{prevIntensity}`（4 位） | `{signed(momIntensityPct,2,'%')}` class=`deltaCls(momIntensityPct)` | `{yoyIntensity}`（4 位） | `{signed(yoyIntensityPct,2,'%')}` class=`deltaCls(yoyIntensityPct)` |
| 行 3 | 产品产量      | `{output}`（2 位，`.is-self`） | `{prevOutput}`（2 位） | `{signed(pctOf(output,prevOutput),2,'%')}` class=`deltaCls(同左)` | `{yoyOutput}`（2 位） | `{signed(pctOf(output,yoyOutput),2,'%')}` class=`deltaCls(同左)` |

   - 三行的「产品产量」全部是**派生量**：`round4(对应期排放量 ÷ 对应期强度)`；强度为 0 或缺失写 `--`。
   - 任一行「环比/同比」不可计算（分母为 0 或 `month = 1`）时写 `--`，**不改变表格结构**。
   表注 `.btable-note`：「注：环比 =（本月 − 上月）÷ 上月 × 100%；同比 =（本月 − 上年同期）÷ 上年同期 × 100%；产品产量由「排放量 ÷ 单位产品碳排放强度」推算（保留 4 位小数），不是独立台账数据。**本月为年度首月，无上月基数，环比相关一律为 `--`。**（此句仅在 `month = 1` 时输出）」
3. **对比条形图**（`cmpBars`，规格见 2.6 图 A），图题「（图）本月 / 上月 / 上年同期碳排放量对比」。

**(6) 二、月度趋势回顾**（`id="sec-2"`）

1. 引导段 `.brief-p`：
   「下图为 `{year}` 年 1~12 月碳排放量走势（橙点为当前月 `{month}` 月）。全年度各月排放量介于 `{min(volume.cur)}` ~ `{max(volume.cur)}` 万tCO₂ 之间。」
   > **`volume.cur` 全为 0 时**，引导段改写为：「下图为 `{year}` 年 1~12 月碳排放量走势（橙点为当前月 `{month}` 月）。本期未提供逐月排放量数据，趋势暂不可绘制。」
2. **12 月折线图**（`lineChart`，纯 SVG，规格见 2.6 图 B），图题「（图）`{year}` 年逐月碳排放量走势（万tCO₂）」。**全零序列时进入"无数据态"**：不画折线，图框内居中一行灰字「本期暂无数据」（见 2.6）。
3. **要点列表** 3 条：
   1. 本月排放量 `{cur}` 万tCO₂，在全年逐月序列中位列第 `{rank}` 位。
   2. 全年排放量最高月为 `{maxMonth}` 月（`{max}` 万tCO₂），最低月为 `{minMonth}` 月（`{min}` 万tCO₂）。
   3. 月度间排放量差异主要来自产品产量的季节波动；单位产品碳排放强度全年保持在 `{min(intensity.cur)}` ~ `{max(intensity.cur)}` tCO₂/t 区间。
   > `{rank}` = 把 12 个月的 `volume.cur` 按降序排序后，当前月所在名次（1 基）。`{maxMonth}`/`{minMonth}` 取最大值/最小值的下标 +1（并列取第一个）。

**(7) 三、本月工作建议**（`id="sec-3"`，`<ol class="advice-list">`，4 条，文案**逐字**如下，变量代入数值）

1. `<strong>紧盯强度指标：</strong>`本月单位产品碳排放强度 `{curIntensity}` tCO₂/t，`{环比上升|下降 x%}`，建议将强度纳入月度绩效考核，防止反弹。
2. `<strong>分析排放波动：</strong>`本月排放量 `{环比上升|下降 x%}`、`{同比上升|下降 y%}`，建议对照《碳排放差异分析报告》核查产量与强度各自的贡献，定位波动主因。
3. `<strong>推进能效降碳：</strong>`聚焦燃料替代、余热余压回收与绿电消纳，持续压降单位产品碳排放强度，从源头减少排放对产量的依赖。
4. `<strong>完善计量台账：</strong>`按月核对活动数据与排放因子，确保月度排放量、产品产量与强度三项数据可追溯、可核证，为年度履约与核查打好基础。

> 第 1、2 条里的百分比片段在不可计算时整句替换为「环比不适用」/「同比不适用」，**不要输出「环比下降 --%」**。

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

**(3) 本期 / 基准取值与派生**：

```javascript
var cur  = round2(VOL_CUR[M - 1]);                     // 本月排放量
var prev = HAS_PREV ? round2(VOL_CUR[PM - 1]) : null;  // 上月排放量（M = 1 → --）
var yoy  = round2(VOL_PREV[M - 1]);                    // 上年同期排放量

// ⚠️ 强度是 4 位小数，必须用 round4 —— 用 round2 会把 0.7655 抹成 0.77
var curIntensity  = round4(INT_CUR[M - 1]);
var prevIntensity = HAS_PREV ? round4(INT_CUR[PM - 1]) : null;
var yoyIntensity  = round4(INT_PREV[M - 1]);

// 产品产量 = 排放量 ÷ 强度（唯一算法；强度 ≤ 0 → --，不做替代推算）
var output     = (curIntensity  > 0) ? round4(cur  / curIntensity)  : null;
var prevOutput = (prevIntensity > 0) ? round4(prev / prevIntensity) : null;
var yoyOutput  = (yoyIntensity  > 0) ? round4(yoy  / yoyIntensity)  : null;

// 年累计（1~M 月求和；入参给 0 就是 0）
var cum = round2(VOL_CUR.slice(0, M).reduce(function (a, b) { return a + b; }, 0));
var annualProjected = round2(cum / M * 12);            // 全年推演

// 环比 / 同比百分比：分母必须 > 0，否则 null（渲染为 --）
function pctOf(a, b) { return (b == null || !(b > 0)) ? null : round2((a - b) / b * 100); }
var momEmissionPct  = pctOf(cur, prev);                // M = 1 时 prev 为 null → --
var yoyEmissionPct  = pctOf(cur, yoy);
var momIntensityPct = pctOf(curIntensity, prevIntensity);
var yoyIntensityPct = pctOf(curIntensity, yoyIntensity);
var momEmissionDiff = (prev == null) ? null : round2(cur - prev);
var yoyEmissionDiff = round2(cur - yoy);
```

**(4) 位置派生**（趋势回顾的要点用）：

```
rank     = 把 VOL_CUR 按降序排序后，下标 M−1 所在的名次（1 基；并列取第一个）
maxMonth = VOL_CUR 最大值下标 + 1 ；minMonth = VOL_CUR 最小值下标 + 1
```

**(5) 数值格式**：排放量 2 位小数 + 千分位；**强度 4 位小数**；产量 2 位小数；百分数 2 位小数。
单位统一：**排放量 = 万tCO₂、强度 = tCO₂/t、产量 = 万t**。

**(6) 零值与缺值处理（除零保护，必须实现）**

`emission` 整体缺失、或其子数组全为 0，都属**合法输入**，报告须正常渲染，不得报错、不得留空、不得填数：

| 情形 | 正确输出 | 错误输出（禁止） |
| --- | --- | --- |
| `volume.cur` 全为 0 | 本月排放量 `0.00`、年累计 `0.00`、环比/同比变化 `0.00`；对比条形图三条 0 宽条 | 为了"报告好看"自动编一组正常数据 |
| `intensity.cur` 某月为 0（或负） | 该月强度显示 `0.0000`（数值序列零兜底），**该月产品产量 `--`**（除零保护）；其余月份照常 | 把产量算成 `Infinity` / `NaN` |
| 环比分母（上月排放量 / 上月强度）为 0 | 环比 `--` | `NaN` / `∞` |
| 同比分母（上年同期排放量 / 强度）为 0 | 同比 `--` | `NaN` / `∞` |
| `month = 1` | 本月、年累计、强度、产量照常；**所有环比相关一律 `--`**，上月标签写「无上月基数」，趋势图只有 1 月一个实点 | 拿上一年 12 月当"上月"，或把上月写成「2025年0月」 |
| `volume.cur` 全为 0 时的折线图 | 进入**无数据态**：不画折线，图框内居中一行灰字「本期暂无数据」 | 画一条贴轴直线却不说明无数据 |
| 数组长度 < 12 | 缺失位按 `0` 处理 | 用最后一个已有值向后外推 |

> 实现提示：判断顺序必须是「**先判存在性与零值 → 再算派生量 → 最后格式化**」。格式化函数遇到 `null` / `NaN` / `Infinity` 必须返回 `--`，不得输出 `0.00` 或 `∞`；同时把 `-0` 归一化为 `0`（否则会显示成「-0.0」）。

**声明：本节是所有数字的唯一来源，生成时不要另编数据。**

**(7) 校验参考**（用来自检；若你的结果与下表不符，说明取数下标或派生公式被改动了）：

| 入参 companyName=河南安钢周口钢铁有限责任公司 | `month=9`（year=2026） | `month=1`（year=2026） |
| --------------------------------- | ------------------ | ------------------ |
| 本月标签 `MONTH_CN` / 上月 `PREV_LABEL` / 同期 `YOY_CN` | 2026年9月 / 2026年8月 / 2025年9月 | 2026年1月 / **无上月基数** / 2025年1月 |
| 本月碳排放量 `cur`（万tCO₂） | 25.76 | 26.84 |
| 上月排放量 `prev` | 26.90 | `--` |
| 上年同期排放量 `yoy` | 26.65 | 27.79 |
| 环比 `momEmissionPct` / 同比 `yoyEmissionPct`（%） | −4.24 / −3.34 | `--` / −3.42 |
| 本月强度 `curIntensity` / 上月强度（tCO₂/t） | 0.7655 / 0.7662 | 0.7605 / `--` |
| 上年同期强度 `yoyIntensity` | 0.7747 | 0.7696 |
| 强度环比 / 强度同比（%） | −0.09 / −1.19 | `--` / −1.18 |
| 产品产量 `output` / 上月 / 上年同期（万t） | 33.65 / 35.11 / 34.40 | 35.29 / `--` / 36.11 |
| 产量环比 / 产量同比（%） | −4.15 / −2.18 | `--` / −2.26 |
| 环比排放变化 / 同比排放变化（万tCO₂） | −1.14 / −0.89 | `--` / −0.95 |
| 年累计 `cum` / 全年推演（万tCO₂） | 236.07 / 314.76 | 26.84 / 322.08 |
| 趋势图：本月排名 / 最高月 / 最低月 | 第 11 位 / 3 月 27.15 / 2 月 24.62 | 第 3 位 / 3 月 27.15 / 2 月 24.62 |
| `volume.cur` 最小值 ~ 最大值 | 24.62 ~ 27.15 | 同左 |
| `intensity.cur` 最小值 ~ 最大值 | 0.7573 ~ 0.7663 | 同左 |

> **基准随 `month` 变化**：上表只对应该套入参。换 `month` 必须按 2.5(3) 重算，不得沿用。

### 2.6 图表规格

本报告共 **2 种图**：1 种纯 HTML/CSS 横向条形图（不用 SVG、不用图表库）+ 1 种纯 SVG 折线图（不用图表库）。
统一容器 `.chart-box`（白底、1px 边框 `#e8ebef`、圆角 6px、padding `12px 14px 6px`）；图题 `.chart-caption`（居中 12.5px 灰，位于图框**下方**，上下间距 `4px 0 16px`）。

**图 A：本月/上月/上年同期对比图（`cmpBars`）——最大值归一**

- 容器 `.hbars`；每行 `.hbar-row`（flex、gap 10px、上下 margin 7px、12.5px）= 名称标签（宽 150px、**右对齐**）→ 轨道（`flex:1`、高 16px、底 `#f2f4f7`、圆角 3px、`overflow:hidden`）→ 数值（宽 150px、tabular-nums）。
- 条宽 = `value ÷ 行内最大值 × 100%`，**下限 0.5%**；数值格式 = `fmt(value, 2) + ' 万tCO₂'`。值为 `null` 时条宽 0、数值显示 `--`。
- 固定 3 行，顺序与配色不可变：

| # | 行标签              | 取值        | 条色        | 特殊               |
| - | ---------------- | --------- | --------- | ---------------- |
| 1 | 本月（{MONTH_CN}）   | `cur`     | `#ff7d00` | 加 `.is-self`（名称与数值加粗、色 `#b25f00`） |
| 2 | 上月（{PREV_LABEL}） | `prev`    | `#00b42a` | —                |
| 3 | 上年同期（{YOY_CN}）   | `yoy`     | `#165dff` | —                |

> **`month = 1` 时**第 2 行的标签为「上月（无上月基数）」，数值显示 `--`、条宽 0——不要把它画成上一年 12 月的值。

**图 B：{year} 年逐月碳排放量走势（`lineChart`）——纯 SVG**

- 画布 `viewBox="0 0 760 240"`，`preserveAspectRatio="xMidYMid meet"`，外边距 `PL=52, PR=18, PT=18, PB=34`。
- **纵轴（Y）**：`min/max` 取自 12 个月排放量，向上/下各留 `span × 0.15` 余量（`span = max − min`，为 0 时取 1）；画 5 条水平网格线（`g = 0..4`，值 = `min + range × g / 4`），线色 `#eef1f4`、宽 1；刻度文字在左侧 `x = PL − 8`、10px `#98a1ab`、`text-anchor="end"`、`toFixed(1)`。
- **横轴（X）**：12 个刻度，`X(i) = PL + iw × i / 11`；标签 `1月`…`12月`，10px `#98a1ab`，位于 `y = H − 12`。
- **折线**：`<polyline>`，`fill="none"`、`stroke="#00b42a"`、`stroke-width="2.2"`、`stroke-linejoin="round"`。
- **数据点**：每月一个 `<circle>`。当前月（`i === M−1`）半径 5、填充 `#ff7d00`、描边 `#ff7d00`，并在点上方 `y − 12` 处标数值（11px、`#b25f00`、700、居中、2 位小数）；其余月份半径 3、填充 `#fff`、描边 `#00b42a`、宽 2。
- 纵轴**不要求从 0 起**，按数据范围自适应即可（这是原型行为，不要改成 0 起）。
- **无数据态**：当 `volume.cur` 12 个元素**全为 0** 时，**不画折线、不画网格与刻度**，图框内居中输出一行灰字「本期暂无数据」（13px `#98a1ab`，垂直居中，占位高度 150px）。这是"该期确实没有排放数据"的正确呈现，不要改画成贴轴直线。

### 2.7 表格规格

- 统一 `.btable`：宽 100%、`border-collapse: collapse`、12.5px；单元格 1px 边框 `#e3e7ec`、padding `6px 8px`、居中、`tabular-nums`；表头底 `#e9f7ee`、600 字重；斑马纹偶数行底 `#fafcfb`；`<tfoot>` 行底 `#f4fbf6`、600 字重。
- 语义色 class：`.is-pos` → `#d4380d`（红，排放上升/不利）；`.is-neg` → `#2ba471`（绿，排放下降/有利）；`.is-self` → 底 `#fff7e8` 加粗（本月列）。
- 表题行 `.table-caption`（左表名 13px `#333` + 右单位 12px `#8a9199`）；表注 `.btable-note`（12px `#98a1ab`）。
- 本报告共 **1 张表**：
  1. **月度排放对比表**：6 列 **3 行**（碳排放量 / 单位产品碳排放强度 / 产品产量），列定义见 2.4(5)。**没有排放源明细表**（排放源数据拿不到，见「数据可得性说明」）。

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
- 不要出现行业特定字眼（高炉 / 烧结 / 转炉 / 炼铁 / 轧钢 / 熟料 / 机组 / 电解槽等）——本报表只做企业层级月度口径，对各类企业通用。
- **不要出现排放源结构相关内容**：不写「排放结构分析」「化石燃料燃烧」「工业生产过程」「外购电力」「外购热力」「直接排放占比」「间接排放占比」「范围一 / 范围二」，也不画排放源结构条形图、不做排放源明细表——这类数据在入参里不存在。章节固定为 **摘要 + 一~三章**。
- **不要引入本报表没有的企业数据**：产品产量台账、逐日排放量、工序级排放量、碳交易数据（成交量 / 成交均价 / 成交金额 / 持仓 / 成交明细 / 交易所行情）一律不出现。产品产量只作为**派生量**出现（= 排放量 ÷ 强度），不得写成年台账口径。
- **不要给入参兜底**：`emission.*` 给 `0` 就显示 `0`；缺位按 `0` 处理。**严禁**用行业均值、相邻期插值、等比放大、联网检索"补"一组排放量或强度，也严禁拿别期数据顶上。
- **不要把 `--` 塞进原句式的数字位**：不可计算时整句改写（如「环比不适用」「本月为年度首月，无上月基数」），不要生成「环比下降 --%」「约 -- 万tCO₂」这类句子。
- **不要混淆红绿语义**：本报告是碳排放维度，**排放上升 = 不利 = 红（`.is-pos` / `#d4380d`）**，**排放下降 = 有利 = 绿（`.is-neg` / `#2ba471`）**。不要照搬「碳资产 / 碳交易」那种「高 = 绿」的映射。
- 不要引入图表库（ECharts / Chart.js / Highcharts）；横向条形图用纯 HTML/CSS，折线图用纯 SVG。
- 不要使用 emoji。
- 不要「生成报告」「查看报告」「导出 Excel」「打印」「删除」等按钮；工具条只有返回链接和「下载报告（PDF）」。
- 不要「功能建设中 / 敬请期待」等占位文字（本页是成品报告页）。
- 不要自由发挥「美化」——色值、字号、间距、文案、图表配色一律以本文档为准。
- **不要交付多个文件**见文首；页面只交付**一个** HTML 文件，库走 CDN；全篇无 emoji、无图表库、无外部图片。

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

**月度碳排放量的量级参照**：先看企业在行业里的规模，再由「月排放量 ÷ 月强度 = 月产品产量」反推一个**产品产量**，判断这个产量是否符合该企业的产能——
本项目示例：月排放 25 ~ 27 万tCO₂、强度 ≈ 0.766 tCO₂/t → 月产品产量 ≈ 33 ~ 35 万t（年 ≈ 300 ~ 320 万tCO₂、产量 ≈ 400 万t 级）。
若反推出的产量明显超出企业产能（差一个数量级），说明入参量级可疑，**应如实呈现并在文案中提示存疑**，**不要**替它改成"合理值"。

> ⚠️ **不要把强度当分母之外的数据用**：强度既是一个展示指标，也是「产量 = 排放量 ÷ 强度」的分母；**为 0（或负）时产量写 `--`**。
> **为什么本报表不收产品产量与排放源结构**：产量台账、排放源拆解（化石燃料燃烧 / 生产过程 / 外购电力 / 外购热力、直接/间接占比）在实际业务中取不到；产量可由「排放量 ÷ 强度」稳定派生，排放源拆解则没有替代口径，故整章删除而不是"填 `--`"。

## 附录 B · 兜底生成规则

> **适用范围：无。本报表全篇为 L1 入参直取，不存在任何兜底生成。**
> 排放量、强度、以及由二者派生的产品产量，**一律不兜底、不推算、不检索替换**。

**B1 三个量各自的合法来源**

| 量 | 合法来源 | 无效时 |
| --- | --- | --- |
| 本月/上月/上年同期排放量 | 入参 `volume.cur` / `volume.prev` | `--` |
| 本月/上月/上年同期强度 | 入参 `intensity.cur` / `intensity.prev` | `--` |
| 产品产量 | **派生**：排放量 ÷ 强度（round4） | 强度 ≤ 0 → `--` |

**B2 派生量必须用唯一算法**

- 产品产量**只能**由「排放量 ÷ 强度」得到，**不得**由年产量按月份比例拆分、不得用行业平均产量顶替、**不得**反向修正排放量或强度。
- 年累计排放量 = `volume.cur` 前 `month` 个元素求和（不是乘 12、不是取 `prev`）。

**B3 本企业数据缺失或为 0 时的降级**

- `volume.cur` 全 0 → 排放量相关全部显示 `0.00`，趋势折线图进入「本期暂无数据」态，**这是正确输出**。
- `intensity.cur` 为 0 → 强度显示 `0.0000`、产量 `--`、强度环比/同比 `--`。
- 环比分母为 0 → 环比 `--`；同比分母为 0 → 同比 `--`。
- `month = 1` → 环比整套 `--`（见 2.4(4)/2.4(5)），**其余照常**。

## 附录 C · 期望值（自检用）

### C1 正常入参

入参为「一、入参」给出的那份（`month = 9`、`year = 2026`）。期望值如下（**必须逐一吻合**）：

| 位置 | 期望值 |
| --- | --- |
| 卡 1 本月碳排放量 | `25.76` 万tCO₂；说明行「环比 -4.24 %」 |
| 卡 2 年累计排放量 | `236.07` 万tCO₂；说明行「截至 2026年9月」 |
| 卡 3 单位产品碳排放强度 | `0.7655` tCO₂/t；说明行「环比 -0.09 %」 |
| 卡 4 本月产品产量 | `33.65` 万t；说明行「按「排放量 ÷ 强度」推算」 |
| 卡 5 环比排放变化 | `-1.14` 万tCO₂；说明行「环比 -4.24 %」 |
| 卡 6 同比排放变化 | `-0.89` 万tCO₂；说明行「环比 -3.34 %」 |
| 对比表 · 碳排放量行 | 25.76 ｜ 26.90 ｜ -4.24 % ｜ 26.65 ｜ -3.34 % |
| 对比表 · 强度行 | 0.7655 ｜ 0.7662 ｜ -0.09 % ｜ 0.7747 ｜ -1.19 % |
| 对比表 · 产品产量行 | 33.65 ｜ 35.11 ｜ -4.15 % ｜ 34.40 ｜ -2.18 % |
| 对比图三行数值 | 本月 25.76 / 上月 26.90 / 上年同期 26.65（单位 万tCO₂） |
| 趋势要点 1 | 本月排放量 25.76 万tCO₂，位列第 **11** 位 |
| 趋势要点 2 | 最高月 **3 月（27.15）**，最低月 **2 月（24.62）** |
| 趋势要点 3 | 强度全年区间 0.7573 ~ 0.7663 tCO₂/t |
| 目录 | 4 条：摘要 · 本月核心指标概览 / 一、月度排放概况 / 二、月度趋势回顾 / 三、本月工作建议 |

> `month = 1` 时的期望值见 2.5(7) 的右列（环比全 `--`、上月标签「无上月基数」、第 3 位）。

### C2 全零入参（`emission` 四组数组全为 0）

| 位置 | 期望结果 |
| --- | --- |
| 卡 1 本月碳排放量 | `0.00` 万tCO₂，说明行「环比 -」→ **不可计算时写「--」** |
| 卡 2 年累计排放量 | `0.00` 万tCO₂ |
| 卡 3 单位产品碳排放强度 | `0.0000` tCO₂/t |
| 卡 4 本月产品产量 | `--`（强度为 0，除零保护） |
| 卡 5 / 卡 6 环比、同比排放变化 | `0.00` / `0.00` 万tCO₂，说明行 `--` |
| 对比表 | 三行本企业与基准值均为 `0.00` / `0.0000`，环比与同比列全 `--` |
| 对比条形图 | 三条 0 宽条，数值 `0.00` |
| 趋势折线图 | **不画折线**，图框内居中一行灰字「本期暂无数据」 |
| 引导段与要点 | 整段按"全 0 / 无数据"措辞输出，趋势引导段改为「本期未提供逐月排放量数据，趋势暂不可绘制。」 |

> **判定标准：出现任何一个非 0 的排放量或强度数字，即为不合格。**

### C3 删掉整个 `emission` 字段

结果应与 **C2 完全一致**：正常渲染、不报错、不填数。

## 附录 D · 交付前自检清单

1. 用 C1 入参生成后，**逐项对照附录 C1**——6 张 KPI 卡、对比表 3 行、对比图、趋势要点、目录都吻合。
2. 全文搜 `NaN`、`undefined`、`Infinity`、`∞`，**必须 0 命中**。
3. 全文搜 `示例`、`演示`、`模拟`、`占位`、`待补充`——**必须 0 命中**。
4. 目录 4 条锚点与正文标题一一对应，点击可定位。
5. **【口径必测】全文搜 `排放源`、`化石燃料`、`外购电力`、`外购热力`、`直接排放`、`间接排放`、`范围一`、`范围二`——必须 0 命中**（数据可得性收缩的验收项）。
6. 产品产量的三处（卡 4、对比表行 3、要点 3）数值**完全一致**，且等于 `round4(排放量 ÷ 强度)`。
7. 年累计 = `volume.cur` 前 `month` 项之和（逐值核对，不要用乘 12 的结果）。
8. 强度显示**恒为 4 位小数**（不得出现 `0.77`、`0.765` 这类位数不足的输出）。
9. 同一入参渲染两次，结果**逐字符一致**。
10. **【零兜底必测】用 C2（全零入参）跑一遍**，逐项对照附录 C2。
11. **【必测】把 `emission` 整个字段删掉再跑一遍**，结果应与 C2 一致。
12. **【必测】用 `month = 1` 跑一遍**：环比相关全部 `--`、「上月」标签为「无上月基数」、**不出现「2025年0月」**、趋势图只有 1 月一个实点。
13. 把 `volume.cur` 改成明显偏大 / 偏小的值，确认排放量、年累计、产量、趋势图都随之变化且逻辑自洽。
14. 页面只交付**一个** HTML 文件，库走 CDN；全篇无 emoji、无图表库、无外部图片。
