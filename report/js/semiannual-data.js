/**
 * 碳排放半年度报告 · 共享数据模型（唯一数据源）
 *
 * 入参驱动。报告全部数值只来自入参 `emission` 数据块：
 *   emission.volume.cur / .prev        逐月排放量（万tCO₂），数组长度 = 该年已发生月份数
 *   emission.intensity.cur / .prev     逐月单位产品碳排放强度（tCO₂/t 等）
 *   emission.halfIntensity.h1 / .h2    报告期累计单位产品碳排放强度（{ cur, prev } 标量对）
 *
 * 数据可得性（本模型刻意不设的字段）：
 *   物料级明细（化石燃料各物料消耗量/低位发热量/单位热值含碳量、过程排放各物料、
 *   含碳产品隐含排放）与工序级排放量，在当前数据条件下无法获取 —— 入参不设对应字段，
 *   报告也没有对应章节。详见 docs/碳排放半年度报告-提示词.md 的「数据口径」抬头块。
 *
 * 数组长度契约：`cur` 的**长度就是「该年已发生到几月」的唯一依据**，
 * 半年报告按 `half` 切出 6 个月的切片，切片内长度不足的月份按「未发生」渲染为占位符。
 * 全零也要写满长度（给 0 就显示 0），**严禁用最后一个已发生值向后外推**。
 *
 * 全部数值由入参推出：无随机数、无种子 —— 同一入参必得完全一致的结果。
 */
