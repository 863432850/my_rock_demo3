// 独立复算：docs/碳排放异动分析报告-提示词.md
//   1) 从文档抠出入参 JSON（正常 + 全零），保证"文档写的"与"被复算的"是同一份
//   2) 按文档 2.7 的规则独立复算 C1 / C2，与文档里写死的期望值逐一断言
//   3) 文档一致性（归一化空白 + U+2212/破折号 → '-'）+ 条款存在性 + 旧规则已移除 + 结构完整
//   4) 归因池完整性（6 行业 × 3 池 × 3 条，逐条池文都能在文档里找到）
//   5) 视觉规格逐字保留
// 不读页面；数字只认复算。
//
// 用法：node scripts/verify-anomaly-doc.js

'use strict';

const fs = require('fs');
const path = require('path');

const DOC = path.join(__dirname, '..', 'docs', '碳排放异动分析报告-提示词.md');
const raw = fs.readFileSync(DOC, 'utf8');

/** 归一化：去掉所有空白与 markdown 加粗标记，并把数学减号/破折号统一成 ASCII '-' */
function norm(s) {
  return String(s)
    .replace(/[ \t\u00a0\u3000]+/g, '')
    .replace(/\*\*/g, '')
    .replace(/[\u2212\u2013\u2014]/g, '-');
}
const flat = norm(raw);

let pass = 0;
const fails = [];
function ok(label, cond, extra) {
  if (cond) pass++;
  else fails.push(label + (extra != null ? '  → ' + extra : ''));
}
function eq(label, got, want) { ok(label + ' = ' + want, got === want, '实际 ' + got); }
function has(label, text) { ok('文档含 ' + label, flat.includes(norm(text))); }
function hasNot(label, text) { ok('文档不含 ' + label, !flat.includes(norm(text))); }

/* ================= 1. 抠入参 JSON ================= */

console.log('--- 1. 入参解析 ---');

const INPUTS = [];
for (const m of raw.matchAll(/```json\s*\n?([\s\S]*?)```/g)) {
  const body = m[1].trim();
  try {
    const o = JSON.parse(body);
    // 只接受"完整入参块"：必须含 companyName 且含 emission.monthly
    if (o && o.companyName && o.emission && o.emission.monthly) INPUTS.push(o);
  } catch (e) {
    // 数组片段示例（如 "cur": [0, 0, …]）会解析失败，跳过——这是预期行为
  }
}
eq('抠出入参 JSON 块数', INPUTS.length, 2);

const P = INPUTS[0] || {};
const Q = INPUTS[1] || {};
console.log('   正常入参：' + P.companyName + ' / ' + P.year + '-' + P.month);
console.log('   全零入参：' + Q.companyName + ' / ' + Q.year + '-' + Q.month);

ok('正常入参含 companyName', typeof P.companyName === 'string' && P.companyName.length > 0);
ok('正常入参含 emission.monthly.cur', Array.isArray(P.emission && P.emission.monthly && P.emission.monthly.cur));
ok('正常入参含 emission.monthly.prev', Array.isArray(P.emission && P.emission.monthly && P.emission.monthly.prev));
eq('正常入参 cur 长度', (P.emission.monthly.cur || []).length, 12);
eq('正常入参 prev 长度', (P.emission.monthly.prev || []).length, 12);
eq('全零入参 cur 长度', ((Q.emission || {}).monthly || {}).cur ? Q.emission.monthly.cur.length : 0, 12);
ok('全零入参 cur 全为 0', (Q.emission.monthly.cur || []).every(v => v === 0));
ok('全零入参 prev 全为 0', (Q.emission.monthly.prev || []).every(v => v === 0));
ok('全零入参不含 lastMonth', Q.emission.lastMonth === undefined);

// 结构化断言：入参不得再带日度 / 工序 / 闭环台账字段
ok('正常入参不含 emission.daily', P.emission.daily === undefined);
ok('正常入参不含 emission.sources', P.emission.sources === undefined);
ok('正常入参不含 emission.lastMonth', P.emission.lastMonth === undefined);
ok('全零入参不含 emission.daily', Q.emission.daily === undefined);
ok('全零入参不含 emission.sources', Q.emission.sources === undefined);

/* ================= 2. 独立复算 ================= */

console.log('--- 2. 独立复算 ---');

