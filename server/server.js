/**
 * Haustro Page Builder — HTTP API
 *
 * Tek bir MongoDB bağlantısı açar ve mevcut pageService fonksiyonlarını
 * REST endpoint olarak sunar. Frontend (web/) bu API'yi tüketir.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { loadEnv } = require('../src/config');
const { connect, close, setShellMode, getDb } = require('../src/db');
const {
  findPageByName,
  listChildren,
  getPageById,
  getPageContent,
  duplicatePage,
  createPageFromTemplate,
  createInventoryCardsPage,
  updatePageContentFromTemplate,
  exportTemplate,
  pageTitle,
  pageUrl,
} = require('../src/pageService');

const { buildBrief, buildClipboardPrompt, saveBrief } = require('./brief');
const { scanComponentUsage } = require('../src/componentUsageService');
const { getRawCatalog, COMPONENT_CATALOG, COMPONENT_CATEGORIES } = require('../src/componentCatalog');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const BRIEFS_DIR = path.join(ROOT, 'briefs');
const ALIAS_FILE = path.join(require('os').homedir(), '.haustro-aliases.json');

const DEFAULT_ALIASES = {
  mahmutcan: '6802646ca01c352cdf350342',
  parent: '6802646ca01c352cdf350342',
  cards: '6a0f082613a466b79aa65c98',
  envanter: '5fef676e4fe5a500117b0852',
};

function loadAliases() {
  try {
    const stored = fs.existsSync(ALIAS_FILE)
      ? JSON.parse(fs.readFileSync(ALIAS_FILE, 'utf8'))
      : {};
    return { ...DEFAULT_ALIASES, ...stored };
  } catch (e) {
    return { ...DEFAULT_ALIASES };
  }
}

function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  const files = fs.readdirSync(TEMPLATES_DIR);
  const pageFiles = files.filter((f) => f.endsWith('-page.json'));
  return pageFiles.map((f) => {
    const name = f.replace(/-page\.json$/, '');
    const hasContent = fs.existsSync(path.join(TEMPLATES_DIR, `${name}-content.json`));
    let displayName = name;
    try {
      const tpl = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8'));
      const dn = (tpl.properties || []).find((p) => p.key === 'display-name');
      if (dn && dn.value) displayName = dn.value;
    } catch (e) {}
    return { name, displayName, hasContent };
  });
}

function loadTemplate(name) {
  const pagePath = path.join(TEMPLATES_DIR, `${name}-page.json`);
  const contentPath = path.join(TEMPLATES_DIR, `${name}-content.json`);
  if (!fs.existsSync(pagePath)) return null;
  const page = JSON.parse(fs.readFileSync(pagePath, 'utf8'));
  const content = fs.existsSync(contentPath)
    ? JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    : null;
  return { page, content };
}

function resolveId(input, aliases) {
  if (!input) return input;
  return aliases[input] || input;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/**
 * Alias çöz + 24-hex doğrula. Geçersizse 400 hata fırlat.
 */
function resolveAndValidateId(input, aliases, fieldName = 'id') {
  if (!input || !String(input).trim()) {
    throw badRequest(`${fieldName} zorunlu`);
  }
  const resolved = resolveId(String(input).trim(), aliases);
  if (!OBJECT_ID_RE.test(resolved)) {
    throw badRequest(
      `Geçersiz ${fieldName}: "${input}". 24 karakterlik hex ID veya tanımlı alias (mahmutcan, parent, cards, envanter, ...) bekleniyor.`
    );
  }
  return resolved;
}

