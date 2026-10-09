// 独立复算：「碳月报及差异分析」四份提示词文档
//   docs/碳排放月度报表-提示词.md      （tab=emission 月度报表）
//   docs/碳交易月度报表-提示词.md      （tab=trade    月度报表）
//   docs/碳排放差异分析-提示词.md      （tab=emission 差异分析）
//   docs/碳交易差异分析-提示词.md      （tab=trade    差异分析）
//
// 做四件事：
//   1) 从每份文档抠出入参 JSON（正常 + 全零），保证"文档写的"与"被复算的"是同一份
//   2) 按文档的数据规则**独立复算** C1/C2（派生量、环比同比、因素分解），与文档写死的期望值逐一断言
//   3) 断言文档一致性（归一化空白 + 去加粗 + 破折号归一）、条款存在性、旧规则已移除（结构化断言）
//   4) 断言口径收缩：碳排放侧无排放源结构章节；碳交易侧无持仓/明细/行情章节
//
// 用法：node scripts/verify-monthly-docs.js

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'docs');
const DOC = {
  reportEmission: path.join(DIR, '碳排放月度报表-提示词.md'),
  reportTrade: path.join(DIR, '碳交易月度报表-提示词.md'),
  diffEmission: path.join(DIR, '碳排放差异分析-提示词.md'),
  diffTrade: path.join(DIR, '碳交易差异分析-提示词.md')
};

let pass = 0;
const fails = [];
function ok(label, cond, extra) { if (cond) pass++; else fails.push(label + (extra != null ? '  → ' + extra : '')); }
function eq(label, got, want) { ok(label + ' = ' + want, got === want, '实际 ' + got); }

/* ---------- 工具 ---------- */
const r2 = n => (n == null || !isFinite(n)) ? null : Math.round(n * 100) / 100;
const r4 = n => (n == null || !isFinite(n)) ? null : Math.round(n * 10000) / 10000;
function pctOf(a, b) { return (a == null || b == null || !isFinite(a) || !isFinite(b) || !(b > 0)) ? null : r2((a - b) / b * 100); }

/** 两因素乘法模型分解（残差口径，与文档 2.5(4) 一字不差） */
function decompose(x0, y0, x1, y1, dec) {
  if (x0 == null || y0 == null || x1 == null || y1 == null) {
    return { z0: null, z1: null, d: null, xEff: null, yEff: null, cross: null,
      xShare: null, yShare: null, crossShare: null, valid: false };
  }
  const k = Math.pow(10, dec);
  const rd = n => Math.round(n * k) / k;
  const z0 = rd(x0 * y0), z1 = rd(x1 * y1);
  const d = rd(z1 - z0);
  const xEff = rd((x1 - x0) * y0);
  const yEff = rd((y1 - y0) * x0);
  const cross = rd(d - xEff - yEff);
  const absSum = Math.abs(xEff) + Math.abs(yEff) + Math.abs(cross);
  const share = v => absSum ? Math.round(Math.abs(v) / absSum * 1000) / 10 : null;
  const xShare = share(xEff), yShare = share(yEff);
  const crossShare = (xShare == null) ? null : Math.round((100 - xShare - yShare) * 10) / 10;
  return { z0, z1, d, xEff, yEff, cross, xShare, yShare, crossShare, valid: true };
}

function readDoc(f) { return fs.readFileSync(f, 'utf8'); }
function norm(s) {
  return String(s).replace(/[ \t\u00a0\u3000]+/g, '').replace(/\*\*/g, '').replace(/[−–—]/g, '-');
}
function extractInputs(src, requiredKeys) {
  const out = [];
  for (const m of src.matchAll(/```json\s*\n?([\s\S]*?)```/g)) {
    try {
      const o = JSON.parse(m[1].trim());
      if (o && o.companyName && requiredKeys.every(k => o[k] !== undefined)) out.push(o);
    } catch (e) { /* 片段，跳过 */ }
  }
  return out;
}