const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;
const pick = (a, i) => { const v = (a || [])[i]; return (v == null || !isFinite(v)) ? 0 : Number(v); };
/** 变化率：分母必须 > 0，否则返回 null（文档规定渲染为 --） */
function ratio(cur, base) {
  if (cur == null || base == null) return null;
  if (!isFinite(cur) || !isFinite(base) || base <= 0) return null;
  return r2((cur - base) / base * 100);
}

function build(input) {
  const Y = input.year, M = input.month;
  const em = input.emission || {};
  const cur = (em.monthly || {}).cur || [];
  const prev = (em.monthly || {}).prev || [];

  const CUR = r2(pick(cur, M - 1));
  const PYY = r2(pick(prev, M - 1));
  const PM = M === 1 ? null : r2(pick(cur, M - 2));

  const MOM = M === 1 ? null : ratio(CUR, PM);
  const YOY = ratio(CUR, PYY);

  let ytdCur = 0, ytdPrev = 0;
  for (let i = 0; i < M; i++) { ytdCur += pick(cur, i); ytdPrev += pick(prev, i); }
  ytdCur = r2(ytdCur); ytdPrev = r2(ytdPrev);
  const YTD_YOY = ratio(ytdCur, ytdPrev);

  // 判定偏离度：取 |MOM| 与 |YOY| 中绝对值较大者（相等取环比）
  let DEV = null, BASIS = '';
  if (MOM != null && YOY != null) {
    if (Math.abs(MOM) >= Math.abs(YOY)) { DEV = MOM; BASIS = '环比'; }
    else { DEV = YOY; BASIS = '同比'; }
  } else if (MOM != null) { DEV = MOM; BASIS = '环比'; }
  else if (YOY != null) { DEV = YOY; BASIS = '同比'; }

  let LEVEL = null;
  if (DEV != null) {
    const a = Math.abs(DEV);
    LEVEL = a >= 12 ? 3 : (a >= 8 ? 2 : (a >= 5 ? 1 : 0));
  }

  const rows = [];
  for (let i = 1; i <= M; i++) {
    const c = pick(cur, i - 1), p = pick(prev, i - 1);
    const ring = i === 1 ? null : pick(cur, i - 2);
    rows.push({
      m: i, cur: r2(c), prev: r2(p),
      yoyDelta: r2(c - p), yoyPct: ratio(c, p),
      ring: ring == null ? null : r2(ring),
      momDelta: ring == null ? null : r2(c - ring),
      momPct: ring == null ? null : ratio(c, ring)
    });
  }

  return {
    Y, M, CUR, PYY, PM, MOM, YOY, ytdCur, ytdPrev, YTD_YOY, DEV, BASIS, LEVEL,
    rows
  };
}

const N = build(P);
const Z = build(Q);

/* ---------- C1 正常入参 ---------- */
console.log('=== C1 正常入参（独立复算） ===');
eq('本月碳排放量', N.CUR, 23.15);
eq('去年同月排放量', N.PYY, 27.02);
eq('上月排放量', N.PM, 26.86);
eq('月环比 MOM', N.MOM, -13.81);
eq('月同比 YOY', N.YOY, -14.32);
eq('年度累计 YTD_CUR', N.ytdCur, 158.08);
eq('上年同期累计 YTD_PREV', N.ytdPrev, 166.21);
eq('累计同比 YTD_YOY', N.YTD_YOY, -4.89);
eq('判定偏离度 DEV', N.DEV, -14.32);
eq('判定基准 DEV_BASIS', N.BASIS, '同比');
eq('异动等级 LEVEL', N.LEVEL, 3);

const EXPECT_ROWS = [
  [1, 27.42, 28.35, -0.93, -3.28, null, null, null],
  [2, 25.60, 26.90, -1.30, -4.83, 27.42, -1.82, -6.64],
  [3, 27.95, 28.62, -0.67, -2.34, 25.60, 2.35, 9.18],
  [4, 27.10, 27.88, -0.78, -2.80, 27.95, -0.85, -3.04],
  [5, 26.86, 27.44, -0.58, -2.11, 27.10, -0.24, -0.89],
  [6, 23.15, 27.02, -3.87, -14.32, 26.86, -3.71, -13.81]
];
EXPECT_ROWS.forEach(e => {
  const [m, cur, prev, yd, yp, ring, md, mp] = e;
  const got = N.rows[m - 1];
  ok(`明细表 ${m} 月存在`, !!got);
  if (!got) return;
  eq(`   ${m}月 本期`, got.cur, cur);
  eq(`   ${m}月 同期`, got.prev, prev);
  eq(`   ${m}月 同比变化值`, got.yoyDelta, yd);
  eq(`   ${m}月 同比%`, got.yoyPct, yp);
  eq(`   ${m}月 上月`, got.ring, ring);
  eq(`   ${m}月 环比变化值`, got.momDelta, md);
  eq(`   ${m}月 环比%`, got.momPct, mp);
});

