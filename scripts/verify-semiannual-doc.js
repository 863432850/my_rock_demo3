/**
 * 碳排放半年度报告 · 提示词文档校验
 *
 * 做三件事：
 *  1) 从 docs/碳排放半年度报告-提示词.md 抠出入参 JSON，**独立复算** C1/C2（不引用项目代码）；
 *  2) 断言文档与「文档自己的规则」一致（归一化空白 + U+2212 → -）；
 *  3) 断言条款存在 / 旧规则已移除（结构化，不拿裸词扫全文）/ 结构完整。
 *
 * 改这份文档后必须重跑。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PRJ = '/Users/rock/Documents/cursor代码存档/2026钢铁项目/绿低平台补充功能/绿低功能设计';
const DOC = path.join(PRJ, 'docs/碳排放半年度报告-提示词.md');

const raw = fs.readFileSync(DOC, 'utf8');
/** 归一化：去所有空白、U+2212 → -、去 markdown 加粗与行内代码标记 */
const flat = raw.replace(/\u2212/g, '-').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, '');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log('FAIL  ' + label + (extra != null ? '  → ' + extra : '')); }
}
function eq(label, got, want) { ok(label + ' = ' + JSON.stringify(want), got === want, 'got ' + JSON.stringify(got)); }
function has(label, text) { ok('文档含「' + label + '」', flat.indexOf(text.replace(/\u2212/g, '-').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, '')) >= 0); }
function hasNot(label, text) { ok('文档不含「' + label + '」', flat.indexOf(text.replace(/\s+/g, '')) < 0); }

/* ================= 1. 抠入参 JSON ================= */
const blocks = [];
const re = /```json\s*\n([\s\S]*?)\n```/g;
let m;
while ((m = re.exec(raw)) !== null) {
  try {
    const o = JSON.parse(m[1]);
    if (o && o.companyName && o.emission && o.emission.volume) blocks.push(o);
  } catch (e) { /* 非入参 JSON，跳过 */ }
}
ok('抠到 2 份入参 JSON', blocks.length === 2, 'got ' + blocks.length);
const P = blocks[0] || {};          // 正常入参
const Q = blocks[1] || {};          // 全零入参

/* ================= 2. 独立复算（按文档 2.5 的规则） ================= */
const r2 = n => Math.round(n * 100) / 100;
const r4 = n => Math.round(n * 10000) / 10000;
function validPos(v) { const n = Number(v); return (isFinite(n) && n > 0) ? r4(n) : null; }
function arr(v) { return (Array.isArray(v) ? v : []).map(x => { const n = Number(x); return isFinite(n) ? n : 0; }); }

function compute(input, half) {
  const em = input.emission || {};
  const volCur = arr(em.volume && em.volume.cur);
  const volPrev = arr(em.volume && em.volume.prev);
  const intCur = arr(em.intensity && em.intensity.cur);
  const off = half === 1 ? 0 : 6;

  const months = [];
  let sumEm = 0, count = 0, sumPrev = 0, countPrev = 0;
  for (let i = 0; i < 6; i++) {
    const idx = off + i;
    const no = (half === 1 ? 1 : 7) + i;
    const has = idx < volCur.length;
    const e = has ? r2(volCur[idx]) : null;
    const it = has ? validPos(intCur[idx]) : null;
    const hp = idx < volPrev.length;
    const pe = hp ? r2(volPrev[idx]) : null;
    months.push({ no, label: no + '月', has, emission: e, intensity: it, prevEmission: pe });
    if (has) { sumEm += (e || 0); count++; }
    if (has && hp) { sumPrev += (pe || 0); countPrev++; }
  }

  const hk = half === 1 ? 'h1' : 'h2';
  const hi = (em.halfIntensity && em.halfIntensity[hk]) || {};
  const unit = validPos(hi.cur);
  const prevUnit = validPos(hi.prev);

  const total = count ? r2(sumEm) : null;
  const prevTotal = countPrev ? r2(sumPrev) : null;

  return {
    months, count, total, prevTotal,
    avg: count ? r2(total / count) : null,
    unit, prevUnit,
    yoyE: (prevTotal != null && total != null && prevTotal !== 0) ? r2((total - prevTotal) / prevTotal * 100) : null,
    yoyI: (unit != null && prevUnit != null) ? r2((unit - prevUnit) / prevUnit * 100) : null
  };
}

