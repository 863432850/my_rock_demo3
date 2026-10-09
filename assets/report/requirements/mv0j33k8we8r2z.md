# 碳排放半年度报告（查看报告页）· 界面复刻提示词

> **使用方法**：把本文档全文连同你的入参（见「一、入参」）一起发给 AI，即可生成一个与原型完全一致的「碳排放半年度报告」报告页。  
> 本文档是**自包含**的：不依赖任何源代码、截图或外部资料；所有文案、颜色、尺寸、计算规则均已逐字给出。  
> 同一份提示词同时兼容：**上半年 / 下半年**两种报告期、**任意年度**、**钢铁 / 发电 / 建材 / 化工**四个行业的名词切换。

---

> **数据口径（先读这条）**
>
> 1. **报告的每一个排放数值都只能来自入参 `emission`，一律不兜底。**
>    - 入参给 `0` 就显示 `0`；数组某位缺位按 `0` 处理，但**数组长度决定「该月是否已发生」**。
>    - **严禁**用行业经验值、相邻月插值、等比放大、联网检索来「补」任何一个排放量或强度。
>    - 「报告期累计单位产品碳排放强度」是**独立的入参标量**（`emission.halfIntensity`），**不得**由逐月强度做算术平均、也**不得**由排放量反推。
> 2. **数组长度契约**：`emission.volume.cur` 的**长度就是「入参年已发生到几月」的唯一依据**，全零也要写满长度（见「数组填写规则」）。
>    - 半年报告按 `half` 从数组里**切出 6 个月的切片**；切片内长度不足的月份，一律渲染为「未发生」占位行 `—`，**不计入合计、不参与占比、不参与折线连接**。
> 3. **数据可得性说明**：本报告**只做企业层级的月度排放量与强度**。以下数据在当前条件下**无法获取**，因此入参**不设**对应字段、正文也**没有**对应章节：
>    - 物料级明细（化石燃料各物料的消耗量 / 低位发热量 / 单位热值含碳量、过程排放各物料、含碳产品隐含排放）；
>    - 工序（生产线）级排放量与其物料构成；
>    - 排放量按「工序层级 / 掺烧自产二次能源的发电设施 / 其他」的构成拆分；
>    - 产品（粗钢等）产量。  
>      **不要自行补上这些内容**——这是本报告与前几版的关键区别。
> 4. 全篇禁止出现 `NaN`、`undefined`、`Infinity`、`∞`；也禁止出现「示例」「演示」「模拟」「占位」「待补充」等字样。
> 5. 本报告**不含**第六章、第七章，也**不含**任何「建议」「结论」小节；正文只有 3 个一级章节（见 2.4）。

---

## 一、入参（JSON）

```json
{
  "companyName": "安阳钢铁股份有限公司",
  "year": 2026,
  "half": 1,
  "emission": {
    "volume": {
      "cur":  [120.68, 117.83, 123.84, 121.65, 125.62, 121.41, 124.09, 124.21, 122.37],
      "prev": [123.92, 121.00, 127.16, 124.92, 128.99, 124.67, 127.43, 127.54, 125.65, 126.83, 124.82, 125.25]
    },
    "intensity": {
      "cur":  [2.0860, 2.0955, 2.0598, 2.0521, 2.0412, 2.0395, 2.0380, 2.0312, 2.0266],
      "prev": [2.1747, 2.1846, 2.1473, 2.1393, 2.1280, 2.1262, 2.1246, 2.1175, 2.1127, 2.1074, 2.1036, 2.0979]
    },
    "halfIntensity": {
      "h1": { "cur": 2.0618, "prev": 2.1495 },
      "h2": { "cur": 2.0319, "prev": 2.1183 }
    }
  }
}
```

### 入参字段说明

| 字段                          | 类型       | 必填    | 说明                                                                                    |
| --------------------------- | -------- | ----- | ------------------------------------------------------------------------------------- |
| `companyName`               | string   | 否     | 企业/主体全称，默认 `"安阳钢铁股份有限公司"`。用于：封面 H1、工具条标题、浏览器标签页标题、报告概述正文；**同时用于推断所属行业**（规则见下）         |
| `year`                      | int      | 否     | **入参年 = 数据所属年份**（`cur` 数组对应这一年，`prev` 数组对应 `year − 1`）。默认 `2026`。它同时出现在封面年月、数据期间与文件名里 |
| `half`                      | int      | 否     | `1` = 上半年（1—6 月），`2` = 下半年（7—12 月）；默认 `1`。决定从数组里切哪 6 个月                               |
| `emission`                  | object   | **是** | **碳排放数据块**（L1，零兜底）。整个对象缺失时按「无有效数据」处理                                                  |
| `emission.volume`           | object   | **是** | 逐月排放量（单位 **万tCO₂**）                                                                   |
| `emission.volume.cur`       | number[] | **是** | **入参年**的逐月排放量，2 位小数。**长度 = 该年已发生到几月**（见「数组填写规则」）                                      |
| `emission.volume.prev`      | number[] | 否     | **入参年的上一年**逐月排放量，同口径。仅用于同比；缺省或长度为 0 → 所有同比写 `--`                                      |
| `emission.intensity`        | object   | **是** | 逐月单位产品碳排放强度（钢铁/建材/化工为 `tCO₂/t`，发电为 `tCO₂/MWh`）                                        |
| `emission.intensity.cur`    | number[] | **是** | 入参年逐月强度，4 位小数，长度与 `volume.cur` 一致                                                     |
| `emission.intensity.prev`   | number[] | 否     | 上年同期逐月强度                                                                              |
| `emission.halfIntensity`    | object   | **是** | **报告期累计**单位产品碳排放强度（**标量**，不是逐月值）                                                      |
| `emission.halfIntensity.h1` | object   | 否     | 上半年：`{ "cur": 本期累计强度, "prev": 上年同期累计强度 }`；`half = 1` 时必填                              |
| `emission.halfIntensity.h2` | object   | 否     | 下半年：同上；`half = 2` 时必填                                                                 |

> **`halfIntensity` 的 `prev` 要按「与本期相同月数」取**：例如下半年本期只发生 7—9 月，`h2.prev` 就是**上年 7—9 月**的累计强度（不是上年整个下半年的累计强度）。

### 数组填写规则（7 条，必须遵守）