/* ---------- C2 全零入参 ---------- */
console.log('=== C2 全零入参（零兜底） ===');
eq('全零 本月碳排放量', Z.CUR, 0);
eq('全零 月环比 → null（渲染 --）', Z.MOM, null);
eq('全零 月同比 → null（渲染 --）', Z.YOY, null);
eq('全零 累计同比 → null（渲染 --）', Z.YTD_YOY, null);
eq('全零 判定偏离度 → null', Z.DEV, null);
eq('全零 等级 → null', Z.LEVEL, null);
ok('全零 明细表各月同比% 均为 null', Z.rows.every(r => r.yoyPct === null));
ok('全零 明细表各月环比% 均为 null', Z.rows.every(r => r.momPct === null));

/* ---------- 双向断言：保护不能误伤正常值 ---------- */
ok('正常入参 MOM 非 null', N.MOM !== null);
ok('正常入参 YOY 非 null', N.YOY !== null);
ok('正常入参 YTD_YOY 非 null', N.YTD_YOY !== null);
ok('正常入参 DEV 非 null', N.DEV !== null);
ok('正常入参 LEVEL 非 null', N.LEVEL !== null);

/* ================= 3. 文档一致性 ================= */

console.log('=== 文档一致性（归一化后匹配） ===');

has('C1 本月 23.15', '23.15');
has('C1 去年同月 27.02', '27.02');
has('C1 累计 158.08', '158.08');
has('C1 上年累计 166.21', '166.21');
has('C1 累计同比 -4.89%', '-4.89%');
has('C1 环比 -13.81%', '-13.81%');
has('C1 同比 -14.32%', '-14.32%');
has('C1 判定基准（同比）', '取绝对值较大者（同比偏离）为');
has('C1 等级 重大异动', '重大异动');

[
  '|2026-01|27.42|28.35|-0.93|-3.28|--|--|--|',
  '|2026-02|25.60|26.90|-1.30|-4.83|27.42|-1.82|-6.64|',
  '|2026-03|27.95|28.62|-0.67|-2.34|25.60|+2.35|+9.18|',
  '|2026-04|27.10|27.88|-0.78|-2.80|27.95|-0.85|-3.04|',
  '|2026-05|26.86|27.44|-0.58|-2.11|27.10|-0.24|-0.89|',
  '|2026-06|23.15|27.02|-3.87|-14.32|26.86|-3.71|-13.81|'
].forEach((row, i) => has(`文档明细表第 ${i + 1} 行`, row));

/* ================= 4. 条款存在性 ================= */

