var docsServerReady = false;
var reqDocModuleId = 'verify';
var reqKeys = docsStorageKeys('verify');

function peekLocalRequirements() {
  try {
    var raw = localStorage.getItem(reqKeys.requirements);
    if (!raw) return null;
    var stored = JSON.parse(raw);
    if (stored && stored.html) return stored;
  } catch (e) { /* ignore */ }
  return null;
}

function escapeHtmlAttr(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeReqAttachments(list) {
  return Array.isArray(list) ? list.slice() : [];
}

/** 优先读取代码包内置数据（GitHub 可见） */
function loadRequirements() {
  if (typeof DEFAULT_REQUIREMENTS !== 'undefined' && DEFAULT_REQUIREMENTS) {
    return {
      html: DEFAULT_REQUIREMENTS.html || '',
      savedAt: DEFAULT_REQUIREMENTS.savedAt || '',
      lineHeight: DEFAULT_REQUIREMENTS.lineHeight || '',
      attachments: normalizeReqAttachments(DEFAULT_REQUIREMENTS.attachments),
    };
  }
  return { html: '', savedAt: '', lineHeight: '', attachments: [] };
}

function formatFileSize(bytes) {
  var n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function guessAttachFileType(file) {
  if (file && file.type) return file.type;
  var name = String((file && file.name) || '').toLowerCase();
  if (/\.md$/.test(name)) return 'text/markdown';
  if (/\.txt$/.test(name)) return 'text/plain';
  if (/\.pdf$/.test(name)) return 'application/pdf';
  if (/\.docx$/.test(name)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.xlsx$/.test(name)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (/\.doc$/.test(name)) return 'application/msword';
  if (/\.xls$/.test(name)) return 'application/vnd.ms-excel';
  if (/\.zip$/.test(name)) return 'application/zip';
  if (/\.png$/.test(name)) return 'image/png';
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  return 'application/octet-stream';
}

function readFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(new Error('读取文件失败')); };
    reader.readAsDataURL(file);
  });
}

function clearLocalRequirementsCache() {
  try {
    localStorage.removeItem(reqKeys.requirements);
  } catch (e) { /* ignore */ }
}

function isRangeInEditor(range, editor) {
  if (!range || !editor) return false;
  var node = range.commonAncestorContainer;
  return node === editor || editor.contains(node);
}

function cloneLiveRange(sel) {
  if (!sel || !sel.rangeCount) return null;
  return sel.getRangeAt(0).cloneRange();
}

function restoreEditorRange(editor, range) {
  if (!range || !isRangeInEditor(range, editor)) return false;
  editor.focus();
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

function textNodesInRange(range) {
  var root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) return [root];
  var nodes = [];
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  var current;
  while ((current = walker.nextNode())) nodes.push(current);
  return nodes;
}

function wrapTextNodeRange(node, from, to, styles) {
  if (from < 0) from = 0;
  if (to > node.nodeValue.length) to = node.nodeValue.length;
  if (from >= to) return null;
  if (from > 0) node = node.splitText(from);
  if (to - from < node.nodeValue.length) node.splitText(to - from);

  var parent = node.parentNode;
  if (
    parent
    && parent.nodeName === 'SPAN'
    && parent.childNodes.length === 1
  ) {
    Object.keys(styles).forEach(function (key) {
      parent.style[key] = styles[key];
    });
    return parent;
  }

  var span = document.createElement('span');
  Object.keys(styles).forEach(function (key) {
    span.style[key] = styles[key];
  });
  parent.replaceChild(span, node);
  span.appendChild(node);
  return span;
}

