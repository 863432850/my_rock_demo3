/**
 * 本地静态服务 + 按模块隔离的文档写入 API
 * 启动：npm start  或  node server.js
 *
 * 文档路径：
 *   js/docs/{module}/doc-defaults.js
 *   assets/{module}/flowchart.*
 *   assets/{module}/requirements/*
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8088;
const MAX_BODY = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 30;
const MODULE_RE = /^[a-zA-Z0-9_-]+$/;
const ATTACH_ID_RE = /^[a-zA-Z0-9_-]+$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体过大（上限 20MB）'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

function assertModule(moduleId) {
  if (!moduleId || !MODULE_RE.test(moduleId)) {
    throw new Error('无效的模块标识');
  }
  return moduleId;
}

function docsJsPath(moduleId) {
  return path.join(ROOT, 'js', 'docs', moduleId, 'doc-defaults.js');
}

function assetsDir(moduleId) {
  return path.join(ROOT, 'assets', moduleId);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function emptyDefaults() {
  return {
    flowchart: {
      fileName: '',
      fileType: '',
      filePath: '',
      savedAt: '',
      cleared: true,
    },
    requirements: {
      html: '',
      lineHeight: '',
      savedAt: '',
      attachments: [],
    },
  };
}

function normalizeRequirements(req) {
  req = req || {};
  return {
    html: typeof req.html === 'string' ? req.html : '',
    lineHeight: req.lineHeight || '',
    savedAt: req.savedAt || '',
    attachments: Array.isArray(req.attachments) ? req.attachments : [],
  };
}

function loadCurrentDefaults(moduleId) {
  const fallback = emptyDefaults();
  const file = docsJsPath(moduleId);
  if (!fs.existsSync(file)) return fallback;
  try {
    const text = fs.readFileSync(file, 'utf8');
    const sandbox = { DEFAULT_FLOWCHART: null, DEFAULT_REQUIREMENTS: null };
    vm.runInNewContext(text, sandbox, { timeout: 1000 });
    if (sandbox.DEFAULT_FLOWCHART) fallback.flowchart = sandbox.DEFAULT_FLOWCHART;
    if (sandbox.DEFAULT_REQUIREMENTS) {
      fallback.requirements = normalizeRequirements(sandbox.DEFAULT_REQUIREMENTS);
    }
  } catch (e) {
    console.warn('[docs] 读取 doc-defaults.js 失败:', moduleId, e.message);
  }
  return fallback;
}

function writeDocDefaults(moduleId, flowchart, requirements) {
  ensureDir(path.dirname(docsJsPath(moduleId)));
  const req = normalizeRequirements(requirements);
  const content = [
    '/**',
    ' * ' + moduleId + ' 模块内置文档数据（由本地服务 npm start 保存时自动写入）',
    ' * 提交本文件 + assets/' + moduleId + '/flowchart.* + assets/' + moduleId + '/requirements/* 后，他人打开项目即可看到相同内容',
    ' */',
    'var DEFAULT_FLOWCHART = ' + JSON.stringify(flowchart, null, 2) + ';',
    '',
    'var DEFAULT_REQUIREMENTS = ' + JSON.stringify(req, null, 2) + ';',
    '',
  ].join('\n');
  fs.writeFileSync(docsJsPath(moduleId), content, 'utf8');
}

function reqAttachDir(moduleId) {
  return path.join(assetsDir(moduleId), 'requirements');
}

function makeAttachId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sanitizeExt(ext) {
  const e = String(ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  return e || 'bin';
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function extFor(fileName, fileType) {
  const m = String(fileName || '').match(/\.([a-z0-9]+)$/i);
  if (m) return m[1].toLowerCase();
  const type = String(fileType || '').toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/gif') return 'gif';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/svg+xml') return 'svg';
  if (type === 'text/markdown' || type === 'text/x-markdown') return 'md';
  if (type.indexOf('text/plain') === 0) return 'txt';
  return 'bin';
}

function clearFlowchartAssets(moduleId, keepName) {
  const dir = assetsDir(moduleId);
  ensureDir(dir);
  fs.readdirSync(dir).forEach(function (name) {
    if (!/^flowchart\./i.test(name)) return;
    if (keepName && name === keepName) return;
    fs.unlinkSync(path.join(dir, name));
  });
}

function decodeDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  if (!raw.startsWith('data:')) throw new Error('无效的文件数据');
  const comma = raw.indexOf(',');
  if (comma < 0) throw new Error('无效的文件数据');
  // 兼容 text/plain;charset=utf-8;base64 以及空 MIME
  const meta = raw.slice(5, comma);
  const payload = raw.slice(comma + 1);
  const isBase64 = /(?:^|;)base64$/i.test(meta);
  const mime = (meta.split(';')[0] || '').trim() || 'application/octet-stream';
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { mime: mime, buffer: buffer };
}