console.log('=== 条款存在性 ===');
[
  ['数据口径块', '数据口径（先读这条）'],
  ['口径为当月值', '当月值（当月排放量，万t）'],
  ['跨报表口径禁令', '不要互相套用、不要做前缀和换算'],
  ['数据可得性说明', '数据可得性说明'],
  ['不采集逐日', '入参不含逐日排放数据'],
  ['不采集分工序', '不含分工序（排放源）排放数据'],
  ['只按月度口径', '本报告只按「月度」口径出具'],
  ['数组长度恒为 12', '`monthly.cur` / `monthly.prev` 长度恒为 12'],
  ['严禁外推', '严禁用最后一个已有值向后外推填充'],
  ['月份必须对齐', '两个数组的同一月份必须对齐'],
  ['全零入参示例', '全零入参示例（必须能正确生成，不得报错、不得填数）'],
  ['入参带入规则', '入参带入规则'],
  ['行业推断用途', '决定归因文案用哪一套行业内容'],
  ['数据来源与真实性要求', '数据来源与真实性要求（重要）'],
  ['计算链条自洽', '计算链条必须自洽'],
  ['除零保护', '除零保护（务必实现）'],
  ['判定必须算出来', '判定必须是"算出来的"，不许"编"'],
  ['图表无数据态', '图表也必须进入"无数据态"'],
  ['判定规则说明段', '本报告按月开展碳排放异动识别'],
  ['判定偏离度定义', '取两者绝对值较大者'],
  ['四级等级表-平稳行', '|平稳|<5%|无需专项处置，按常规流程跟踪|'],
  ['判定明细表标题', '异动判定明细'],
  ['判定结论块', '判定结论块 `.verdict`'],
  ['归因三分支-无数据', '本期排放数据缺失，暂不作归因分析'],
  ['数值取值总表', '数值取值总表（全部来自入参，零兜底）'],
  ['异动判定节', '(2) 异动判定（月度口径，必须严格遵守）'],
  ['除零保护表', '(3) 零值与缺值处理（除零保护，必须实现）'],
  ['叙事层免责句', '不含任何排放数值'],
  ['种子算法', 'seed = year × 100 + month'],
  ['行业推断与归因池', '行业推断与归因池'],
  ['数字格式节', '(6) 数字格式'],
  ['折线图规格', '(1) 折线图（月度排放趋势）'],
  ['明确不要环形图', '不要画环形图（donut）、横向条形图（hbars）'],
  ['PDF 文件名模板', '碳排放异动分析报告-{year}年{month}月.pdf'],
  ['负面清单', '不要做什么（负面清单）'],
  ['附录 A', '附录 A · 联网检索指引与行业锚点'],
  ['附录 B', '附录 B · 兜底生成规则'],
  ['附录 B 不覆盖数值', '碳排放数值（`monthly.*`、派生的一切同比/环比/偏离度）一律不兜底'],
  ['附录 C1', '### C1 正常入参（有排放数据）'],
  ['附录 C2', '### C2 全零入参（零兜底验收用例，必测）'],
  ['附录 D', '附录 D · 交付前自检清单'],
  ['行业锚点 长流程', '1.8 ~ 2.32 tCO₂/t 粗钢'],
  ['行业锚点 转炉', '1.6048 tCO₂/t'],
  ['量级自检用法', '量级自检用法'],
  ['自检清单第 14 条', '14. 全篇无 emoji、无图表库、无外部图片。']
].forEach(([label, text]) => has(label, text));

/* ================= 5. 旧规则已移除 ================= */

console.log('=== 旧规则已移除（防残留冲突） ===');
[
  ['旧公式 Σ daily', 'Σ daily'],
  ['旧公式 月日均基线', 'base = Σ'],
  ['旧阈值 ≥ 30%', '≥ 30%'],
  ['旧阈值 22% ~ 30%', '22% ~ 30%'],
  ['旧阈值 15% ~ 22%', '15% ~ 22%'],
  ['旧章节 二、本月异动清单', '二、本月异动清单'],
  ['旧章节 三、排放源结构分析', '三、排放源结构分析'],
  ['旧章节 四、重点异动事件详析', '四、重点异动事件详析'],
  ['旧章节 一、排放总览与异动判定', '一、排放总览与异动判定'],
  ['旧概念 以当月日排放量均值', '以当月日排放量均值'],
  ['旧 KPI 本月异动天数', '本月异动天数'],
  ['旧 KPI 综合预警级别', '综合预警级别'],
  ['旧 KPI 最大偏离度', '最大偏离度'],
  ['旧 KPI 月日均排放量', '月日均排放量'],
  ['旧章节 处置建议与闭环跟踪', '处置建议与闭环跟踪'],
  ['旧小节标题 （一）上月异动处置闭环情况（sec-3-1）', '上月异动处置闭环情况（sec-3-1）'],
  ['旧公式 闭环率 =', '闭环率 ='],
  ['旧表格列 异常事项数（起）', '异常事项数（起）'],
  ['旧表格列 已闭环（起）', '已闭环（起）'],
  ['旧锚点 sec-3-1', 'sec-3-1'],
  ['旧锚点 sec-3-2', 'sec-3-2']
].forEach(([label, text]) => hasNot(label, text));

// 入参块里不得再出现旧字段（结构化断言，避免被"禁止性说明"误伤）
ok('入参 JSON 不含 daily 键', !JSON.stringify(P).includes('"daily"') && !JSON.stringify(Q).includes('"daily"'));
ok('入参 JSON 不含 sources 键', !JSON.stringify(P).includes('"sources"') && !JSON.stringify(Q).includes('"sources"'));