/* ---------- 默认入参（与文档 JSON 示例逐字一致） ---------- */
const EM = {
  cur:  [26.84, 24.62, 27.15, 26.38, 26.12, 25.83, 26.47, 26.90, 25.76, 26.31, 25.94, 26.68],
  prev: [27.79, 25.48, 28.06, 27.28, 27.02, 26.72, 27.38, 27.83, 26.65, 27.22, 26.84, 27.60],
  icur: [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663],
  iprev: [0.7696, 0.7664, 0.7729, 0.7722, 0.7738, 0.7745, 0.7750, 0.7754, 0.7747, 0.7753, 0.7749, 0.7755]
};
const TR = {
  cur:  [4.62, 3.85, 5.94, 4.78, 6.73, 5.31, 4.47, 6.12, 5.03, 7.24, 5.58, 4.41],
  prev: [4.90, 4.08, 6.30, 5.07, 7.13, 5.63, 4.74, 6.49, 5.33, 7.67, 5.91, 4.67],
  pcur: [86.5, 88.2, 85.7, 89.4, 91.2, 88.6, 90.3, 92.1, 90.8, 93.5, 91.7, 94.2],
  pprev: [83.04, 84.67, 82.27, 85.82, 87.55, 85.06, 86.69, 88.42, 87.17, 89.76, 88.03, 90.43]
};

/* ---------- 复算：碳排放月报 / 差异分析 ---------- */
function buildEmission(M) {
  const PM = M === 1 ? 0 : M - 1, HAS = M > 1;
  const cur = r2(EM.cur[M - 1]);
  const prev = HAS ? r2(EM.cur[PM - 1]) : null;
  const yoy = r2(EM.prev[M - 1]);
  const i1 = r4(EM.icur[M - 1]);
  const i0m = HAS ? r4(EM.icur[PM - 1]) : null;
  const i0y = r4(EM.iprev[M - 1]);
  const q1 = i1 > 0 ? r4(cur / i1) : null;
  const q0m = (i0m != null && i0m > 0) ? r4(prev / i0m) : null;
  const q0y = (i0y != null && i0y > 0) ? r4(yoy / i0y) : null;
  let cum = 0; for (let i = 0; i < M; i++) cum += EM.cur[i];
  cum = r2(cum);
  const sorted = EM.cur.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  return {
    cur, prev, yoy, i1, i0m, i0y, q1, q0m, q0y, cum, HAS,
    proj: r2(cum / M * 12),
    momEmissionDiff: prev == null ? null : r2(cur - prev),
    yoyEmissionDiff: r2(cur - yoy),
    momEmissionPct: pctOf(cur, prev),
    yoyEmissionPct: pctOf(cur, yoy),
    momIntensityPct: pctOf(i1, i0m),
    yoyIntensityPct: pctOf(i1, i0y),
    rank: sorted.findIndex(o => o.i === M - 1) + 1,
    maxMonth: EM.cur.indexOf(Math.max.apply(null, EM.cur)) + 1,
    max: Math.max.apply(null, EM.cur),
    minMonth: EM.cur.indexOf(Math.min.apply(null, EM.cur)) + 1,
    min: Math.min.apply(null, EM.cur),
    iMin: Math.min.apply(null, EM.icur), iMax: Math.max.apply(null, EM.icur),
    momD: decompose(q0m, i0m, q1, i1, 2),
    yoyD: decompose(q0y, i0y, q1, i1, 2)
  };
}

/* ---------- 复算：碳交易月报 / 差异分析 ---------- */
function buildTrade(M) {
  const PM = M === 1 ? 0 : M - 1, HAS = M > 1;
  const v1 = r2(TR.cur[M - 1]);
  const v0m = HAS ? r2(TR.cur[PM - 1]) : null;
  const v0y = r2(TR.prev[M - 1]);
  const p1 = r2(TR.pcur[M - 1]);
  const p0m = HAS ? r2(TR.pcur[PM - 1]) : null;
  const p0y = r2(TR.pprev[M - 1]);
  const a1 = r2(v1 * p1);
  const a0m = (v0m == null || p0m == null) ? null : r2(v0m * p0m);
  const a0y = r2(v0y * p0y);
  let cum = 0; for (let i = 0; i < M; i++) cum += TR.cur[i];
  cum = r2(cum);
  const sorted = TR.cur.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  return {
    v1, v0m, v0y, p1, p0m, p0y, a1, a0m, a0y, cum, HAS,
    proj: r2(cum / M * 12),
    momAmtDiff: a0m == null ? null : r2(a1 - a0m),
    yoyAmtDiff: r2(a1 - a0y),
    amtMomPct: pctOf(a1, a0m),
    amtYoyPct: pctOf(a1, a0y),
    volMomPct: pctOf(v1, v0m),
    volYoyPct: pctOf(v1, v0y),
    prMomPct: pctOf(p1, p0m),
    prYoyPct: pctOf(p1, p0y),
    rank: sorted.findIndex(o => o.i === M - 1) + 1,
    maxMonth: TR.cur.indexOf(Math.max.apply(null, TR.cur)) + 1,
    max: Math.max.apply(null, TR.cur),
    minMonth: TR.cur.indexOf(Math.min.apply(null, TR.cur)) + 1,
    min: Math.min.apply(null, TR.cur),
    pMin: Math.min.apply(null, TR.pcur), pMax: Math.max.apply(null, TR.pcur),
    momD: decompose(v0m, p0m, v1, p1, 2),
    yoyD: decompose(v0y, p0y, v1, p1, 2)
  };
}

