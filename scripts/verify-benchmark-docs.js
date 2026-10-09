// 独立复算：两份「对标分析报告」提示词文档
//   docs/碳排放对标分析报告-提示词.md
//   docs/碳资产对标分析报告-提示词.md
//
// 做四件事：
//   1) 从文档抠出入参 JSON（正常 + 无有效数据），保证"文档写的"与"被复算的"是同一份
//   2) 按文档的数据规则**独立复算**兜底基准与派生量，与文档里写死的期望值逐一断言
//   3) 断言文档一致性（归一化空白 + 去掉 markdown 加粗 + 破折号归一）、条款存在性、旧规则已移除
//   4) 断言零兜底语义（入参为 0 / 缺失时进入无有效数据态）与口径收缩（无年产量、无金额）
//
// 口径（2026-10-08 版）：
//   · 碳排放对标：入参只留 emission.intensity，删掉 emission.annualOutput；
//     第五章由「年减排潜力（万tCO₂/年）」改为「单位产品降碳空间（tCO₂/t ＋ 相对降幅 %）」。
//   · 碳资产对标：入参由 carbonAsset.totalValue（万元）+ annualEmission
//     改为单一 carbonAsset.volume（万tCO₂）；全篇去掉金额、收益率、履约覆盖率；
//     行业先进值方向翻转为「高于行业均值」（×1.12~1.16）。
//
// 用法：node scripts/verify-benchmark-docs.js

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'docs');
const DOC_B = path.join(DIR, '碳排放对标分析报告-提示词.md');
const DOC_A = path.join(DIR, '碳资产对标分析报告-提示词.md');

let pass = 0;
const fails = [];
function ok(label, cond, extra) { if (cond) pass++; else fails.push(label + (extra != null ? '  → ' + extra : '')); }
function eq(label, got, want) { ok(label + ' = ' + want, got === want, '实际 ' + got); }

/* ---------- 工具：与文档 2.5(1) 完全一致的散列与伪随机 ---------- */
function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = n => Math.round(Number(n) * 10) / 10;
const r2 = n => Math.round(Number(n) * 100) / 100;
const r4 = n => Math.round(Number(n) * 10000) / 10000;

function readDoc(f) { return fs.readFileSync(f, 'utf8'); }
function norm(s) {
  return String(s).replace(/[ \t\u00a0\u3000]+/g, '').replace(/\*\*/g, '').replace(/[−–—]/g, '-');
}
/** 抠出「含指定主键」的完整入参 JSON 块（数组片段示例会解析失败，自动跳过） */
function extractInputs(src, requiredKeys) {
  const out = [];
  for (const m of src.matchAll(/```json\s*\n?([\s\S]*?)```/g)) {
    try {
      const o = JSON.parse(m[1].trim());
      if (o && o.companyName && requiredKeys.every(k => o[k] !== undefined)) out.push(o);
    } catch (e) { /* 片段示例，跳过 */ }
  }
  return out;
}

const rawB = readDoc(DOC_B);
const rawA = readDoc(DOC_A);
const flatB = norm(rawB);
const flatA = norm(rawA);
function hasB(l, t) { ok('【碳排放】文档含 ' + l, flatB.includes(norm(t))); }
function hasA(l, t) { ok('【碳资产】文档含 ' + l, flatA.includes(norm(t))); }
function noB(l, t) { ok('【碳排放】文档不含 ' + l, !flatB.includes(norm(t))); }
function noA(l, t) { ok('【碳资产】文档不含 ' + l, !flatA.includes(norm(t))); }

/* ================= 1. 入参解析 ================= */

console.log('--- 1. 入参解析 ---');
const IN_B = extractInputs(rawB, ['emission']);
const IN_A = extractInputs(rawA, ['carbonAsset']);
eq('碳排放文档 入参块数', IN_B.length, 2);
eq('碳资产文档 入参块数', IN_A.length, 2);

const B_OK = IN_B[0] || {}, B_ZERO = IN_B[1] || {};
const A_OK = IN_A[0] || {}, A_ZERO = IN_A[1] || {};
console.log('   碳排放：' + B_OK.companyName + ' / ' + B_OK.year + '-' + B_OK.month + ' / intensity=' + (B_OK.emission || {}).intensity);
console.log('   碳资产：' + A_OK.companyName + ' / ' + A_OK.year + '-' + A_OK.month + ' / volume=' + (A_OK.carbonAsset || {}).volume);