/* ================= 6. 结构完整性 ================= */

console.log('=== 结构完整性 ===');
[
  ['标题', '# 碳排放异动分析报告 — 界面复刻提示词'],
  ['一、入参', '## 一、入参'],
  ['二、任务', '## 二、任务'],
  ['2.1 交付物', '### 2.1 交付物'],
  ['2.2 页面整体布局', '### 2.2 页面整体布局'],
  ['2.3 设计规格', '### 2.3 设计规格'],
  ['2.4 封面', '### 2.4 封面（纸面 1）'],
  ['2.5 目录', '### 2.5 目录（纸面 2）'],
  ['2.6 正文各章节', '### 2.6 正文各章节（纸面 3，按顺序）'],
  ['2.7 数据规则', '### 2.7 数据规则（唯一数据源）'],
  ['2.8 图表规格', '### 2.8 图表规格'],
  ['2.9 下载报告', '### 2.9 下载报告（PDF）'],
  ['2.10 负面清单', '### 2.10 不要做什么（负面清单）']
].forEach(([label, text]) => has(label, text));

[
  '摘要 · 本月排放概览', '一、月度排放趋势', '二、本月异动判定与分析',
  '（一）判定规则', '（二）本月判定结论', '（三）归因分析',
  '三、处置建议'
].forEach(t => has('目录/标题「' + t + '」', t));

['#sec-0', '#sec-1', '#sec-2', '#sec-2-1', '#sec-2-2', '#sec-2-3', '#sec-3']
  .forEach(a => has('锚点 ' + a, a));

/* ================= 7. 归因池完整性 ================= */

console.log('=== 归因池（6 行业 × 3 池 × 3 条） ===');

const POOLS = {
  '钢铁': [
    '本月各工序生产负荷较上月提升，铁前与炼钢环节燃料消耗同步增加，化石燃料燃烧排放相应上升',
    '高炉复风后产量处于爬坡阶段，铁水产量回升带动燃料比阶段性上升',
    '炉料结构与燃料配比发生调整，焦炭与喷吹煤消耗增加，单位产品排放强度上升',
    '本月开展计划性检修，主要工序阶段性降负荷运行，燃料消耗与工序排放同步下降',
    '高炉按计划休风，铁水产量下降带动铁前工序排放回落',
    '提高废钢比、优化炉料结构，铁水消耗与燃料单耗下降，吨钢排放强度改善',
    '本月各工序运行负荷与燃料结构基本稳定，排放波动处于正常区间',
    '生产组织平稳，主要能源介质单耗与上月基本持平',
    '能源回收与环保设施运行正常，未出现明显工况波动'
  ],
  '火力发电': [
    '机组负荷率较上月提升，燃煤量增加，燃料燃烧排放上升',
    '入炉煤热值下降，相同供电量下煤耗上升，排放强度增加',
    '机组启停调峰频次增加，启动过程燃料消耗与排放相应上升',
    '机组按计划开展检修，阶段性停机使燃料消耗与排放下降',
    '深度调峰期间机组低负荷运行，燃煤量下降',
    '掺烧生物质等低碳燃料比例提升，化石燃料消耗下降',
    '本月机组负荷率与入炉煤质基本稳定，排放波动处于正常区间',
    '运行方式未发生明显调整，供电煤耗与上月基本持平',
    '环保与节能设施运行正常，未出现明显工况波动'
  ],
  '建材': [
    '回转窑运转率提升，熟料产量增加带动燃料燃烧与工艺过程排放上升',
    '生料易烧性变差，窑系统热耗上升，单位熟料排放强度增加',
    '替代燃料投加比例下降，化石燃料消耗相应上升',
    '回转窑按计划停窑检修，熟料产量下降带动排放回落',
    '替代燃料与替代原料掺加比例提升，化石燃料与石灰石用量下降',
    '窑系统热工制度优化，烧成煤耗下降，单位熟料排放改善',
    '本月窑系统运行稳定，熟料产量与煤耗波动处于正常区间',
    '生料配比与燃料结构未发生明显调整，排放水平与上月基本持平',
    '余热回收系统运行正常，未出现明显工况波动'
  ],
  '化工石化': [
    '装置负荷较上月提升，加热炉燃料气消耗增加，排放上升',
    '原料组成变化导致工艺过程排放上升',
    '蒸汽系统供汽量增加，锅炉燃料消耗相应上升',
    '装置按计划停车检修，燃料消耗与工艺过程排放同步下降',
    '余热回收系统投运，加热炉与锅炉燃料消耗下降',
    '原料结构优化，工艺过程排放与副产气放空量下降',
    '本月装置负荷与原料结构基本稳定，排放波动处于正常区间',
    '蒸汽与加热炉系统运行方式未发生明显调整，能耗与上月基本持平',
    '火炬气回收与余热利用系统运行正常，未出现明显工况波动'
  ],
  '有色金属': [
    '电解系列电流效率波动，直流电耗上升，间接排放增加',
    '电解槽效应系数上升，全氟化碳（PFC）排放增加',
    '自备机组负荷提升，燃煤量与燃料燃烧排放上升',
    '电解系列按计划停槽检修，产量下降带动排放回落',
    '槽控系统优化，效应系数下降，PFC 排放减少',
    '电流效率提升，直流电耗下降，间接排放改善',
    '本月电解系列运行平稳，电流效率与效应系数波动处于正常区间',
    '槽控参数与自备机组运行方式未发生明显调整，能耗与上月基本持平',
    '烟气净化与余热回收系统运行正常，未出现明显工况波动'
  ],
  '通用工业': [
    '本月生产负荷提升，锅炉与主要用能设备燃料消耗增加，排放上升',
    '燃料结构中高碳燃料占比上升，单位产品排放强度增加',
    '设备运行工况波动，热效率下降，能耗与排放相应上升',
    '主要用能设备按计划检修，阶段性停运使燃料消耗与排放下降',
    '余热回收装置投运，供热与用能系统能耗下降',
    '清洁能源替代比例提升，化石燃料消耗与排放下降',
    '本月生产负荷与燃料结构基本稳定，排放波动处于正常区间',
    '主要用能设备运行方式未发生明显调整，能耗与上月基本持平',
    '能源计量与回收设施运行正常，未出现明显工况波动'
  ]
};