1. **长度 = 该年已发生到几月**，这是唯一依据。入参年只到 9 月 → `cur` 写 **9 个**元素；写满 12 个表示全年都有数据。
2. **全零也要写满长度**。某月排放量为 `0` 也要写 `0`（不能省略不写），否则该月会被当成「未发生」而显示为 `—`。
3. **严禁向后外推**：不要因为「后面几个月还没到」就复制前一个月的值填满 12 个；长度就是长度。
4. `cur` 与 `prev` 的**下标对齐**：`cur[i]` 与 `prev[i]` 都表示「第 i+1 月」。`prev` 建议写满 12 个（上年完整数据），同比只取**与本期已发生月份相同的下标**。
5. `intensity.cur` / `.prev` 的长度要与对应的 `volume` 数组一致；强度写 **4 位小数**。
6. 强度 `≤ 0` 在业务上不成立，视为该月无效（渲染 `--`），但**下标与长度仍要保留**，不能因为某月无效就把它从数组里删掉。
7. 数组直接写**数值数组**（不要写成 `"1,2,3"` 这样的字符串）。

### 入参示例：全零（零兜底）

```json
{
  "companyName": "安阳钢铁股份有限公司",
  "year": 2026,
  "half": 1,
  "emission": {
    "volume": { "cur": [0,0,0,0,0,0,0,0,0,0,0,0], "prev": [0,0,0,0,0,0,0,0,0,0,0,0] },
    "intensity": { "cur": [0,0,0,0,0,0,0,0,0,0,0,0], "prev": [0,0,0,0,0,0,0,0,0,0,0,0] },
    "halfIntensity": { "h1": { "cur": 0, "prev": 0 }, "h2": { "cur": 0, "prev": 0 } }
  }
}
```

这份入参下的**正确**结果见「附录 C · C2」——全部排放量显示 `0.00`（12 个 0 表示全年都有数据、只是值都是 0），强度显示 `--`。

### 入参示例：无有效数据（数组为空）

把 `volume.cur` / `volume.prev` 写成 `[]`（或整个 `emission` 字段不传），表示**报告期一个月都没发生**，全篇进入「无有效数据」态，见「附录 C · C3 / C4」。

### 行业推断规则（从 `companyName` 自动判断，没有单独的行业入参）

按下列优先级逐行扫描企业名称，**第一个命中关键词的行即确定行业**；一行内命中任一关键词即算命中；全部未命中时按**钢铁**兜底。

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

**行业推断只影响「产品名词与单位」四种文案**，不影响任何数值（数值全部来自入参）。映射表见 2.5.6。**禁止把任何钢铁专有名词写死，也禁止要求调用方额外传行业字段。**

### 入参带入规则

| JSON 字段                           | 影响位置                                                                          | 规则                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `companyName`                     | 封面 H1 第一行 / 工具条标题 / 浏览器标签页标题 / 报告概述正文 / 行业推断                                  | 封面拼接为「{companyName}（换行）碳排放半年度报告」；工具条标题为「{companyName}碳排放半年度报告（{YEAR} 年{halfName}）」；`document.title` = `碳排放半年度报告-{YEAR}H1` 或 `-{YEAR}H2` |
| `year`                            | 封面年月、封面「数据期间」、正文年号、下载文件名；**并决定取哪一年的数组**（`cur` 对应 `year`、`prev` 对应 `year − 1`） | 四位年份                                                                                                                                    |
| `half`                            | 封面年月（`1—6月` / `7—12月`）、数据期间、目录与章节标题、逐月表月份、折线图月份切片、下载文件名                       | `1` 或 `2`；非法值按 `1` 处理                                                                                                                   |
| `emission.volume.*`               | 摘要 KPI 卡 1（报告期累计）与卡 2（月均）、图 1、逐月表「碳排放量」列与占比列、要点                               | **L1 入参直取，零兜底**；数组长度决定「哪几个月已发生」                                                                                                         |
| `emission.intensity.*`            | 图 2、逐月表「单位{product}碳排放量」列                                                     | 逐月值；`≤ 0` 或缺失 → `--`                                                                                                                    |
| `emission.halfIntensity.h1 / .h2` | 摘要 KPI 卡 3（数值与同比）、逐月表合计行的强度列                                                  | L1 标量；`≤ 0` 或缺失 → `--`                                                                                                                  |

### 运行期入参来源（URL 查询参数）

页面读取 URL 查询参数决定**渲染哪一期报告**（数据本身仍来自上表的入参 JSON）：

```
?year=2026&half=1&company=安阳钢铁股份有限公司
```

- `year` / `half`：决定封面年月、数据期间、章节切片与文件名；不传时用入参 JSON 的示例值。
- `company`：覆盖 `companyName`。
- **逐月数组不走 URL**，一律由入参 JSON 提供。

---

## 二、任务

### 数据来源与真实性要求（先读）

本报告的数字分属三层，**不要笼统写成「数据来自企业台账」**：

**A. L1 入参直取（零兜底）—— 全部排放数值**

- `emission.volume.*` → 摘要 KPI 1/2、图 1、逐月表、要点。
- `emission.intensity.*` → 图 2、逐月表强度列。
- `emission.halfIntensity.*` → 摘要 KPI 3、逐月表合计行强度。
- **入参给 `0` 就写 `0`**；数组缺位按「该月未发生」；`≤ 0` 的强度按无效写 `--`。
- **严禁**用行业经验值、相邻月插值、等比放大、联网检索来「补」任何数值。详见 2.5(5)。

**B. L2 联网检索（可选，仅限非数值内容）**

- 如需在「报告概述」里补充企业所属行业与主营产品的背景说明，可按 `companyName` 检索公开信息。
- **检索结果不得引入任何排放数值、不得改写任何指标**；正文里凡是带数字的句子，数字必须能由入参复算出来。

**C. L3 兜底生成**

- 本报告**不设兜底数值层**。任何缺失一律按 `--` 或「未发生」呈现，**不得生成替代值**。
- 唯一的「本地表」是 2.5.6 的**行业名词映射**（产品名、产量单位、强度单位），它只改文案、不产生数值。

**D. 通用禁令**

- 不得出现与入参量级明显不符的常量（如入参给 120 万tCO₂，报告里不得出现「700 万tCO₂」）。
- 不得把某一家企业的公开排放数字直接套给入参企业。
- 不得写「数据待补充」「暂无数据」「（示例）」；一律按 2.5(5) 与附录 C 规定的措辞处理。