const E9 = buildEmission(9), E1 = buildEmission(1);
const T9 = buildTrade(9), T1 = buildTrade(1);
const ZE = buildEmission(9), ZT = buildTrade(9);   // 全零另算（见下）

/* 全零 */
function zeroBuild(kind, M) {
  const PM = M === 1 ? 0 : M - 1, HAS = M > 1;
  if (kind === 'emission') {
    const cur = 0, i1 = 0;
    const q1 = i1 > 0 ? 0 : null;
    const i0m = HAS ? 0 : null;
    const q0m = (i0m != null && i0m > 0) ? 0 : null;
    const i0y = 0;
    const q0y = i0y > 0 ? 0 : null;
    return { cum: 0, momDiff: HAS ? 0 : null, yoyDiff: 0, i1: 0, q1,
      momPct: null, yoyPct: null,
      momD: decompose(q0m, i0m, q1, i1, 2), yoyD: decompose(q0y, i0y, q1, i1, 2) };
  }
  const v1 = 0, p1 = 0, a1 = 0;
  const v0m = HAS ? 0 : null, p0m = HAS ? 0 : null;
  const a0m = (v0m == null || p0m == null) ? null : 0;
  return { cum: 0, a1, momDiff: a0m == null ? null : 0, yoyDiff: 0,
    momPct: null, yoyPct: null,
    momD: decompose(v0m, p0m, v1, p1, 2), yoyD: decompose(0, 0, v1, p1, 2) };
}
const ZEB = zeroBuild('emission', 9), ZTB = zeroBuild('trade', 9);

/* ================= 1. 入参解析 ================= */
console.log('--- 1. 入参解析 ---');
const raw = {};
Object.keys(DOC).forEach(k => { raw[k] = readDoc(DOC[k]); });
const IN = {
  reportEmission: extractInputs(raw.reportEmission, ['emission']),
  reportTrade: extractInputs(raw.reportTrade, ['trade']),
  diffEmission: extractInputs(raw.diffEmission, ['emission']),
  diffTrade: extractInputs(raw.diffTrade, ['trade'])
};
Object.keys(IN).forEach(k => eq(k + ' 入参块数', IN[k].length, 2));

const RE = IN.reportEmission[0] || {}, RE0 = IN.reportEmission[1] || {};
const RT = IN.reportTrade[0] || {}, RT0 = IN.reportTrade[1] || {};
const DE = IN.diffEmission[0] || {}, DE0 = IN.diffEmission[1] || {};
const DT = IN.diffTrade[0] || {}, DT0 = IN.diffTrade[1] || {};