Object.keys(POOLS).forEach(ind => {
  const items = POOLS[ind];
  eq(ind + ' 池条目数', items.length, 9);
  items.forEach((t, i) => has(`${ind} 池第 ${i + 1} 条`, t));
});

[
  ['钢铁关键词', '钢、铁、冶金、轧钢'],
  ['火力发电关键词', '发电、电厂、热电、电力'],
  ['建材关键词', '水泥、建材、混凝土、玻璃、陶瓷'],
  ['化工石化关键词', '化工、石化、炼化、化学、化肥'],
  ['有色金属关键词', '铝、铜、锌、镁、有色'],
  ['通用工业兜底', '（均不命中）']
].forEach(([l, t]) => has(l, t));

/* ================= 8. 视觉规格逐字保留 ================= */

console.log('=== 视觉规格逐字保留 ===');
[
  ['折线图 viewBox', '`viewBox="0 0 760 250"`'],
  ['涨红', '涨/偏高红 `#d4380d`（is-pos）'],
  ['跌绿', '跌/偏低绿 `#2ba471`（is-neg）'],
  ['重大等级色', '重大 `#f53f3f`（底 `#fff1f0` 边 `#ffcfcc`）'],
  ['平稳等级色', '平稳 `#00b42a`（底 `#e8fff3` 边 `#b7ebc9`）'],
  ['无数据等级色', '无有效数据 `#98a1ab`（底 `#f4f5f7` 边 `#e0e3e8`）'],
  ['KPI 四列布局', '4 张 KPI 卡（4 列网格'],
  ['纸面阴影', '`0 4px 24px rgba(20,40,30,.10)`'],
  ['纸面内边距', '`64px 72px 72px`'],
  ['表头底与边框', '表头底 `#e9f7ee`，表格边框 `#e3e7ec`，斑马纹 `#fafcfb`'],
  ['页面背景', '页面背景 #e9edf3'],
  ['数据期间', '数据期间：{year}-{MM}-01 至 {year}-{MM}-{月末日}']
].forEach(([l, t]) => has(l, t));

/* ================= 汇总 ================= */

console.log('\n--- ' + pass + ' pass / ' + fails.length + ' fail ---');
if (fails.length) {
  console.log('\n失败项：');
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exitCode = 1;
}