async function handleSaveFlowchart(moduleId, req, res) {
  const body = await readBody(req);
  if (!body.dataUrl && !body.filePath) {
    sendJson(res, 400, { ok: false, message: '缺少流程图文件数据' });
    return;
  }

  const current = loadCurrentDefaults(moduleId);
  let flowchart;

  if (body.dataUrl) {
    const decoded = decodeDataUrl(body.dataUrl);
    const fileType = body.fileType || decoded.mime;
    const fileName = body.fileName || ('flowchart.' + extFor('', fileType));
    const ext = extFor(fileName, fileType);
    const assetName = 'flowchart.' + ext;
    ensureDir(assetsDir(moduleId));
    fs.writeFileSync(path.join(assetsDir(moduleId), assetName), decoded.buffer);
    clearFlowchartAssets(moduleId, assetName);
    flowchart = {
      fileName: fileName,
      fileType: fileType,
      filePath: 'assets/' + moduleId + '/' + assetName,
      savedAt: body.savedAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
      cleared: false,
    };
  } else {
    flowchart = {
      fileName: body.fileName || current.flowchart.fileName,
      fileType: body.fileType || current.flowchart.fileType,
      filePath: body.filePath,
      savedAt: body.savedAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
      cleared: false,
    };
  }

  writeDocDefaults(moduleId, flowchart, current.requirements);
  sendJson(res, 200, { ok: true, flowchart: flowchart, message: '流程图已写入代码包' });
}

async function handleDeleteFlowchart(moduleId, req, res) {
  const current = loadCurrentDefaults(moduleId);
  clearFlowchartAssets(moduleId, '');
  const flowchart = {
    fileName: '',
    fileType: '',
    filePath: '',
    savedAt: '',
    cleared: true,
  };
  writeDocDefaults(moduleId, flowchart, current.requirements);
  sendJson(res, 200, { ok: true, flowchart: flowchart, message: '流程图已从代码包删除' });
}

async function handleSaveRequirements(moduleId, req, res) {
  const body = await readBody(req);
  if (typeof body.html !== 'string') {
    sendJson(res, 400, { ok: false, message: '缺少需求说明内容' });
    return;
  }
  const current = loadCurrentDefaults(moduleId);
  const requirements = normalizeRequirements({
    html: body.html,
    lineHeight: body.lineHeight || '',
    savedAt: body.savedAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
    attachments: current.requirements.attachments,
  });
  writeDocDefaults(moduleId, current.flowchart, requirements);
  sendJson(res, 200, { ok: true, requirements: requirements, message: '需求说明已写入代码包' });
}

async function handleUploadRequirementAttachment(moduleId, req, res) {
  const body = await readBody(req);
  if (!body.dataUrl) {
    sendJson(res, 400, { ok: false, message: '缺少附件文件数据' });
    return;
  }
  const current = loadCurrentDefaults(moduleId);
  const requirements = normalizeRequirements(current.requirements);
  if (requirements.attachments.length >= MAX_ATTACHMENTS) {
    sendJson(res, 400, { ok: false, message: '附件数量已达上限（' + MAX_ATTACHMENTS + ' 个）' });
    return;
  }

  const decoded = decodeDataUrl(body.dataUrl);
  const fileName = String(body.fileName || 'attachment.bin').replace(/[\\/]/g, '_');
  const fileType = body.fileType || decoded.mime || 'application/octet-stream';
  const ext = sanitizeExt(extFor(fileName, fileType));
  const id = ATTACH_ID_RE.test(String(body.id || '')) ? String(body.id) : makeAttachId();
  const assetName = id + '.' + ext;
  const dir = reqAttachDir(moduleId);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, assetName), decoded.buffer);

  const item = {
    id: id,
    fileName: fileName,
    fileType: fileType,
    filePath: 'assets/' + moduleId + '/requirements/' + assetName,
    size: decoded.buffer.length,
    sizeText: formatSize(decoded.buffer.length),
    savedAt: body.savedAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
  requirements.attachments = requirements.attachments.filter(function (a) { return a.id !== id; });
  requirements.attachments.push(item);
  writeDocDefaults(moduleId, current.flowchart, requirements);
  sendJson(res, 200, {
    ok: true,
    attachment: item,
    attachments: requirements.attachments,
    message: '附件已写入代码包',
  });
}