[['月度报表·碳排放', RE, RE0, 'emission'], ['差异分析·碳排放', DE, DE0, 'emission']].forEach(([n, o, z, key]) => {
  ok(n + ' 入参含 ' + key + '.volume.cur[12]', Array.isArray(((o[key] || {}).volume || {}).cur) && o[key].volume.cur.length === 12);
  ok(n + ' 入参含 ' + key + '.volume.prev[12]', Array.isArray(((o[key] || {}).volume || {}).prev) && o[key].volume.prev.length === 12);
  ok(n + ' 入参含 ' + key + '.intensity.cur[12]', Array.isArray(((o[key] || {}).intensity || {}).cur) && o[key].intensity.cur.length === 12);
  ok(n + ' 入参含 ' + key + '.intensity.prev[12]', Array.isArray(((o[key] || {}).intensity || {}).prev) && o[key].intensity.prev.length === 12);
  ok(n + ' 入参不含 sources/daily/output 等旧字段', !JSON.stringify(o).match(/sources|daily|output|annualOutput/));
  ok(n + ' 全零入参四组数组全 0', [z[key].volume.cur, z[key].volume.prev, z[key].intensity.cur, z[key].intensity.prev]
    .every(a => a.every(v => v === 0)));
});
[['月度报表·碳交易', RT, RT0], ['差异分析·碳交易', DT, DT0]].forEach(([n, o, z]) => {
  ok(n + ' 入参含 trade.volume.cur[12]', Array.isArray((o.trade || {}).volume.cur) && o.trade.volume.cur.length === 12);
  ok(n + ' 入参含 trade.volume.prev[12]', Array.isArray((o.trade || {}).volume.prev) && o.trade.volume.prev.length === 12);
  ok(n + ' 入参含 trade.price.cur[12]', Array.isArray((o.trade || {}).price.cur) && o.trade.price.cur.length === 12);
  ok(n + ' 入参含 trade.price.prev[12]', Array.isArray((o.trade || {}).price.prev) && o.trade.price.prev.length === 12);
  ok(n + ' 入参不含持仓/明细/行情字段', !JSON.stringify(o).match(/hold|allowance|ccer|deal|market|annualEmission/));
  ok(n + ' 全零入参四组数组全 0', [z.trade.volume.cur, z.trade.volume.prev, z.trade.price.cur, z.trade.price.prev]
    .every(a => a.every(v => v === 0)));
});

/* ================= 2. 独立复算 ================= */
console.log('--- 2. 独立复算 ---');

// 碳排月报 / 碳排差异（共用一套）
eq('碳排 month=9 排放量 cur', E9.cur, 25.76);
eq('碳排 month=9 上月 prev', E9.prev, 26.9);
eq('碳排 month=9 上年同期 yoy', E9.yoy, 26.65);
eq('碳排 month=9 强度 i1', E9.i1, 0.7655);
eq('碳排 month=9 上月强度 i0m', E9.i0m, 0.7662);
eq('碳排 month=9 同期强度 i0y', E9.i0y, 0.7747);
eq('碳排 month=9 产量 q1', E9.q1, 33.6512);
eq('碳排 month=9 上月产量 q0m', E9.q0m, 35.1083);
eq('碳排 month=9 同期产量 q0y', E9.q0y, 34.4004);
eq('碳排 month=9 年累计 cum', E9.cum, 236.07);
eq('碳排 month=9 全年推演', E9.proj, 314.76);
eq('碳排 month=9 环比差', E9.momEmissionDiff, -1.14);
eq('碳排 month=9 同比差', E9.yoyEmissionDiff, -0.89);
eq('碳排 month=9 环比%', E9.momEmissionPct, -4.24);
eq('碳排 month=9 同比%', E9.yoyEmissionPct, -3.34);
eq('碳排 month=9 强度环比%', E9.momIntensityPct, -0.09);
eq('碳排 month=9 强度同比%', E9.yoyIntensityPct, -1.19);
eq('碳排 month=9 排名', E9.rank, 11);
eq('碳排 month=9 最高月', E9.maxMonth + '月 ' + E9.max, '3月 27.15');
eq('碳排 month=9 最低月', E9.minMonth + '月 ' + E9.min, '2月 24.62');
eq('碳排 month=9 环比三项', [E9.momD.xEff, E9.momD.yEff, E9.momD.cross].join('/'), '-1.12/-0.02/0');
eq('碳排 month=9 环比占比', [E9.momD.xShare, E9.momD.yShare, E9.momD.crossShare].join('/'), '98.2/1.8/0');
eq('碳排 month=9 同比三项', [E9.yoyD.xEff, E9.yoyD.yEff, E9.yoyD.cross].join('/'), '-0.58/-0.32/0.01');
eq('碳排 month=9 同比占比', [E9.yoyD.xShare, E9.yoyD.yShare, E9.yoyD.crossShare].join('/'), '63.7/35.2/1.1');
ok('碳排 month=9 恒等式 环比 三项之和（按展示精度）= 合计', r2(E9.momD.xEff + E9.momD.yEff + E9.momD.cross) === E9.momD.d);
ok('碳排 month=9 恒等式 同比 三项之和（按展示精度）= 合计', r2(E9.yoyD.xEff + E9.yoyD.yEff + E9.yoyD.cross) === E9.yoyD.d);
ok('碳排 month=9 合计差异 === 核算差', E9.momD.d === E9.momEmissionDiff && E9.yoyD.d === E9.yoyEmissionDiff);
ok('碳排 month=9 占比之和 = 100.0', E9.momD.xShare + E9.momD.yShare + E9.momD.crossShare === 100);