(function () {
  'use strict';

  /* ================= 常量 ================= */

  var ORG_DEFAULT = '安阳钢铁股份有限公司';
  var CURRENT_YEAR = 2026;
  var CURRENT_MONTH = 9;          // 演示口径：当前时点 2026-09
  var YEARS = [2026, 2025, 2024, 2023, 2022];

  /* ================= 行业名词映射（只有名词，不含任何数据） ================= */

  /**
   * 行业推断：按优先级逐行扫描企业名称，第一个命中即确定；全部未命中按「钢铁」兜底。
   * 推断结果只影响界面里的**产品名词与单位**，不影响任何数值。
   */
  var INDUSTRY_NAMES = {
    steel:    { product: '粗钢',     prodNoun: '粗钢产量',     prodUnit: 't',   intUnit: 'tCO₂/t' },
    power:    { product: '上网电量', prodNoun: '上网电量',     prodUnit: 'MWh', intUnit: 'tCO₂/MWh' },
    building: { product: '水泥熟料', prodNoun: '水泥熟料产量', prodUnit: 't',   intUnit: 'tCO₂/t' },
    chemical: { product: '合成氨',   prodNoun: '合成氨产量',   prodUnit: 't',   intUnit: 'tCO₂/t' }
  };

  function inferIndustry(companyName) {
    var n = String(companyName || '');
    if (/钢/.test(n)) return 'steel';
    if (/发电|电力|电厂|热电|火电|水电/.test(n)) return 'power';
    if (/水泥|建材|混凝土|陶瓷|玻璃/.test(n)) return 'building';
    if (/化工|化学|化肥|氯碱|石化/.test(n)) return 'chemical';
    return 'steel';
  }

  /* ================= 默认演示入参 ================= */

  /**
   * 演示数据：安阳钢铁 2026 年逐月（1—9 月已发生，10—12 月未发生 → 数组只写 9 个）
   *           + 2025 年逐月（写满 12 个，同比按同月数截取比较）。
   * 单位：排放量 万tCO₂；强度 tCO₂/t。
   */
  var DEFAULT_INPUT = {
    companyName: ORG_DEFAULT,
    year: 2026,
    half: 1,
    emission: {
      volume: {
        /* 2026 年逐月排放量：1—9 月（10—12 月尚未发生，故不写） */
        cur: [120.68, 117.83, 123.84, 121.65, 125.62, 121.41, 124.09, 124.21, 122.37],
        /* 2025 年逐月排放量：全年 12 个月（同比只取与本期相同的月数） */
        prev: [123.92, 121.00, 127.16, 124.92, 128.99, 124.67, 127.43, 127.54, 125.65, 126.83, 124.82, 125.25]
      },
      intensity: {
        cur: [2.0860, 2.0955, 2.0598, 2.0521, 2.0412, 2.0395, 2.0380, 2.0312, 2.0266],
        prev: [2.1747, 2.1846, 2.1473, 2.1393, 2.1280, 2.1262, 2.1246, 2.1175, 2.1127, 2.1074, 2.1036, 2.0979]
      },
      /* 报告期累计单位产品碳排放强度：h1 = 上半年，h2 = 下半年
         （prev 取「与本期相同月数」的上年同期累计强度：下半年本期只有 7—9 月） */
      halfIntensity: {
        h1: { cur: 2.0618, prev: 2.1495 },
        h2: { cur: 2.0319, prev: 2.1183 }
      }
    }
  };

  /* ================= 工具函数 ================= */

  function pad2(n) { return String(n).padStart(2, '0'); }

  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }

  function r2(n) { return Math.round(n * 100) / 100; }
  function r4(n) { return Math.round(n * 10000) / 10000; }

  /** 千分位 + 固定小数位；null / NaN / Infinity 一律输出 -- */
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return '--';
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /** 带符号数值；-0 归一为 0 */
  function signed(n, d, unit) {
    if (n == null || !isFinite(n)) return '--';
    var v = (n === 0 ? 0 : n);
    var s = (v > 0 ? '+' : '') + fmt(v, d);
    return s + (unit ? ' ' + unit : '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * 数值数组归一：非数组 → 空数组（长度 0 = 全年未发生）；
   * 元素缺失或非有限数 → 按 0 处理（零兜底）。
   */
  function numArr(v) {
    if (!Array.isArray(v)) return [];
    return v.map(function (x) {
      var n = Number(x);
      return isFinite(n) ? n : 0;
    });
  }

  /** 强度 / 单位量：`≤ 0` 在业务上不成立，视为该期无效（显示 --）；值本身仍零兜底 */
  function validPos(v) {
    var n = Number(v);
    return (isFinite(n) && n > 0) ? r4(n) : null;
  }

  /* ================= 入参读取 ================= */

  /** URL query → 入参覆盖（?year=&half=&company= 以及可选的逐月 CSV 覆盖） */
  function readInput() {
    var input = {
      companyName: DEFAULT_INPUT.companyName,
      year: DEFAULT_INPUT.year,
      half: DEFAULT_INPUT.half,
      emission: {
        volume: { cur: DEFAULT_INPUT.emission.volume.cur.slice(), prev: DEFAULT_INPUT.emission.volume.prev.slice() },
        intensity: { cur: DEFAULT_INPUT.emission.intensity.cur.slice(), prev: DEFAULT_INPUT.emission.intensity.prev.slice() },
        halfIntensity: {
          h1: { cur: DEFAULT_INPUT.emission.halfIntensity.h1.cur, prev: DEFAULT_INPUT.emission.halfIntensity.h1.prev },
          h2: { cur: DEFAULT_INPUT.emission.halfIntensity.h2.cur, prev: DEFAULT_INPUT.emission.halfIntensity.h2.prev }
        }
      }
    };

    var search = (typeof location !== 'undefined' && location.search) ? location.search : '';
    if (!search) return input;

    var qs = new URLSearchParams(search);

    function csv(key) {
      if (!qs.has(key)) return null;
      var raw = qs.get(key);
      if (raw === '') return [];
      return raw.split(',').map(function (x) {
        var n = Number(x);
        return isFinite(n) ? n : 0;
      });
    }

    if (qs.has('company')) input.companyName = qs.get('company') || DEFAULT_INPUT.companyName;

    /* 逐月数组覆盖（仅实测用）：?evCur=120.68,117.83,… → emission.volume.cur 等 */
    var v = csv('evCur'); if (v) input.emission.volume.cur = v;
    var v2 = csv('evPrev'); if (v2) input.emission.volume.prev = v2;
    var i1 = csv('eiCur'); if (i1) input.emission.intensity.cur = i1;
    var i2 = csv('eiPrev'); if (i2) input.emission.intensity.prev = i2;

    /* 报告期累计强度覆盖：?hi1=2.0618,2.1495 → 上半年 cur/prev；?hi2=… → 下半年 */
    var h1 = csv('hi1');
    if (h1 && h1.length >= 2) { input.emission.halfIntensity.h1.cur = h1[0]; input.emission.halfIntensity.h1.prev = h1[1]; }
    var h2 = csv('hi2');
    if (h2 && h2.length >= 2) { input.emission.halfIntensity.h2.cur = h2[0]; input.emission.halfIntensity.h2.prev = h2[1]; }

    return input;
  }

  var INPUT = readInput();

  /* ================= 构建半年数据集 ================= */

  /**
   * 构建某个「年 + 半年」的完整报告数据
   * @param {number} year 报告年份
   * @param {1|2} half 1=上半年(1—6月)  2=下半年(7—12月)
   * @param {object} [input] 入参；缺省用页面入参
   */
  function buildHalf(year, half, input) {
    half = half === 2 ? 2 : 1;
    input = input || INPUT;

    var em = (input && input.emission) || {};
    var baseYear = (input && input.year) ? input.year : CURRENT_YEAR;

    /* 入参只覆盖两个年份：cur 数组 = 入参年，prev 数组 = 入参年的上一年。
       其余年份没有数据（availableCount = 0 → 报告进入「无有效数据」态，列表页卡片置灰）。 */
    var useCur = (year === baseYear) ? true : ((year === baseYear - 1) ? false : null);

    var vol = (useCur == null) ? []
      : numArr(useCur ? (em.volume && em.volume.cur) : (em.volume && em.volume.prev));
    var inten = (useCur == null) ? []
      : numArr(useCur ? (em.intensity && em.intensity.cur) : (em.intensity && em.intensity.prev));
    /* 上年同期：只有「入参年」这一期才存在可比的上一年 */
    var volPrev = (useCur === true) ? numArr(em.volume && em.volume.prev) : [];
    var intenPrev = (useCur === true) ? numArr(em.intensity && em.intensity.prev) : [];

    var org = (input && input.companyName) ? input.companyName : ORG_DEFAULT;
    var industry = inferIndustry(org);
    var NAMES = INDUSTRY_NAMES[industry] || INDUSTRY_NAMES.steel;

    var halfKey = half === 1 ? 'h1' : 'h2';
    var halfIn = (em.halfIntensity && em.halfIntensity[halfKey]) || {};
    var unitIntensity = (useCur == null) ? null : validPos(useCur ? halfIn.cur : halfIn.prev);
    var prevUnitIntensity = (useCur === true) ? validPos(halfIn.prev) : null;

    var startMonth = half === 1 ? 1 : 7;
    var endMonth = half === 1 ? 6 : 12;
    var offset = half === 1 ? 0 : 6;

    var months = [];
    var sumEm = 0, sumPrevEm = 0, count = 0, countPrev = 0;

    for (var i = 0; i < 6; i++) {
      var idx = offset + i;
      var no = startMonth + i;
      var has = idx < vol.length;                       // 长度即唯一依据
      var emv = has ? r2(vol[idx]) : null;
      var intv = has ? validPos(inten[idx]) : null;

      var hasPrev = idx < volPrev.length;
      var emPrev = hasPrev ? r2(volPrev[idx]) : null;
      var intPrevVal = hasPrev ? validPos(intenPrev[idx]) : null;

      months.push({
        no: no,
        label: no + '月',
        has: has,
        emission: emv,                 // 万tCO₂
        intensity: intv,               // tCO₂/t 等
        prevEmission: emPrev,
        prevIntensity: intPrevVal
      });

      if (has) { sumEm += (emv || 0); count++; }
      /* 同比只对齐「本期已发生」的月份，且上年同期同月也存在 */
      if (has && hasPrev) { sumPrevEm += (emPrev || 0); countPrev++; }
    }

    /* 一个月都没有（数组缺位）时累计量写 null（渲染为 --）；
       而「写了 12 个 0」是有效入参，累计量为 0.00 —— 这是零兜底的正确行为。 */
    var totalEmission = count ? r2(sumEm) : null;
    var prevTotalEmission = countPrev ? r2(sumPrevEm) : null;

    var complete = (count === 6);
    var availableCount = count;

    var yoyEmissionPct = (prevTotalEmission != null && totalEmission != null && prevTotalEmission !== 0)
      ? r2((totalEmission - prevTotalEmission) / prevTotalEmission * 100) : null;
    var yoyIntensityPct = (unitIntensity != null && prevUnitIntensity != null)
      ? r2((unitIntensity - prevUnitIntensity) / prevUnitIntensity * 100) : null;

    return {
      year: year,
      half: half,
      halfName: half === 1 ? '上半年' : '下半年',
      label: year + ' 年 · ' + (half === 1 ? '上半年' : '下半年'),
      shortLabel: year + (half === 1 ? 'H1' : 'H2'),
      start: year + '-' + pad2(startMonth) + '-01',
      end: year + '-' + pad2(endMonth) + '-' + lastDay(year, endMonth),
      rangeText: year + '-' + pad2(startMonth) + ' 至 ' + year + '-' + pad2(endMonth),

      org: org,
      industry: industry,
      product: NAMES.product,
      prodNoun: NAMES.prodNoun,
      prodUnit: NAMES.prodUnit,
      intUnit: NAMES.intUnit,

      months: months,
      complete: complete,
      availCount: availableCount,
      availableCount: availableCount,

      totalEmission: totalEmission,                     // 万tCO₂
      avgEmission: count ? r2(totalEmission / count) : null,
      unitIntensity: unitIntensity,                     // 报告期累计强度（入参）

      hasPrev: prevTotalEmission != null && prevTotalEmission !== 0,
      prevTotalEmission: prevTotalEmission,
      prevUnitIntensity: prevUnitIntensity,
      yoyEmissionPct: yoyEmissionPct,
      yoyIntensityPct: yoyIntensityPct
    };
  }

  /** 同一年的上、下半年 */
  function buildYear(year, input) {
    return { year: year, h1: buildHalf(year, 1, input), h2: buildHalf(year, 2, input) };
  }

  /** 卡片状态：已归档 / 数据积累中 */
  function halfStatus(d) {
    if (d.complete) return { key: 'done', text: '已归档', cls: 'is-done' };
    return { key: 'doing', text: '数据积累中', cls: 'is-doing' };
  }

  window.SA_DATA = {
    ORG_DEFAULT: ORG_DEFAULT,
    CURRENT_YEAR: CURRENT_YEAR,
    CURRENT_MONTH: CURRENT_MONTH,
    YEARS: YEARS,
    INDUSTRY_NAMES: INDUSTRY_NAMES,
    inferIndustry: inferIndustry,
    DEFAULT_INPUT: DEFAULT_INPUT,
    INPUT: INPUT
  };

  window.SA = {
    fmt: fmt,
    signed: signed,
    esc: esc,
    pad2: pad2,
    lastDay: lastDay,
    r2: r2,
    r4: r4,
    buildHalf: buildHalf,
    buildYear: buildYear,
    halfStatus: halfStatus
  };
})();
