/**
 * 路径适配器：计算当前页面相对"项目根"的深度前缀，挂到 window.__PRJ_PREFIX__
 *
 * 背景：项目需要同时支持两种部署形态
 *   1. 本地服务（http://localhost:8090/）           —— 项目根 = "/"
 *   2. GitHub Pages 子路径（https://xxx.github.io/my_rock_demo3/） —— 项目根 = "/my_rock_demo3/"
 *
 * 规则：
 *   - 根目录页面（index.html / flowchart.html / requirements.html）
 *       → window.__PRJ_PREFIX__ = ''
 *   - 一级子目录页面（carbon/index.html 等）
 *       → window.__PRJ_PREFIX__ = '../'
 *
 * 使用方式：
 *   1. 每个 HTML 的 <head> 内同步加载（不能 defer/async）：
 *        根目录页面   <script src="js/path-adapter.js"></script>
 *        子目录页面   <script src="../js/path-adapter.js"></script>
 *   2. 静态资源引用按"深度正确"的相对路径写：
 *        根目录页面   js/app.js / css/app.css
 *        子目录页面   ../js/app.js / ../css/app.css
 *   3. JS 里跨目录导航（菜单 href 等，统一写"相对项目根"的路径）：
 *        (window.__PRJ_PREFIX__ || '') + 'carbon/index.html'
 *   4. JS 里同目录跳转（如 carbon/js 内部 location.href = 'create.html'）
 *      保持同目录相对路径即可，浏览器按当前文档 URL 解析，无需前缀。
 */
(function () {
  var me = document.currentScript;
  var mySrc = (me && me.src) || '';
  // 反推项目根 URL：去掉 /js/path-adapter.js（含可能的 ?/# 后缀）
  var rootUrl = mySrc.replace(/js\/path-adapter\.js.*$/, '');
  var prefix = '';
  if (rootUrl) {
    var pageUrl = location.href.split('?')[0].split('#')[0];
    var relPage = pageUrl.indexOf(rootUrl) === 0 ? pageUrl.slice(rootUrl.length) : '';
    // 当前页面相对项目根的目录深度（如 carbon/index.html → 1）
    var depth = relPage ? relPage.split('/').length - 1 : 0;
    for (var i = 0; i < depth; i++) prefix += '../';
  }
  window.__PRJ_PREFIX__ = prefix;
})();