/* ---------- C1 上半年 ---------- */
console.log('=== C1 正常入参 · 2026 上半年 ===');
const A = compute(P, 1);
eq('已发生月数', A.count, 6);
eq('累计排放量', A.total, 731.03);
eq('月均排放量', A.avg, 121.84);
eq('报告期累计强度', A.unit, 2.0618);
eq('排放同比', A.yoyE, -2.62);
eq('强度同比', A.yoyI, -4.08);

const EXPECT_M1 = [
  [1, 2.0860, 120.68], [2, 2.0955, 117.83], [3, 2.0598, 123.84],
  [4, 2.0521, 121.65], [5, 2.0412, 125.62], [6, 2.0395, 121.41]
];
EXPECT_M1.forEach(([no, it, e]) => {
  const mm = A.months[no - 1];
  ok(no + '月 强度 ' + it, mm.intensity === it, mm.intensity);
  ok(no + '月 排放 ' + e, mm.emission === e, mm.emission);
});
ok('逐月排放量之和 = 累计', r2(A.months.reduce((a, x) => a + x.emission, 0)) === A.total);

/* 占比（用于文档一致性断言） */
const shares = A.months.map(x => r2(x.emission / A.total * 100));
eq('占比之和（展示精度）', r2(shares.reduce((a, b) => a + b, 0)), 100);

/* ---------- 同一份入参换 half = 2 ---------- */
console.log('=== C1 正常入参 · 2026 下半年 ===');
const B = compute(P, 2);
eq('已发生月数', B.count, 3);
eq('累计排放量', B.total, 370.67);
eq('月均排放量', B.avg, 123.56);
eq('报告期累计强度', B.unit, 2.0319);
eq('排放同比', B.yoyE, -2.61);
eq('强度同比', B.yoyI, -4.08);
eq('7 月排放', B.months[6 - 6].emission, 124.09);
eq('8 月排放', B.months[7 - 6].emission, 124.21);
eq('9 月排放', B.months[8 - 6].emission, 122.37);
ok('10—12 月未发生', !B.months[9 - 6].has && !B.months[10 - 6].has && !B.months[11 - 6].has);

/* ---------- C2 全零入参 ---------- */
console.log('=== C2 全零入参（零兜底） ===');
const Z = compute(Q, 1);
eq('全零 已发生月数（12 个 0 = 全年都有数据）', Z.count, 6);
eq('全零 累计排放量 → 0.00（给 0 就显示 0）', Z.total, 0);
eq('全零 月均排放量 → 0.00', Z.avg, 0);
eq('全零 累计强度 → null（强度为 0 业务上不成立）', Z.unit, null);
eq('全零 排放同比 → null', Z.yoyE, null);
eq('全零 强度同比 → null', Z.yoyI, null);
ok('全零 逐月排放均为 0', Z.months.every(x => x.emission === 0));
ok('全零 逐月强度均为 null', Z.months.every(x => x.intensity === null));

/* ---------- C3 空数组 ---------- */
console.log('=== C3 空数组 ===');
const E = compute({ emission: { volume: { cur: [], prev: [] } } }, 1);
eq('空数组 已发生月数', E.count, 0);
eq('空数组 累计排放量 → null（渲染 --）', E.total, null);
eq('空数组 月均 → null', E.avg, null);
ok('空数组 6 个月全部未发生', E.months.every(x => !x.has));

/* ---------- C4 缺 emission ---------- */
const F = compute({}, 1);
eq('缺 emission 累计 → null', F.total, null);