async function start() {
  loadEnv();
  setShellMode(true);
  const t0 = Date.now();
  await connect();
  console.log(`[server] MongoDB bağlandı (${Date.now() - t0}ms)`);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.use((req, _res, next) => {
    const t = Date.now();
    const orig = _res.send.bind(_res);
    _res.send = (...args) => {
      console.log(`[${req.method}] ${req.path} ${_res.statusCode} (${Date.now() - t}ms)`);
      return orig(...args);
    };
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/aliases', (_req, res) => {
    res.json(loadAliases());
  });

  app.get('/api/templates', (_req, res) => {
    res.json(listTemplates());
  });

  app.get('/api/templates/:name', (req, res) => {
    const tpl = loadTemplate(req.params.name);
    if (!tpl) return res.status(404).json({ error: 'template not found' });
    res.json(tpl);
  });

  // AI + web için tam component kataloğu (statik JSON)
  app.get('/api/components/catalog', (_req, res) => {
    res.json({
      ...getRawCatalog(),
      catalogMap: COMPONENT_CATALOG,
      categories: COMPONENT_CATEGORIES,
    });
  });

  // Tüm sayfalardaki component kullanımı (DB taraması)
  app.get('/api/components/usage', async (req, res, next) => {
    try {
      const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const data = await scanComponentUsage({ refresh });
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/pages', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      // parent boş olabilir (root listesi). Alias yoksa olduğu gibi kullan.
      const raw = String(req.query.parent || '').trim();
      let parent = '';
      if (raw) {
        const resolved = resolveId(raw, aliases);
        if (!OBJECT_ID_RE.test(resolved)) {
          throw badRequest(
            `Geçersiz parent: "${raw}". 24 hex ID veya tanımlı alias bekleniyor.`
          );
        }
        parent = resolved;
      }
      const pages = await listChildren(parent);
      res.json(
        pages.map((p) => ({
          _id: String(p._id),
          title: pageTitle(p),
          url: pageUrl(p),
          parent: p.parent,
          type: p.type,
        }))
      );
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/pages/search', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const q = String(req.query.q || '').trim();
      if (!q) return res.json([]);
      let parent;
      if (req.query.parent) {
        parent = resolveAndValidateId(req.query.parent, aliases, 'parent');
      }
      const pages = await findPageByName(q, { parentId: parent });
      res.json(
        pages.map((p) => ({
          _id: String(p._id),
          title: pageTitle(p),
          url: pageUrl(p),
          parent: p.parent,
          type: p.type,
        }))
      );
    } catch (e) {
      next(e);
    }
  });

  // Block ağacını UI önizlemesi için temizler:
  // - properties -> {key: value} map
  // - content (render-template HTML) korunur
  // - children rekürsif düzleştirilir
  function flattenBlock(b) {
    if (!b || typeof b !== 'object') return null;
    const props = {};
    for (const p of b.properties || []) {
      if (p && p.key) props[p.key] = p.value;
    }
    return {
      type: b.type,
      isContainer: !!b.isContainer,
      isTextEditor: !!b.isTextEditor,
      displayName: props['display-name'] || null,
      variableName: props['variable-name'] || null,
      tableName: props['table-name'] || null,
      props,
      content: typeof b.content === 'string' ? b.content : null,
      children: Array.isArray(b.children) ? b.children.map(flattenBlock).filter(Boolean) : [],
    };
  }

  app.get('/api/pages/:id', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const id = resolveAndValidateId(req.params.id, aliases, 'pageId');
      const page = await getPageById(id);
      if (!page) return res.status(404).json({ error: 'not found' });
      const content = await getPageContent(id);
      const blocks = (content?.content || []).map(flattenBlock).filter(Boolean);
      res.json({
        page: {
          ...page,
          _id: String(page._id),
          title: pageTitle(page),
          url: pageUrl(page),
        },
        content: content
          ? {
              blocks,
              styles: content.styles || '',
              hasStyles: !!(content.styles && content.styles.length),
            }
          : null,
      });
    } catch (e) {
      next(e);
    }
  });

  // Önizleme için bir data-source'dan örnek veri: tabloyu Mongo'dan
  // çeker, ilk N kaydı döner. Frontend Handlebars context'i için kullanır.
  app.post('/api/data-source/sample', async (req, res, next) => {
    try {
      const { tableName, filter, limit = 6 } = req.body || {};
      if (!tableName || !String(tableName).trim()) {
        return res.status(400).json({ error: 'tableName zorunlu' });
      }
      let parsedFilter = {};
      if (filter) {
        try {
          parsedFilter = typeof filter === 'string' ? JSON.parse(filter) : filter;
        } catch (e) {
          return res
            .status(400)
            .json({ error: `filter JSON parse hatası: ${e.message}` });
        }
      }
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 50);
      const db = getDb();
      const docs = await db
        .collection(String(tableName))
        .find(parsedFilter)
        .limit(safeLimit)
        .toArray();
      // _id'leri string'e çevir
      const sanitized = docs.map((d) => {
        const out = { ...d };
        if (out._id && typeof out._id === 'object' && out._id.toString) {
          out._id = out._id.toString();
        }
        return out;
      });
      res.json({ tableName, count: sanitized.length, rows: sanitized });
    } catch (e) {
      next(e);
    }
  });

  // Yeni sayfa oluştur (template'ten)
  // body: { templateName, parentId, title, url?, propertyOverrides?: { [key]: value } }
  app.post('/api/pages', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const { templateName, parentId, title, url, propertyOverrides } = req.body || {};
      if (!templateName || !title) {
        return res
          .status(400)
          .json({ error: 'templateName ve title zorunlu' });
      }
      const resolvedParent = resolveAndValidateId(parentId, aliases, 'parentId');

      // Override desteği: template'i kopyalayıp property'leri patch'leyerek
      // geçici dosyaya yazmak yerine override'ları aldıktan sonra
      // createPageFromTemplate çağırıp sonradan property'leri patch'leyebiliriz.
      // Daha temizi: pageService'e overrides eklemek; ama mevcut API yeterli —
      // önce sayfayı oluştur, override varsa post-process et.
      const result = await createPageFromTemplate({
        templateName,
        parentId: resolvedParent,
        title,
        url,
      });

      if (propertyOverrides && typeof propertyOverrides === 'object') {
        const db = getDb();
        const { ObjectId } = require('mongodb');
        const pageId = result.pageId;
        const page = await db
          .collection('pages')
          .findOne({ _id: ObjectId(pageId) });
        if (page) {
          const props = page.properties || [];
          const apply = (key, val) => {
            const top = props.find((p) => p.key === key);
            if (top) {
              top.value = val;
              return;
            }
            for (const p of props) {
              if (Array.isArray(p.children)) {
                const child = p.children.find((c) => c.key === key);
                if (child) {
                  child.value = val;
                  return;
                }
              }
            }
          };
          Object.entries(propertyOverrides).forEach(([k, v]) => apply(k, v));
          await db
            .collection('pages')
            .updateOne({ _id: page._id }, { $set: { properties: props } });
        }
      }

      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  // Inventory cards kısayolu (deprecated — POST /api/pages ile aynı sonucu verir)
  app.post('/api/pages/inventory-cards', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const { parentId, title, url } = req.body || {};
      if (!title) return res.status(400).json({ error: 'title zorunlu' });
      const result = await createInventoryCardsPage({
        parentId: resolveAndValidateId(parentId, aliases, 'parentId'),
        title,
        url,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  // Sayfa kopyala
  app.post('/api/pages/duplicate', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const { sourceId, parentId, title, url } = req.body || {};
      if (!title) return res.status(400).json({ error: 'title zorunlu' });
      const result = await duplicatePage(
        resolveAndValidateId(sourceId, aliases, 'sourceId'),
        {
          title,
          url,
          parentId: parentId
            ? resolveAndValidateId(parentId, aliases, 'parentId')
            : undefined,
        }
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  // İçerik güncelle
  app.put('/api/pages/:id/content', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const id = resolveAndValidateId(req.params.id, aliases, 'pageId');
      const { templateName } = req.body || {};
      if (!templateName) return res.status(400).json({ error: 'templateName zorunlu' });
      const result = await updatePageContentFromTemplate({
        pageId: id,
        templateName,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  // Brief üret: form girdilerini alır, briefs/<...>.md dosyasını yazar,
  // kopyalanabilir prompt metnini döndürür.
  app.post('/api/brief', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const {
        pageType = 'sub',
        parentId,
        label,
        url,
        description,
        notes,
        references,
      } = req.body || {};
      if (!label || !description) {
        return res
          .status(400)
          .json({ error: 'label ve description zorunlu' });
      }
      if (pageType === 'sub') {
        // sub için parent zorunlu + valid id
        resolveAndValidateId(parentId, aliases, 'parentId');
      }
      const resolvedParent = parentId
        ? resolveId(String(parentId).trim(), aliases)
        : '';
      // Parent label'ını da bul (sub ise)
      let parentLabel = null;
      if (pageType === 'sub' && resolvedParent) {
        try {
          const p = await getPageById(resolvedParent);
          if (p) parentLabel = pageTitle(p);
        } catch (e) {}
      }

      const { md, slug, url: finalUrl } = buildBrief({
        pageType,
        parentId: resolvedParent,
        parentLabel,
        label: label.trim(),
        url: url ? url.trim() : '',
        description,
        notes,
        references,
      });

      const briefPath = saveBrief({ briefsDir: BRIEFS_DIR, slug, md });
      const prompt = buildClipboardPrompt(briefPath, slug);

      res.json({
        slug,
        url: finalUrl,
        briefPath,
        briefRelative: path.relative(ROOT, briefPath),
        prompt,
        markdown: md,
        nextStep: `npm run create-from-template -- -n ${slug} -p ${
          resolvedParent || '<parentId>'
        } -t "${label}" -u ${finalUrl}`,
      });
    } catch (e) {
      next(e);
    }
  });

  // DB'den şablon export
  app.post('/api/templates/export', async (req, res, next) => {
    try {
      const aliases = loadAliases();
      const { sourcePageId, name } = req.body || {};
      const id = resolveAndValidateId(sourcePageId, aliases, 'sourcePageId');
      const result = await exportTemplate(id, name);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  // Production: web/dist statik serve
  const DIST = path.join(ROOT, 'web', 'dist');
  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(DIST, 'index.html'));
    });
  }

  app.use((err, req, res, _next) => {
    console.error(`[error] ${req.method} ${req.path}:`, err.message);
    const status = err.status || 500;
    // Mongo "ObjectId" hatasını anlaşılır mesaja çevir
    let message = err.message || 'internal error';
    if (/12 bytes or a string of 24 hex characters/i.test(message)) {
      message =
        'Geçersiz ID — beklenen: 24 karakterlik hex (MongoDB ObjectId) veya tanımlı alias.';
    }
    res.status(status).json({ error: message });
  });

  const server = app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}`);
    if (!fs.existsSync(DIST)) {
      console.log(`[server] (web/dist yok — Vite dev server için "npm run web" kullan)`);
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[server] Port ${PORT} zaten kullanımda. ` +
          `Başka bir server'ı kapat ya da PORT=3001 npm run server ile farklı portta başlat.`
      );
    } else {
      console.error('[server] listen hatası:', err.message);
    }
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\n[server] kapanıyor...');
    await close();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('[server] başlatılamadı:', err.message);
  process.exit(1);
});