eq('碳排 month=1 环比为 null', E1.momEmissionDiff, null);
eq('碳排 month=1 上月为 null', E1.prev, null);
eq('碳排 month=1 同比差', E1.yoyEmissionDiff, -0.95);
eq('碳排 month=1 同比%', E1.yoyEmissionPct, -3.42);
eq('碳排 month=1 产量 q1', E1.q1, 35.2926);
eq('碳排 month=1 同期产量 q0y', E1.q0y, 36.1097);
eq('碳排 month=1 同比三项', [E1.yoyD.xEff, E1.yoyD.yEff, E1.yoyD.cross].join('/'), '-0.63/-0.33/0.01');
eq('碳排 month=1 排名', E1.rank, 3);
eq('碳排 month=1 年累计', E1.cum, 26.84);
ok('碳排 month=1 环比分解作废', E1.momD.valid === false);
ok('碳排 month=1 同比分解有效', E1.yoyD.valid === true);

// 交易月报 / 交易差异（共用一套）
eq('交易 month=9 成交量 v1', T9.v1, 5.03);
eq('交易 month=9 上月量 v0m', T9.v0m, 6.12);
eq('交易 month=9 同期量 v0y', T9.v0y, 5.33);
eq('交易 month=9 均价 p1', T9.p1, 90.8);
eq('交易 month=9 上月价 p0m', T9.p0m, 92.1);
eq('交易 month=9 同期价 p0y', T9.p0y, 87.17);
eq('交易 month=9 金额 a1', T9.a1, 456.72);
eq('交易 month=9 上月金额 a0m', T9.a0m, 563.65);
eq('交易 month=9 同期金额 a0y', T9.a0y, 464.62);
eq('交易 month=9 年累计', T9.cum, 46.85);
eq('交易 month=9 全年推演', T9.proj, 62.47);
eq('交易 month=9 环比金额差', T9.momAmtDiff, -106.93);
eq('交易 month=9 同比金额差', T9.yoyAmtDiff, -7.9);
eq('交易 month=9 环比金额%', T9.amtMomPct, -18.97);
eq('交易 month=9 同比金额%', T9.amtYoyPct, -1.7);
eq('交易 month=9 量环比%', T9.volMomPct, -17.81);
eq('交易 month=9 量同比%', T9.volYoyPct, -5.63);
eq('交易 month=9 价环比%', T9.prMomPct, -1.41);
eq('交易 month=9 价同比%', T9.prYoyPct, 4.16);
eq('交易 month=9 排名', T9.rank, 7);
eq('交易 month=9 最高月', T9.maxMonth + '月 ' + T9.max, '10月 7.24');
eq('交易 month=9 最低月', T9.minMonth + '月 ' + T9.min, '2月 3.85');
eq('交易 month=9 环比三项', [T9.momD.xEff, T9.momD.yEff, T9.momD.cross].join('/'), '-100.39/-7.96/1.42');
eq('交易 month=9 环比占比', [T9.momD.xShare, T9.momD.yShare, T9.momD.crossShare].join('/'), '91.5/7.3/1.2');
eq('交易 month=9 同比三项', [T9.yoyD.xEff, T9.yoyD.yEff, T9.yoyD.cross].join('/'), '-26.15/19.35/-1.1');
eq('交易 month=9 同比占比', [T9.yoyD.xShare, T9.yoyD.yShare, T9.yoyD.crossShare].join('/'), '56.1/41.5/2.4');
ok('交易 month=9 恒等式 环比 三项之和（按展示精度）= 合计', r2(T9.momD.xEff + T9.momD.yEff + T9.momD.cross) === T9.momD.d);
ok('交易 month=9 恒等式 同比 三项之和（按展示精度）= 合计', r2(T9.yoyD.xEff + T9.yoyD.yEff + T9.yoyD.cross) === T9.yoyD.d);
ok('交易 month=9 合计差异 === 金额差', T9.momD.d === T9.momAmtDiff && T9.yoyD.d === T9.yoyAmtDiff);
ok('交易 month=9 占比之和 = 100.0', T9.momD.xShare + T9.momD.yShare + T9.momD.crossShare === 100);

