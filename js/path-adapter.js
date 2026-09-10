/**
 * 路径适配器：在 <head> 内同步加载，自动为页面注入 <base> 标签
 *
 * 解决：把项目挂到 GitHub Pages 子路径（如 https://xxx.github.io/my_rock_demo3/）时，
 * 内部链接用了根绝对路径（如 href="/carbon/index.html"）会被解析为
 * https://xxx.github.io/carbon/index.html（少了项目名），导致 404。
 *
 * 本适配器通过 document.currentScript.src 反推 path-adapter.js 所在的目录，
 * 作为 <base href>，从而让所有"相对项目根"的内部链接自动适配：
 *   <script src="js/app.js">      → 始终指向项目根下的 js/app.js
 *   <link href="css/app.css">     → 始终指向项目根下的 css/app.css
 *   <a href="carbon/index.html">  → 始终指向项目根下的 carbon/index.html
 *
 * 适配示例：
 *   本地服务 http://localhost:8090/index.html
 *     → currentScript.src = http://localhost:8090/js/path-adapter.js
 *     → base = http://localhost:8090/
 *   GitHub Pages https://xxx.github.io/my_rock_demo3/carbon/index.html
 *     → currentScript.src = https://xxx.github.io/my_rock_demo3/js/path-adapter.js
 *     → base = https://xxx.github.io/my_rock_demo3/
 *
 * 使用方法（必须同步加载在 head 最早位置，不能 defer/async）：
 *   <!-- 根目录页面 -->
 *   <script src="js/path-adapter.js"></script>
 *   <!-- 一级子目录页面 -->
 *   <script src="../js/path-adapter.js"></script>
 */
(function () {
  var me = document.currentScript;
  var mySrc = (me && me.src) || '';
  // 反推：去掉 /js/path-adapter.js（含可能的 ?xxx / #xxx），剩余即为项目根
  var baseUrl = mySrc.replace(/js\/path-adapter\.js.*$/, '');
  if (!baseUrl) return;
  var base = document.createElement('base');
  base.href = baseUrl;
  var head = document.head || document.getElementsByTagName('head')[0];
  if (head.firstChild) {
    head.insertBefore(base, head.firstChild);
  } else {
    head.appendChild(base);
  }
})();