/* ================= 3. 文档一致性（文档里写的数必须等于复算值） ================= */
console.log('=== 文档一致性 ===');
[
  ['C1 累计 731.03', '731.03'],
  ['C1 月均 121.84', '121.84'],
  ['C1 强度 2.0618', '2.0618'],
  ['C1 排放同比 -2.62', '-2.62'],
  ['C1 强度同比 -4.08', '-4.08'],
  ['C2 累计 370.67', '370.67'],
  ['C2 月均 123.56', '123.56'],
  ['C2 强度 2.0319', '2.0319'],
  ['C2 排放同比 -2.61', '-2.61'],
  ['逐月 1月', '1月2.0860/120.68/16.51%'],
  ['逐月 2月', '2月2.0955/117.83/16.12%'],
  ['逐月 3月', '3月2.0598/123.84/16.94%'],
  ['逐月 4月', '4月2.0521/121.65/16.64%'],
  ['逐月 5月', '5月2.0412/125.62/17.18%'],
  ['逐月 6月', '6月2.0395/121.41/16.61%'],
  ['合计行 2.0618 / 731.03 / 100.00%', '2.0618/731.03/100.00%'],
  ['下半年 7月', '7月2.0380/124.09/33.48%'],
  ['下半年 8月', '8月2.0312/124.21/33.51%'],
  ['下半年 9月', '9月2.0266/122.37/33.01%'],
  ['下半年合计行', '2.0319/370.67/100.00%']
].forEach(([label, text]) => has(label, text));

/* 要点里的区间与高低月 */
has('要点区间 117.83 ~ 125.62', '117.83~125.62');
has('最高月 5月', '最高月为5月');
has('最低月 2月', '最低月为2月');
has('趋势措辞 强度总体呈下降走势', '强度总体呈下降走势');

/* ================= 4. 条款存在性 ================= */
console.log('=== 条款存在性 ===');
[
  ['数据口径抬头块', '数据口径（先读这条）'],
  ['数组长度契约', '数组长度契约'],
  ['数据可得性说明', '数据可得性说明'],
  ['物料级明细拿不到', '物料级明细（化石燃料各物料的消耗量'],
  ['工序级拿不到', '工序（生产线）级排放量与其物料构成'],
  ['构成拆分拿不到', '构成拆分'],
  ['产品产量拿不到', '产品（粗钢等）产量'],
  ['字段说明表头', '入参字段说明'],
  ['数组填写规则 7 条', '数组填写规则（7条，必须遵守）'],
  ['全零示例标题', '入参示例：全零（零兜底）'],
  ['空数组示例标题', '入参示例：无有效数据（数组为空）'],
  ['行业推断规则节', '行业推断规则（从companyName自动判断'],
  ['入参带入规则节', '入参带入规则'],
  ['运行期入参来源', '运行期入参来源（URL查询参数）'],
  ['数据来源与真实性要求', '数据来源与真实性要求（先读）'],
  ['L1 入参直取', 'A.L1入参直取（零兜底）'],
  ['L2 联网检索', 'B.L2联网检索（可选，仅限非数值内容）'],
  ['L3 兜底生成', 'C.L3兜底生成'],
  ['页面整体布局', '页面整体布局'],
  ['设计规格 CSS', '设计规格（完整CSS，逐字使用）'],
  ['区块逐一规格', '区块逐一规格'],
  ['目录 3 条', '<liclass="toc-l1"><ahref="#sec-0">摘要·核心指标概览</a></li><liclass="toc-l1"><ahref="#sec-1">一、报告概述</a></li><liclass="toc-l1"><ahref="#sec-2">二、逐月排放与强度走势</a></li>'],
  ['摘要 3 卡', '3张KPI卡'],
  ['要点 4 条', '+4条要点'],
  ['概述 kv 表 3 行', '恰好3行（不得增删行）'],
  ['核算口径说明', '（一）核算口径说明'],
  ['逐月表 4 列', '<th>月份</th><th>单位{product}碳排放量（{intUnit}）</th><th>碳排放量（万tCO₂）</th><th>占报告期累计比重</th>'],
  ['is-empty 占位行', '<trclass="is-empty"><td>{label}</td><td>—</td><td>—</td><td>—</td></tr>'],
  ['数据规则节', '数据规则（唯一数据源）'],
  ['逐月切片', '逐月切片与逐月记录'],
  ['报告期聚合', '报告期聚合'],
  ['同比规则', '同比'],
  ['数值格式', '数值格式'],
  ['除零保护节', '零值与缺值处理（除零保护，必须实现）'],
  ['行业自适应文案规则', '行业自适应文案规则'],
  ['图表规格', '图表规格'],
  ['图表无数据态', '无数据态（关键）'],
  ['表格规格', '表格规格'],
  ['下载导出', '下载导出'],
  ['负面清单', '不要做什么'],
  ['附录 A', '附录A·量级锚点与自检'],
  ['附录 B', '附录B·兜底生成规则'],
  ['附录 C', '附录C·期望值（自检用）'],
  ['附录 D', '附录D·交付前自检清单']
].forEach(([label, text]) => has(label, text));

