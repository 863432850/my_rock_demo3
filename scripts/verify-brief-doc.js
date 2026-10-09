// 独立复算：docs/双碳管理月度简报-提示词.md
// 1) 正常入参 → 附录 C1 期望值（独立复算）
// 2) 全零入参 → 附录 C2 期望值（零兜底模拟，验证规则本身不会产出 NaN/∞）
// 3) 文档一致性 + 结构完整性 + 零兜底条款存在性
// 不读页面、不读文档中的结论；数字只认复算。
const fs = require('fs');
const doc = fs.readFileSync('docs/双碳管理月度简报-提示词.md', 'utf8');

// 抠出入参 JSON：只认「含 companyName 且能解析」的完整入参块（中间夹杂的数组片段示例要跳过）
const jsons = [];
for (const m of doc.matchAll(/```json\s*([\s\S]*?)```/g)) {
  try { const o = JSON.parse(m[1]); if (o && o.companyName) jsons.push(o); } catch (e) { /* 片段示例，跳过 */ }
}
if (jsons.length < 2) { console.log('FAIL 未找到两个完整入参 JSON 块，实际 ' + jsons.length); process.exit(1); }
const P = jsons[0];   // 正常入参
const Z = jsons[1];   // 全零入参
const E = P.emission;
const M = P.month, Y = P.year;
console.log('解析到入参块 ' + jsons.length + ' 个：' + jsons.map(o => o.companyName + '/' + o.year + '-' + o.month).join(' , '));

const r2 = v => Math.round(v * 100) / 100;
const r4 = v => Math.round(v * 10000) / 10000;
const pct = v => Math.round(v * 100) / 100;

let fail = 0, pass = 0;
function chk(label, got, want, tol) {
  tol = tol == null ? 0.005 : tol;
  const ok = Math.abs(got - want) <= tol;
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + label.padEnd(34) + ' got=' + got + '  want=' + want);
}
/** 断言：值必须是 null（文档规定写 --），或等于期望数 */
function chkDash(label, got, wantNum) {
  const isDash = got === null;
  const ok = wantNum === null ? isDash : (!isDash && Math.abs(got - wantNum) <= 0.005);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + label.padEnd(34) + ' got=' + String(got) +
    '  want=' + (wantNum === null ? '--' : wantNum));
}

/* ============ 按文档规则实现的取值/推导函数（含除零保护） ============ */
function build(E, M) {
  const g = (o, p) => { let v = o; for (const k of p.split('.')) v = v == null ? null : v[k]; return v; };
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  // 数组槽位：缺失按 0（不是外推），并保证只在 length>=12 时按规范使用
  const slot = (arr, i) => Array.isArray(arr) ? num(arr[i]) || 0 : 0;
  const cur = i => slot(g(E, 'total.cur'), i);
  const prv = i => slot(g(E, 'total.prev'), i);
  const icu = i => slot(g(E, 'intensity.cur'), i);
  const targetT = num(g(E, 'targetTotal')) || 0;
  const targetI = num(g(E, 'targetIntensity')) || 0;
  const allow = num(g(E, 'allowance')) || 0;

  const o = {};
  o.inc = M === 1 ? cur(0) : cur(M - 1) - cur(M - 2);                 // 本月排放量
  const incPrev = M <= 2 ? null : cur(M - 2) - cur(M - 3);
  o.incMom = (M === 1 || !incPrev) ? null : (o.inc - incPrev) / incPrev * 100;
  o.cum = cur(M - 1);                                                 // 年累计
  o.cumYoy = prv(M - 1) > 0 ? (o.cum - prv(M - 1)) / prv(M - 1) * 100 : null;
  o.inten = icu(M - 1);
  const iprv = slot(g(E, 'intensity.prev'), M - 1);
  o.intenYoy = iprv > 0 ? (o.inten - iprv) / iprv * 100 : null;
  o.output = o.inten > 0 ? o.cum / o.inten : null;                    // 产品产量（除零保护）
  o.forecast = o.cum / M * 12;                                        // 全年预测
  o.achT = targetT > 0 ? o.cum / targetT * 100 : null;                // 总量达成率
  o.achI = targetI > 0 ? o.inten / targetI * 100 : null;              // 强度达成率
  o.allow = allow > 0 ? allow : null;
  o.gap = o.allow === null ? null : o.allow - o.forecast;             // 配额盈缺
  // 明细表派生列（第 1 行环期 = priorDec）
  const pd = num(g(E, 'total.priorDec')) || 0;
  o.rows = [];
  for (let i = 0; i < M; i++) {
    const c = cur(i), p = prv(i);
    const ring = i === 0 ? pd : cur(i - 1);
    o.rows.push({
      yoyDiff: c - p, yoy: p > 0 ? (c - p) / p * 100 : null,
      momDiff: c - ring, mom: ring > 0 ? (c - ring) / ring * 100 : null
    });
  }
  return o;
}

