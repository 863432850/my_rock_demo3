/**
 * 碳排放半年度报告 · 共享数据模型（唯一数据源）
 *
 * 基准数据来源：《安阳钢铁股份有限公司钢铁-炼钢-粗钢2026年6月月度存证.xlsx》
 *   - Sheet「企业层级生产数据及排放量表」→ BASE_MONTH.fuel / process / product
 *   - Sheet「排放量汇总表」              → BASE_MONTH.summary
 *   - Sheet「工序-生产线生产数据及排放量表」→ BASE_MONTH.processLine
 * 该存证为「报告期末月（2026 年 6 月）」的实测数据，本文件以它为锚点，
 * 按固定的逐月产量/强度序列还原 2026 年上、下半年，并按下调系数还原往年。
 *
 * 全部数值由写死序列与公式推出：无随机数、无种子 —— 同一入参必得完全一致的结果。
 *
 * 关键勾稽式（已用存证值验算通过）：
 *   企业层级排放总量
 *     = 化石燃料燃烧排放 + 过程排放 − 含碳产品隐含的排放
 *     = 1,229,176.10 + 32,394.60 − 47,513.21 = 1,214,057.49 tCO₂
 *   排放量 = 消耗量 × 低位发热量 × 单位热值含碳量 × 44/12          （化石燃料燃烧）
 *   排放量 = 消耗量（产量）× 排放因子                              （过程排放 / 含碳产品）
 *   单位粗钢碳排放量 = 企业层级排放总量 ÷ 粗钢产量
 *                    = 1,214,057.49 ÷ 595,279.00 = 2.0395 tCO₂/t
 */