/* ================= 5. 关键规则断言（条款语义） ================= */
console.log('=== 关键规则 ===');
[
  ['零兜底：给 0 就显示 0', '入参给0就显示0'],
  ['零兜底：严禁外推', '严禁向后外推'],
  ['零兜底：不得用算术平均顶替', '不是各月强度的算术平均'],
  ['数组长度 = 已发生月数', '长度=该年已发生到几月'],
  ['全零也要写满长度', '全零也要写满长度'],
  ['prev 与 cur 下标对齐', '下标对齐'],
  ['强度 ≤0 视为无效', '强度≤0在业务上不成立'],
  ['halfIntensity 取相同月数的上年同期', '与本期相同月数'],
  ['除零 → --', '逐月表「占报告期累计比重」列写--'],
  ['signed 保留空格', 'signed()在单位前保留一个空格'],
  ['同比缺失措辞', '无上年同期数据，不计算同比'],
  ['KPI 角标写法', '同比--'],
  ['纵轴不从 0 起', '纵轴不从0起'],
  ['isCur 只高亮报告期末月', '只高亮报告期最后一个月'],
  ['下半年无高亮点是正确行为', '没有高亮点'],
  ['无数据态文案', '本期暂无数据'],
  ['12 个 0 是有效入参', '12个0表示全年都有数据'],
  ['未发生月不计入合计', '不计入合计、不参与占比、不参与折线连接']
].forEach(([label, text]) => has(label, text));

/* ================= 6. 旧规则已移除（结构化断言，不拿裸词扫全文） ================= */
console.log('=== 旧规则已移除 ===');
const inputKeys = JSON.stringify(blocks);
[
  ['旧物料数组 BASE_FUEL', 'BASE_FUEL'],
  ['旧物料数组 BASE_PROCESS', 'BASE_PROCESS'],
  ['旧产品数组 BASE_PRODUCT', 'BASE_PRODUCT'],
  ['旧工序数组 BASE_PROCESS_LINE', 'BASE_PROCESS_LINE'],
  ['旧汇总拆分 SUMMARY_SPLIT', 'SUMMARY_SPLIT'],
  ['旧折算系数 HALF_FACTOR', 'HALF_FACTOR'],
  ['旧逐年强度系数', 'YEAR_INT_FACTOR'],
  ['旧逐年产量系数', 'YEAR_PROD_FACTOR'],
  ['旧产量入参 production', '"production"'],
  ['旧产量入参 annualOutput', 'annualOutput'],
  ['旧汇总表 BASE_SUMMARY', 'BASE_SUMMARY']
].forEach(([label, key]) => ok('入参 JSON 不含「' + label + '」', inputKeys.indexOf(key) < 0));

[
  ['旧章节标题 一、入参 之外的一级章节', '##三、'],
  ['旧图 3', '（图3）'],
  ['旧图 4', '（图4）'],
  ['旧表 2 表头', '<thclass="is-left">物料</th><th>消耗量</th>'],
  ['旧表 3 表头', '<th>类别</th><thclass="is-left">物料/产品</th>'],
  ['旧表 4 表头', '<thclass="is-left">工序/生产线</th>'],
  ['旧表 5 表头', '<th>月份</th><th>{prodNoun}（万{prodUnit}）</th>'],
  ['旧目录 6 条锚点', '<ahref="#sec-5">'],
  ['旧章节 三、企业层级核算明细', '三、企业层级核算明细'],
  ['旧章节 四、工序层级排放构成', '四、工序层级排放构成'],
  ['旧章节 五、逐月排放与强度走势', '五、逐月排放与强度走势'],
  ['旧 KPI 半年累计产量', '半年累计{prodNoun}'],
  ['旧 KPI 发电设施排放占比', '发电设施排放占比'],
  ['旧勾稽块', '半年度累计勾稽关系（已校验通过）'],
  ['旧口径 工序层级排放总量为净额口径', '工序层级排放总量</strong>为净额口径'],
  ['旧锚点月概念', '核算锚点月</strong>'],
  ['旧六章七章禁令', '不要第六章、第七章</strong>']
].forEach(([label, text]) => hasNot(label, text));