/* ============ 1. 正常入参复算（附录 C1） ============ */
const n = build(E, M);
console.log('=== C1 正常入参 ===');
chk('卡1 本月排放量(万t)', r2(n.inc), 29.17);
chk('卡1 环比(%)', pct(n.incMom), 2.97, 0.006);
chk('卡2 年累计(万t)', r2(n.cum), 170.09);
chk('卡2 同比(%)', pct(n.cumYoy), 1.57, 0.006);
chk('卡3 强度(tCO2/t)', r4(n.inten), 1.9350, 0.00005);
chk('卡3 同比(%)', pct(n.intenYoy), -3.06, 0.006);
chk('总量达成率(%)', pct(n.achT), 48.60, 0.006);
chk('强度达成率(%)', pct(n.achI), 97.97, 0.006);
chk('年累计产品产量(万t)', r2(n.output), 87.90);
chk('全年预测排放量(万t)', r2(n.forecast), 340.18);
chk('配额盈缺量(万t)', r2(n.gap), 8.42);
const acct = r2(n.allow * 0.125), ccer = 0.08, national = r2(acct - ccer);
chk('当前账户(万t)', acct, 43.58);
chk('全国碳市场(万t)', national, 43.50);
chk('配额占比(%)', pct(national / acct * 100), 99.82, 0.006);
chk('自愿减排量占比(%)', pct(ccer / acct * 100), 0.18, 0.006);
const sell = n.gap * (M / 12) * 0.275;
chk('卖出年累计(万t)', r2(sell), 1.16);

/* ============ 2. 全零入参复算（附录 C2，零兜底核心验收） ============ */
console.log('\n=== C2 全零入参（零兜底） ===');
const z = build(Z.emission, Z.month);
chkDash('卡1 本月排放量(万t)', r2(z.inc), 0);
chkDash('卡1 环比(%)', z.incMom === null ? null : pct(z.incMom), null);
chkDash('卡2 年累计(万t)', r2(z.cum), 0);
chkDash('卡2 同比(%)', z.cumYoy === null ? null : pct(z.cumYoy), null);
chkDash('卡3 强度(tCO2/t)', r4(z.inten), 0);
chkDash('卡3 同比(%)', z.intenYoy === null ? null : pct(z.intenYoy), null);
chkDash('总量达成率(%)', z.achT === null ? null : pct(z.achT), null);
chkDash('强度达成率(%)', z.achI === null ? null : pct(z.achI), null);
chkDash('年累计产品产量(万t)', z.output === null ? null : r2(z.output), null);
chkDash('全年预测排放量(万t)', r2(z.forecast), 0);
chkDash('配额核发量', z.allow, null);
chkDash('配额盈缺量(万t)', z.gap, null);
console.log('  → 明细表 ' + z.rows.length + ' 行：');
let rowsOk = z.rows.length === Z.month;
z.rows.forEach(function (r, i) {
  // 全零下：变化值 0.00，比值必须为 --（分母为 0）
  if (r.yoyDiff !== 0 || r.momDiff !== 0 || r.yoy !== null || r.mom !== null) rowsOk = false;
});
rowsOk ? pass++ : fail++;
console.log((rowsOk ? 'ok  ' : 'FAIL') + '  明细表全行 变化值0.00 / 同环比 --');

// 零兜底的核心：全零入参下绝不允许出现非零的排放数值
const zeroFields = ['inc', 'cum', 'inten', 'forecast'];
const allZero = zeroFields.every(k => z[k] === 0);
allZero ? pass++ : fail++;
console.log((allZero ? 'ok  ' : 'FAIL') + '  排放数值全部为 0（无凭空生成）');

// 除零场景必须落到 null（--）而非 NaN/Infinity
const dashFields = ['incMom', 'cumYoy', 'intenYoy', 'output', 'achT', 'achI', 'gap'];
const allDash = dashFields.every(k => z[k] === null);
allDash ? pass++ : fail++;
console.log((allDash ? 'ok  ' : 'FAIL') + '  除零场景全部落 -- （无 NaN/Infinity）');

// 反向验证：正常入参下这些字段都不该是 null（确认除零保护没把正常值也吞掉）
const nNotDash = dashFields.every(k => n[k] !== null);
nNotDash ? pass++ : fail++;
console.log((nNotDash ? 'ok  ' : 'FAIL') + '  正常入参下同批字段均非 -- （保护未误伤）');

// 全零入参数组必须写满 12 个
[['total.cur', Z.emission.total.cur], ['total.prev', Z.emission.total.prev],
 ['intensity.cur', Z.emission.intensity.cur], ['intensity.prev', Z.emission.intensity.prev]].forEach(function (p) {
  const ok = Array.isArray(p[1]) && p[1].length === 12 && p[1].every(v => v === 0);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  全零示例 ' + p[0].padEnd(16) + ' 长度 12 且全为 0');
});