async function handleDeleteRequirementAttachment(moduleId, attachId, req, res) {
  if (!ATTACH_ID_RE.test(String(attachId || ''))) {
    sendJson(res, 400, { ok: false, message: '无效的附件标识' });
    return;
  }
  const current = loadCurrentDefaults(moduleId);
  const requirements = normalizeRequirements(current.requirements);
  const target = requirements.attachments.find(function (a) { return a.id === attachId; });
  if (!target) {
    sendJson(res, 404, { ok: false, message: '附件不存在' });
    return;
  }

  const abs = safeJoin(ROOT, '/' + target.filePath);
  if (abs && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    fs.unlinkSync(abs);
  }
  requirements.attachments = requirements.attachments.filter(function (a) { return a.id !== attachId; });
  writeDocDefaults(moduleId, current.flowchart, requirements);
  sendJson(res, 200, {
    ok: true,
    attachments: requirements.attachments,
    message: '附件已从代码包删除',
  });
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const cleaned = decoded.replace(/^\/+/, '');
  const full = path.normalize(path.join(root, cleaned || 'index.html'));
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res, pathname) {
  let filePath = safeJoin(ROOT, pathname === '/' ? '/index.html' : pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const noCache = ext === '.js' || ext === '.html' || ext === '.css'
    || /\/assets\/[^/]+\/flowchart\./.test(pathname)
    || /\/assets\/[^/]+\/requirements\//.test(pathname);
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': noCache ? 'no-store' : 'public, max-age=60',
  });
  fs.createReadStream(filePath).pipe(res);
}

function matchDocsApi(pathname) {
  let m = pathname.match(/^\/api\/docs\/([^/]+)\/requirements\/attachments(?:\/([^/]+))?$/);
  if (m) {
    return { moduleId: m[1], kind: 'req-attach', attachId: m[2] || '' };
  }
  m = pathname.match(/^\/api\/docs\/([^/]+)\/(status|flowchart|requirements)$/);
  if (!m) return null;
  return { moduleId: m[1], kind: m[2], attachId: '' };
}

const server = http.createServer(async function (req, res) {
  const parsed = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = parsed.pathname;
  const method = req.method || 'GET';

  try {
    // 兼容旧接口 → verify 模块
    if (pathname === '/api/docs/status' || pathname === '/api/docs/flowchart' || pathname === '/api/docs/requirements') {
      const kind = pathname.split('/').pop();
      const moduleId = 'verify';
      if (method === 'GET' && kind === 'status') {
        sendJson(res, 200, { ok: true, mode: 'file', moduleId: moduleId, message: '文档写入服务已就绪' });
        return;
      }
      if (method === 'POST' && kind === 'flowchart') {
        await handleSaveFlowchart(moduleId, req, res);
        return;
      }
      if (method === 'DELETE' && kind === 'flowchart') {
        await handleDeleteFlowchart(moduleId, req, res);
        return;
      }
      if (method === 'POST' && kind === 'requirements') {
        await handleSaveRequirements(moduleId, req, res);
        return;
      }
    }

    const matched = matchDocsApi(pathname);
    if (matched) {
      const moduleId = assertModule(matched.moduleId);
      const kind = matched.kind;
      if (method === 'GET' && kind === 'status') {
        sendJson(res, 200, { ok: true, mode: 'file', moduleId: moduleId, message: '文档写入服务已就绪' });
        return;
      }
      if (method === 'POST' && kind === 'flowchart') {
        await handleSaveFlowchart(moduleId, req, res);
        return;
      }
      if (method === 'DELETE' && kind === 'flowchart') {
        await handleDeleteFlowchart(moduleId, req, res);
        return;
      }
      if (method === 'POST' && kind === 'requirements') {
        await handleSaveRequirements(moduleId, req, res);
        return;
      }
      if (method === 'POST' && kind === 'req-attach' && !matched.attachId) {
        await handleUploadRequirementAttachment(moduleId, req, res);
        return;
      }
      if (method === 'DELETE' && kind === 'req-attach' && matched.attachId) {
        await handleDeleteRequirementAttachment(moduleId, matched.attachId, req, res);
        return;
      }
      sendJson(res, 405, { ok: false, message: '方法不允许' });
      return;
    }

    if (method === 'GET' || method === 'HEAD') {
      serveStatic(req, res, pathname);
      return;
    }
    sendJson(res, 405, { ok: false, message: '方法不允许' });
  } catch (err) {
    console.error('[server]', err);
    sendJson(res, 500, { ok: false, message: err.message || '服务器错误' });
  }
});

server.listen(PORT, '127.0.0.1', function () {
  console.log('');
  console.log('  绿色低碳管理平台原型服务已启动');
  console.log('  地址: http://127.0.0.1:' + PORT + '/');
  console.log('  文档按模块写入:');
  console.log('    - js/docs/{module}/doc-defaults.js');
  console.log('    - assets/{module}/flowchart.*');
  console.log('    - assets/{module}/requirements/*');
  console.log('');
});