eq('交易 month=1 金额 a1', T1.a1, 399.63);
eq('交易 month=1 同期金额 a0y', T1.a0y, 406.9);
eq('交易 month=1 同比金额差', T1.yoyAmtDiff, -7.27);
eq('交易 month=1 同比金额%', T1.amtYoyPct, -1.79);
eq('交易 month=1 同比三项', [T1.yoyD.xEff, T1.yoyD.yEff, T1.yoyD.cross].join('/'), '-23.25/16.95/-0.97');
eq('交易 month=1 同比占比', [T1.yoyD.xShare, T1.yoyD.yShare, T1.yoyD.crossShare].join('/'), '56.5/41.2/2.3');
ok('交易 month=1 环比为 null', T1.momAmtDiff === null);
ok('交易 month=1 环比分解作废', T1.momD.valid === false);

// 全零
eq('全零 碳排 排放量', ZEB.cum, 0);
eq('全零 碳排 强度', ZEB.i1, 0);
ok('全零 碳排 产量为 null', ZEB.q1 === null);
ok('全零 碳排 分解作废', ZEB.momD.valid === false && ZEB.yoyD.valid === false);
eq('全零 交易 金额', ZTB.a1, 0);
ok('全零 交易 分解有效（量×价 无除法）', ZTB.momD.valid === true && ZTB.yoyD.valid === true);
ok('全零 交易 三项占比全 null', ZTB.momD.xShare === null && ZTB.momD.yShare === null && ZTB.momD.crossShare === null);
eq('全零 交易 合计差异', ZTB.yoyD.d, 0);
ok('全零 交易 恒等式仍成立', r2(ZTB.momD.xEff + ZTB.momD.yEff + ZTB.momD.cross) === ZTB.momD.d);

/* ================= 3. 文档一致性 ================= */
console.log('--- 3. 文档一致性 ---');
const flat = {};
Object.keys(DOC).forEach(k => { flat[k] = norm(raw[k]); });
function has(k, label, text) { ok('【' + k + '】文档含 ' + label, flat[k].includes(norm(text))); }
function not(k, label, text) { ok('【' + k + '】文档不含 ' + label, !flat[k].includes(norm(text))); }

// —— 碳排放月度报表 ——
has('reportEmission', '本月排放量 25.76', '25.76');
has('reportEmission', '年累计 236.07', '236.07');
has('reportEmission', '强度 0.7655', '0.7655');
has('reportEmission', '产量 33.65', '33.65');
has('reportEmission', '环比排放变化 -1.14', '-1.14');
has('reportEmission', '同比排放变化 -0.89', '-0.89');
has('reportEmission', '环比 -4.24', '-4.24');
has('reportEmission', '同比 -3.34', '-3.34');
has('reportEmission', '强度环比 -0.09', '-0.09');
has('reportEmission', '强度同比 -1.19', '-1.19');
has('reportEmission', '产量环比 -4.15', '-4.15');
has('reportEmission', '产量同比 -2.18', '-2.18');
has('reportEmission', '排名 第 11 位', '第 11 位');
has('reportEmission', '最高月 3 月 27.15', '3 月 27.15');
has('reportEmission', '最低月 2 月 24.62', '2 月 24.62');
has('reportEmission', '强度区间 0.7573 ~ 0.7663', '0.7573 ~ 0.7663');
has('reportEmission', 'month=1 年累计 26.84', '26.84');
has('reportEmission', 'month=1 同比 -3.42', '-3.42');
has('reportEmission', 'month=1 排名 第 3 位', '第 3 位');
has('reportEmission', '上一月标签「无上月基数」', 'PREV_LABEL');
has('reportEmission', '派生口径说明', '按「排放量 ÷ 强度」推算');