/* ============ 3. 文档一致性 ============ */
console.log('\n=== 文档一致性（写死的期望值必须等于复算结果） ===');
// 表格列宽会随编辑变化，因此去掉所有空白后再匹配，避免误报
const flat = doc.replace(/[ \t\u00a0]+/g, '');
function chkDoc(label, needle) {
  const ok = flat.includes(needle.replace(/[ \t\u00a0]+/g, ''));
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + label.padEnd(20) + ' "' + needle + '"');
}
chkDoc('卡1 环比', '29.17 万t，环比 +2.97%');
chkDoc('卡2', '170.09 万t，同比 +1.57%');
chkDoc('卡3', '1.9350 tCO₂/t，同比 −3.06%');
chkDoc('卡6', '+8.42 万t（盈余）');
chkDoc('总量达成率', '| 48.60% |');
chkDoc('强度达成率', '| 97.97% |');
chkDoc('产品产量', '| 87.90 万t |');
chkDoc('全年预测', '| 340.18 万t |');
chkDoc('卖出量', '| 1.16 万t |');

/* ============ 4. 零兜底条款存在性 ============ */
console.log('\n=== 零兜底条款（本轮新增，缺一不可） ===');
const clauses = [
  ['数据口径 零兜底', '一律不兜底'],
  ['全零也必须正确', '全零入参必须生成一份"全零报告"'],
  ['数组长度恒为12', '长度恒为 12'],
  ['12个0示例', '"cur": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]'],
  ['禁止外推补齐', '严禁用最后一个已有值向后外推填充'],
  ['零值与缺值处理节', '零值与缺值处理（除零保护，必须实现）'],
  ['除零→--', '分母为 `0` 时统一写 `--`'],
  ['折线图无数据态', '本期暂无数据'],
  ['附录C2', 'C2 全零入参（**零兜底验收用例，必测**）'],
  ['自检:全零必测', '【零兜底必测】用「全零入参示例」跑一遍'],
  ['自检:删字段必测', '把 `emission` 整个字段删掉再跑一遍'],
  ['自检:NaN必查', '必须 0 命中'],
  ['附录B范围限定', '仅 碳减排 / 碳资产 / 碳交易 三章'],
];
clauses.forEach(function (c) {
  const ok = doc.includes(c[1]);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + c[0]);
});

/* ============ 5. 旧的碳排放兜底规则必须已删除 ============ */
console.log('\n=== 碳排放兜底规则必须已移除 ===');
const removed = [
  ['配额核发量兜底公式', '配额核发量（万t）= 全年预测排放量 × 1.01–1.03'],
  ['旧-缺省时按附录B推算', '缺省时按附录 B 推算'],
  ['旧-联网检索→兜底公式', '缺省时按「联网检索 → 兜底公式」取值'],
];
removed.forEach(function (c) {
  const ok = !doc.includes(c[1]);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  已移除: ' + c[0]);
});

/* ============ 6. 结构完整性 ============ */
console.log('\n=== 结构完整性 ===');
['## 一、入参', '## 二、任务', '### 数据来源与真实性要求（重要）', '### 数据规则（唯一数据源，不要另编数字）',
 '## 附录 A · 联网检索指引', '## 附录 B · 兜底生成规则',
 '## 附录 C · 期望值（自检用）', '## 附录 D · 交付前自检清单', '提示词结束',
 '**数组填写规则（关键，必须遵守）**', '**全零入参示例（必须能正确生成，不得报错、不得填数）**'].forEach(function (s) {
  const ok = doc.includes(s);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + s);
});

/* ============ 7. 视觉规格逐字保留 ============ */
console.log('\n=== 视觉规格逐字保留（防止改坏原界面约定） ===');
['viewBox `760×250`',
 '色板**：`#00b42a, #165dff, #ff7d00, #f53f3f, #722ed1, #0fc6c2, #86909c, #ffb01f`',
 '文字 `#1a1a1a` / `#333` / 次要 `#8a9199` / 弱 `#98a1ab`',
 '涨（正）`#d4380d`，跌（负）`#2ba471`',
 '`0 4px 24px rgba(20,40,30,.10)`',
 '内边距约 `64px 72px`',
 '表头底 `#e9f7ee`；偶数行底 `#fafcfb`',
 '双碳管理月度简报-{year}年{month}月.pdf',
 '21px，左 5px 主色竖条，背景 `#e9f7ee` 向右渐隐',
 '16.5px，前置 8px 主色小方块',
 '`#e9edf3`'].forEach(function (s) {
  const ok = doc.includes(s);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + s.slice(0, 44));
});

console.log('\n--- ' + pass + ' pass / ' + fail + ' fail ---');