ok('碳排放 正常入参含 emission.intensity', typeof (B_OK.emission || {}).intensity === 'number');
ok('碳排放 正常入参不含 emission.annualOutput', (B_OK.emission || {}).annualOutput === undefined);
ok('碳排放 无数据入参 intensity = 0', ((B_ZERO.emission || {}).intensity) === 0);
ok('碳排放 无数据入参不含 annualOutput', (B_ZERO.emission || {}).annualOutput === undefined);
ok('碳排放 正常入参无顶层 annualOutput', B_OK.annualOutput === undefined);

ok('碳资产 正常入参含 carbonAsset.volume', typeof (A_OK.carbonAsset || {}).volume === 'number');
ok('碳资产 正常入参不含 carbonAsset.totalValue', (A_OK.carbonAsset || {}).totalValue === undefined);
ok('碳资产 正常入参不含顶层 annualEmission', A_OK.annualEmission === undefined);
ok('碳资产 无数据入参 volume = 0', ((A_ZERO.carbonAsset || {}).volume) === 0);
ok('碳资产 无数据入参不含 totalValue / annualEmission',
  (A_ZERO.carbonAsset || {}).totalValue === undefined && A_ZERO.annualEmission === undefined);

/* ================= 2. 独立复算：碳排放对标 ================= */

console.log('--- 2. 独立复算 · 碳排放对标 ---');

function benchBuild(input) {
  const Y = input.year, M = input.month, REGION = input.region || '河南省';
  const IS_NATIONAL = REGION === '全国';
  const rnd = mulberry32((strHash(REGION) ^ Math.imul(Y, 131) ^ M) >>> 0);

  // L3 兜底基准（顺序不可换）
  const indAvg = r4((0.8020 + (2026 - Y) * 0.015) * (1 + (rnd() - 0.5) * 0.008));
  const regionOffset = IS_NATIONAL ? 0 : (rnd() - 0.45) * 0.12;
  const regionAvg = r4(indAvg * (1 + regionOffset));
  const advanced = r4(indAvg * (0.925 + rnd() * 0.01));
  const entCount = IS_NATIONAL ? Math.round(1400 + rnd() * 900) : Math.round(45 + rnd() * 180);

  // L1 入参（只认 intensity）
  const IN = input.emission || {};
  const HAS_ENT = typeof IN.intensity === 'number' && IN.intensity > 0;
  const ent = HAS_ENT ? r4(IN.intensity) : null;

  let rank = null, outperform = null, vsRegion = null, vsIndustry = null, vsAdvanced = null;
  let gapToAvg = null, gapToAdvanced = null, cutPctToAvg = null, cutPctToAdvanced = null;
  if (HAS_ENT) {
    const rankPct = Math.min(0.98, Math.max(0.02, 0.5 - (regionAvg - ent) / (regionAvg * 0.22)));
    rank = Math.max(1, Math.round(entCount * rankPct));
    outperform = r1((1 - rank / entCount) * 100);
    vsRegion = r2((ent - regionAvg) / regionAvg * 100);
    vsIndustry = r2((ent - indAvg) / indAvg * 100);
    vsAdvanced = r2((ent - advanced) / advanced * 100);
    gapToAvg = r4(ent - indAvg);
    gapToAdvanced = r4(ent - advanced);
    cutPctToAvg = r2(Math.max(0, ent - indAvg) / ent * 100);
    cutPctToAdvanced = r2(Math.max(0, ent - advanced) / ent * 100);
  }

  return { indAvg, regionAvg, advanced, entCount, ent, HAS_ENT, rank, outperform,
    vsRegion, vsIndustry, vsAdvanced, gapToAvg, gapToAdvanced, cutPctToAvg, cutPctToAdvanced };
}

const NB = benchBuild(B_OK);
const ZB = benchBuild(B_ZERO);