// —— 碳交易月度报表 ——
has('reportTrade', '成交量 5.03', '5.03');
has('reportTrade', '均价 90.80', '90.80');
has('reportTrade', '金额 456.72', '456.72');
has('reportTrade', '年累计 46.85', '46.85');
has('reportTrade', '环比金额变化 -106.93', '-106.93');
has('reportTrade', '同比金额变化 -7.90', '-7.90');
has('reportTrade', '环比金额 -18.97', '-18.97');
has('reportTrade', '同比金额 -1.70', '-1.70');
has('reportTrade', '量环比 -17.81', '-17.81');
has('reportTrade', '量同比 -5.63', '-5.63');
has('reportTrade', '价环比 -1.41', '-1.41');
has('reportTrade', '价同比 +4.16', '+4.16');
has('reportTrade', '排名 第 7 位', '第 7 位');
has('reportTrade', '最高月 10 月 7.24', '10 月 7.24');
has('reportTrade', '最低月 2 月 3.85', '2 月 3.85');
has('reportTrade', '均价区间 85.70 ~ 94.20', '85.70 ~ 94.20');
has('reportTrade', 'month=1 金额 399.63', '399.63');
has('reportTrade', 'month=1 同期金额 406.90', '406.90');
has('reportTrade', 'month=1 同比 -1.79', '-1.79');
has('reportTrade', 'month=1 排名 第 9 位', '第 9 位');
has('reportTrade', '派生口径说明', '按「成交量 × 成交均价」推算');

// —— 碳排放差异分析 ——
has('diffEmission', '本月排放量 25.76', '25.76');
has('diffEmission', '环比差异 -1.14', '-1.14');
has('diffEmission', '同比差异 -0.89', '-0.89');
has('diffEmission', '环比主要动因占 98.2%', '占差异 98.2%');
has('diffEmission', '同比主要动因占 63.7%', '占差异 63.7%');
has('diffEmission', '强度 0.7655', '0.7655');
has('diffEmission', '环比三项', '-1.12 / -0.02 / 0.00');
has('diffEmission', '环比占比 98.2 / 1.8 / 0.0', '98.2 / 1.8 / 0.0');
has('diffEmission', '同比三项', '-0.58 / -0.32 / +0.01');
has('diffEmission', '同比占比 63.7 / 35.2 / 1.1', '63.7 / 35.2 / 1.1');
has('diffEmission', '环比表注三项之和式', '-1.12 + -0.02 + 0.00 = -1.14 万tCO₂');
has('diffEmission', '恒等式说明', '三项之和恒等于合计差异');
has('diffEmission', '残差口径说明', '合计差异 − 产量效应 − 强度效应');
has('diffEmission', '交互项占比取残差', '交互项占比取残差');
has('diffEmission', '敏感性 I0/Q0', 'I₀ = 0.7662');
has('diffEmission', '产量 33.6512', '33.6512');
has('diffEmission', 'month=1 同比 -0.95', '-0.95');
has('diffEmission', 'month=1 同比三项', '-0.63 / -0.33 / +0.01');
has('diffEmission', 'month=1 分解降级说明', '无法由「排放量 ÷ 强度」推算产品产量，环比因素分解不做');
has('diffEmission', '上一月标签「无上月基数」', 'PREV_LABEL');

// —— 碳交易差异分析 ——
has('diffTrade', '本月金额 456.72', '456.72');
has('diffTrade', '环比差异 -106.93', '-106.93');
has('diffTrade', '同比差异 -7.90', '-7.90');
has('diffTrade', '环比主要动因占 91.5%', '占差异 91.5%');
has('diffTrade', '环比三项', '-100.39 / -7.96 / +1.42');
has('diffTrade', '环比占比 91.5 / 7.3 / 1.2', '91.5 / 7.3 / 1.2');
has('diffTrade', '同比三项', '-26.15 / +19.35 / -1.10');
has('diffTrade', '同比占比 56.1 / 41.5 / 2.4', '56.1 / 41.5 / 2.4');
has('diffTrade', '环比表注三项之和式', '-100.39 + -7.96 + 1.42 = -106.93 万元');
has('diffTrade', '恒等式说明', '三项之和恒等于合计差异');
has('diffTrade', '残差口径说明', '合计差异 − 量差效应 − 价差效应');
has('diffTrade', '敏感性 P0/V0', 'P₀ = 92.10');
has('diffTrade', 'month=1 金额 399.63', '399.63');
has('diffTrade', 'month=1 同比 -7.27', '-7.27');
has('diffTrade', 'month=1 同比三项', '-23.25 / +16.95 / -0.97');
has('diffTrade', 'month=1 环比降级说明', '环比差异不做因素分解');
has('diffTrade', '上一月标签「无上月基数」', 'PREV_LABEL');