function wrapSelectionWithStyle(editor, styles, savedRange) {
  var range = savedRange;
  if (!range || range.collapsed || !isRangeInEditor(range, editor)) {
    var live = cloneLiveRange(window.getSelection());
    if (live && !live.collapsed && isRangeInEditor(live, editor)) range = live;
  }
  if (!range || range.collapsed || !isRangeInEditor(range, editor)) return false;

  restoreEditorRange(editor, range);

  var startNode = range.startContainer;
  var startOff = range.startOffset;
  var endNode = range.endContainer;
  var endOff = range.endOffset;
  var nodes = textNodesInRange(range);
  if (!nodes.length) return false;

  var wrapped = [];
  for (var i = nodes.length - 1; i >= 0; i--) {
    var node = nodes[i];
    var from = (node === startNode && node.nodeType === Node.TEXT_NODE) ? startOff : 0;
    var to = (node === endNode && node.nodeType === Node.TEXT_NODE) ? endOff : node.nodeValue.length;
    var el = wrapTextNodeRange(node, from, to, styles);
    if (el) wrapped.push(el);
  }
  if (!wrapped.length) return false;

  var sel = window.getSelection();
  var next = document.createRange();
  next.setStartBefore(wrapped[wrapped.length - 1]);
  next.setEndAfter(wrapped[0]);
  sel.removeAllRanges();
  sel.addRange(next);
  return true;
}

function applyRteColor(editor, type, color) {
  document.execCommand('styleWithCSS', false, true);
  if (type === 'fore') {
    document.execCommand('foreColor', false, color);
    return;
  }
  if (!document.execCommand('hiliteColor', false, color)) {
    document.execCommand('backColor', false, color);
  }
}

var RTE_BLOCK_TAGS = {
  P: 1, DIV: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, BLOCKQUOTE: 1,
};

function closestRteBlock(node, editor) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE && RTE_BLOCK_TAGS[node.nodeName]) return node;
    node = node.parentNode;
  }
  return null;
}

function collectBlocksInRange(range, editor) {
  var blocks = [];
  function add(node) {
    var block = closestRteBlock(node, editor);
    if (block && blocks.indexOf(block) === -1) blocks.push(block);
  }
  if (!range) return blocks;
  if (range.collapsed) {
    add(range.startContainer);
    return blocks;
  }
  textNodesInRange(range).forEach(add);
  add(range.startContainer);
  add(range.endContainer);
  return blocks;
}

function applyLineHeightToBlocks(blocks, value) {
  blocks.forEach(function (el) {
    el.style.lineHeight = value;
  });
}

function applyLineHeightToEditor(editor, value) {
  editor.style.lineHeight = value;
  Array.prototype.forEach.call(editor.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,blockquote'), function (el) {
    if (!editor.contains(el)) return;
    el.style.lineHeight = value;
  });
}

function resolveLineHeightRange(editor, savedRange) {
  var range = savedRange;
  if (!range || !isRangeInEditor(range, editor)) {
    var live = cloneLiveRange(window.getSelection());
    if (live && isRangeInEditor(live, editor)) range = live;
  }
  return range && isRangeInEditor(range, editor) ? range : null;
}

function updateServerBadge() {
  var badge = document.getElementById('docs-server-badge');
  if (!badge) return;
  if (docsServerReady) {
    badge.textContent = '写入服务已连接';
    badge.className = 'docs-server-badge ok';
  } else {
    badge.textContent = '未连接写入服务（请 npm start）';
    badge.className = 'docs-server-badge warn';
  }
}

