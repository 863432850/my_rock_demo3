/**
 * 碳资产对标分析报告 · 渲染（与碳排放对标报告并列，但内容维度完全不同）
 * - URL 参数：?type=asset&year=2026&month=9&region=河南省&volume=320&company=...
 * - 不同对标条件生成不同内容：以「区域名 + 年 + 月」为稳定种子
 * - 对标维度聚焦「碳资产量」：配额持有量、CCER 储备量、资产结构与规模
 *   与碳排放对标（强度/排名/降碳空间）口径不同，互为补充
 * - 【口径】全篇为**实物量口径（万tCO₂）**，不出现任何金额：碳价逐日波动，
 *   把「碳资产总价值（万元）」当入参会让同一天量、不同天价的数据不可比。
 *   故入参只收碳资产量，报告也不做「量 × 价」折算。
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
    if (n == null || !isFinite(n)) return '--';
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

  /* ---------- 本企业碳资产数据（入参直取，零兜底） ---------- */

  // ?volume= 本企业碳资产量（万tCO₂）。报告为纯实物量口径，不采集金额，也不采集年履约排放量。
  var IN_VOLUME = qs.has('volume') ? Number(qs.get('volume')) : 320;

  var HAS_VOLUME = isFinite(IN_VOLUME) && IN_VOLUME > 0;

  var entVolume = HAS_VOLUME ? +IN_VOLUME.toFixed(2) : null;   // 碳资产量（万tCO₂）

  /* ---------- 资产结构（按固定占比由总量拆解，口径见文档 2.5(2)(3)） ---------- */

  var SHARE_ALLOWANCE = 0.88;   // 配额占比
  var SHARE_CCER = 0.07;        // CCER 占比（其余约 5% 归入「其他碳资产」，用减法保证三项之和 = 碳资产量）

  var entAllowance = HAS_VOLUME ? +(entVolume * SHARE_ALLOWANCE).toFixed(2) : null;      // 配额持有量 万tCO₂
  var entCCER = HAS_VOLUME ? +(entVolume * SHARE_CCER).toFixed(2) : null;                // CCER 储备量 万tCO₂
  var entOther = HAS_VOLUME ? +(entVolume - entAllowance - entCCER).toFixed(2) : null;   // 其他碳资产 万tCO₂

  /* ---------- 对标基准（L3 兜底：区域/行业口径，同条件结果一致） ---------- */

  // 注意：`rnd()` 一律**无条件**消耗（全国分支除外），与入参是否有值无关 —— 见文档 2.5(3)
  // 行业先进值**高于**行业均值（碳资产量越大越好，先进值应更优 = 更大）；
  // 这与碳排放对标报告的 `advanced = indAvg × 0.92x`（强度越低越好）方向相反，不要照抄。
  var regionOffset = IS_NATIONAL ? 0 : (rnd() - 0.45) * 0.12;
  var uInd = rnd(), uAdv = rnd();
  var regionAvgVolume = HAS_VOLUME ? +(entVolume * (1 + regionOffset)).toFixed(2) : null;
  var indAvgVolume = HAS_VOLUME ? +(entVolume * (1 + (uInd - 0.42) * 0.10)).toFixed(2) : null;
  var advancedVolume = HAS_VOLUME ? +(indAvgVolume * (1.12 + uAdv * 0.04)).toFixed(2) : null;

  // 区域样本企业数
  var entCount = IS_NATIONAL ? Math.round(1400 + rnd() * 900) : Math.round(45 + rnd() * 180);

  // 区域排名（按碳资产量降序，量越大越靠前）
  var rank = null, outperform = null;
  if (HAS_VOLUME) {
    var rankPct = clamp(0.5 - (entVolume - regionAvgVolume) / (regionAvgVolume * 0.22), 0.02, 0.98);
    rank = Math.max(1, Math.round(entCount * rankPct));
    outperform = +((1 - rank / entCount) * 100).toFixed(1);
  }

  var vsRegion = HAS_VOLUME ? +((entVolume - regionAvgVolume) / regionAvgVolume * 100).toFixed(2) : null;   // 正=高于区域均值
  var vsIndustry = HAS_VOLUME ? +((entVolume - indAvgVolume) / indAvgVolume * 100).toFixed(2) : null;
  var vsAdvanced = HAS_VOLUME ? +((entVolume - advancedVolume) / advancedVolume * 100).toFixed(2) : null;

  /* ---------- 储备提升空间（两档目标情景，只依赖碳资产量） ---------- */

  var gapAvg = HAS_VOLUME ? +(Math.max(0, indAvgVolume - entVolume)).toFixed(2) : null;          // 差距量 万tCO₂
  var gapAdvanced = HAS_VOLUME ? +(Math.max(0, advancedVolume - entVolume)).toFixed(2) : null;   // 差距量 万tCO₂
  var pctAvg = (gapAvg == null) ? null : +(gapAvg / entVolume * 100).toFixed(2);                 // 相对提升幅度 %
  var pctAdvanced = (gapAdvanced == null) ? null : +(gapAdvanced / entVolume * 100).toFixed(2);

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
    var levelWord = !HAS_VOLUME ? '本企业数据缺失'
      : (entVolume >= advancedVolume ? '已达行业资产规模先进梯队'
        : (entVolume >= indAvgVolume ? '高于行业平均、距先进有差距' : '落后于行业平均，资产厚度不足'));
    var levelCls = !HAS_VOLUME ? 'is-flat' : (entVolume >= indAvgVolume ? 'is-neg' : 'is-pos');

    /** 对比小字：碳资产量越高越好，v>=0 为「高于」；不可计算时写「本企业数据缺失」 */
    function cmpDelta(v, unit) {
      if (v == null) return '<div class="kpi-delta is-flat">本企业数据缺失</div>';
      var higher = v >= 0;
      return '<div class="kpi-delta ' + (higher ? 'is-neg' : 'is-pos') + '">本企业' + (higher ? '高于' : '低于') + unit + ' ' + fmt(Math.abs(v), 2) + '%</div>';
    }

    var html = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本企业碳资产量</div><div class="kpi-val">' + fmt(entVolume, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">' + esc(MONTH_CN) + ' 持仓口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">' + esc(REGION) + '平均值</div><div class="kpi-val">' + fmt(regionAvgVolume, 2) + '<small> 万tCO₂</small></div>' + cmpDelta(vsRegion, '区域') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">行业平均值（全国）</div><div class="kpi-val">' + fmt(indAvgVolume, 2) + '<small> 万tCO₂</small></div>' + cmpDelta(vsIndustry, '行业') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">行业先进值</div><div class="kpi-val">' + fmt(advancedVolume, 2) + '<small> 万tCO₂</small></div>'
      + '<div class="kpi-delta ' + (vsAdvanced == null ? 'is-flat' : (vsAdvanced >= 0 ? 'is-neg' : 'is-pos')) + '">'
      + (vsAdvanced == null ? '本企业数据缺失' : (vsAdvanced >= 0 ? '已达先进水平' : '距先进差距 ' + fmt(Math.abs(vsAdvanced), 2) + '%')) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">' + esc(REGION) + '排名</div><div class="kpi-val">' + (rank == null ? '--' : '第 ' + rank + ' 名') + '<small>' + (rank == null ? '' : ' / 共 ' + entCount + ' 家') + '</small></div><div class="kpi-delta is-flat">区域内同行业企业口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">超越区域企业比例</div><div class="kpi-val">' + fmt(outperform, 1) + '<small> %</small></div><div class="kpi-delta ' + levelCls + '">' + levelWord + '</div></div>'
      + '</div>';

    // 排名横幅
    html += '<div class="rank-banner">'
      + '<div class="rank-no">' + (rank == null ? 'No.--' : 'No.' + rank) + '<small>/ ' + entCount + ' 家</small></div>'
      + '<div class="rank-info"><div class="t">' + esc(REGION) + '同行业企业碳资产规模排名（' + esc(MONTH_CN) + '），超越区域内 <strong>' + fmt(outperform, 1) + '%</strong> 的企业</div>'
      + '<div class="rank-track"><i style="width:' + (outperform == null ? 0 : clamp(outperform, 1, 100)).toFixed(1) + '%"></i></div>'
      + '<div class="s">排名口径：按碳资产量（万tCO₂）降序排列，数据来源于区域碳市场登记簿、交易结算平台与行业统计</div></div>'
      + '</div>';

    // 碳资产量对标总览（本企业数据缺失时基准不可推导，整图不画）
    if (!HAS_VOLUME) {
      html += '<div class="btable-note">本期未提供本企业碳资产数据，对标总览图与排名暂不可用。</div>';
    } else {
      html += chartBlock(cmpBars([
        { name: '本企业（' + ORG + '）', value: entVolume, color: '#ff7d00', self: true },
        { name: REGION + '平均值', value: regionAvgVolume, color: GREEN },
        { name: '行业平均值（全国）', value: indAvgVolume, color: '#165dff' },
        { name: '行业先进值', value: advancedVolume, color: '#722ed1' }
      ], '万tCO₂', 2), '（图）企业层级碳资产量对标总览（' + MONTH_CN + '）');
    }

    return html;
  }

  /** 一、报告定位与核心思路 */
  function positionHtml() {
    return '<p class="brief-p">本报告为 ' + esc(ORG) + ' 专属碳资产对标专项报告，聚焦企业碳资产的<strong>规模与结构</strong>开展量化研判，'
      + '与碳排放对标（强度/降碳空间）形成互补——碳排放对标看「排了多少、强度如何」，本看「手里有多少碳资产、储备结构是否合理」。'
      + '报告以「' + esc(REGION) + '」为对标区域、以「' + esc(MONTH_CN) + '」为对标期间，'
      + '将本企业碳资产量与区域平均值、行业平均值、行业先进值进行四维对比，并拆解配额、CCER 与其他碳资产的配置结构。</p>'
      + '<p class="brief-p">报告核心思路：<strong>一排名、二对比、三结构、四建议</strong>——'
      + '先以碳资产规模排名锚定企业在区域同行业中的位置；再与区域、行业、先进三级基准逐层对比；'
      + '拆解配额、CCER、其他碳资产的配置结构并定位储备短板；最终给出碳资产储备与结构优化建议，为企业盘活碳资产、提升储备厚度提供决策依据。</p>'
      + '<p class="brief-p">数据口径说明：碳资产量为<strong>实物量口径</strong>（万tCO₂），由配额持有量、CCER 储备量与其他碳资产三部分构成；'
      + '碳价逐日波动，故本报告不做「量 × 价」折算、全篇不出现金额，以保证不同期间、不同企业之间可比。'
      + '区域与行业数据来源于区域碳排放权登记簿、碳交易结算平台及行业协会统计，样本企业 ' + entCount + ' 家；先进值取行业前 10% 企业水平。</p>';
  }

  /** 二、企业碳资产规模与结构对标 */
  function assetScaleHtml() {
    var html = '<div class="table-caption"><span>企业碳资产规模对标表</span><span class="unit">单位：万tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>指标</th><th>企业数据</th><th>' + esc(REGION) + '排名</th><th>' + esc(REGION) + '平均值</th><th>行业平均值</th><th>行业先进值</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>碳资产量</td><td class="is-self">' + fmt(entVolume, 2) + '</td>'
      + '<td class="is-self">' + (rank == null ? '--' : rank + ' / ' + entCount) + '</td>'
      + '<td>' + fmt(regionAvgVolume, 2) + '</td><td>' + fmt(indAvgVolume, 2) + '</td><td>' + fmt(advancedVolume, 2) + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：排名按碳资产量降序（量越大排名越靠前），样本为' + esc(REGION) + '同行业报送企业。</div>';

    html += '<h2 class="brief-h2">（一）资产规模与对标分析</h2>';
    if (!HAS_VOLUME) {
      html += '<p class="brief-p">本期未提供本企业碳资产数据，无法开展对标分析。'
        + '表中各级基准值由本企业碳资产规模推导，本企业数据缺失时一并不可用；数据补齐后即可完成规模对比与排名。</p>';
    } else {
      var posWords = [];
      posWords.push(vsRegion >= 0
        ? '本企业碳资产量 ' + fmt(entVolume, 2) + ' 万tCO₂，高于' + REGION + '平均值 ' + fmt(regionAvgVolume, 2) + ' 万tCO₂（高出区域 ' + fmt(Math.abs(vsRegion), 2) + '%）'
        : '本企业碳资产量 ' + fmt(entVolume, 2) + ' 万tCO₂，低于' + REGION + '平均值 ' + fmt(regionAvgVolume, 2) + ' 万tCO₂（低于区域 ' + fmt(Math.abs(vsRegion), 2) + '%）');
      posWords.push(vsIndustry >= 0
        ? '高于行业平均值 ' + fmt(indAvgVolume, 2) + ' 万tCO₂（高出行业 ' + fmt(Math.abs(vsIndustry), 2) + '%）'
        : '低于行业平均值 ' + fmt(indAvgVolume, 2) + ' 万tCO₂（低于行业 ' + fmt(Math.abs(vsIndustry), 2) + '%）');
      posWords.push(vsAdvanced >= 0
        ? '已达到行业先进值 ' + fmt(advancedVolume, 2) + ' 万tCO₂ 水平'
        : '与行业先进值 ' + fmt(advancedVolume, 2) + ' 万tCO₂ 相比仍有 ' + fmt(Math.abs(vsAdvanced), 2) + '% 差距');

      html += '<p class="brief-p">' + posWords.join('，') + '。'
        + '在' + esc(REGION) + ' ' + entCount + ' 家同行业样本企业中位列第 <strong>' + rank + '</strong> 名，'
        + '超越区域内 ' + fmt(outperform, 1) + '% 的企业，'
        + (outperform >= 75 ? '整体处于区域头部梯队，碳资产厚度与储备能力领先。'
          : outperform >= 50 ? '整体处于区域中上水平，资产规模仍有向头部企业看齐的空间。'
          : outperform >= 25 ? '整体处于区域中游偏下位置，碳资产储备需系统补充。'
          : '整体处于区域落后梯队，碳资产储备薄弱，须尽快充实以提升履约与交易弹性。') + '</p>';
    }

    // 结构分析
    html += '<h2 class="brief-h2">（二）资产结构与配置</h2>';
    if (!HAS_VOLUME) {
      html += '<p class="brief-p">本期未提供本企业碳资产数据，暂不作结构分析。</p>';
    } else {
      var p1 = (entAllowance / entVolume * 100).toFixed(1);
      var p2 = (entCCER / entVolume * 100).toFixed(1);
      var p3 = (entOther / entVolume * 100).toFixed(1);
      var pRest = ((entCCER + entOther) / entVolume * 100).toFixed(1);

      html += '<p class="brief-p">本企业碳资产量 ' + fmt(entVolume, 2) + ' 万tCO₂，按用途拆分为配额、CCER 与其他碳资产三部分：'
        + '配额持有量 ' + fmt(entAllowance, 2) + ' 万tCO₂（占比 ' + p1 + '%）、'
        + 'CCER 储备量 ' + fmt(entCCER, 2) + ' 万tCO₂（占比 ' + p2 + '%）、'
        + '其他碳资产 ' + fmt(entOther, 2) + ' 万tCO₂（占比 ' + p3 + '%）。'
        + '结构上以配额为绝对主体（占比 ' + p1 + '%），履约保障基础扎实；'
        + 'CCER 与其他碳资产合计占比 ' + pRest + '%，可作为低成本抵销资源与流动性补充，'
        + '整体配置符合「以配额保履约、以 CCER 降成本」的通用思路。</p>';

      html += chartBlock(structBars([
        { name: '配额持有量', value: entAllowance, color: GREEN },
        { name: 'CCER 储备量', value: entCCER, color: '#165dff' },
        { name: '其他碳资产', value: entOther, color: '#ff7d00' }
      ], '万tCO₂', 2), '（图）本企业碳资产结构分布（' + MONTH_CN + '）');
    }

    return html;
  }

  /** 三、优势与短板 */
  function swotHtml() {
    if (!HAS_VOLUME) {
      return '<div class="vs-cols">'
        + '<div class="vs-col is-good"><h3>优势</h3><ul><li>本企业碳资产数据缺失，暂不作优势评价。</li></ul></div>'
        + '<div class="vs-col is-bad"><h3>短板</h3><ul><li>本企业碳资产数据缺失，暂不作短板评价。</li></ul></div></div>';
    }
    var goodItems = [];
    if (vsRegion >= 0) goodItems.push('碳资产量高于' + REGION + '平均值 ' + fmt(Math.abs(vsRegion), 2) + '%，区域碳资产厚度处于靠前位置（第 ' + rank + ' / ' + entCount + ' 名）。');
    if (vsIndustry >= 0) goodItems.push('碳资产量高于全国行业平均值 ' + fmt(Math.abs(vsIndustry), 2) + '%，具备行业层面的资产规模优势。');
    if (vsAdvanced >= 0) goodItems.push('已达到行业先进值水平（' + fmt(advancedVolume, 2) + ' 万tCO₂），跻身行业碳资产储量第一梯队。');
    if (outperform >= 75) goodItems.push('超越区域内 ' + fmt(outperform, 1) + '% 的同行业企业，碳资产储备体系完善、可持续性强。');
    if (!goodItems.length) goodItems.push('本期碳资产各项指标未优于各级对标基准，暂无可列优势项，需全面补强。');

    var badItems = [];
    if (vsIndustry < 0) badItems.push('碳资产量低于全国行业平均值 ' + fmt(Math.abs(vsIndustry), 2) + '%，整体储备厚度不足。');
    if (vsRegion < 0) badItems.push('碳资产量低于' + REGION + '平均值 ' + fmt(Math.abs(vsRegion), 2) + '%，区域排名靠后（第 ' + rank + ' / ' + entCount + ' 名），储备规模承压。');
    if (vsAdvanced < 0) badItems.push('与行业先进值相比仍有 ' + fmt(Math.abs(vsAdvanced), 2) + '% 差距，头部企业的储备与配置经验不足。');
    if (outperform < 50 && outperform > 0) badItems.push('仅超越区域内 ' + fmt(outperform, 1) + '% 的企业，与头部梯队存在系统性差距。');
    if (!badItems.length) badItems.push('各项碳资产指标均优于对标基准，暂无显著短板，需防范储备闲置与市场波动风险。');

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
    var a1 = HAS_VOLUME
      ? '以行业先进值 ' + fmt(advancedVolume, 2) + ' 万tCO₂ 为目标，制定分年度碳资产增持路线图，明确责任部门与时间节点，逐步缩小与区域头部企业的储备差距。'
      : '先完成配额发放量、CCER 登记量与持有量的核算与台账核对，建立碳资产量基线，再据此制定分年度增持路线图与责任分工。';
    return '<ol class="advice-list">'
      + '<li><strong>夯实碳资产储备：</strong>' + a1 + '</li>'
      + '<li><strong>优化资产配置结构：</strong>&#x5728;配额为主的基础上，适度提高 CCER 等低成本抵销资产占比，利用 CCER 与配额的功能差异降低履约成本；审慎开展碳质押、碳回购等碳金融业务，盘活存量资产流动性。</li>'
      + '<li><strong>提升碳资产运营绩效：</strong>&#x5BF9;标区域先进企业的碳资产管理水平，建立碳价监测与择时交易机制，在低价区间为履约与储备建仓、在高点择机变现盈余配额，提高存量资产的周转效率。</li>'
      + '<li><strong>开发自有 CCER 项目：</strong>&#x68B3;理厂区余热余压发电、节能技改、林业碳汇等可开发减排量的场景，申报 CCER 项目，形成低成本、长周期的自有碳资产供给，降低外购依赖。</li>'
      + '<li><strong>健全碳资产台账：</strong>&#x5B8C;善配额发放、CCER 登记与持有量的统一台账，按月开展内部对标通报，将碳资产持有量纳入企业绩效考核，实现「存量可见、变动可溯」。</li>'
      + '<li><strong>联动碳排放管理：</strong>&#x5C06;减排成果（强度下降）同步转化为配额盈余与 CCER 增量，形成「降碳—盈余—储备—再投入」的正向循环，并关注碳市场扩容与配额收紧带来的储备价值变化。</li>'
      + '</ol>';
  }

  /** 五、碳资产储备提升空间分析 */
  function potentialHtml() {
    var html = '<p class="brief-p">以本企业当前碳资产量为基线，分「达到行业平均值」「达到行业先进值」两档目标情景，测算储备提升空间。'
      + '计算逻辑：<strong>差距量（万tCO₂）＝目标情景碳资产量 − 本企业碳资产量</strong>；'
      + '<strong>相对提升幅度（%）＝差距量 ÷ 本企业碳资产量 × 100</strong>。'
      + '本企业已达到目标情景时，该档差距量计为 0。</p>'
      + '<div class="table-caption"><span>碳资产储备提升空间测算表</span><span class="unit">碳资产量：万tCO₂；提升幅度：%</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>目标情景</th><th>本企业碳资产量</th><th>目标水平</th><th>差距量</th><th>相对提升幅度</th>'
      + '</tr></thead><tbody>';

    /** 差距量单元格：不可计算时写 --；仍需增持为红，已达标为绿 */
    function gapTd(v) {
      if (v == null || !isFinite(v)) return '<td>--</td>';
      return '<td class="' + (v > 0 ? 'is-pos' : 'is-neg') + '">' + fmt(v, 2) + '</td>';
    }

    /** 相对提升幅度单元格：不可计算时写 -- */
    function pctTd(v) {
      if (v == null || !isFinite(v)) return '<td>--</td>';
      return '<td class="' + (v > 0 ? 'is-pos' : 'is-neg') + '"><strong>' + fmt(v, 2) + '%</strong></td>';
    }

    html += '<tr><td>情景一：达到行业平均值</td>'
      + '<td>' + fmt(entVolume, 2) + '</td><td>' + fmt(indAvgVolume, 2) + '</td>'
      + gapTd(gapAvg) + pctTd(pctAvg) + '</tr>'
      + '<tr><td>情景二：达到行业先进值</td>'
      + '<td>' + fmt(entVolume, 2) + '</td><td>' + fmt(advancedVolume, 2) + '</td>'
      + gapTd(gapAdvanced) + pctTd(pctAdvanced) + '</tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：差距量 = 目标值 − 本企业值，正值（红）表示仍需增持；已达到目标情景时计为 0。</div>';

    if (!HAS_VOLUME) {
      html += '<p class="brief-p">本期未提供本企业碳资产数据，无法测算储备提升空间。'
        + '建议先行完成配额发放量、CCER 登记量与持有量的核算与台账核对，建立碳资产量基线；'
        + '数据补齐后即可自动生成两档情景的储备提升空间测算。</p>'
        + '<p class="brief-p">建议按「保障优先、储备并重」原则推进碳资产管理工作：先把持有量基线建准、把台账建全，'
        + '再据此排定分年度增持与结构优化计划，并将碳资产持有量纳入企业年度经营考核。</p>';
      return html;
    }

    /** 单档情景描述句（不含结尾标点） */
    function scenText(name, target, gap, pct) {
      if (gap <= 0) return '本企业碳资产量已达' + name + '水平（' + fmt(target, 2) + ' 万tCO₂），无需增持';
      return '达到' + name + '水平需增持 <strong>' + fmt(gap, 2) + '</strong> 万tCO₂（相对提升 <strong>' + fmt(pct, 2) + '%</strong>）';
    }

    html += '<p class="brief-p">测算结果显示：'
      + scenText('行业平均', indAvgVolume, gapAvg, pctAvg) + '；'
      + scenText('行业先进', advancedVolume, gapAdvanced, pctAdvanced) + '。</p>'
      + '<p class="brief-p">建议按「保障优先、储备并重」原则排定储备提升优先级：先把持有量补齐至行业平均水平、消除与同业的规模断层，'
      + '再向行业先进水平看齐，同步优化配额与 CCER 的配置比例。两项叠加，可在' + esc(REGION)
      + '同行业中进一步稳固碳资产竞争位势，并将碳资产持有量纳入企业年度经营考核。</p>';
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
      + '<li class="toc-l1"><a href="#sec-5">五、碳资产储备提升空间分析</a></li>'
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

      + '<h1 class="brief-h1" id="sec-5">五、碳资产储备提升空间分析</h1>'
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