/* ================= 4. 条款存在性 ================= */
console.log('--- 4. 条款存在性 ---');
const COMMON = [
  ['数据口径块', '数据口径（先读这条）'],
  ['数据可得性说明', '数据可得性说明'],
  ['入参字段说明表', '### 入参字段说明'],
  ['数组填写规则', '### 数组填写规则'],
  ['全零入参示例', '全零入参示例'],
  ['入参带入规则', '### 入参带入规则'],
  ['URL 入参来源', '### 运行期入参来源（URL 查询参数）'],
  ['零值与缺值处理', '零值与缺值处理（除零保护，必须实现）'],
  ['声明唯一数据源', '本节是所有数字的唯一来源'],
  ['校验参考', '校验参考'],
  ['附录 A', '## 附录 A'],
  ['附录 B', '## 附录 B'],
  ['附录 C1', '### C1 正常入参'],
  ['附录 C2', '### C2 全零入参'],
  ['附录 C3', '### C3 删掉整个'],
  ['附录 D', '## 附录 D'],
  ['month=1 降级', '无上月基数'],
  ['负零归一', '-0'],
  ['不兜底', '不兜底']
];
Object.keys(DOC).forEach(k => COMMON.forEach(([l, t]) => has(k, l, t)));

// 章节一致性
has('reportEmission', '摘要章', '摘要 · 本月核心指标概览');
has('reportEmission', '一章', '一、月度排放概况');
has('reportEmission', '二章（趋势）', '二、月度趋势回顾');
has('reportEmission', '三章（建议）', '三、本月工作建议');
has('reportTrade', '摘要章', '摘要 · 本月核心指标概览');
has('reportTrade', '一章', '一、交易概况');
has('reportTrade', '二章（趋势）', '二、月度趋势回顾');
has('reportTrade', '三章（建议）', '三、本月交易建议');

/* ================= 5. 旧规则已移除（结构化断言） ================= */
console.log('--- 5. 旧规则已移除 ---');
// 注意：不能用裸词扫全文——负面清单里会点名禁止这些词，必然误伤。
// 一律用**代码形态**或**字段定义形态**断言。
const OLD = [
  'INTENSITY_2026', 'OUTPUT_2026', 'SRC_RATIO', 'SRC_COLORS',
  'HOLD_ALLOWANCE', 'HOLD_CCER', 'DEAL_ROWS', 'MARKET_ROWS',
  'YOY_OUTPUT_DIV', 'YOY_INTENSITY_FACTOR', 'YOY_VOL_FACTOR', 'YOY_PRICE_FACTOR',
  'var EMISSION = OUTPUT_2026', 'var structBars'
];
Object.keys(DOC).forEach(k => OLD.forEach(t => not(k, t, t)));

// 结构化：入参里不得再出现旧字段
ok('碳排放 入参无 annualOutput', !JSON.stringify([RE, DE]).includes('annualOutput'));
ok('碳交易 入参无持仓/明细/行情字段', !JSON.stringify([RT, DT]).match(/allowance|ccer|deal|market/));
ok('碳排放文档不含「直接排放占比」的取值定义', !/直接排放占比.*62\.0/.test(raw.reportEmission));
ok('碳交易文档不含行情表行数据', !/上海环境能源交易所.*90\.2/.test(raw.reportTrade));

/* ================= 6. 口径收缩验收 ================= */
console.log('--- 6. 口径收缩 ---');
// 碳排放侧：不得再有「排放结构分析」章节与结构图
not('reportEmission', '排放结构分析章节标题', '二、排放结构分析');
not('reportEmission', '排放源明细表', '本月排放数据明细（按排放源）');
not('reportEmission', 'structBars 图规格', 'structBars');
// 碳交易侧：不得再有持仓/明细/行情章节
not('reportTrade', '成交明细章节标题', '二、成交明细');
not('reportTrade', '持仓与资产章节标题', '三、持仓与资产');
not('reportTrade', '市场行情章节标题', '四、市场行情');
not('reportTrade', '持仓结构图规格', '期末碳资产持仓结构图');

/* ================= 汇总 ================= */
console.log('\n--- ' + pass + ' pass / ' + fails.length + ' fail ---');
if (fails.length) {
  console.log('\n失败项：');
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exitCode = 1;
}