eq('碳排放 indAvg', NB.indAvg, 0.8032);
eq('碳排放 regionAvg', NB.regionAvg, 0.7954);
eq('碳排放 advanced', NB.advanced, 0.7495);
eq('碳排放 entCount', NB.entCount, 113);
eq('碳排放 ent', NB.ent, 0.7662);
eq('碳排放 rank', NB.rank, 38);
eq('碳排放 outperform', NB.outperform, 66.4);
eq('碳排放 vsRegion', NB.vsRegion, -3.67);
eq('碳排放 vsIndustry', NB.vsIndustry, -4.61);
eq('碳排放 vsAdvanced', NB.vsAdvanced, 2.23);
eq('碳排放 情景一 强度差距', NB.gapToAvg, -0.037);
eq('碳排放 情景一 相对降幅', NB.cutPctToAvg, 0);
eq('碳排放 情景二 强度差距', NB.gapToAdvanced, 0.0167);
eq('碳排放 情景二 相对降幅', NB.cutPctToAdvanced, 2.18);
ok('碳排放 基准相对关系 advanced < indAvg', NB.advanced < NB.indAvg);
ok('碳排放 相对降幅下限为 0（不为负）',
  NB.cutPctToAvg >= 0 && NB.cutPctToAdvanced >= 0);

// 零兜底
eq('碳排放 无数据 HAS_ENT', ZB.HAS_ENT, false);
eq('碳排放 无数据 rank → null', ZB.rank, null);
eq('碳排放 无数据 vsRegion → null', ZB.vsRegion, null);
eq('碳排放 无数据 相对降幅 → null', ZB.cutPctToAvg, null);
ok('碳排放 正常入参 rank 非 null（保护未误伤）', NB.rank !== null);
ok('碳排放 正常入参 相对降幅非 null（保护未误伤）', NB.cutPctToAdvanced !== null);

/* ================= 3. 独立复算：碳资产对标 ================= */

console.log('--- 3. 独立复算 · 碳资产对标 ---');

function assetBuild(input) {
  const Y = input.year, M = input.month, REGION = input.region || '河南省';
  const IS_NATIONAL = REGION === '全国';
  const rnd = mulberry32((strHash(REGION) ^ Math.imul(Y, 131) ^ Math.imul(M, 977)) >>> 0);

  const SHARE_ALLOWANCE = 0.88, SHARE_CCER = 0.07;
  const IN = input.carbonAsset || {};
  const HAS_VOLUME = typeof IN.volume === 'number' && IN.volume > 0;
  const entVolume = HAS_VOLUME ? r2(IN.volume) : null;

  const entAllowance = HAS_VOLUME ? r2(entVolume * SHARE_ALLOWANCE) : null;
  const entCCER = HAS_VOLUME ? r2(entVolume * SHARE_CCER) : null;
  const entOther = HAS_VOLUME ? r2(entVolume - entAllowance - entCCER) : null;

  // L3 兜底基准：rnd() 无条件消耗（全国跳过 regionOffset）
  const regionOffset = IS_NATIONAL ? 0 : (rnd() - 0.45) * 0.12;
  const uInd = rnd(), uAdv = rnd();
  const regionAvgVolume = HAS_VOLUME ? r2(entVolume * (1 + regionOffset)) : null;
  const indAvgVolume = HAS_VOLUME ? r2(entVolume * (1 + (uInd - 0.42) * 0.10)) : null;
  const advancedVolume = HAS_VOLUME ? r2(indAvgVolume * (1.12 + uAdv * 0.04)) : null;
  const entCount = IS_NATIONAL ? Math.round(1400 + rnd() * 900) : Math.round(45 + rnd() * 180);

  let rank = null, outperform = null, vsRegion = null, vsIndustry = null, vsAdvanced = null;
  if (HAS_VOLUME) {
    const rankPct = Math.min(0.98, Math.max(0.02, 0.5 - (entVolume - regionAvgVolume) / (regionAvgVolume * 0.22)));
    rank = Math.max(1, Math.round(entCount * rankPct));
    outperform = r1((1 - rank / entCount) * 100);
    vsRegion = r2((entVolume - regionAvgVolume) / regionAvgVolume * 100);
    vsIndustry = r2((entVolume - indAvgVolume) / indAvgVolume * 100);
    vsAdvanced = r2((entVolume - advancedVolume) / advancedVolume * 100);
  }
  const gapAvg = HAS_VOLUME ? r2(Math.max(0, indAvgVolume - entVolume)) : null;
  const gapAdvanced = HAS_VOLUME ? r2(Math.max(0, advancedVolume - entVolume)) : null;
  const pctAvg = gapAvg == null ? null : r2(gapAvg / entVolume * 100);
  const pctAdvanced = gapAdvanced == null ? null : r2(gapAdvanced / entVolume * 100);

  return { entVolume, entAllowance, entCCER, entOther, regionAvgVolume, indAvgVolume, advancedVolume,
    entCount, rank, outperform, vsRegion, vsIndustry, vsAdvanced,
    gapAvg, gapAdvanced, pctAvg, pctAdvanced, HAS_VOLUME };
}