### 2.1 交付物

- **唯一交付物**：一个自包含的 HTML 文件，文件名 `碳排放半年度报告.html`。
- 所有 CSS 写在 `<style id="brief-style">` 内，所有 JS 写在 `<script>` 内，入参数据直接内嵌在 JS 常量中。
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
│  二、逐月排放与强度走势     → #sec-2                                     │
└───────────────────────────────────────────────────────────────────────┘
┌──────────────── .brief-page（纸面 3：正文） ────────────────────────────┐
│  ▎摘要 · 核心指标概览        (h1#sec-0)  3 张 KPI 卡 + 4 条要点          │
│  ▎一、报告概述             (h1#sec-1)  引言 + 3 行 kv 表 + （一）核算口径说明│
│  ▎二、逐月排放与强度走势    (h1#sec-2)  引言 + 图 1 + 图 2 + 逐月表 + 要点  │
└───────────────────────────────────────────────────────────────────────┘
```

**容器一致性（重要）**：三张纸面都是 `<div class="brief-page">`，修饰类（`brief-cover-wrap` / `brief-toc`）只追加、**不允许**单独覆盖 `width / margin / padding`。目录恰好 **3 条**、正文恰好 **3 个** `<h1 class="brief-h1">`（id 依次为 `sec-0` / `sec-1` / `sec-2`），章节数量、顺序、名称一字不差。


### 2.3 设计规格（完整 CSS，逐字使用）

主色为绿色 `#00b42a`。以下 CSS 逐字放入 `<style id="brief-style">`（其中 `.hbars`、`.formula-box`、`.advice-list` 三组样式本页用不到，保留无害）：

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

/* 横向条形图（纯 HTML/CSS；本页未使用，保留） */
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

/* 勾稽式（本页未使用，保留） */
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

**颜色语义（全篇统一，禁止反转）**：排放类数字的角标一律按**数值符号**着色——大于 0 用红 `#d4380d`（`.is-pos`）、小于 0 用绿 `#2ba471`（`.is-neg`）、等于 0 或无数据用灰 `#98a1ab`（`.is-flat`）。不按业务好坏做特殊调整。

**工具函数**（JS 中实现，行为必须一致）：

```js
function fmt(n, d) {
  if (n == null || !isFinite(n)) return '--';        // null / NaN / Infinity 一律 -> '--'
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function r2(n) { return Math.round(n * 100) / 100; }
function r4(n) { return Math.round(n * 10000) / 10000; }
function signed(n, d, unit) {                        // 正数带 + 号："+1.52 %"；-0 归一为 0
  if (n == null || !isFinite(n)) return '--';
  var v = (n === 0 ? 0 : n);
  return (v > 0 ? '+' : '') + fmt(v, d) + (unit ? ' ' + unit : '');
}
function deltaCls(n) { return (n == null || !isFinite(n)) ? 'is-flat' : (n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : 'is-flat')); }
function validPos(v) {                               // 强度/单位量：≤ 0 视为无效
  var n = Number(v);
  return (isFinite(n) && n > 0) ? r4(n) : null;
}
function yoyKpi(pct) { return (pct == null || isNaN(pct)) ? '同比 --' : '同比 ' + signed(pct, 2, '%'); }
function yoyPhrase(pct) {
  if (pct == null || isNaN(pct)) return '无上年同期数据，不计算同比';
  return '较上年同期' + (pct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(pct), 2) + '%';
}
```

> 注意 `signed()` 在单位前**保留一个空格**（`同比 -2.62 %`），这是原型行为，不要「顺手」去掉。
> `yoyKpi()` 在无上年数据时输出 `同比 --`（两个短横），**不要**输出 `同比 — %` 这种半截文案。

### 2.4 区块逐一规格

下文用占位符表示运行期取值：`{ORG}` = companyName；`{YEAR}` = year；`{halfName}` = `上半年`/`下半年`；`{PERIOD_CN}` = `{YEAR}年1—6月`（half=1）或 `{YEAR}年7—12月`（half=2）；`{RANGE}` = 数据期间（**精确到月**，上半年 `{YEAR}-01 至 {YEAR}-06`，下半年 `{YEAR}-07 至 {YEAR}-12`）；`{product}` / `{prodNoun}` / `{prodUnit}` / `{intUnit}` 等行业名词见 2.5.6。

#### 2.4.0 顶部工具条 `.brief-toolbar`

```html
<div class="brief-toolbar" id="brief-toolbar">
  <a class="bt-back" href="#">← 返回碳排放半年度报告</a>
  <span class="bt-title" id="bt-title">{ORG}碳排放半年度报告（{YEAR} 年{halfName}）</span>
  <div class="bt-actions">
    <button type="button" class="bt-btn" id="btn-download">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 21h16"/></svg>
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

封面**只有**这些元素：没有「核算边界」行、没有任何「锚点月/期末月/基准月」字样；数据期间**精确到月**（如 `数据期间：2026-01 至 2026-06`）。

#### 2.4.2 纸面 2 · 目录 `.brief-toc`

```html
<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>
  <li class="toc-l1"><a href="#sec-0">摘要 · 核心指标概览</a></li>
  <li class="toc-l1"><a href="#sec-1">一、报告概述</a></li>
  <li class="toc-l1"><a href="#sec-2">二、逐月排放与强度走势</a></li>
</ol></div>
```

恰好 **3 条**，名称一字不差，**没有**第三章及以后的任何条目。

#### 2.4.3 摘要 · 核心指标概览（`sec-0`）

`<h1 class="brief-h1" id="sec-0">摘要 · 核心指标概览</h1>` 之后是 **3 张 KPI 卡**（`.kpi-grid`，3 列网格，正好一行）+ **4 条要点**（`.point-list`）。

3 张 KPI 卡（第 1、3 张带 `.is-self` 橙色高亮，第 2 张为绿色普通卡）：

| # | 卡片类 | kpi-name | kpi-val | kpi-delta |
| --- | --- | --- | --- | --- |
| 1 | `kpi-card is-self` | `{halfName}累计排放量` | `fmt(totalEmission,2)` + `<small> 万tCO₂</small>` | `deltaCls(yoyEmissionPct)` + `yoyKpi(yoyEmissionPct)` |
| 2 | `kpi-card` | `月均排放量` | `fmt(avgEmission,2)` + `<small> 万tCO₂/月</small>` | `is-flat`，文案 `按 {availableCount} 个月平均` |
| 3 | `kpi-card is-self` | `单位{product}碳排放量` | `fmt(unitIntensity,4)` + `<small> {intUnit}</small>` | `deltaCls(yoyIntensityPct)` + `yoyKpi(yoyIntensityPct)` |

4 条要点（`.point-list`，`<strong>` 包数字）：

```html
<li>{PERIOD_CN}企业层级累计碳排放量 <strong>{fmt(totalEmission,2)}</strong> 万tCO₂，{yoyPhrase(yoyEmissionPct)}。</li>
<li>单位{product}碳排放量 <strong>{fmt(unitIntensity,4)}</strong> {intUnit}，{yoyPhrase(yoyIntensityPct)}{有同比时接「，是本期减排成效的核心体现。」；无同比时接「。」}</li>
<li>逐月排放量介于 {fmt(minM.emission,2)} ~ {fmt(maxM.emission,2)} 万tCO₂ 之间，最高月为 {maxM.label}，最低月为 {minM.label}。</li>
<li>报告期共 <strong>{availableCount}</strong> 个月已发生，{trendWord}，逐月数据以企业月度碳排放核算台账为准。</li>
```

- `minM` / `maxM` 只在**已发生月份**里取（按排放量升/降序）；`availableCount = 0` 时第 3、4 条改写为：
  ```html
  <li>本期未提供逐月排放数据，排放量区间与高低月份暂不可判。</li>
  <li>报告期共 0 个月已发生，数据补齐后即可生成逐月走势分析。</li>
  ```
- `trendWord` 的取值：取报告期**已发生且强度有效**的月份，比较首月与末月强度——末月小于首月 → `强度总体呈下降走势`；大于 → `强度总体呈上升走势`；相等 → `强度总体保持平稳`；有效点不足 2 个 → `强度走势暂不可判`。

钢铁 2026 上半年渲染效果（供比对）：

> - 2026年1—6月企业层级累计碳排放量 **731.03** 万tCO₂，较上年同期下降 2.62%。
> - 单位粗钢碳排放量 **2.0618** tCO₂/t，较上年同期下降 4.08%，是本期减排成效的核心体现。
> - 逐月排放量介于 117.83 ~ 125.62 万tCO₂ 之间，最高月为 5月，最低月为 2月。
> - 报告期共 **6** 个月已发生，强度总体呈下降走势，逐月数据以企业月度碳排放核算台账为准。

#### 2.4.4 一、报告概述（`sec-1`）

```html
<h1 class="brief-h1" id="sec-1">一、报告概述</h1>
<p class="brief-p">本报告为 {ORG} {YEAR} 年{halfName}碳排放核算结果，核算边界为企业层级，报告期 {RANGE}，共 {availableCount} 个月。核算基准信息如下。</p>
```

接一张 `.kv-table`，**恰好 3 行**（不得增删行）：

| th（左列，宽 132px） | td |
| --- | --- |
| 核算主体 | `{ORG}` |
| 核算边界 | `企业层级：法人边界内的化石燃料燃烧排放、过程排放与含碳产品隐含排放` |
| 报告期 | `{PERIOD_CN}（{RANGE}）` |

然后是小节标题与 3 条口径说明：

```html
<div class="brief-h2">（一）核算口径说明</div>
<ul class="point-list">
  <li><strong>报告期排放量</strong>为报告期内各月实际排放量的累计，只统计<strong>已发生月份</strong>；报告期尚未发生的月份不计入合计，也不参与占比。</li>
  <li><strong>单位{product}碳排放量</strong>按报告期累计口径给出，由企业报告期核算结果直接获得，<strong>不是各月强度的算术平均</strong>。</li>
  <li>逐月排放量与强度均取企业月度碳排放核算台账数据；未经第三方核查的月度数据不作为对外披露口径。</li>
</ul>
```

> 「核算边界」那一行是**核算口径说明**（怎么算的），**不是**「报告里列出了这些明细」的承诺——正文里没有物料级明细表，不要因为看到这几个词就自行补章节。

#### 2.4.5 二、逐月排放与强度走势（`sec-2`）

```html
<h1 class="brief-h1" id="sec-2">二、逐月排放与强度走势</h1>
<p class="brief-p">{PERIOD_CN}逐月排放量介于 {fmt(minM.emission,2)} ~ {fmt(maxM.emission,2)} 万tCO₂ 之间，单位{product}碳排放量介于 {fmt(bestInt.intensity,4)} ~ {fmt(worstInt.intensity,4)} {intUnit} 之间，整体呈<strong>排放量随生产负荷波动</strong>的走势，{trendWord}。</p>
```

- `minM / maxM / bestInt / worstInt` 只在**已发生月份**中取（`bestInt` / `worstInt` 还要强度有效）。
- `availableCount = 0` 时引言段改写为：「本期未提供逐月排放数据，暂不作走势分析。逐月数据补齐后即可自动生成排放量与强度走势图。」

**图 1**：折线图（纯 SVG，规格见 2.6），数据 = 各月排放量（万tCO₂，刻度 1 位小数），图题 `（图 1）{PERIOD_CN}逐月碳排放量走势（万tCO₂）`。

**图 2**：折线图，数据 = 各月单位产品碳排放强度（刻度 4 位小数），图题 `（图 2）{PERIOD_CN}逐月单位{product}碳排放量走势（{intUnit}）`。

**表 1 · 逐月生产与排放数据表**（`.btable`，**4 列**）：caption `<span>逐月生产与排放数据表（{PERIOD_CN}）</span><span class="unit">强度：{intUnit}；排放量：万tCO₂</span>`，表头：

```html
<th>月份</th><th>单位{product}碳排放量（{intUnit}）</th><th>碳排放量（万tCO₂）</th><th>占报告期累计比重</th>
```

- 已发生月份行：月份（`1月`…`12月`）｜`fmt(intensity,4)`（无效时 `--`）｜`fmt(emission,2)`｜`totalEmission > 0 ? fmt(emission/totalEmission*100,2) + '%' : '--'`。
- **未发生月份行（关键规则）**：`has:false` 的月份输出占位行 `<tr class="is-empty"><td>{label}</td><td>—</td><td>—</td><td>—</td></tr>`，灰字，**不计入合计、不参与占比**。例如 2026 年下半年的 10月 / 11月 / 12月。
- 合计行放 `<tfoot>`：

```html
<tfoot><tr><td>合计</td><td>{fmt(unitIntensity,4)}</td><td>{fmt(totalEmission,2)}</td><td>{totalEmission > 0 ? '100.00%' : '--'}</td></tr></tfoot>
```

- 表后注：

```html
<div class="btable-note">注：合计栏的「单位{product}碳排放量」为报告期累计口径，非各月强度的算术平均；「占报告期累计比重」按各月排放量 ÷ 报告期累计排放量计算。</div>
```

**3 条要点**（`firstAvail` = 首个已发生且强度有效的月，`lastAvail` = 最后一个已发生且强度有效的月；若有效点不足 2 个，只输出一条兜底句）：

```html
<ul class="point-list">
  <li>排放量最高月为 {maxM.label}（{fmt(maxM.emission,2)} 万tCO₂），最低月为 {minM.label}（{fmt(minM.emission,2)} 万tCO₂），月度波动主要来自生产负荷变化。</li>
  <li>单位{product}碳排放量由 {firstAvail.label} 的 {fmt(firstAvail.intensity,4)} {intUnit} 变为 {lastAvail.label} 的 {fmt(lastAvail.intensity,4)} {intUnit}，累计{下降|上升} {绝对值}{%}。</li>
  <li>强度最优月为 {bestInt.label}（{fmt(bestInt.intensity,4)} {intUnit}），最差月为 {worstInt.label}（{fmt(worstInt.intensity,4)} {intUnit}）。</li>
</ul>
```

有效点不足 2 个时替换为：

```html
<ul class="point-list">
  <li>报告期已发生月份不足两个月，强度走势与最优/最差月暂不可判。</li>
</ul>
```

### 2.5 数据规则（唯一数据源）

**本节是所有数字的唯一来源。** 全部数值由入参 `emission` 推出：**无随机数、无种子**——同一入参必得完全一致的结果。**不要另编数字。**

通用常量：

```js
/* 报告期切片基址：上半年取数组下标 0—5，下半年取下标 6—11 */
var OFFSET = (HALF === 1) ? 0 : 6;
```

#### 2.5.1 逐月切片与逐月记录

对 `i = 0 … 5`（半年内的第 i 个月）：

```js
var idx = OFFSET + i;
var no  = (HALF === 1 ? 1 : 7) + i;          // 1—6 或 7—12
var label = no + '月';

var has      = idx < volumeCur.length;                       // 长度即唯一依据
var emission = has ? r2(volumeCur[idx]) : null;               // 万tCO₂
var intensity= has ? validPos(intensityCur[idx]) : null;      // ≤ 0 -> null

var hasPrev  = idx < volumePrev.length;
var prevEmission  = hasPrev ? r2(volumePrev[idx]) : null;
var prevIntensity = hasPrev ? validPos(intensityPrev[idx]) : null;
```

每月记录 `{ no, label, has, emission, intensity, prevEmission, prevIntensity }`。

#### 2.5.2 报告期聚合

```js
var availableCount = 已发生月份数（has 为 true 的个数）;
var totalEmission  = availableCount ? r2(Σ emission) : null;          // 万tCO₂；一个月都没有时写 null
var avgEmission    = availableCount ? r2(totalEmission / availableCount) : null;
var unitIntensity  = validPos(halfIntensity[HALF === 1 ? 'h1' : 'h2'].cur);   // 报告期累计强度（入参标量）
var prevUnitIntensity = validPos(halfIntensity[HALF === 1 ? 'h1' : 'h2'].prev);
var complete       = (availableCount === 6);
```

> **`totalEmission` 的两条边界必须分清**：
> - 数组写成「12 个 0」= 全年都有数据、只是值都是 0 → `availableCount = 6`、`totalEmission = 0.00` → **页面显示 0.00**（这是零兜底的正确结果）。
> - 数组写成 `[]`（缺位）= 一个月都没发生 → `availableCount = 0`、`totalEmission = null` → **页面显示 `--`**，全篇进入「无有效数据」态。

#### 2.5.3 同比

同比只对齐「**本期已发生**」的月份，且上年同月也必须存在：

```js
var prevTotalEmission = (至少一个月份 has && hasPrev) ? r2(Σ prevEmission) : null;

var yoyEmissionPct = (prevTotalEmission != null && totalEmission != null && prevTotalEmission !== 0)
  ? r2((totalEmission - prevTotalEmission) / prevTotalEmission * 100) : null;

var yoyIntensityPct = (unitIntensity != null && prevUnitIntensity != null)
  ? r2((unitIntensity - prevUnitIntensity) / prevUnitIntensity * 100) : null;
```

`prev` 数组缺失、长度为 0、或上年同期累计为 0 时，**所有同比写 `--`**（KPI 角标 `同比 --`、要点用「无上年同期数据，不计算同比」），**不得**靠 `null >= 0` 判成「上升 0.00%」。

> 入参年只有一期数据时（`prev` 为空），还可能出现另一种情形：入参 `year` 的**上一年**（即数据写在 `prev` 里）作为本期渲染。此时它的同比没有可比的更早一年，同样全部写 `--`。

#### 2.5.4 数值格式

- 千分位分隔（`toLocaleString('zh-CN')`）；排放量 **2 位小数**（单位 万tCO₂）；强度 **4 位小数**；百分比 **2 位小数**。
- 变化率带正负号（正数补 `+`）；`signed()` 在单位前保留一个空格（`同比 -2.62 %`）。
- 一律不使用「约」「近」这类修饰词。

#### 2.5.5 零值与缺值处理（除零保护，必须实现）

`emission` 各字段缺省或为 `0` 属**合法输入**，报告须正常渲染，不得报错、不得留空、不得填数。分母为 `0` 时统一写 `--`：

| 情形 | 正确输出 | 错误输出（禁止） |
| --- | --- | --- |
| `volume.cur` 缺失（非数组） | 该年 12 个月全部「未发生」→ 全篇「无有效数据」态 | 报错、或用 0 填满 12 个月 |
| `volume.cur` 写了 12 个 0 | 累计 `0.00`、月均 `0.00`、逐月表各行排放量 `0.00` | 显示 `--`、或误判为「无有效数据」 |
| `volume.cur` 长度 9（1—9 月） | 下半年报告只有 7/8/9 月有数，10—12 月输出 `—` 占位行 | 把 10—12 月当 0 计入合计 |
| `intensity.cur[i] ≤ 0` 或缺失 | 该月强度写 `--`，该点不参与折线连接与最优/最差月评选 | 显示 `0.0000`、拿 0 去比「最优月」 |
| `halfIntensity.h{half}.cur ≤ 0` 或缺失 | KPI 卡 3 数值 `--`、逐月表合计行强度 `--` | 显示 `0.0000`、用逐月强度的算术平均顶替 |
| `totalEmission = 0` | 逐月表「占报告期累计比重」列写 `--`；合计行占比写 `--` | `0 / 0` → `NaN`；或输出 `∞` |
| `volume.prev` 缺失或长度为 0 | 所有同比角标 `同比 --`、要点「无上年同期数据，不计算同比」 | 靠 `null >= 0` 判成「上升 0.00%」 |
| `prevTotalEmission = 0` | 排放同比 `--` | `NaN` / `∞` |
| `prevUnitIntensity ≤ 0` 或缺失 | 强度同比 `--` | `NaN` / `∞` |
| 图 1 全部月份未发生 | 不画线，图内居中「本期暂无数据」 | 画一副空坐标系 |
| 图 1 数值全为 0（有效） | **照常画一条 0 值折线**（0 是有效值） | 误判为无数据而只显示提示文字 |
| 图 2 全部月份强度无效 | 不画线，图内居中「本期暂无数据」 | 画一条 0 值线 |
| `availableCount = 0` | 摘要与走势引言、要点全部改为「无有效数据」措辞（见 2.4.3 / 2.4.5） | 保留原句式却代入 `--`（会读成「介于 -- ~ -- 之间」） |

> 实现提示：判断顺序必须是「**先判 `has` / `validPos` → 再算派生量 → 最后格式化**」。格式化函数遇到 `null` / `NaN` / `Infinity` 必须返回 `--`，不得输出 `0.00` 或 `∞`。

#### 2.5.6 行业自适应文案规则

界面中所有行业相关文案必须从下表取词，**禁止写死**（本表只改名词，不产生任何数值）：

| 文案占位符 | 钢铁（steel） | 发电（power） | 建材（building） | 化工（chemical） |
| --- | --- | --- | --- | --- |
| `{product}`（KPI 卡 3、图 2 题、合计注） | 粗钢 | 上网电量 | 水泥熟料 | 合成氨 |
| `{prodNoun}`（保留占位，正文已不出现产量口径） | 粗钢产量 | 上网电量 | 水泥熟料产量 | 合成氨产量 |
| `{prodUnit}`（保留占位） | t | MWh | t | t |
| `{intUnit}`（KPI 卡 3、图 2、逐月表列名与单位） | tCO₂/t | tCO₂/MWh | tCO₂/t | tCO₂/t |

### 2.6 图表规格

本报告共 **2 张图**，均为**纯 SVG 折线图**（不引入图表库、不用 Canvas）。

**折线图 `lineChartN(points, unit, dec)`**（points = `[{ label, value, has, isCur }]`）：

- `<svg viewBox="0 0 760 250" preserveAspectRatio="xMidYMid meet">`，内边距 `PL=66, PR=24, PT=26, PB=38`。
- **无数据态（关键）**：若没有任何 `has && value != null` 的点，输出一张同尺寸的空 SVG，**图内居中**一行 `<text x="380" y="125" font-size="13" fill="#98a1ab" text-anchor="middle">本期暂无数据</text>`，**不画坐标系、不画折线**。
- 纵轴范围：取有效点的 min/max，上下各外延 `span × 0.20`（**纵轴不从 0 起**，否则小差异被压平；`span = max − min`，为 0 时取 1）。
- 5 条横向网格线（`stroke="#eef1f4" stroke-width="1"`），纵轴刻度 5 个（`font-size="10" fill="#98a1ab" text-anchor="end"`，按 `dec` 位小数格式化），纵轴单位写在左上（`font-size="10" fill="#b0b8c1"`）。
- 横轴标签：**全部 6 个月份都显示**（`font-size="10.5" text-anchor="middle"`，已发生 `fill="#98a1ab"`，未发生 `fill="#d0d5db"`），横轴 6 个点位均分，与是否有数据无关。
- 折线：仅连接 `has && value != null` 的点（`<polyline fill="none" stroke="#00b42a" stroke-width="2.2" stroke-linejoin="round">`）。
- 数据点：普通点 `r=3`、白填充、绿边（`stroke="#00b42a" stroke-width="2"`）；高亮点 `r=5`、橙色 `fill/stroke="#ff7d00"`，上方 13px 处显示数值标签（`font-size="11" fill="#b25f00" font-weight="700" text-anchor="middle"`）。
- `isCur` 规则：`has && no === (half === 1 ? 6 : 12)`——即**只高亮报告期最后一个月**（上半年 6 月 / 下半年 12 月）。若该月尚未发生（如 2026 下半年 12 月），则**没有高亮点**，这是正确行为，不要「修正」成高亮最后一个已发生月。
- 每个图外套 `<div class="chart-box">`，图题用 `.chart-caption` 放在图框**下方**。

### 2.7 表格规格

本报告共 **1 张 `.btable`**（逐月生产与排放数据表，4 列，`tfoot` 合计行 + 可能的 `is-empty` 占位行）+ **1 张 `.kv-table`**（报告概述，3 行 2 列）。通用规则：

- 表头 `<th>` 绿底 `#e9f7ee`；斑马纹 `tbody tr:nth-child(even)` 底色 `#fafcfb`；文本列加 `is-left`；单位小字用 `<div class="txt-sm">`。
- 合计行放 `<tfoot>`（浅绿 `#f4fbf6` 加粗）。
- 所有数字 `font-variant-numeric: tabular-nums`（CSS 已含），千分位分隔。
- **合计必须等于各行之和**（未发生月份不算行）。自检：逐月表合计排放量 = 各已发生月之和；占比列各已发生月之和 = 100.00%（分母非 0 时）。

### 2.8 下载导出

- 点击 `#btn-download`：按钮禁用并显示 `正在生成 PDF…`；用 `html2canvas` 逐个截取 `#brief-root .brief-page`（`scale: 2, backgroundColor: '#ffffff'`），按 A4（210×297mm）切片（`jsPDF('p','mm','a4')`，JPEG 质量 0.92），逐页 `addImage`。
- 文件名：`碳排放半年度报告-{YEAR}年{halfName}.pdf`（如 `碳排放半年度报告-2026年上半年.pdf`）。正文通常导出约 4 页（封面 1 + 目录 1 + 正文约 2）。
- 若 CDN 依赖加载失败或生成出错：降级为 `window.print()`（`@media print` 已隐藏工具条、纸面去阴影）。
- 完成后恢复按钮可用状态与原始文案。

### 2.9 不要做什么

1. **不要交付多个文件**——唯一交付物是自包含的单个 HTML 文件（除 2 个 CDN 依赖外不得引用任何本地资源）。
2. **不要出现平台外壳**——本页是独立全屏子页：没有顶部导航栏、没有侧边栏、没有面包屑、没有模块切换。
3. **不要把已删除的章节加回来**——本报告**没有**「排放量汇总」「企业层级核算明细」「工序层级排放构成」等章节，**不要**输出化石燃料各物料明细表、过程排放明细表、含碳产品明细表、工序构成表，也**不要**输出「低位发热量」「单位热值含碳量」「排放因子」「工序层级」「掺烧自产二次能源」「勾稽」这类已删除概念。
4. **不要出现产量口径**——本报告**不含**产品（粗钢等）产量指标：摘要没有「累计产量」卡、逐月表没有产量列、正文不要写「半年累计产量」。
5. **不要出现「核算锚点月」「报告期末月」「基准月」等概念**——全篇任何位置（封面、概述、正文、注释）都不允许出现这类字样；数据期间一律**精确到月**（`2026-01 至 2026-06`），不要写成具体日期。
6. **不要第六章、第七章**——正文只有 摘要 + 一、报告概述 + 二、逐月排放与强度走势，共 3 个一级章节；目录 3 条。
7. **报告概述的 kv 表不要多出这些行**：核算方法、主要能源品种、主要含碳产品、核算锚点月、排放因子来源——kv 表恰好 3 行（核算主体 / 核算边界 / 报告期）。
8. **不要把未发生月份当有数渲染**——`has:false` 的月份必须输出 `—` 占位行（`.is-empty` 灰字），不计入合计、不参与占比、不参与折线连接。
9. **不要给缺失数值「补」一个数**——入参给 0 就显示 0；缺位/无效一律 `--` 或占位；**严禁**用行业经验值、相邻月插值、算术平均或联网检索顶替任何一个数。
10. **不要把颜色语义搞反**——排放类数字按数值符号着色（正红负绿），不要因为「强度下降是好事」就改成绿色。
11. **不要写死钢铁行业名词**——产品名与强度单位必须按 `companyName` 推断的行业走 2.5.6 的映射；切换行业后不允许残留「粗钢」等钢铁词。
12. **不要引入图表库**——折线图手写 SVG；不要给折线图纵轴从 0 起始。
13. **不要自由发挥「美化」**——色值、字号、间距、文案、图表配色一律以本文档为准。
14. **不要出现占位字样**——「示例」「演示」「模拟」「占位」「待补充」一律不得出现；也禁止 `NaN`、`undefined`、`Infinity`、`∞`。

---

## 附录 A · 量级锚点与自检

**单位产品碳排放强度的量级参照**——用于判断入参是否「一眼假」，**不是用来填数**：

| 行业 | 强度量级 | 说明 |
| --- | --- | --- |
| 钢铁（长流程） | `1.8 ~ 2.32` tCO₂/t 粗钢 | 含焦化、烧结、炼铁、转炉全流程；短流程（电炉）约 `0.63 ~ 0.76` |
| 发电（燃煤） | `0.78 ~ 1.05` tCO₂/MWh | 与机组容量、煤质、负荷率相关 |
| 建材（水泥熟料） | `0.78 ~ 0.95` tCO₂/t 熟料 | 其中约 60% 来自石灰石分解（工艺排放） |
| 化工（合成氨） | `1.6 ~ 2.6` tCO₂/t 氨 | 与原料路线（煤/天然气）强相关 |

**月度排放量的量级参照**：

- 核算方式：`月排放量（万tCO₂）= 月产量（万t）× 单位强度`。
- 例：年产粗钢约 700 万t 的企业，月产约 58 万t，强度 2.06 tCO₂/t → 月排放约 `120` 万tCO₂，半年约 `730` 万tCO₂。
- 若入参给出的量级与「产量 × 强度」相差一个数量级，**应如实呈现并在正文不加修饰**，**不要**替它改成「合理值」。

**自检用法**：拿到入参后，先用「月排放量 ÷ 单位强度」粗估月产量，看是否落在该行业合理产能区间；再看半年累计与 12 个月的关系是否单调合理。

## 附录 B · 兜底生成规则

> **适用范围：仅「行业名词推断」（2.5.6 的四类产品名与单位）。**
> **所有排放数值一律不兜底**——见「数据口径」第 1 条与 2.5.5。

**B1 行业名词由 `companyName` 决定**

- 关键词匹配优先级与兜底见「一、入参」的行业推断规则节，**逐字按那张表实现**。
- 推断只改 4 个名词/单位，**不得**据此推算任何数值。

**B2 数值不得由任何基准反推**

- 任何情况下都不得用「行业平均强度」「邻近年份强度」「行业经验产能」去倒推本企业的排放量或强度。
- 每一个数字只有两个合法来源：**入参**，或显式的**占位 `--` / `—`**。

**B3 缺失时一律降级，不生成替代值**

- `volume.cur` 缺位 → 全篇「无有效数据」态；
- `volume.prev` 缺位 → 全部同比 `--`；
- `intensity.*` 无效 → 该点 `--`；
- `halfIntensity.*` 无效 → KPI 卡 3 与合计行强度 `--`。

## 附录 C · 期望值（自检用）

### C1 正常入参（`year = 2026`、`half = 1`、`region` 无关）

入参为「一、入参」给出的那一份。期望值如下（**必须逐一吻合**）：

| 位置 | 期望值 |
| --- | --- |
| 封面 / 工具条 | `2026年1—6月`；数据期间 `2026-01 至 2026-06` |
| 报告期已发生月数 | `6` |
| KPI 卡 1 上半年累计排放量 | `731.03` 万tCO₂；角标 `同比 -2.62 %`（绿） |
| KPI 卡 2 月均排放量 | `121.84` 万tCO₂/月；副行 `按 6 个月平均` |
| KPI 卡 3 单位粗钢碳排放量 | `2.0618` tCO₂/t；角标 `同比 -4.08 %`（绿） |
| 逐月表 | 1月 `2.0860 / 120.68 / 16.51%`；2月 `2.0955 / 117.83 / 16.12%`；3月 `2.0598 / 123.84 / 16.94%`；4月 `2.0521 / 121.65 / 16.64%`；5月 `2.0412 / 125.62 / 17.18%`；6月 `2.0395 / 121.41 / 16.61%` |
| 逐月表合计行 | `2.0618 / 731.03 / 100.00%` |
| 图 1 / 图 2 高亮点 | 均在 **6 月**（`r=5` 橙色） |
| 要点 3 / 4 | 「介于 117.83 ~ 125.62 万tCO₂ 之间，最高月为 5月，最低月为 2月」；「报告期共 6 个月已发生，强度总体呈下降走势」 |

**同一份入参换 `half = 2`**（下半年，只有 7—9 月发生）：

| 位置 | 期望值 |
| --- | --- |
| 报告期 / 数据期间 | `2026年7—12月` / `2026-07 至 2026-12` |
| 已发生月数 | `3` |
| KPI 卡 1 | `370.67` 万tCO₂；角标 `同比 -2.61 %` |
| KPI 卡 2 | `123.56` 万tCO₂/月；副行 `按 3 个月平均` |
| KPI 卡 3 | `2.0319` tCO₂/t；角标 `同比 -4.08 %` |
| 逐月表 | 7月 `2.0380 / 124.09 / 33.48%`；8月 `2.0312 / 124.21 / 33.51%`；9月 `2.0266 / 122.37 / 33.01%`；10—12月 **`—` 占位行** |
| 逐月表合计行 | `2.0319 / 370.67 / 100.00%` |
| 图 1 / 图 2 高亮点 | **无**（12 月尚未发生） |

> **基准与同比随入参变化**，上表只对应该组条件。换入参必须按 2.5 重算，不得沿用上表数字。

### C2 全零入参（零兜底验收用例）

用「一、入参」里的**全零示例**跑一遍，逐项核对：

| 位置 | 期望结果 |
| --- | --- |
| KPI 卡 1 | `0.00` 万tCO₂；角标 `同比 --`（灰） |
| KPI 卡 2 | `0.00` 万tCO₂/月；副行 `按 6 个月平均` |
| KPI 卡 3 | `--`（强度为 0 在业务上不成立） |
| 图 1 | **照常画一条 0 值折线**（0 是有效值，不是无数据） |
| 图 2 | 图内居中「本期暂无数据」 |
| 逐月表 6 行 | 强度 `--`、排放量 `0.00`、占比 `--` |
| 逐月表合计行 | `-- / 0.00 / --` |
| 要点 3 / 4 | 照常输出区间与「报告期共 6 个月已发生」 |
| 全文脏值 | `NaN` / `undefined` / `Infinity` / `∞` **必须 0 命中** |

> **判定标准：出现任何一个 `NaN`、`∞`，或把有效月份渲染成占位行，即为不合格。**

### C3 数组全空（`volume.cur = []`）

- KPI 卡 1/2/3 全部 `--`；角标 `同比 --`。
- 图 1、图 2 都输出「本期暂无数据」（不画坐标系）。
- 逐月表 **6 行全部 `—` 占位行**（`.is-empty` 灰字）；合计行 `-- / -- / --`。
- 要点写「本期未提供逐月排放数据，排放量区间与高低月份暂不可判。」与「报告期共 0 个月已发生，数据补齐后即可生成逐月走势分析。」
- 正常渲染、不报错、不填数。

### C4 删掉整个 `emission` 字段

结果应与 **C3 完全一致**。

## 附录 D · 交付前自检清单

1. 用 C1 入参生成后，**逐项对照附录 C1**——封面、目录、摘要 3 卡、概述 kv 表、两张折线图、逐月表都要吻合。
2. 全文搜 `NaN`、`undefined`、`Infinity`、`∞`，**必须 0 命中**。
3. 全文搜 `示例`、`演示`、`模拟`、`占位`、`待补充`——**必须 0 命中**。
4. 目录 3 条锚点与正文 3 个标题一一对应，点击可定位。
5. **逐月表合计 = 各已发生月排放量之和**（未发生月份不算行）；占比列各已发生月之和 = `100.00%`（分母非 0 时）。
6. 同一入参渲染两次，结果**逐字符一致**（无随机数）。
7. **【零兜底必测】用 C2（全零）跑一遍**，逐项对照附录 C2。**出现 `NaN` / `∞` 即不合格。**
8. **【零兜底必测】用 C3（空数组）跑一遍**，确认进入「无有效数据」态且不报错。
9. **【必测】把 `emission` 整个字段删掉再跑一遍**，结果应与 C3 一致。
10. **【必测】把 `volume.cur` 截成长度 9（1—9 月）跑 `half = 2`**：确认只有 7/8/9 月有数、10—12 月是 `—` 占位行，且合计只含 3 个月。
11. 把排放量整体改成明显偏大 / 偏小的值，确认 KPI、折线图、占比随之变化且逻辑自洽；把强度改成明显偏小（如 `1.2`）确认同比与趋势措辞随之变化。
12. 换一个明显属于其他行业的企业名（含「电力」「水泥」「化工」）跑一遍，确认产品名与强度单位切换、**且不残留「粗钢」**。
13. 全文搜 `工序`、`物料`、`低位发热量`、`单位热值含碳量`、`排放因子`、`产量`——**本报告不应出现任何一处**（「排放因子」若出现在 2.4.4「核算边界」行的口径描述里属正常，但不得出现明细表）。
14. 下载按钮能生成 `碳排放半年度报告-{YEAR}年{halfName}.pdf`（或库缺失时降级打印）。
15. 页面只交付**一个** HTML 文件，库走 CDN；全篇无 emoji、无图表库、无外部图片。