/* 目录 HTML 恰好 3 条 */
const tocCount = (raw.match(/<li class="toc-l1">/g) || []).length;
eq('文档中 toc-l1 条数', tocCount, 3);

/* 正文 brief-h1 恰好 3 个 */
const h1Count = (raw.match(/<h1 class="brief-h1" id="sec-/g) || []).length;
eq('文档中 brief-h1 个数', h1Count, 3);

/* ================= 7. 静态托管安全（Jekyll / Liquid） ================= */
console.log('=== 静态托管安全 ===');
/* 这些 md 会被放进静态站点仓库，GitHub Pages 的 Jekyll 会对 .md / .html 做 Liquid 解析：
   `{%` 会被当成标签起始符（`{%}` 无法闭合 → 构建直接失败），`{{` 会被当成输出标签。
   文档里的模板占位符一律用单花括号（如 `{fmt(x,2)}%`），**不要**用 `{%` / `{{`。 */
ok('文档不含 Liquid 标签起始符 {%（会导致 Jekyll 构建失败）', raw.indexOf('{%') < 0,
  '第 ' + (raw.slice(0, raw.indexOf('{%')).split('\n').length) + ' 行');
ok('文档不含 Liquid 输出起始符 {{', raw.indexOf('{{') < 0);

/* ================= 8. 结构完整性 ================= */
console.log('=== 结构 ===');
[
  ['## 一、入参（JSON）', '## 一、入参（JSON）'],
  ['## 二、任务', '## 二、任务'],
  ['### 2.1 交付物', '### 2.1 交付物'],
  ['### 2.2 页面整体布局', '### 2.2 页面整体布局'],
  ['### 2.3 设计规格', '### 2.3 设计规格'],
  ['### 2.4 区块逐一规格', '### 2.4 区块逐一规格'],
  ['### 2.5 数据规则', '### 2.5 数据规则'],
  ['### 2.6 图表规格', '### 2.6 图表规格'],
  ['### 2.7 表格规格', '### 2.7 表格规格'],
  ['### 2.8 下载导出', '### 2.8 下载导出'],
  ['### 2.9 不要做什么', '### 2.9 不要做什么']
].forEach(([label, text]) => ok('文档含小节「' + label + '」', raw.indexOf(text) >= 0));

/* 关键视觉规格逐字保留 */
[
  ['主色', '#00b42a'],
  ['纸面宽', 'width: 920px'],
  ['纸面内边距', 'padding: 64px 72px 72px'],
  ['KPI 3 列', 'grid-template-columns: repeat(3, 1fr)'],
  ['折线画布', 'viewBox="0 0 760 250"'],
  ['折线内边距', 'PL=66, PR=24, PT=26, PB=38'],
  ['表头底色', '#e9f7ee'],
  ['占位行色', '.btable tr.is-empty td { color: #c0c4cc; }'],
  ['勾稽块虚线', 'border: 1px dashed #b7e0c5;'],
  ['CDN html2canvas', 'html2canvas@1.4.1'],
  ['CDN jsPDF', 'jspdf@2.5.1'],
  ['文件名模板', '碳排放半年度报告-{YEAR}年{halfName}.pdf']
].forEach(([label, text]) => ok('视觉规格保留「' + label + '」', raw.indexOf(text) >= 0));

console.log('\n--- ' + pass + ' pass / ' + fail + ' fail ---');
process.exit(fail ? 1 : 0);
