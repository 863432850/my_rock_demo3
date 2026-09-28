/**
 * 报告/报表管理 · 碳对标分析（演示）
 * 两个页签：碳排放对标 / 碳资产对标
 * - 碳排放对标：选择 对标年 / 对标月 / 对标区域 → 开始对标 → 跳转碳排放报告页
 * - 碳资产对标：相同查询条件 → 开始对标 → 跳转碳资产报告页（内容不同）
 */

var BENCH_CURRENT_YEAR = 2026;
var BENCH_CURRENT_MONTH = 9; // 演示口径：当前日期 2026-09-26
var BENCH_ORG = '河南安钢周口钢铁有限责任公司'; // 本企业（对标主体），随跳转透传给报告页

/** 对标区域：全国 + 全国各省级行政区 */
var BENCH_REGIONS = [
  '全国',
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
  '辽宁省', '吉林省', '黑龙江省',
  '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省',
  '重庆市', '四川省', '贵州省', '云南省', '西藏自治区',
  '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
  '台湾省', '香港特别行政区', '澳门特别行政区'
];

/** 填充一组「对标年 / 对标月 / 对标区域」下拉（两个页签复用） */
function fillBenchmarkConds(yearSel, monthSel, regionSel) {
  for (var y = BENCH_CURRENT_YEAR; y >= BENCH_CURRENT_YEAR - 4; y--) {
    var opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = y + ' 年';
    yearSel.appendChild(opt);
  }
  yearSel.value = String(BENCH_CURRENT_YEAR);

  for (var m = 1; m <= 12; m++) {
    var mOpt = document.createElement('option');
    mOpt.value = String(m);
    mOpt.textContent = m + ' 月';
    monthSel.appendChild(mOpt);
  }
  monthSel.value = String(BENCH_CURRENT_MONTH);

  BENCH_REGIONS.forEach(function (r) {
    var rOpt = document.createElement('option');
    rOpt.value = r;
    rOpt.textContent = r;
    regionSel.appendChild(rOpt);
  });
  regionSel.value = '河南省';
}

/** 拼接对标跳转地址 */
function buildBenchmarkHref(reportPage, year, month, region) {
  return reportPage
    + '?type=' + (reportPage.indexOf('asset') >= 0 ? 'asset' : 'emission')
    + '&company=' + encodeURIComponent(BENCH_ORG)
    + '&year=' + encodeURIComponent(year)
    + '&month=' + encodeURIComponent(month)
    + '&region=' + encodeURIComponent(region);
}

function initBenchmarkPage() {
  initLayout('benchmark', { moduleId: 'report', pageTitle: '碳对标分析' });

  /* ---------- 页签切换 ---------- */
  var tabEmission = document.getElementById('tab-emission');
  var tabAsset = document.getElementById('tab-asset');
  var paneEmission = document.getElementById('pane-emission');
  var paneAsset = document.getElementById('pane-asset');

  function switchTab(which) {
    var isEmission = which === 'emission';
    tabEmission.classList.toggle('is-active', isEmission);
    tabAsset.classList.toggle('is-active', !isEmission);
    tabEmission.setAttribute('aria-selected', isEmission ? 'true' : 'false');
    tabAsset.setAttribute('aria-selected', isEmission ? 'false' : 'true');
    paneEmission.style.display = isEmission ? '' : 'none';
    paneAsset.style.display = isEmission ? 'none' : '';
  }

  tabEmission.addEventListener('click', function () { switchTab('emission'); });
  tabAsset.addEventListener('click', function () { switchTab('asset'); });

  /* ---------- 查询条件（两个页签同结构） ---------- */
  var yearSel = document.getElementById('cond-year');
  var monthSel = document.getElementById('cond-month');
  var regionSel = document.getElementById('cond-region');
  fillBenchmarkConds(yearSel, monthSel, regionSel);

  var yearSelA = document.getElementById('cond-year-asset');
  var monthSelA = document.getElementById('cond-month-asset');
  var regionSelA = document.getElementById('cond-region-asset');
  fillBenchmarkConds(yearSelA, monthSelA, regionSelA);

  /* ---------- 开始对标 ---------- */
  document.getElementById('btn-start').addEventListener('click', function () {
    var year = yearSel.value;
    var month = monthSel.value;
    var region = regionSel.value;
    if (!year || !month || !region) {
      toast('请先选择完整的对标条件');
      return;
    }
    location.href = buildBenchmarkHref('benchmark-report.html', year, month, region);
  });

  document.getElementById('btn-start-asset').addEventListener('click', function () {
    var year = yearSelA.value;
    var month = monthSelA.value;
    var region = regionSelA.value;
    if (!year || !month || !region) {
      toast('请先选择完整的对标条件');
      return;
    }
    location.href = buildBenchmarkHref('asset-report.html', year, month, region);
  });
}

if (document.querySelector('.benchmark-page')) initBenchmarkPage();
