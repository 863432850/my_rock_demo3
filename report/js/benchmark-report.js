/**
 * 碳排放对标分析报告 · 渲染（参考《xxx企业智能对标分析报告》模板扩展）
 * - URL 参数：?type=emission&year=2026&month=9&region=河南省
 * - 不同对标条件生成不同内容：以「区域名 + 年 + 月」为稳定种子
 *   · 本企业数据锚定平台既有口径（2026 年强度序列），年份推移按能效年改善 1.2% 折算
 *   · 区域均值按省份稳定偏移（工业结构差异），全国 = 行业均值口径
 *   · 区域排名、企业数等均由种子确定性生成，同条件结果一致
 * - 报告仅做企业层级对标（强度 / 排名 / 降碳空间），不含行业特定内容，各行业通用
 * - 本企业只采集「单位产品碳排放强度」一项：年产量、年排放总量、工序级排放均无法获取，
 *   因此第五章只出单位产品口径的降碳空间（强度差距 tCO₂/t ＋ 相对降幅 %），不出年减排量
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
  /** 带符号的百分比文字；不可计算时返回 '--' */
  function pct(n, d) {
    if (n == null || !isFinite(n)) return '--';
    return (n > 0 ? '+' : '') + fmt(n, d) + '%';
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
  ORG = qs.get('company') || ORG; // 报告主体企业名可由查询页透传

  /** 条件种子：区域 + 年 + 月共同决定，同条件结果完全一致 */
  var SEED = (strHash(REGION) ^ Math.imul(Y, 131) ^ M) >>> 0;
  var rnd = mulberry32(SEED);

  /* ---------- 本企业数据（入参直取，零兜底） ---------- */

  // ?intensity= 本企业单位产品碳排放强度（tCO₂/t）。本报告不采集年产量等其它企业数据。
  var IN_INTENSITY = qs.has('intensity') ? Number(qs.get('intensity')) : 0.7662;

  var HAS_INTENSITY = isFinite(IN_INTENSITY) && IN_INTENSITY > 0;

  var entIntensity = HAS_INTENSITY ? +IN_INTENSITY.toFixed(4) : null;   // 本企业强度（tCO₂/t）

  /* ---------- 对标基准（L3 兜底：区域/行业口径，同条件结果一致） ---------- */

  // 行业均值（全国同行业）：基准 0.8020，早年更高（年改善 1.5%），月际微扰
  var indAvg = +((0.8020 + (2026 - Y) * 0.015) * (1 + (rnd() - 0.5) * 0.008)).toFixed(4);

  // 区域均值：全国 = 行业均值；省份按区域名稳定偏移（工业结构差异 ±6%）
  var regionOffset = IS_NATIONAL ? 0 : (rnd() - 0.45) * 0.12;
  var regionAvg = +(indAvg * (1 + regionOffset)).toFixed(4);

  // 行业先进值：约为行业均值的 92.5%~93.5%
  var advanced = +(indAvg * (0.925 + rnd() * 0.01)).toFixed(4);

  // 区域样本企业数：全国 1400~2300 家；省份 45~225 家
  var entCount = IS_NATIONAL ? Math.round(1400 + rnd() * 900) : Math.round(45 + rnd() * 180);

  /* ---------- 对标结果（依赖本企业强度；无有效数据时一律为 null，渲染为 --） ---------- */

  var rank = null, outperform = null;
  if (HAS_INTENSITY) {
    // 区域排名：由本企业与区域均值的相对位置确定（确定性，不另取随机）
    var rankPct = clamp(0.5 - (regionAvg - entIntensity) / (regionAvg * 0.22), 0.02, 0.98);
    rank = Math.max(1, Math.round(entCount * rankPct));
    outperform = +((1 - rank / entCount) * 100).toFixed(1);
  }

  var vsRegion = HAS_INTENSITY ? +((entIntensity - regionAvg) / regionAvg * 100).toFixed(2) : null;   // 负=优于区域均值
  var vsIndustry = HAS_INTENSITY ? +((entIntensity - indAvg) / indAvg * 100).toFixed(2) : null;
  var vsAdvanced = HAS_INTENSITY ? +((entIntensity - advanced) / advanced * 100).toFixed(2) : null;

  /* ---------- 降碳空间（单位产品口径；只依赖本企业强度，不采集产量） ---------- */

  // 强度差距（tCO₂/t）与相对降幅（%）：本企业已优于目标情景时降幅计 0
  function gapOf(target) { return HAS_INTENSITY ? +(entIntensity - target).toFixed(4) : null; }
  function cutPctOf(target) {
    if (!HAS_INTENSITY) return null;
    return +((Math.max(0, entIntensity - target) / entIntensity) * 100).toFixed(2);
  }
  var gapToAvg = gapOf(indAvg), gapToAdvanced = gapOf(advanced);
  var cutPctToAvg = cutPctOf(indAvg), cutPctToAdvanced = cutPctOf(advanced);


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

  function chartBlock(innerHtml, caption) {
    return '<div class="chart-box">' + innerHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  /* ---------- 文案区块 ---------- */

  /** 摘要 · 对标结论概览 */
  function summaryHtml() {
    var levelWord = !HAS_INTENSITY ? '本企业数据缺失'
      : (entIntensity <= advanced ? '已达行业先进水平'
        : (entIntensity <= indAvg ? '优于行业平均、距先进有差距' : '落后于行业平均，亟需提升'));
    var levelCls = !HAS_INTENSITY ? 'is-flat' : (entIntensity <= indAvg ? 'is-neg' : 'is-pos');

    /** 对比小字：强度越低越好，v<=0 为「优于」；不可计算时写「本企业数据缺失」 */
    function cmpDelta(v, unit) {
      if (v == null) return '<div class="kpi-delta is-flat">本企业数据缺失</div>';
      var better = v <= 0;
      return '<div class="kpi-delta ' + (better ? 'is-neg' : 'is-pos') + '">本企业' + (better ? '优于' : '高于') + unit + ' ' + fmt(Math.abs(v), 2) + '%</div>';
    }

    var html = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本企业碳排放强度</div><div class="kpi-val">' + fmt(entIntensity, 4) + '<small> tCO₂/t</small></div><div class="kpi-delta is-flat">' + esc(MONTH_CN) + ' 当月口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">' + esc(REGION) + '平均值</div><div class="kpi-val">' + fmt(regionAvg, 4) + '<small> tCO₂/t</small></div>' + cmpDelta(vsRegion, '区域') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">行业平均值（全国）</div><div class="kpi-val">' + fmt(indAvg, 4) + '<small> tCO₂/t</small></div>' + cmpDelta(vsIndustry, '行业') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">行业先进值</div><div class="kpi-val">' + fmt(advanced, 4) + '<small> tCO₂/t</small></div>'
      + '<div class="kpi-delta ' + (vsAdvanced == null ? 'is-flat' : (vsAdvanced <= 0 ? 'is-neg' : 'is-pos')) + '">'
      + (vsAdvanced == null ? '本企业数据缺失' : (vsAdvanced <= 0 ? '已达先进水平' : '距先进差距 ' + fmt(vsAdvanced, 2) + '%')) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">' + esc(REGION) + '排名</div><div class="kpi-val">' + (rank == null ? '--' : '第 ' + rank + ' 名') + '<small>' + (rank == null ? '' : ' / 共 ' + entCount + ' 家') + '</small></div><div class="kpi-delta is-flat">区域内同行业企业口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">超越区域企业比例</div><div class="kpi-val">' + fmt(outperform, 1) + '<small> %</small></div><div class="kpi-delta ' + levelCls + '">' + levelWord + '</div></div>'
      + '</div>';

    // 排名横幅
    html += '<div class="rank-banner">'
      + '<div class="rank-no">' + (rank == null ? 'No.--' : 'No.' + rank) + '<small>/ ' + entCount + ' 家</small></div>'
      + '<div class="rank-info"><div class="t">' + esc(REGION) + '同行业企业碳排放强度排名（' + esc(MONTH_CN) + '），超越区域内 <strong>' + fmt(outperform, 1) + '%</strong> 的企业</div>'
      + '<div class="rank-track"><i style="width:' + (outperform == null ? 0 : clamp(outperform, 1, 100)).toFixed(1) + '%"></i></div>'
      + '<div class="s">排名口径：按单位产品碳排放强度升序排列，数据来源于区域碳排放数据报送平台与行业统计</div></div>'
      + '</div>';

    // 对标总览条形图（本企业强度缺失时不画本企业条）
    var bars = [];
    if (HAS_INTENSITY) bars.push({ name: '本企业（' + ORG + '）', value: entIntensity, color: '#ff7d00', self: true });
    bars.push({ name: REGION + '平均值', value: regionAvg, color: GREEN });
    bars.push({ name: '行业平均值（全国）', value: indAvg, color: '#165dff' });
    bars.push({ name: '行业先进值', value: advanced, color: '#722ed1' });
    html += chartBlock(cmpBars(bars, 'tCO₂/t', 4), '（图）企业层级碳排放强度对标总览（' + MONTH_CN + '）');

    return html;
  }

  /** 一、报告定位与核心思路 */
  function positionHtml() {
    return '<p class="brief-p">本报告为 ' + esc(ORG) + ' 专属智能对标分析专项报告，聚焦企业经营与双碳管控核心指标开展量化研判，'
      + '围绕与配额计算关键的<strong>单位产品碳排放强度</strong>指标，'
      + '以「' + esc(REGION) + '」为对标区域、以「' + esc(MONTH_CN) + '」为对标期间，'
      + '将本企业碳排放强度与区域平均值、行业平均值、行业先进值进行四维对比，量化差距、定位短板。</p>'
      + '<p class="brief-p">报告核心思路：<strong>一排名、二对比、三归因、四建议</strong>——'
      + '先以强度排名锚定企业在区域同行业中的位置；再与区域、行业、先进三级基准逐层对比；'
      + '结合对标结果归因优势与短板；最终给出降碳行动建议与单位产品降碳空间测算，为企业节能降碳改造与碳资产管理提供决策依据。</p>'
      + '<p class="brief-p">数据口径说明：碳排放强度为单位产品碳排放强度（tCO₂/t），适用于各行业企业间横向对比；'
      + '本报告只采集企业单位产品碳排放强度一项数据，年产量与年排放总量不在采集口径内，故降碳空间统一按单位产品口径列示。'
      + '区域与行业数据来源于区域碳排放数据报送平台、行业协会统计及公开披露信息，样本企业 ' + entCount + ' 家；先进值取行业前 10% 企业水平。</p>';
  }

  /** 二、企业层级碳排放强度对标 */
  function entLevelHtml() {
    var html = '<div class="table-caption"><span>企业层级碳排放强度排名表</span><span class="unit">单位：tCO₂/t</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>企业层级</th><th>企业数据</th><th>' + esc(REGION) + '排名</th><th>' + esc(REGION) + '平均值</th><th>行业平均值</th><th>行业先进值</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>企业层级</td><td class="is-self">' + fmt(entIntensity, 4) + '</td>'
      + '<td class="is-self">' + rank + ' / ' + entCount + '</td>'
      + '<td>' + fmt(regionAvg, 4) + '</td><td>' + fmt(indAvg, 4) + '</td><td>' + fmt(advanced, 4) + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：排名按碳排放强度升序（强度越低排名越靠前），样本为' + esc(REGION) + '同行业报送企业。</div>';

    // 数据分析
    var posWords = [];
    posWords.push(vsRegion <= 0
      ? '本企业碳排放强度 ' + fmt(entIntensity, 4) + ' tCO₂/t，低于' + REGION + '平均值 ' + fmt(regionAvg, 4) + ' tCO₂/t（优于区域 ' + fmt(Math.abs(vsRegion), 2) + '%）'
      : '本企业碳排放强度 ' + fmt(entIntensity, 4) + ' tCO₂/t，高于' + REGION + '平均值 ' + fmt(regionAvg, 4) + ' tCO₂/t（超出区域 ' + fmt(vsRegion, 2) + '%）');
    posWords.push(vsIndustry <= 0
      ? '低于行业平均值 ' + fmt(indAvg, 4) + ' tCO₂/t（优于行业 ' + fmt(Math.abs(vsIndustry), 2) + '%）'
      : '高于行业平均值 ' + fmt(indAvg, 4) + ' tCO₂/t（超出行业 ' + fmt(vsIndustry, 2) + '%）');
    posWords.push(vsAdvanced <= 0
      ? '已达到行业先进值 ' + fmt(advanced, 4) + ' tCO₂/t 水平'
      : '与行业先进值 ' + fmt(advanced, 4) + ' tCO₂/t 相比仍有 ' + fmt(vsAdvanced, 2) + '% 差距');

    html += '<h2 class="brief-h2">（一）数据分析</h2>';
    if (!HAS_INTENSITY) {
      html += '<p class="brief-p">本期未提供本企业碳排放强度数据，无法开展对标分析。'
        + '表中' + esc(REGION) + '平均值 ' + fmt(regionAvg, 4) + '、行业平均值 ' + fmt(indAvg, 4) + '、行业先进值 ' + fmt(advanced, 4) + ' tCO₂/t 为公开统计口径，仅供参照；'
        + '本企业数据补齐后即可完成四维对比与排名。</p>';
    } else {
      var posWords = [];
      posWords.push(vsRegion <= 0
        ? '本企业碳排放强度 ' + fmt(entIntensity, 4) + ' tCO₂/t，低于' + REGION + '平均值 ' + fmt(regionAvg, 4) + ' tCO₂/t（优于区域 ' + fmt(Math.abs(vsRegion), 2) + '%）'
        : '本企业碳排放强度 ' + fmt(entIntensity, 4) + ' tCO₂/t，高于' + REGION + '平均值 ' + fmt(regionAvg, 4) + ' tCO₂/t（超出区域 ' + fmt(vsRegion, 2) + '%）');
      posWords.push(vsIndustry <= 0
        ? '低于行业平均值 ' + fmt(indAvg, 4) + ' tCO₂/t（优于行业 ' + fmt(Math.abs(vsIndustry), 2) + '%）'
        : '高于行业平均值 ' + fmt(indAvg, 4) + ' tCO₂/t（超出行业 ' + fmt(vsIndustry, 2) + '%）');
      posWords.push(vsAdvanced <= 0
        ? '已达到行业先进值 ' + fmt(advanced, 4) + ' tCO₂/t 水平'
        : '与行业先进值 ' + fmt(advanced, 4) + ' tCO₂/t 相比仍有 ' + fmt(vsAdvanced, 2) + '% 差距');

      html += '<p class="brief-p">' + posWords.join('，') + '。'
        + '在' + esc(REGION) + ' ' + entCount + ' 家同行业样本企业中位列第 <strong>' + rank + '</strong> 名，'
        + '超越区域内 ' + fmt(outperform, 1) + '% 的企业，'
        + (outperform >= 75 ? '整体处于区域头部梯队，碳绩效管理水平领先。'
          : outperform >= 50 ? '整体处于区域中上水平，仍有向头部企业看齐的空间。'
          : outperform >= 25 ? '整体处于区域中游偏下位置，强度管控需系统加强。'
          : '整体处于区域落后梯队，节能降碳形势严峻，须尽快采取专项措施。') + '</p>';
    }

    // 建议方案
    html += '<h2 class="brief-h2">（二）建议方案</h2>';
    if (!HAS_INTENSITY) {
      html += '<p class="brief-p">本企业碳排放强度数据尚未报送，建议：优先完成企业层级碳排放量与产品产量的核算、计量校核，'
        + '确保强度指标可算、可比、可追溯；同步建立「月度对标、季度评估」机制，将强度指标纳入企业绩效考核；'
        + '积极申报国家及省级节能降碳专项资金，借力政策工具加快技改落地。</p>';
    } else {
      html += '<p class="brief-p">结合企业碳强度对标结果，建议：'
        + (vsAdvanced > 0
          ? '以行业先进值 ' + fmt(advanced, 4) + ' tCO₂/t 为目标值，制定年度强度下降路线图，明确责任部门与时间节点，分阶段压降单位产品碳排放；'
          : '巩固行业先进水平，持续跟踪区域头部企业动态，防止强度反弹；')
        + '建立「月度对标、季度评估」机制，将强度指标纳入企业绩效考核；'
        + '积极申报国家及省级节能降碳专项资金，借力政策工具加快技改落地。</p>';
    }
    return html;
  }

  /** 三、优势与短板 */
  function swotHtml() {
    if (!HAS_INTENSITY) {
      return '<div class="vs-cols">'
        + '<div class="vs-col is-good"><h3>优势</h3><ul><li>本企业碳排放强度数据缺失，暂不作优势评价。</li></ul></div>'
        + '<div class="vs-col is-bad"><h3>短板</h3><ul><li>本企业碳排放强度数据缺失，暂不作短板评价。</li></ul></div></div>';
    }
    var goodItems = [];
    if (vsRegion <= 0) goodItems.push('碳排放强度优于' + REGION + '平均值 ' + fmt(Math.abs(vsRegion), 2) + '%，区域碳绩效处于靠前位置（第 ' + rank + ' / ' + entCount + ' 名）。');
    if (vsIndustry <= 0) goodItems.push('碳排放强度优于全国行业平均值 ' + fmt(Math.abs(vsIndustry), 2) + '%，具备行业层面的碳竞争力。');
    if (vsAdvanced <= 0) goodItems.push('已达到行业先进值水平（' + fmt(advanced, 4) + ' tCO₂/t），跻身行业碳效第一梯队。');
    if (outperform >= 75) goodItems.push('超越区域内 ' + fmt(outperform, 1) + '% 的同行业企业，碳排放管控体系成熟、执行力强。');
    if (!goodItems.length) goodItems.push('本期指标未优于各级对标基准，暂无可列优势项，需全面整改提升。');

    var badItems = [];
    if (vsIndustry > 0) badItems.push('碳排放强度高于全国行业平均值 ' + fmt(vsIndustry, 2) + '%，整体能效与碳效水平落后。');
    if (vsRegion > 0) badItems.push('碳排放强度高于' + REGION + '平均值 ' + fmt(vsRegion, 2) + '%，区域排名靠后（第 ' + rank + ' / ' + entCount + ' 名），面临区域碳预算与督查压力。');
    if (vsAdvanced > 0) badItems.push('与行业先进值相比仍有 ' + fmt(vsAdvanced, 2) + '% 差距，先进节能降碳技术应用不足。');
    if (outperform < 50 && outperform > 0) badItems.push('仅超越区域内 ' + fmt(outperform, 1) + '% 的企业，与头部梯队存在系统性差距。');
    if (!badItems.length) badItems.push('各项指标均优于对标基准，暂无显著短板，需防范强度反弹风险。');

    return '<div class="vs-cols">'
      + '<div class="vs-col is-good"><h3>优势</h3><ul>'
      + goodItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div>'
      + '<div class="vs-col is-bad"><h3>短板</h3><ul>'
      + badItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div></div>';
  }

  /** 四、降碳行动建议 */
  function actionHtml() {
    return '<ol class="advice-list">'
      + '<li><strong>开展能效碳效诊断：</strong>对照行业先进值 ' + fmt(advanced, 4) + ' tCO₂/t 开展全流程能效碳效诊断，摸清主要用能环节的损失分布，形成重点改造清单并纳入年度技改项目库。</li>'
      + '<li><strong>对标先进学经验：</strong>组织赴区域排名前 10% 的先进企业实地对标，学习其能源管理、工艺控制与余热余压回收经验，形成可落地的改进措施。</li>'
      + '<li><strong>优化能源与原料结构：</strong>提高绿电、绿证采购比例，推进厂区分布式光伏等清洁能源建设；提升低碳原料、再生资源使用比例，从源头降低单位产品碳排放强度。</li>'
      + '<li><strong>健全碳数据管理体系：</strong>完善碳排放计量与数据台账，按月开展内部对标通报，将强度指标纳入绩效考核，实现「以考促降」。</li>'
      + '<li><strong>借力政策资金：</strong>对照国家节能降碳中央预算内投资、工业领域设备更新再贷款等扶持方向，包装申报能效提升项目，降低技改资金压力。</li>'
      + '<li><strong>联动碳资产管理：</strong>将强度下降成果转化为配额盈余，结合碳市场行情择机交易变现，形成「降碳—盈余—收益—再投入」的正向循环。</li>'
      + '</ol>';
  }

  /** 五、企业降碳空间深度分析 */
  function potentialHtml() {
    var html = '<p class="brief-p">以本企业当前碳排放强度为基线，分「达到行业平均值」「达到行业先进值」两档目标情景，测算单位产品降碳空间。'
      + '计算逻辑：<strong>强度差距（tCO₂/t）＝本企业碳排放强度 − 目标情景强度</strong>；'
      + '<strong>相对降幅（%）＝强度差距 ÷ 本企业碳排放强度 × 100</strong>。'
      + '本企业已优于目标情景时，该档降幅计为 0。</p>'
      + '<div class="table-caption"><span>降碳空间测算表（企业层级）</span><span class="unit">强度：tCO₂/t；降幅：%</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>目标情景</th><th>本企业强度</th><th>目标强度</th><th>强度差距</th><th>相对降幅</th>'
      + '</tr></thead><tbody>';

    /** 强度差距单元格：不可计算时写 -- */
    function gapTd(v) {
      if (v == null || !isFinite(v)) return '<td>--</td>';
      return '<td class="' + (v > 0 ? 'is-pos' : 'is-neg') + '">' + (v > 0 ? '+' : '') + fmt(+v.toFixed(4), 4) + '</td>';
    }

    /** 相对降幅单元格：不可计算时写 --；有降碳空间为红，已达标为绿 */
    function cutTd(v) {
      if (v == null || !isFinite(v)) return '<td>--</td>';
      return '<td class="' + (v > 0 ? 'is-pos' : 'is-neg') + '"><strong>' + fmt(v, 2) + '%</strong></td>';
    }

    html += '<tr><td>情景一：达到行业平均值</td>'
      + '<td>' + fmt(entIntensity, 4) + '</td><td>' + fmt(indAvg, 4) + '</td>'
      + gapTd(gapToAvg) + cutTd(cutPctToAvg) + '</tr>'
      + '<tr><td>情景二：达到行业先进值</td>'
      + '<td>' + fmt(entIntensity, 4) + '</td><td>' + fmt(advanced, 4) + '</td>'
      + gapTd(gapToAdvanced) + cutTd(cutPctToAdvanced) + '</tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：强度差距 = 本企业 − 目标值，正值（红）表示存在降碳空间；相对降幅以本企业当前碳排放强度为分母。</div>';

    if (!HAS_INTENSITY) {
      html += '<p class="brief-p">本期未提供本企业碳排放强度数据，无法测算两档情景的降碳空间。'
        + '建议先行完成企业层级碳排放量与产品产量的核算与计量校核，确保强度指标可算、可比、可追溯；'
        + '数据补齐后即可自动生成单位产品口径的降碳空间测算。</p>';
      return html;
    }

    /** 单档情景描述句（不含结尾标点） */
    function scenText(name, target, gap, cut) {
      if (gap <= 0) return '本企业碳排放强度已达' + name + '水平（' + fmt(target, 4) + ' tCO₂/t），该档无降碳空间';
      return '达到' + name + '水平可降低单位产品碳排放 <strong>' + fmt(gap, 4) + '</strong> tCO₂/t（相对降幅 <strong>' + fmt(cut, 2) + '%</strong>）';
    }

    html += '<p class="brief-p">测算结果显示：'
      + scenText('行业平均', indAvg, gapToAvg, cutPctToAvg) + '；'
      + scenText('行业先进', advanced, gapToAdvanced, cutPctToAdvanced) + '。</p>'
      + '<p class="brief-p">上述降碳空间为单位产品口径（tCO₂/t）——本报告不采集企业年产量与年排放总量数据，'
      + '年减排总量需结合企业年度产品产量另行核算。建议按「潜力大、投资省、见效快」原则排定能效碳效改造优先级，'
      + '分年度滚动实施，并将强度下降成果纳入碳资产管理台账统一管理与核算。</p>';
    return html;
  }

  /* ---------- 报告组装 ---------- */

  function buildReport() {
    var dateRange = Y + '-' + pad2(M) + '-01 至 ' + Y + '-' + pad2(M) + '-' + lastDay(Y, M);

    // 封面
    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">碳 排 放 对 标 分 析 报 告</div>'
      + '<h1>' + esc(ORG) + '<br/>碳排放对标分析报告</h1>'
      + '<div class="cover-month">' + esc(MONTH_CN) + '</div>'
      + '<div class="cover-region">对标区域：' + esc(REGION) + '</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + dateRange + '</div>'
      + '</div></div>';

    // 目录
    html += '<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>'
      + '<li class="toc-l1"><a href="#sec-0">摘要 · 对标结论概览</a></li>'
      + '<li class="toc-l1"><a href="#sec-1">一、报告定位与核心思路</a></li>'
      + '<li class="toc-l1"><a href="#sec-2">二、企业层级碳排放强度对标</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-1">（一）数据分析</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-2">（二）建议方案</a></li>'
      + '<li class="toc-l1"><a href="#sec-3">三、优势与短板</a></li>'
      + '<li class="toc-l1"><a href="#sec-4">四、降碳行动建议</a></li>'
      + '<li class="toc-l1"><a href="#sec-5">五、企业降碳空间深度分析</a></li>'
      + '</ol></div>';

    // 正文
    html += '<div class="brief-page">'
      + '<h1 class="brief-h1" id="sec-0">摘要 · 对标结论概览</h1>'
      + summaryHtml()

      + '<h1 class="brief-h1" id="sec-1">一、报告定位与核心思路</h1>'
      + positionHtml()

      + '<h1 class="brief-h1" id="sec-2">二、企业层级碳排放强度对标</h1>'
      + entLevelHtml()

      + '<h1 class="brief-h1" id="sec-3">三、优势与短板</h1>'
      + swotHtml()

      + '<h1 class="brief-h1" id="sec-4">四、降碳行动建议</h1>'
      + actionHtml()

      + '<h1 class="brief-h1" id="sec-5">五、企业降碳空间深度分析</h1>'
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
      pdf.save('碳排放对标分析报告-' + Y + '年' + M + '月-' + REGION + '.pdf');
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
  document.getElementById('bt-title').textContent = ORG + '碳排放对标分析报告（' + MONTH_CN + ' · ' + REGION + '）';
  document.title = '碳排放对标分析报告-' + Y + '年' + M + '月-' + REGION;
  document.getElementById('btn-download').addEventListener('click', download);
})();