const NA = assetBuild(A_OK);
const ZA = assetBuild(A_ZERO);

eq('碳资产 entVolume', NA.entVolume, 320);
eq('碳资产 regionAvgVolume', NA.regionAvgVolume, 324.66);
eq('碳资产 indAvgVolume', NA.indAvgVolume, 307.06);
eq('碳资产 advancedVolume', NA.advancedVolume, 356.13);
eq('碳资产 entAllowance（配额持有量）', NA.entAllowance, 281.6);
eq('碳资产 entCCER（CCER 储备量）', NA.entCCER, 22.4);
eq('碳资产 entOther（其他碳资产）', NA.entOther, 16);
eq('碳资产 结构三项之和 = 碳资产量', r2(NA.entAllowance + NA.entCCER + NA.entOther), 320);
eq('碳资产 rank', NA.rank, 54);
eq('碳资产 entCount', NA.entCount, 95);
eq('碳资产 outperform', NA.outperform, 43.2);
eq('碳资产 vsRegion', NA.vsRegion, -1.44);
eq('碳资产 vsIndustry', NA.vsIndustry, 4.21);
eq('碳资产 vsAdvanced', NA.vsAdvanced, -10.15);
eq('碳资产 情景一 差距量', NA.gapAvg, 0);
eq('碳资产 情景一 相对提升幅度', NA.pctAvg, 0);
eq('碳资产 情景二 差距量', NA.gapAdvanced, 36.13);
eq('碳资产 情景二 相对提升幅度', NA.pctAdvanced, 11.29);
ok('碳资产 基准相对关系 advancedVolume > indAvgVolume', NA.advancedVolume > NA.indAvgVolume);
ok('碳资产 差距量下限为 0（不为负）', NA.gapAvg >= 0 && NA.gapAdvanced >= 0);
ok('碳资产 本报告无任何金额派生量（无 costToFull / gainToAdvanced 概念）',
  !('costToFull' in NA) && !('gainToAdvanced' in NA) && !('entROI' in NA));

// 零兜底
eq('碳资产 无数据 HAS_VOLUME', ZA.HAS_VOLUME, false);
eq('碳资产 无数据 rank → null', ZA.rank, null);
eq('碳资产 无数据 差距量 → null', ZA.gapAvg, null);
eq('碳资产 无数据 相对提升幅度 → null', ZA.pctAdvanced, null);
ok('碳资产 无数据时 entVolume 为 null', ZA.entVolume === null);
ok('碳资产 无数据时基准一并不可用', ZA.regionAvgVolume === null && ZA.advancedVolume === null);
ok('碳资产 正常入参 rank 非 null（保护未误伤）', NA.rank !== null);
ok('碳资产 样本企业数与入参无关（无数据时仍有值）', ZA.entCount !== null);

// 「全国」时区域均值 = 本企业值
const AN = assetBuild(Object.assign({}, A_OK, { region: '全国' }));
eq('碳资产 全国口径 区域均值 = 本企业值', AN.regionAvgVolume, 320);

// 相对位置不随 volume 变化（L3 以本企业量级为锚的固有性质）
const A2 = assetBuild(Object.assign({}, A_OK, { carbonAsset: { volume: 1200 } }));
eq('碳资产 排名不随 volume 变化', A2.rank, NA.rank);
eq('碳资产 vsIndustry 不随 volume 变化', A2.vsIndustry, NA.vsIndustry);
ok('碳资产 差距量随 volume 等比缩放', r2(A2.gapAdvanced / NA.gapAdvanced) === 3.75);

/* ================= 4. 文档一致性 ================= */

console.log('--- 4. 文档一致性 ---');
hasB('C1 强度 0.7662', '0.7662');
hasB('C1 indAvg 0.8032', '0.8032');
hasB('C1 regionAvg 0.7954', '0.7954');
hasB('C1 advanced 0.7495', '0.7495');
hasB('C1 优于区域 3.67%', '本企业优于区域 3.67%');
hasB('C1 优于行业 4.61%', '本企业优于行业 4.61%');
hasB('C1 距先进差距 2.23%', '距先进差距 2.23%');
hasB('C1 排名 38', '第 `38` 名');
hasB('C1 超越比例 66.4%', '66.4%');
hasB('C1 情景一 强度差距 -0.0370', '`-0.0370`');
hasB('C1 情景二 强度差距 +0.0167', '`+0.0167`');
hasB('C1 情景二 相对降幅 2.18%', '2.18%');
hasB('C1 结论句', '本企业碳排放强度已达行业平均水平（0.8032 tCO₂/t），该档无降碳空间；达到行业先进水平可降低单位产品碳排放 0.0167 tCO₂/t（相对降幅 2.18%）。');