(function () {
  'use strict';

  /* ================= 常量 ================= */

  var ORG_DEFAULT = '安阳钢铁股份有限公司';
  var CURRENT_YEAR = 2026;
  var CURRENT_MONTH = 9;          // 演示口径：当前日期 2026-09-26
  var YEARS = [2026, 2025, 2024, 2023, 2022];

  /** 42/12（CO₂ 与 C 的分子量之比），用于化石燃料燃烧排放量核算 */
  var C_TO_CO2 = 44 / 12;

  /* ================= 基准月：2026 年 6 月（存证实测值） ================= */

  /**
   * 化石燃料燃烧排放明细
   * [物料, 消耗量, 消耗量单位, 低位发热量, 发热量单位, 单位热值含碳量, 含碳量单位, 排放量(tCO₂)]
   */
  var BASE_FUEL = [
    ['无烟煤',    2317.68,  't',        25.024,  'GJ/t',        0.02749, 'tC/GJ',  5845.97],
    ['烟煤',      120188.43, 't',       23.736,  'GJ/t',        0.02618, 'tC/GJ',  273849.07],
    ['洗精煤',    300810.90, 't',       26.344,  'GJ/t',        0.02541, 'tC/GJ',  738331.47],
    ['焦炭',      66522.44,  't',       28.435,  'GJ/t',        0.02942, 'tC/GJ',  204049.48],
    ['焦炉煤气',  920.50,    '10⁴Nm³',  173.854, 'GJ/10⁴Nm³',   0.0121,  'tC/GJ',  7100.11]
  ];

  /** 过程排放明细  [物料, 消耗量(t), 排放因子(tCO₂/t), 排放量(tCO₂)] */
  var BASE_PROCESS = [
    ['高碳铬铁',      312.00,   0.348, 108.58],
    ['微碳锰铁',      1256.54,  0.004, 5.03],
    ['电炉高碳锰铁',  1301.32,  0.275, 357.86],
    ['锰硅合金',      6181.94,  0.092, 568.74],
    ['硅铁',          1798.22,  0.007, 12.59],
    ['钼铁合金',      20.54,    0.018, 0.37],
    ['镍铁',          0.00,     0.037, 0.00],
    ['废钢',          55461.56, 0.037, 2052.08],
    ['生铁',          9867.76,  0.172, 1697.25],
    ['电极',          371.22,   3.663, 1359.78],
    ['白云石',        53361.58, 0.476, 25400.11],
    ['石灰石',        1891.38,  0.440, 832.21]
  ];

  /** 含碳产品隐含的排放（核算中的扣减项）  [产品, 产量(t), 排放因子(tCO₂/t), 扣减量(tCO₂)] */
  var BASE_PRODUCT = [
    ['粗钢',    595279.00, 0.037, 22025.32],
    ['粗苯',    1878.22,   3.382, 6352.14],
    ['煤焦油',  7089.94,   2.699, 19135.75]
  ];

  /** 排放量汇总表（报告期末月，四项互为勾稽）  [参数名称, 数值(tCO₂)] */
  var BASE_SUMMARY = [
    ['企业层级排放总量', 1214057.49],
    ['工序层级排放总量', 390764.54],
    ['掺烧自产二次能源的化石燃料发电设施排放总量', 314203.08],
    ['其他排放总量', 509089.87]
  ];

  /**
   * 工序层级燃料燃烧排放量（含本工序产出并转出至下游工序的二次能源）
   * 口径说明：工序口径不经二次能源转出互抵，与汇总表「工序层级排放总量」的净额口径不同，
   * 仅用于工序之间的横向结构对比。
   * [工序, 各物料排放量数组, 工序合计(tCO₂)]
   */
  var BASE_PROCESS_LINE = [
    ['焦化工序', [['洗精煤', 575054.11], ['焦炭', 469412.30], ['高炉煤气', 120522.54], ['焦炉煤气', 55683.25]], 1220672.20],
    ['烧结工序', [['无烟煤', 49639.49], ['焦炭', 41167.53], ['焦炉煤气', 2360.35]], 93167.37],
    ['炼铁工序', [['高炉煤气', 796719.68], ['焦炭', 625413.88], ['烟煤', 229008.30], ['焦粉', 10556.69], ['无烟煤', 3939.43], ['焦炉煤气', 706.69]], 1666344.67],
    ['转炉炼钢工序', [['转炉煤气', 121677.72], ['焦炉煤气', 785.99], ['高炉煤气', 322.63]], 122786.34],
    ['掺烧自产二次能源的化石燃料发电设施', [['高炉煤气', 196949.27], ['转炉煤气', 106269.31], ['焦炉煤气', 10984.50]], 314203.08]
  ];

  /* ================= 逐月序列（2026 年） ================= */

  /**
   * 2026 年逐月粗钢产量（t）
   * 6 月为存证实测值 595,279.00；其余月份为按月度生产节奏设计的演示值。
   */
  var PROD_H1_2026 = [578500, 562300, 601200, 592800, 615400, 595279];
  var PROD_H2_2026 = [608900, 611500, 603800, 611000, 602400, 606100];

  /**
   * 2026 年逐月单位粗钢碳排放量（tCO₂/t），全年呈持续下降（能效改善）趋势。
   * 6 月为存证展示值 2.0395（存证计算值为 1,214,057.49 ÷ 595,279.00 = 2.039468…）。
   */
  var INT_H1_2026 = [2.0860, 2.0955, 2.0598, 2.0521, 2.0412, 2.0395];
  var INT_H2_2026 = [2.0380, 2.0312, 2.0266, 2.0215, 2.0178, 2.0124];

  /**
   * 2026 年上半年逐月排放量（tCO₂）= 产量 × 强度（四舍五入 2 位）。
   * 6 月直接采用存证值 1,214,057.49（存证强度为 2.039468…，展示取 2.0395，
   * 故 595,279 × 2.0395 与存证值相差 14.01 tCO₂，报告按存证值取数并在参数表注明）。
   */
  var EM_H1_2026 = [1206751.00, 1178299.65, 1238351.76, 1216484.88, 1256154.48, 1214057.49];

  /* ================= 往年折算系数 ================= */

  /**
   * 往年相对 2026 年的强度倍数（越早年份单位粗钢碳排放量越高，体现逐年改善）
   * 2025 / 2026 之比 1.0425 与平台「碳月报」的强度和同比口径保持一致。
   */
  var YEAR_INT_FACTOR = { 2026: 1, 2025: 1.0425, 2024: 1.0866, 2023: 1.1315, 2022: 1.1770 };

  /** 往年相对 2026 年的产量倍数（产能小幅释放） */
  var YEAR_PROD_FACTOR = { 2026: 1, 2025: 0.9850, 2024: 0.9760, 2023: 0.9640, 2022: 0.9520 };

  /* ================= 工具函数 ================= */

  function pad2(n) { return String(n).padStart(2, '0'); }

  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }

  /** 千分位 + 固定小数位 */
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /** 带符号数值 */
  function signed(n, d, unit) {
    var s = (n > 0 ? '+' : '') + fmt(n, d);
    return s + (unit ? ' ' + unit : '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 1~6 月 / 7~12 月的月份下标（0 基） */
  function monthIndexOf(half, i) { return half === 1 ? i : i + 6; }

  /* ================= 汇总计算 ================= */

  /** 报告期末月（基准月）汇总 */
  function baseTotals() {
    var fuelSum = 0, processSum = 0, productSum = 0;
    BASE_FUEL.forEach(function (r) { fuelSum += r[7]; });
    BASE_PROCESS.forEach(function (r) { processSum += r[3]; });
    BASE_PRODUCT.forEach(function (r) { productSum += r[3]; });
    return {
      fuelSum: +fuelSum.toFixed(2),
      processSum: +processSum.toFixed(2),
      productSum: +productSum.toFixed(2),
      total: +(fuelSum + processSum - productSum).toFixed(2),
      summary: BASE_SUMMARY,
      processLineTotal: +BASE_PROCESS_LINE.reduce(function (a, r) { return a + r[2]; }, 0).toFixed(2)
    };
  }

  /**
   * 构建某个「年 + 半年」的完整数据集
   * @param {number} year 年份
   * @param {1|2} half 1=上半年(1~6月)  2=下半年(7~12月)
   */
  function buildHalf(year, half) {
    half = half === 2 ? 2 : 1;
    var baseProd = half === 1 ? PROD_H1_2026 : PROD_H2_2026;
    var baseInt = half === 1 ? INT_H1_2026 : INT_H2_2026;
    var baseEm = half === 1 ? EM_H1_2026 : null;

    var isBaseYear = (year === CURRENT_YEAR);
    var prodK = YEAR_PROD_FACTOR[year] != null ? YEAR_PROD_FACTOR[year] : 1;
    var intK = YEAR_INT_FACTOR[year] != null ? YEAR_INT_FACTOR[year] : 1;

    // 2026 年下半年只有 7~9 月已发生（当前 2026-09）
    var availCount = 6;
    if (isBaseYear && half === 2) {
      availCount = Math.max(0, Math.min(6, CURRENT_MONTH - 6)); // 9 - 6 = 3
    }

    var months = [];
    var sumEm = 0, sumProd = 0, availEm = 0, availProd = 0;

    for (var i = 0; i < 6; i++) {
      var m = monthIndexOf(half, i) + 0; // 1..12 中该半年的第 i 个月
      var monthNo = half === 1 ? i + 1 : i + 7;
      var prod = isBaseYear ? baseProd[i] : Math.round(baseProd[i] * prodK);
      var inten = isBaseYear ? baseInt[i] : +((baseInt[i] * intK).toFixed(4));
      var em = (isBaseYear && baseEm) ? baseEm[i] : +(prod * inten).toFixed(2);
      var has = i < availCount;

      months.push({
        no: monthNo,
        label: monthNo + '月',
        prod: prod,
        intensity: inten,
        emission: em,
        has: has
      });

      sumEm += em; sumProd += prod;
      if (has) { availEm += em; availProd += prod; }
    }

    sumEm = +sumEm.toFixed(2);
    sumProd = +sumProd.toFixed(2);
    availEm = +availEm.toFixed(2);
    availProd = +availProd.toFixed(2);

    var complete = availCount === 6;
    var useEm = complete ? sumEm : availEm;
    var useProd = complete ? sumProd : availProd;
    var useCount = complete ? 6 : availCount;

    var startMonth = half === 1 ? 1 : 7;
    var endMonth = half === 1 ? 6 : 12;

    var res = {
      year: year,
      half: half,
      halfName: half === 1 ? '上半年' : '下半年',
      label: year + ' 年 · ' + (half === 1 ? '上半年' : '下半年'),
      shortLabel: year + (half === 1 ? 'H1' : 'H2'),
      start: year + '-' + pad2(startMonth) + '-01',
      end: year + '-' + pad2(endMonth) + '-' + lastDay(year, endMonth),
      months: months,
      complete: complete,
      availCount: availCount,
      availableCount: useCount,
      totalEmission: useEm,                       // 半年累计排放量（tCO₂）
      avgEmission: +(useEm / useCount).toFixed(2), // 月均排放量（tCO₂）
      totalProd: useProd,                          // 半年累计粗钢产量（t）
      avgProd: +(useProd / useCount).toFixed(2),
      unitIntensity: +(useEm / useProd).toFixed(4),// 半年单位粗钢碳排放量（tCO₂/t）
      fullTotalEmission: sumEm,
      fullTotalProd: sumProd
    };

    // 上年同期（同一半年）。若本半年尚未完整，同比只取上年「相同月数」的部分，
    // 否则会出现「3 个月 vs 6 个月」的失真对比。
    var prev = null;
    if (YEAR_INT_FACTOR[year - 1] != null) {
      prev = buildHalf(year - 1, half);
    }
    res.hasPrev = !!prev;

    if (prev) {
      var pEm = prev.totalEmission, pProd = prev.totalProd;
      if (!complete) {
        pEm = 0; pProd = 0;
        for (var k = 0; k < availCount; k++) { pEm += prev.months[k].emission; pProd += prev.months[k].prod; }
        pEm = +pEm.toFixed(2); pProd = +pProd.toFixed(2);
      }
      var pInt = +(pEm / pProd).toFixed(4);
      res.prevYear = prev;
      res.prevComparedEmission = pEm;
      res.prevComparedProd = pProd;
      res.prevComparedIntensity = pInt;
      res.yoyEmissionPct = +((res.totalEmission - pEm) / pEm * 100).toFixed(2);
      res.yoyIntensityPct = +((res.unitIntensity - pInt) / pInt * 100).toFixed(2);
      res.yoyProdPct = +((res.totalProd - pProd) / pProd * 100).toFixed(2);
    } else {
      res.prevComparedEmission = null;
      res.prevComparedProd = null;
      res.prevComparedIntensity = null;
      res.yoyEmissionPct = null;
      res.yoyIntensityPct = null;
      res.yoyProdPct = null;
    }

    return res;
  }

  /** 同一年的上、下半年（用于「上半年 vs 下半年」对比） */
  function buildYear(year) {
    var h1 = buildHalf(year, 1);
    var h2 = buildHalf(year, 2);
    return { year: year, h1: h1, h2: h2 };
  }

  /** 卡片状态：已归档 / 编制中（数据积累中） */
  function halfStatus(d) {
    if (d.complete) return { key: 'done', text: '已归档', cls: 'is-done' };
    return { key: 'doing', text: '数据积累中', cls: 'is-doing' };
  }

  window.SA_DATA = {
    ORG_DEFAULT: ORG_DEFAULT,
    CURRENT_YEAR: CURRENT_YEAR,
    CURRENT_MONTH: CURRENT_MONTH,
    YEARS: YEARS,
    C_TO_CO2: C_TO_CO2,
    BASE_FUEL: BASE_FUEL,
    BASE_PROCESS: BASE_PROCESS,
    BASE_PRODUCT: BASE_PRODUCT,
    BASE_SUMMARY: BASE_SUMMARY,
    BASE_PROCESS_LINE: BASE_PROCESS_LINE,
    PROD_H1_2026: PROD_H1_2026,
    PROD_H2_2026: PROD_H2_2026,
    INT_H1_2026: INT_H1_2026,
    INT_H2_2026: INT_H2_2026,
    EM_H1_2026: EM_H1_2026,
    YEAR_INT_FACTOR: YEAR_INT_FACTOR,
    YEAR_PROD_FACTOR: YEAR_PROD_FACTOR,
    /* 存证来源月份，仅作数据来源标注（数据字典）。
       报告界面已不再呈现任何「锚点月 / 期末月」概念，故本字段不参与渲染。 */
    BASE_MONTH: { year: 2026, month: 6, label: '2026年6月' }
  };

  window.SA = {
    fmt: fmt,
    signed: signed,
    esc: esc,
    pad2: pad2,
    lastDay: lastDay,
    baseTotals: baseTotals,
    buildHalf: buildHalf,
    buildYear: buildYear,
    halfStatus: halfStatus
  };
})();
