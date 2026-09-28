/**
 * 碳资产对标分析报告 · 渲染（与碳排放对标报告并列，但内容维度完全不同）
 * - URL 参数：?type=asset&year=2026&month=9&region=河南省&company=...
 * - 不同对标条件生成不同内容：以「区域名 + 年 + 月」为稳定种子
 * - 对标维度聚焦「碳资产」：配额持有、CCER 储备、碳交易绩效、履约保障、资产收益
 *   与碳排放对标（强度/排名/减排潜力）口径不同，互为补充
 * - 「下载报告」用 html2canvas + jsPDF 生成 PDF
 */

(function () {
  'use strict';

  var ORG = '河南安钢周口钢铁有限责任公司';
  var GREEN = '#00b42a';
  var PALETTE = ['#00b42a', '#165dff', '#ff7d00', '#f53f3f', '#722ed1', '#0fc6c2', '#86909c', '#ffb01f'];

  /* ---------- 基础工具 ---------- */

  function pad2(n) { return String(n).padStart(2, '0'); }
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  function fmt(n, d) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /** 字符串散列（区域名 → 稳定数值） */
  function strHash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** 可复现伪随机 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 对标条件参数 ---------- */

  var qs = new URLSearchParams(location.search);
  var Y = parseInt(qs.get('year'), 10) || 2026;
  var M = parseInt(qs.get('month'), 10) || 9;
  if (M < 1 || M > 12) M = 9;
  var REGION = qs.get('region') || '河南省';
  var IS_NATIONAL = REGION === '全国';
  var MONTH_CN = Y + '年' + M + '月';
  ORG = qs.get('company') || ORG;

  /** 条件种子：区域 + 年 + 月共同决定，同条件结果完全一致 */
  var SEED = (strHash(REGION) ^ Math.imul(Y, 131) ^ Math.imul(M, 977)) >>> 0;
  var rnd = mulberry32(SEED);

  /* ---------- 碳资产数据（锚定平台口径，演示演算） ---------- */

  var CARBON_PRICE = 90;   // 元/tCO₂，全国碳市场配额参考均价
  var CCER_PRICE = 68;     // 元/tCO₂，CCER 市场参考价（较配额折价）
  var ANNUAL_EMISSION = 6058; // 本企业年度履约排放（万tCO₂），用于覆盖率测算

  // 本企业配额持有量（万tCO₂）：基准约等于年度排放，年际微扰
  var entAllowance = +(ANNUAL_EMISSION * (1 + (rnd() - 0.5) * 0.05)).toFixed(0);
  var entAllowanceVal = +(entAllowance * CARBON_PRICE).toFixed(0); // 万元（万t × 元/t = 万元）

  // 本企业 CCER 储备量（万t）：约为配额的 6%~10%
  var entCCER = +((entAllowance * 0.08) * (1 + (rnd() - 0.5) * 0.3)).toFixed(0);
  var entCCERVal = +(entCCER * CCER_PRICE).toFixed(0); // 万元（万t × 元/t = 万元）

  // 其他碳资产（碳质押/碳远期/碳回购等）：约为配额价值的 4%~8%
  var entOther = +(entAllowanceVal * 0.06 * (1 + (rnd() - 0.5) * 0.4)).toFixed(0);
  var entTotal = entAllowanceVal + entCCERVal + entOther; // 碳资产总价值（万元）

  // 区域/行业均值（按区域名稳定偏移；全国 = 行业均值口径）
  var regionOffset = IS_NATIONAL ? 0 : (rnd() - 0.45) * 0.12;
  var regionTotalAvg = +(entTotal * (1 + regionOffset)).toFixed(0);
  var indAvgTotal = +((entTotal) * (1 + (rnd() - 0.42) * 0.10)).toFixed(0);
  var advancedTotal = +(indAvgTotal * (0.92 + rnd() * 0.02)).toFixed(0);

  // 碳资产收益率（本年碳交易净收益 / 碳资产规模，%）：5%~11%
  var entROI = +((8 + (rnd() - 0.5) * 6)).toFixed(2);
  var regionROI = +(entROI * (1 + (rnd() - 0.5) * 0.10)).toFixed(2);
  var indROI = +(entROI * (1 + (rnd() - 0.30) * 0.12)).toFixed(2);
  var advancedROI = +(indROI * 1.15).toFixed(2);

  // 配额履约覆盖率（%）：自有配额 / 年度履约排放
  var entCoverage = +(entAllowance / ANNUAL_EMISSION * 100).toFixed(1);
  // 碳资产占总资产比例（%）
  var entAssetRatio = +(1.5 + (rnd() - 0.5) * 0.8).toFixed(2);

  // 区域样本企业数
  var entCount = IS_NATIONAL ? Math.round(1400 + rnd() * 900) : Math.round(45 + rnd() * 180);

  // 区域排名（按碳资产总价值降序，越高越靠前）
  var rankPct = clamp(0.5 - (entTotal - regionTotalAvg) / (regionTotalAvg * 0.22), 0.02, 0.98);
  var rank = Math.max(1, Math.round(entCount * rankPct));
  var outperform = +((1 - rank / entCount) * 100).toFixed(1);

  var vsRegion = +((entTotal - regionTotalAvg) / regionTotalAvg * 100).toFixed(2);   // 正=高于区域均值
  var vsIndustry = +((entTotal - indAvgTotal) / indAvgTotal * 100).toFixed(2);
  var vsAdvanced = +((entTotal - advancedTotal) / advancedTotal * 100).toFixed(2);

  /* ---------- 图表 ---------- */

  /** 对比条形图（本企业行高亮） */
  function cmpBars(items, unit, dec) {
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    max = max || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it) {
      var pct = Math.max(0.5, it.value / max * 100);
      html += '<div class="hbar-row' + (it.self ? ' is-self' : '') + '">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(it.value, dec) + (unit ? ' ' + unit : '') + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /** 结构条形图（固定基准 100% 归一） */
  function structBars(items, unit, dec) {
    var total = 0;
    items.forEach(function (it) { total += it.value; });
    total = total || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it) {
      var pct = it.value / total * 100;
      html += '<div class="hbar-row">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(it.value, dec) + (unit ? ' ' + unit : '') + '（' + pct.toFixed(1) + '%）</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  function chartBlock(innerHtml, caption) {
    return '<div class="chart-box">' + innerHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  /* ---------- 文案区块 ---------- */

  /** 摘要 · 碳资产对标结论概览 */
  function summaryHtml() {
    var levelWord = entTotal >= advancedTotal ? '已达行业资产规模先进梯队'
      : (entTotal >= indAvgTotal ? '高于行业平均、距先进有差距' : '落后于行业平均，资产厚度不足');
    var levelCls = entTotal >= indAvgTotal ? 'is-neg' : 'is-pos';

    var html = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本企业碳资产总价值</div><div class="kpi-val">' + fmt(entTotal, 0) + '<small> 万元</small></div><div class="kpi-delta is-flat">' + esc(MONTH_CN) + ' 持仓口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">' + esc(REGION) + '平均值</div><div class="kpi-val">' + fmt(regionTotalAvg, 0) + '<small> 万元</small></div><div class="kpi-delta ' + (vsRegion >= 0 ? 'is-neg' : 'is-pos') + '">本企业' + (vsRegion >= 0 ? '高于' : '低于') + '区域 ' + fmt(Math.abs(vsRegion), 2) + '%</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">行业平均值（全国）</div><div class="kpi-val">' + fmt(indAvgTotal, 0) + '<small> 万元</small></div><div class="kpi-delta ' + (vsIndustry >= 0 ? 'is-neg' : 'is-pos') + '">本企业' + (vsIndustry >= 0 ? '高于' : '低于') + '行业 ' + fmt(Math.abs(vsIndustry), 2) + '%</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">碳资产收益率</div><div class="kpi-val">' + fmt(entROI, 2) + '<small> %</small></div><div class="kpi-delta ' + (entROI >= regionROI ? 'is-neg' : 'is-pos') + '">区域均值 ' + fmt(regionROI, 2) + '%</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">' + esc(REGION) + '排名</div><div class="kpi-val">第 ' + rank + ' 名<small> / 共 ' + entCount + ' 家</small></div><div class="kpi-delta is-flat">区域内同行业企业口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">配额履约覆盖率</div><div class="kpi-val">' + fmt(entCoverage, 1) + '<small> %</small></div><div class="kpi-delta ' + (entCoverage >= 100 ? 'is-neg' : 'is-pos') + '">' + (entCoverage >= 100 ? '配额盈余，履约无忧' : '存在履约缺口') + '</div></div>'
      + '</div>';

    // 排名横幅
    html += '<div class="rank-banner">'
      + '<div class="rank-no">No.' + rank + '<small>/ ' + entCount + ' 家</small></div>'
      + '<div class="rank-info"><div class="t">' + esc(REGION) + '同行业企业碳资产规模排名（' + esc(MONTH_CN) + '），超越区域内 <strong>' + fmt(outperform, 1) + '%</strong> 的企业</div>'
      + '<div class="rank-track"><i style="width:' + clamp(outperform, 1, 100).toFixed(1) + '%"></i></div>'
      + '<div class="s">排名口径：按碳资产总价值降序排列，数据来源于区域碳市场登记簿、交易结算平台与行业统计</div></div>'
      + '</div>';

    // 碳资产总价值对标总览
    html += chartBlock(cmpBars([
      { name: '本企业（' + ORG + '）', value: entTotal, color: '#ff7d00', self: true },
      { name: REGION + '平均值', value: regionTotalAvg, color: GREEN },
      { name: '行业平均值（全国）', value: indAvgTotal, color: '#165dff' },
      { name: '行业先进值', value: advancedTotal, color: '#722ed1' }
    ], '万元', 0), '（图）企业层级碳资产总价值对标总览（' + MONTH_CN + '）');

    return html;
  }

  /** 一、报告定位与核心思路 */
  function positionHtml() {
    return '<p class="brief-p">本报告为 ' + esc(ORG) + ' 专属碳资产对标专项报告，聚焦企业碳资产的<strong>规模、结构与运营绩效</strong>开展量化研判，'
      + '与碳排放对标（强度/减排）形成互补——碳排放对标看「排了多少、强度如何」，本看「手里有多少碳资产、运营得好不好」。'
      + '报告以「' + esc(REGION) + '」为对标区域、以「' + esc(MONTH_CN) + '」为对标期间，'
      + '将本企业碳资产总价值与区域平均值、行业平均值、行业先进值进行四维对比，并延伸至配额覆盖率、碳资产收益率等运营指标。</p>'
      + '<p class="brief-p">报告核心思路：<strong>一排名、二对比、三结构、四建议</strong>——'
      + '先以碳资产规模排名锚定企业在区域同行业中的位置；再与区域、行业、先进三级基准逐层对比；'
      + '拆解配额、CCER、其他碳资产的配置结构并评价运营绩效；最终给出碳资产优化与履约保障建议，为企业盘活碳资产、增厚碳收益提供决策依据。</p>'
      + '<p class="brief-p">数据口径说明：碳资产价值按持仓量 × 当期市场参考价折算（配额 ' + CARBON_PRICE + ' 元/tCO₂、CCER ' + CCER_PRICE + ' 元/tCO₂）；'
      + '区域与行业数据来源于区域碳排放权登记簿、碳交易结算平台及行业协会统计，样本企业 ' + entCount + ' 家；先进值取行业前 10% 企业水平。</p>';
  }

  /** 二、企业碳资产规模与结构对标 */
  function assetScaleHtml() {
    var html = '<div class="table-caption"><span>企业碳资产规模对标表</span><span class="unit">单位：万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>企业层级</th><th>企业数据</th><th>' + esc(REGION) + '排名</th><th>' + esc(REGION) + '平均值</th><th>行业平均值</th><th>行业先进值</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>碳资产总价值</td><td class="is-self">' + fmt(entTotal, 0) + '</td>'
      + '<td class="is-self">' + rank + ' / ' + entCount + '</td>'
      + '<td>' + fmt(regionTotalAvg, 0) + '</td><td>' + fmt(indAvgTotal, 0) + '</td><td>' + fmt(advancedTotal, 0) + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：排名按碳资产总价值降序（价值越高排名越靠前），样本为' + esc(REGION) + '同行业报送企业。</div>';

    // 数据分析
    var posWords = [];
    posWords.push(vsRegion >= 0
      ? '本企业碳资产总价值 ' + fmt(entTotal, 0) + ' 万元，高于' + REGION + '平均值 ' + fmt(regionTotalAvg, 0) + ' 万元（高出区域 ' + fmt(Math.abs(vsRegion), 2) + '%）'
      : '本企业碳资产总价值 ' + fmt(entTotal, 0) + ' 万元，低于' + REGION + '平均值 ' + fmt(regionTotalAvg, 0) + ' 万元（低于区域 ' + fmt(Math.abs(vsRegion), 2) + '%）');
    posWords.push(vsIndustry >= 0
      ? '高于行业平均值 ' + fmt(indAvgTotal, 0) + ' 万元（高出行业 ' + fmt(Math.abs(vsIndustry), 2) + '%）'
      : '低于行业平均值 ' + fmt(indAvgTotal, 0) + ' 万元（低于行业 ' + fmt(Math.abs(vsIndustry), 2) + '%）');
    posWords.push(vsAdvanced <= 0
      ? '已达到行业先进值 ' + fmt(advancedTotal, 0) + ' 万元水平'
      : '与行业先进值 ' + fmt(advancedTotal, 0) + ' 万元相比仍有 ' + fmt(vsAdvanced, 2) + '% 差距');

    html += '<h2 class="brief-h2">（一）资产规模与对标分析</h2>'
      + '<p class="brief-p">' + posWords.join('，') + '。'
      + '在' + esc(REGION) + ' ' + entCount + ' 家同行业样本企业中位列第 <strong>' + rank + '</strong> 名，'
      + '超越区域内 ' + fmt(outperform, 1) + '% 的企业，'
      + (outperform >= 75 ? '整体处于区域头部梯队，碳资产厚度与运营能力领先。'
        : outperform >= 50 ? '整体处于区域中上水平，资产规模仍有向头部企业看齐的空间。'
        : outperform >= 25 ? '整体处于区域中游偏下位置，碳资产储备需系统补充。'
        : '整体处于区域落后梯队，碳资产储备薄弱，须尽快充实以提升履约与交易弹性。') + '</p>';

    // 结构分析
    html += '<h2 class="brief-h2">（二）资产结构与配置</h2>'
      + '<p class="brief-p">本企业碳资产由配额、CCER 与其他碳资产（质押/远期/回购等）三部分构成，'
      + '其中配额价值 ' + fmt(entAllowanceVal, 0) + ' 万元（占比 ' + (entAllowanceVal / entTotal * 100).toFixed(1) + '%）、'
      + 'CCER 价值 ' + fmt(entCCERVal, 0) + ' 万元（占比 ' + (entCCERVal / entTotal * 100).toFixed(1) + '%）、'
      + '其他碳资产 ' + fmt(entOther, 0) + ' 万元（占比 ' + (entOther / entTotal * 100).toFixed(1) + '%）。'
      + (entCoverage >= 100
        ? '配额履约覆盖率达 ' + fmt(entCoverage, 1) + '%，自有配额可完全覆盖年度履约排放，并保有 ' + fmt(entAllowance - ANNUAL_EMISSION, 0) + ' 万tCO₂ 盈余可用于市场交易或储备。'
        : '配额履约覆盖率为 ' + fmt(entCoverage, 1) + '%，尚存 ' + fmt(ANNUAL_EMISSION - entAllowance, 0) + ' 万tCO₂ 履约缺口，需通过购入或 CCER 抵销补齐，资产结构安全垫不足。')
      + '</p>';

    html += chartBlock(structBars([
      { name: '配额价值', value: entAllowanceVal, color: GREEN },
      { name: 'CCER 价值', value: entCCERVal, color: '#165dff' },
      { name: '其他碳资产', value: entOther, color: '#ff7d00' }
    ], '万元', 0), '（图）本企业碳资产结构分布（' + MONTH_CN + '）');

    return html;
  }

  /** 三、优势与短板 */
  function swotHtml() {
    var goodItems = [];
    if (vsRegion >= 0) goodItems.push('碳资产总价值高于' + REGION + '平均值 ' + fmt(Math.abs(vsRegion), 2) + '%，区域碳资产厚度处于靠前位置（第 ' + rank + ' / ' + entCount + ' 名）。');
    if (vsIndustry >= 0) goodItems.push('碳资产总价值高于全国行业平均值 ' + fmt(Math.abs(vsIndustry), 2) + '%，具备行业层面的资产竞争优势。');
    if (vsAdvanced <= 0) goodItems.push('已达到行业先进值水平（' + fmt(advancedTotal, 0) + ' 万元），跻身行业碳资产第一梯队。');
    if (entCoverage >= 100) goodItems.push('配额履约覆盖率 ' + fmt(entCoverage, 1) + '%，自有配额盈余充足，履约风险低、交易弹性大。');
    if (entROI >= indROI) goodItems.push('碳资产收益率 ' + fmt(entROI, 2) + '% 不低于行业均值，资产运营绩效良好。');
    if (!goodItems.length) goodItems.push('本期碳资产各项指标未优于各级对标基准，暂无可列优势项，需全面补强。');

    var badItems = [];
    if (vsIndustry < 0) badItems.push('碳资产总价值低于全国行业平均值 ' + fmt(Math.abs(vsIndustry), 2) + '%，整体资产厚度不足。');
    if (vsRegion < 0) badItems.push('碳资产总价值低于' + REGION + '平均值 ' + fmt(Math.abs(vsRegion), 2) + '%，区域排名靠后（第 ' + rank + ' / ' + entCount + ' 名），资产储备承压。');
    if (vsAdvanced > 0) badItems.push('与行业先进值相比仍有 ' + fmt(vsAdvanced, 2) + '% 差距，头部企业资产运营经验不足。');
    if (entCoverage < 100) badItems.push('配额履约覆盖率仅 ' + fmt(entCoverage, 1) + '%，存在 ' + fmt(ANNUAL_EMISSION - entAllowance, 0) + ' 万tCO₂ 履约缺口，期末履约保障压力大。');
    if (entROI < regionROI) badItems.push('碳资产收益率 ' + fmt(entROI, 2) + '% 低于区域均值 ' + fmt(regionROI, 2) + '%，交易择时与资产盘活能力偏弱。');
    if (!badItems.length) badItems.push('各项碳资产指标均优于对标基准，暂无显著短板，需防范配额贬值与市场波动风险。');

    return '<div class="vs-cols">'
      + '<div class="vs-col is-good"><h3>优势</h3><ul>'
      + goodItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div>'
      + '<div class="vs-col is-bad"><h3>短板</h3><ul>'
      + badItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div></div>';
  }

  /** 四、碳资产优化行动建议 */
  function actionHtml() {
    return '<ol class="advice-list">'
      + '<li><strong>夯实履约安全垫：</strong>以配额覆盖率 ' + fmt(entCoverage, 1) + '% 为基线，制定分月配额/CCER 采购与储备计划，确保覆盖率稳定保持在 100% 以上，' + (entCoverage < 100 ? '优先补齐 ' + fmt(ANNUAL_EMISSION - entAllowance, 0) + ' 万tCO₂ 缺口，' : '') + '平滑履约成本、规避期末集中购碳的价格风险。</li>'
      + '<li><strong>优化资产配置结构：</strong>在配额为主的基础上，适度提高 CCER 等低成本抵销资产占比，利用 CCER 与配额价差降低履约成本；审慎开展碳质押、碳回购等碳金融业务，盘活存量资产流动性。</li>'
      + '<li><strong>提升碳交易运营绩效：</strong>对标区域先进企业 ' + fmt(advancedROI, 2) + '% 的收益率水平，建立碳价监测与择时交易机制，在低价为履约与储备建仓、在高点择机变现盈余配额，将收益率提升至行业先进区间。</li>'
      + '<li><strong>开发自有 CCER 项目：</strong>梳理厂区余热余压发电、节能技改、林业碳汇等可开发减排量的场景，申报 CCER 项目，形成低成本、长周期的自有碳资产供给，降低外购依赖。</li>'
      + '<li><strong>健全碳资产台账：</strong>完善配额发放、CCER 登记、交易流水与持仓价值的统一台账，按月开展内部对标通报，将碳资产收益率、覆盖率纳入绩效考核，实现「存量可见、收益可算」。</li>'
      + '<li><strong>联动碳排放管理：</strong>将减排成果（强度下降）同步转化为配额盈余与 CCER 增量，形成「降碳—盈余—收益—再投入」的正向循环，并关注碳市场扩容与配额收紧带来的资产升值空间。</li>'
      + '</ol>';
  }

  /** 五、碳资产收益与履约保障潜力分析 */
  function potentialHtml() {
    // 情景一：配额覆盖率提升至 100%（补缺口的购入成本）
    var gap = Math.max(0, ANNUAL_EMISSION - entAllowance); // 万tCO₂
    var costToFull = +(gap * CARBON_PRICE).toFixed(0); // 万元（万t × 元/t = 万元）
    // 情景二：碳资产收益率提升至行业先进水平（增量年收益）
    var roiGap = Math.max(0, advancedROI - entROI);
    var gainToAdvanced = +(roiGap / 100 * entTotal).toFixed(0); // 万元/年

    var html = '<p class="brief-p">以本企业当前碳资产状况为基线，分「配额覆盖率提升至 100%」「碳资产收益率提升至行业先进」两档目标情景，'
      + '测算保障成本与收益潜力。计算逻辑：<strong>补缺口成本（万元）＝履约缺口（万tCO₂）× 配额市场价（元/tCO₂）</strong>；'
      + '<strong>增量年收益（万元/年）＝（行业先进收益率 − 本企业收益率）÷ 100 × 碳资产总价值</strong>；已达标时该项计为 0。</p>'
      + '<div class="table-caption"><span>碳资产优化潜力测算表</span><span class="unit">价值：万元；缺口：万tCO₂；收益率：%</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>目标情景</th><th>当前水平</th><th>目标水平</th><th>差距</th><th>投入/增量</th><th>说明</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>情景一：覆盖率→100%</td>'
      + '<td>' + fmt(entCoverage, 1) + '%</td><td>100.0%</td>'
      + '<td class="' + (gap > 0 ? 'is-pos' : 'is-neg') + '">' + (gap > 0 ? '缺口 ' + fmt(gap, 0) : '已盈余') + '</td>'
      + '<td><strong>' + fmt(costToFull, 0) + '</strong></td><td>' + (gap > 0 ? '需购碳补足缺口' : '无需额外投入') + '</td></tr>'
      + '<tr><td>情景二：收益率→行业先进</td>'
      + '<td>' + fmt(entROI, 2) + '%</td><td>' + fmt(advancedROI, 2) + '%</td>'
      + '<td class="' + (roiGap > 0 ? 'is-pos' : 'is-neg') + '">' + (roiGap > 0 ? '+' + fmt(roiGap, 2) : '已达标') + '</td>'
      + '<td><strong>' + fmt(gainToAdvanced, 0) + '</strong></td><td>增量年收益</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：覆盖率缺口以年度履约排放 ' + ANNUAL_EMISSION + ' 万tCO₂ 为基准；增量年收益按碳资产总价值 ' + fmt(entTotal, 0) + ' 万元测算。</div>';

    html += '<p class="brief-p">测算结果显示：'
      + (gap > 0
        ? '本企业需投入约 <strong>' + fmt(costToFull, 0) + '</strong> 万元补足履约缺口、将覆盖率提升至 100%，'
        : '本企业配额已盈余，覆盖率达标，可节省约 ' + fmt(costToFull, 0) + ' 万元的潜在购碳支出，')
      + '若将碳资产收益率提升至行业先进水平（' + fmt(advancedROI, 2) + '%），可带来约 <strong>' + fmt(gainToAdvanced, 0) + '</strong> 万元/年的增量收益。</p>'
      + '<p class="brief-p">建议按「保障优先、收益并重」原则排定优化优先级：先以情景一筑牢履约安全垫、消除期末履约风险，'
      + '再以情景二通过择时交易与资产盘活增厚收益。两项叠加，可在' + esc(REGION) + '同行业中进一步稳固碳资产竞争位势，'
      + '并将碳资产规模与运营绩效统一纳入企业资产负债表与年度经营考核。</p>';
    return html;
  }

  /* ---------- 报告组装 ---------- */

  function buildReport() {
    var dateRange = Y + '-' + pad2(M) + '-01 至 ' + Y + '-' + pad2(M) + '-' + lastDay(Y, M);

    // 封面
    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">碳 资 产 对 标 分 析 报 告</div>'
      + '<h1>' + esc(ORG) + '<br/>碳资产对标分析报告</h1>'
      + '<div class="cover-month">' + esc(MONTH_CN) + '</div>'
      + '<div class="cover-region">对标区域：' + esc(REGION) + '</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + dateRange + '</div>'
      + '</div></div>';

    // 目录
    html += '<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>'
      + '<li class="toc-l1"><a href="#sec-0">摘要 · 碳资产对标结论概览</a></li>'
      + '<li class="toc-l1"><a href="#sec-1">一、报告定位与核心思路</a></li>'
      + '<li class="toc-l1"><a href="#sec-2">二、企业碳资产规模与结构对标</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-1">（一）资产规模与对标分析</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-2">（二）资产结构与配置</a></li>'
      + '<li class="toc-l1"><a href="#sec-3">三、优势与短板</a></li>'
      + '<li class="toc-l1"><a href="#sec-4">四、碳资产优化行动建议</a></li>'
      + '<li class="toc-l1"><a href="#sec-5">五、碳资产收益与履约保障潜力分析</a></li>'
      + '</ol></div>';

    // 正文
    html += '<div class="brief-page">'
      + '<h1 class="brief-h1" id="sec-0">摘要 · 碳资产对标结论概览</h1>'
      + summaryHtml()

      + '<h1 class="brief-h1" id="sec-1">一、报告定位与核心思路</h1>'
      + positionHtml()

      + '<h1 class="brief-h1" id="sec-2">二、企业碳资产规模与结构对标</h1>'
      + assetScaleHtml()

      + '<h1 class="brief-h1" id="sec-3">三、优势与短板</h1>'
      + swotHtml()

      + '<h1 class="brief-h1" id="sec-4">四、碳资产优化行动建议</h1>'
      + actionHtml()

      + '<h1 class="brief-h1" id="sec-5">五、碳资产收益与履约保障潜力分析</h1>'
      + potentialHtml()
      + '</div>';

    return html;
  }

  /* ---------- 下载（PDF） ---------- */

  function download() {
    if (!(window.jspdf && window.jspdf.jsPDF && window.html2canvas)) {
      window.print();
      return;
    }
    var btn = document.getElementById('btn-download');
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = '正在生成 PDF…';

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
            part.width = canvas.width;
            part.height = h;
            var ctx = part.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, part.width, part.height);
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
      pdf.save('碳资产对标分析报告-' + Y + '年' + M + '月-' + REGION + '.pdf');
    }).catch(function (err) {
      if (window.console) console.error('PDF 生成失败，降级为打印：', err);
      window.print();
    }).then(function () {
      btn.disabled = false;
      btn.innerHTML = oldText;
    });
  }

  /* ---------- 启动 ---------- */

  document.getElementById('brief-root').innerHTML = buildReport();
  document.getElementById('bt-title').textContent = ORG + '碳资产对标分析报告（' + MONTH_CN + ' · ' + REGION + '）';
  document.title = '碳资产对标分析报告-' + Y + '年' + M + '月-' + REGION;
  document.getElementById('btn-download').addEventListener('click', download);
})();