hasA('C1 碳资产量 320.00', '`320.00` 万tCO₂');
hasA('C1 regionAvgVolume 324.66', '324.66');
hasA('C1 indAvgVolume 307.06', '307.06');
hasA('C1 advancedVolume 356.13', '356.13');
hasA('C1 配额 281.60', '`281.60` 万tCO₂（88.0%）');
hasA('C1 CCER 22.40', '`22.40` 万tCO₂（7.0%）');
hasA('C1 其他 16.00', '`16.00` 万tCO₂（5.0%）');
hasA('C1 排名 54 / 95 家', '第 `54` 名（共 `95` 家）');
hasA('C1 超越比例 43.2%', '43.2%');
hasA('C1 高于行业 4.21%', '本企业高于行业 4.21%');
hasA('C1 低于区域 1.44%', '本企业低于区域 1.44%');
hasA('C1 距先进差距 10.15%', '距先进差距 10.15%');
hasA('C1 情景二 差距量 36.13', '`36.13` / `11.29%`');
hasA('C1 情景一 差距量 0.00', '`0.00` / `0.00%`');
hasA('C1 结论段', '本企业碳资产量已达行业平均水平（307.06 万tCO₂），无需增持；达到行业先进水平需增持 36.13 万tCO₂（相对提升 11.29%）。');

/* ================= 5. 条款存在性 ================= */

console.log('--- 5. 条款存在性 ---');
[
  ['数据口径块', '数据口径（先读这条）'],
  ['数据可得性说明', '**数据可得性说明**'],
  ['入参字段说明', '### 入参字段说明'],
  ['无有效数据示例', '无有效数据（`emission.intensity` 缺失或 `≤ 0`）时的入参示例'],
  ['数据来源与真实性要求', '### 数据来源与真实性要求（先读）'],
  ['L1 分层', 'L1 入参直取（零兜底）'],
  ['L3 分层', 'L3 兜底生成'],
  ['本企业强度改为入参', '直接取入参，不做任何年份折算'],
  ['只采集强度一项', '本企业数据只采集"单位产品碳排放强度"一项'],
  ['章名已改', '**(9) 五、企业降碳空间深度分析**'],
  ['降碳空间表 5 列', '`目标情景 | 本企业强度 | 目标强度 | 强度差距 | 相对降幅`'],
  ['相对降幅公式', '相对降幅（%）＝强度差距 ÷ 本企业碳排放强度 × 100'],
  ['不可出现年产量两列', '**不要出现「年产量」「年减排潜力」两列**'],
  ['零值与缺值处理', '(12) 零值与缺值处理（除零保护，必须实现）'],
  ['不为本企业兜底', '不要给本企业强度兜底'],
  ['不引入产量口径', '不要引入本报告没有的企业数据'],
  ['不以碳价折算金额', '不要以碳价折算金额'],
  ['附录 A', '## 附录 A · 行业锚点与量级自检'],
  ['附录 B', '## 附录 B · 兜底生成规则'],
  ['附录 C1', '### C1 正常入参'],
  ['附录 C2', '### C2 无有效数据'],
  ['附录 C3', '### C3 删掉整个 `emission` 字段'],
  ['附录 D', '## 附录 D · 交付前自检清单'],
  ['基准顺序不可换', '取值顺序不可调换'],
  ['全国跳过 rnd', '**全国时跳过**'],
  ['行业锚点 长流程', '1.8 ~ 2.32 tCO₂/t 粗钢']
].forEach(([l, t]) => hasB(l, t));