function initRequirementsPage() {
  reqDocModuleId = getDocModuleId();
  reqKeys = docsStorageKeys(reqDocModuleId);
  initLayout('requirements', { moduleId: reqDocModuleId, pageTitle: '需求说明/注意事项' });

  var editor = document.getElementById('rte-editor');
  var toolbar = document.getElementById('rte-toolbar');
  var hintEl = document.getElementById('req-save-hint');
  var attachListEl = document.getElementById('req-attach-list');
  var attachUpload = document.getElementById('req-attach-upload');
  var saved = loadRequirements();
  var savedRange = null;
  var reqAttachments = normalizeReqAttachments(saved.attachments);
  var MAX_REQ_ATTACH_BYTES = 12 * 1024 * 1024;

  editor.innerHTML = saved.html || '';
  if (saved.lineHeight) {
    editor.style.lineHeight = saved.lineHeight;
    var lineSelectInit = document.getElementById('rte-line-height');
    if (lineSelectInit.querySelector('option[value="' + saved.lineHeight + '"]')) {
      lineSelectInit.value = saved.lineHeight;
    }
  }
  if (saved.savedAt) {
    hintEl.textContent = '代码包数据 · ' + saved.savedAt;
  } else {
    hintEl.textContent = '尚未保存到代码包';
  }

  function renderAttachments() {
    if (!attachListEl) return;
    if (!reqAttachments.length) {
      attachListEl.innerHTML = '';
      return;
    }
    attachListEl.innerHTML = reqAttachments.map(function (item) {
      var href = '/' + String(item.filePath || '').replace(/^\/+/, '');
      var sizeText = item.sizeText || formatFileSize(item.size);
      return '<div class="requirements-attach-item" data-id="' + escapeHtmlAttr(item.id) + '">'
        + '<div class="requirements-attach-name" title="' + escapeHtmlAttr(item.fileName) + '">'
        + escapeHtmlAttr(item.fileName) + '</div>'
        + '<div class="requirements-attach-meta">' + escapeHtmlAttr(sizeText) + '</div>'
        + '<div class="requirements-attach-actions">'
        + '<a href="' + escapeHtmlAttr(href) + '" download="' + escapeHtmlAttr(item.fileName) + '">下载</a>'
        + '<button type="button" class="btn-attach-del" data-id="' + escapeHtmlAttr(item.id) + '">删除</button>'
        + '</div></div>';
    }).join('');
  }

  renderAttachments();

  var localDraft = peekLocalRequirements();
  if (localDraft && localDraft.html && localDraft.html !== (saved.html || '')) {
    if (confirm('检测到浏览器中有未同步的需求说明。\n\n是否加载到编辑器？加载后请再点击「保存到代码包」写入仓库文件。')) {
      editor.innerHTML = localDraft.html || '';
      if (localDraft.lineHeight) {
        editor.style.lineHeight = localDraft.lineHeight;
        var lineSelectLocal = document.getElementById('rte-line-height');
        if (lineSelectLocal.querySelector('option[value="' + localDraft.lineHeight + '"]')) {
          lineSelectLocal.value = localDraft.lineHeight;
        }
      }
      hintEl.textContent = '已载入浏览器暂存，请保存到代码包';
    }
  }

  checkDocsServer(reqDocModuleId).then(function (ok) {
    docsServerReady = ok;
    updateServerBadge();
    if (!ok) {
      hintEl.textContent = (hintEl.textContent ? hintEl.textContent + ' · ' : '') + '请先 npm start';
    }
  });

  function uploadOneAttachment(file) {
    if (!file) return Promise.resolve();
    if (file.size > MAX_REQ_ATTACH_BYTES) {
      toast('「' + file.name + '」超过 12MB，已跳过');
      return Promise.resolve();
    }
    return readFileAsDataUrl(file).then(function (dataUrl) {
      return docsApi(docsApiPath(reqDocModuleId, 'requirements/attachments'), {
        method: 'POST',
        body: {
          dataUrl: dataUrl,
          fileName: file.name,
          fileType: guessAttachFileType(file),
          size: file.size,
          savedAt: nowText(),
        },
      });
    }).then(function (res) {
      reqAttachments = normalizeReqAttachments(res.attachments);
      renderAttachments();
    });
  }

  if (attachUpload) {
    attachUpload.addEventListener('change', function () {
      var files = Array.prototype.slice.call(attachUpload.files || []);
      attachUpload.value = '';
      if (!files.length) return;
      if (!docsServerReady) {
        toast(docsServerRequiredTip());
        return;
      }
      var chain = Promise.resolve();
      files.forEach(function (file) {
        chain = chain.then(function () { return uploadOneAttachment(file); });
      });
      chain.then(function () {
        toast('附件已写入代码包');
        hintEl.textContent = '附件已更新 · ' + nowText();
      }).catch(function (err) {
        docsServerReady = false;
        updateServerBadge();
        toast((err && err.message) || docsServerRequiredTip());
      });
    });
  }

  if (attachListEl) {
    attachListEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-attach-del');
      if (!btn) return;
      e.preventDefault();
      var id = btn.getAttribute('data-id');
      if (!id) return;
      if (!docsServerReady) {
        toast(docsServerRequiredTip());
        return;
      }
      if (!confirm('确定从代码包删除该附件？')) return;
      docsApi(docsApiPath(reqDocModuleId, 'requirements/attachments/' + encodeURIComponent(id)), {
        method: 'DELETE',
      }).then(function (res) {
        reqAttachments = normalizeReqAttachments(res.attachments);
        renderAttachments();
        toast('附件已删除');
        hintEl.textContent = '附件已更新 · ' + nowText();
      }).catch(function (err) {
        docsServerReady = false;
        updateServerBadge();
        toast((err && err.message) || docsServerRequiredTip());
      });
    });
  }

  function rememberSelection() {
    var range = cloneLiveRange(window.getSelection());
    if (range && !range.collapsed && isRangeInEditor(range, editor)) {
      savedRange = range;
    }
  }

  document.addEventListener('selectionchange', function () {
    if (document.activeElement !== editor && !editor.contains(document.activeElement)) return;
    rememberSelection();
  });
  editor.addEventListener('mouseup', rememberSelection);
  editor.addEventListener('keyup', rememberSelection);

  toolbar.addEventListener('pointerdown', rememberSelection);
  toolbar.addEventListener('mousedown', function (e) {
    rememberSelection();
    if (e.target.closest('select') || e.target.closest('input')) return;
    e.preventDefault();
  });

  function useSavedSelection() {
    if (savedRange) restoreEditorRange(editor, savedRange);
    else editor.focus();
  }

  toolbar.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    e.preventDefault();
    useSavedSelection();
    var cmd = btn.dataset.cmd;
    var value = btn.dataset.value || null;
    document.execCommand(cmd, false, value);
    rememberSelection();
  });

  document.getElementById('rte-font-size').addEventListener('change', function (e) {
    var size = e.target.value;
    if (!size) return;
    var applied = wrapSelectionWithStyle(editor, { fontSize: size }, savedRange);
    if (!applied) toast('请先选中要调整的文字');
    else rememberSelection();
    e.target.value = '';
  });

  document.getElementById('rte-line-height').addEventListener('change', function (e) {
    var value = e.target.value;
    if (!value) return;
    var range = resolveLineHeightRange(editor, savedRange);
    var blocks = range && !range.collapsed ? collectBlocksInRange(range, editor) : [];
    if (blocks.length) applyLineHeightToBlocks(blocks, value);
    else applyLineHeightToEditor(editor, value);
    rememberSelection();
  });

  document.getElementById('rte-fore-color').addEventListener('input', function (e) {
    useSavedSelection();
    applyRteColor(editor, 'fore', e.target.value);
    rememberSelection();
  });

  document.getElementById('rte-bg-color').addEventListener('input', function (e) {
    useSavedSelection();
    applyRteColor(editor, 'back', e.target.value);
    rememberSelection();
  });

  document.getElementById('btn-insert-link').addEventListener('click', function () {
    useSavedSelection();
    var url = prompt('请输入链接地址', 'https://');
    if (!url) return;
    restoreEditorRange(editor, savedRange);
    document.execCommand('createLink', false, url);
  });

  document.getElementById('btn-req-save').addEventListener('click', function () {
    if (!docsServerReady) {
      toast(docsServerRequiredTip());
      return;
    }
    var data = {
      html: editor.innerHTML,
      lineHeight: editor.style.lineHeight || '',
      savedAt: nowText(),
    };
    var btn = document.getElementById('btn-req-save');
    btn.disabled = true;
    docsApi(docsApiPath(reqDocModuleId, 'requirements'), { method: 'POST', body: data }).then(function (res) {
      clearLocalRequirementsCache();
      var savedAt = (res.requirements && res.requirements.savedAt) || data.savedAt;
      hintEl.textContent = '已保存到代码包 · ' + savedAt;
      toast('需求说明已写入代码包，请提交 GitHub');
    }).catch(function (err) {
      docsServerReady = false;
      updateServerBadge();
      toast((err && err.message) || docsServerRequiredTip());
    }).then(function () {
      btn.disabled = false;
    });
  });
}

if (document.querySelector('.requirements-page')) initRequirementsPage();