[
  ['数据口径块', '数据口径（先读这条）'],
  ['实物量口径', '本报告是"实物量"口径（万tCO₂），全篇不出现金额'],
  ['入参字段说明', '### 入参字段说明'],
  ['数据可得性说明', '**数据可得性说明**'],
  ['无有效数据示例', '无有效数据（`carbonAsset.volume` 缺失或 `≤ 0`）时的入参示例'],
  ['数据来源与真实性要求', '### 数据来源与真实性要求（先读）'],
  ['L1 分层', 'L1 入参直取（零兜底）'],
  ['结构性派生', '结构性派生——资产结构'],
  ['L3 分层', 'L3 兜底生成'],
  ['结构占比固定', 'SHARE_ALLOWANCE = 0.88'],
  ['结构用减法保证', '减法保证三项之和'],
  ['先进值方向翻转', '先进值 = 行业均值 × (1.12 ~ 1.16)'],
  ['第五章改名', '**(9) 五、碳资产储备提升空间分析**'],
  ['储备提升表 5 列', '`目标情景 | 本企业碳资产量 | 目标水平 | 差距量 | 相对提升幅度`'],
  ['相对提升公式', '相对提升幅度（%）＝差距量 ÷ 本企业碳资产量 × 100'],
  ['零值与缺值处理', '(6) 零值与缺值处理（除零保护，必须实现）'],
  ['不为本企业兜底', '不要给本企业碳资产量兜底'],
  ['不把结构说成独立台账', '不要把结构拆解说成独立台账'],
  ['不与旧版校验表对照', '不要拿旧版的校验表来对'],
  ['基准以本企业量级为锚', '本报告的基准以"本企业量级"为锚'],
  ['附录 A', '## 附录 A · 量级锚点与自检'],
  ['附录 A 为何不收金额', '本报告为何不收金额'],
  ['附录 B', '## 附录 B · 兜底生成规则'],
  ['附录 C1', '### C1 正常入参'],
  ['附录 C2', '### C2 无有效数据'],
  ['附录 C3', '### C3 删掉整个 `carbonAsset` 字段'],
  ['附录 D', '## 附录 D · 交付前自检清单'],
  ['好坏语义', '碳资产量「高=好=绿」']
].forEach(([l, t]) => hasA(l, t));

/* ================= 6. 旧规则已移除 ================= */

console.log('--- 6. 旧规则已移除 ---');
// 注意：不能用「裸词扫全文」——负面清单里会点名禁止这些词，会误伤。
// 一律用**结构形态**或**字段定义形态**做断言。
[
  ['旧写死强度序列', 'INTENSITY_2026'],
  ['旧序列字面量', '0.7605, 0.7573'],
  ['旧年份折算系数', '(1 + (2026 − year) × 0.012)'],
  ['旧产量反推', '6058.01 / 0.7663'],
  ['旧产量常量名', 'ANNUAL_OUTPUT'],
  ['旧产量入参字段定义', '| `emission.annualOutput` |'],
  ['旧年产量测算表', '年减排潜力测算表'],
  ['旧碳价常量小节', '**(11) 碳价常量**'],
  ['旧收益段公式', 'potToAdvanced × 90']
].forEach(([l, t]) => noB(l, t));

[
  ['旧年度排放常量', 'ANNUAL_EMISSION = 6058'],
  ['旧年度排放数值（区块规格内）', '6058'],
  ['旧总价值入参字段定义', '| `carbonAsset.totalValue` |'],
  ['旧年排放入参字段定义', '| `annualEmission` |'],
  ['旧三项独立编造注释', '本企业持仓量与价值'],
  ['旧碳价常量', 'CARBON_PRICE = 90'],
  ['旧收益率变量定义', 'var entROI'],
  ['旧覆盖率变量定义', 'var entCoverage'],
  ['旧潜力表名', '碳资产优化潜力测算表'],
  ['旧章节名', '五、碳资产收益与履约保障潜力分析'],
  ['旧基准倒挂关系', 'advancedTotal < indAvgTotal']
].forEach(([l, t]) => noA(l, t));

// 结构化断言：入参里已无旧字段
ok('碳排放 入参里无写死强度序列', !JSON.stringify(B_OK).includes('INTENSITY'));
ok('碳排放 入参里无 annualOutput', !JSON.stringify(IN_B).includes('annualOutput'));
ok('碳资产 入参里无 totalValue', !JSON.stringify(IN_A).includes('totalValue'));
ok('碳资产 入参里无 annualEmission', !JSON.stringify(IN_A).includes('annualEmission'));
ok('碳资产 入参里无 ANNUAL_EMISSION', !JSON.stringify(A_OK).includes('ANNUAL_EMISSION'));

/* ================= 汇总 ================= */

console.log('\n--- ' + pass + ' pass / ' + fails.length + ' fail ---');
if (fails.length) {
  console.log('\n失败项：');
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exitCode = 1;
}
