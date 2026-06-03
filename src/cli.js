#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chalk = require('chalk');
const { Command } = require('commander');
const { loadEnv } = require('./config');
const { connect, close, setShellMode, isShellMode } = require('./db');
const {
  findPageByName,
  listChildren,
  getPageById,
  getPageContent,
  duplicatePage,
  createInventoryListPage,
  createInventoryCardsPage,
  createPageFromTemplate,
  updatePageContentFromTemplate,
  exportTemplate,
  pageTitle,
  pageUrl,
  DEFAULT_INVENTORY_TEMPLATE_PAGE_ID,
} = require('./pageService');

const program = new Command();

program
  .name('haustro-pages')
  .description('Haustro galliardDb panel sayfası oluşturma CLI')
  .version('1.0.0');

function printPage(p) {
  console.log(
    chalk.cyan(p._id.toString()),
    chalk.white(pageTitle(p)),
    chalk.gray(`parent=${p.parent || ''} url=${pageUrl(p)} type=${p.type || ''}`)
  );
}

async function withDb(fn) {
  try {
    loadEnv();
    await connect();
    return await fn();
  } finally {
    if (!isShellMode()) await close();
  }
}

program
  .command('find <name>')
  .description('İsme göre sayfa ara')
  .option('-p, --parent <id>', 'Sadece bu parent altında ara')
  .action(async (name, opts) => {
    await withDb(async () => {
      const pages = await findPageByName(name, { parentId: opts.parent });
      if (!pages.length) {
        console.log(chalk.yellow('Sonuç yok.'));
        return;
      }
      pages.forEach(printPage);
    });
  });

program
  .command('list')
  .description('Parent altındaki alt sayfaları listele')
  .option('-p, --parent <id>', 'Parent page id', '')
  .action(async (opts) => {
    await withDb(async () => {
      const children = await listChildren(opts.parent);
      if (!children.length) {
        console.log(chalk.yellow('Alt sayfa yok.'));
        return;
      }
      children.forEach(printPage);
    });
  });

program
  .command('show <pageId>')
  .description('Tek sayfa detayı')
  .action(async (pageId) => {
    await withDb(async () => {
      const page = await getPageById(pageId);
      if (!page) {
        console.log(chalk.red('Sayfa bulunamadı.'));
        return;
      }
      printPage(page);
      const content = await require('./pageService').getPageContent(pageId);
      console.log(
        chalk.gray(
          `pageContents: ${content ? (content.content || []).length + ' blok' : 'yok'}`
        )
      );
    });
  });

program
  .command('duplicate')
  .description('Mevcut sayfayı kopyala (duplicatePage.php mantığı)')
  .requiredOption('-s, --source <id>', 'Kaynak page _id')
  .requiredOption('-t, --title <title>', 'Yeni sayfa başlığı')
  .option('-u, --url <slug>', 'URL slug')
  .option('-p, --parent <id>', 'Parent page id')
  .action(async (opts) => {
    await withDb(async () => {
      const result = await duplicatePage(opts.source, {
        title: opts.title,
        url: opts.url,
        parentId: opts.parent,
      });
      console.log(chalk.green('Sayfa oluşturuldu:'));
      console.log(JSON.stringify(result, null, 2));
    });
  });

program
  .command('create-inventory-list')
  .description(
    'Envanter listesi sayfası oluştur (varsayılan şablon: Araç Gereç Envanteri)'
  )
  .requiredOption('-p, --parent <id>', 'Üst sayfa id (ör. mahmutcan test)')
  .requiredOption('-t, --title <title>', 'Sayfa başlığı')
  .option('-u, --url <slug>', 'URL slug')
  .option(
    '--template <id>',
    'Şablon page id',
    DEFAULT_INVENTORY_TEMPLATE_PAGE_ID
  )
  .action(async (opts) => {
    await withDb(async () => {
      const result = await createInventoryListPage({
        parentId: opts.parent,
        title: opts.title,
        url: opts.url,
        templatePageId: opts.template,
      });
      console.log(chalk.green('Envanter listesi sayfası oluşturuldu:'));
      console.log(JSON.stringify(result, null, 2));
      console.log(
        chalk.gray(
          `\nPanel URL örneği: /d/${result.url}?_id= (liste sayfası dinamik route kullanır)`
        )
      );
    });
  });

program
  .command('create-inventory-cards')
  .description(
    'Envanter kartları sayfası oluştur (render-template ile inventory koleksiyonunu card grid olarak listeler)'
  )
  .requiredOption('-p, --parent <id>', 'Üst sayfa id (ör. mahmutcan test)')
  .option('-t, --title <title>', 'Sayfa başlığı', 'Envanter Kartları')
  .option('-u, --url <slug>', 'URL slug')
  .action(async (opts) => {
    await withDb(async () => {
      const result = await createInventoryCardsPage({
        parentId: opts.parent,
        title: opts.title,
        url: opts.url,
      });
      console.log(chalk.green('Envanter kartları sayfası oluşturuldu:'));
      console.log(JSON.stringify(result, null, 2));
    });
  });

program
  .command('create-from-template')
  .description(
    'templates/<name>-page.json ve <name>-content.json şablonlarından yeni sayfa oluştur'
  )
  .requiredOption('-n, --name <name>', 'Şablon adı (örn. inventory-cards)')
  .requiredOption('-p, --parent <id>', 'Üst sayfa id')
  .requiredOption('-t, --title <title>', 'Sayfa başlığı')
  .option('-u, --url <slug>', 'URL slug')
  .action(async (opts) => {
    await withDb(async () => {
      const result = await createPageFromTemplate({
        templateName: opts.name,
        parentId: opts.parent,
        title: opts.title,
        url: opts.url,
      });
      console.log(chalk.green('Sayfa oluşturuldu:'));
      console.log(JSON.stringify(result, null, 2));
    });
  });

program
  .command('update-content')
  .description(
    'Mevcut sayfa pageContents kaydını templates/<name>-content.json ile güncelle'
  )
  .requiredOption('-i, --pageId <id>', 'Güncellenecek page id')
  .requiredOption('-n, --name <name>', 'Şablon adı (örn. inventory-cards)')
  .action(async (opts) => {
    await withDb(async () => {
      const result = await updatePageContentFromTemplate({
        pageId: opts.pageId,
        templateName: opts.name,
      });
      console.log(chalk.green('pageContents güncellendi:'));
      console.log(JSON.stringify(result, null, 2));
    });
  });

program
  .command('export-template')
  .description('DB\'den şablon JSON dosyası dışa aktar')
  .requiredOption('-s, --source <id>', 'Kaynak page id')
  .option('-n, --name <name>', 'Dosya adı (templates/<name>-page.json)')
  .action(async (opts) => {
    await withDb(async () => {
      const paths = await exportTemplate(opts.source, opts.name);
      console.log(chalk.green('Şablon kaydedildi:'));
      console.log(paths);
    });
  });

// ---------------------------------------------------------------------------
// Shell mode (REPL) — tek MongoDB bağlantısı üzerinden ardışık komutlar
// Her komut için yeni connect/close yapmadığından ilk komuttan sonra her sorgu
// neredeyse anlık olur.
// ---------------------------------------------------------------------------

const ALIAS_FILE = path.join(os.homedir(), '.haustro-aliases.json');
const HISTORY_FILE = path.join(os.homedir(), '.haustro-history');

const DEFAULT_ALIASES = {
  mahmutcan: '6802646ca01c352cdf350342',
  parent: '6802646ca01c352cdf350342',
  cards: '6a0f082613a466b79aa65c98',
  envanter: DEFAULT_INVENTORY_TEMPLATE_PAGE_ID,
};

function loadAliases() {
  const stored = fs.existsSync(ALIAS_FILE)
    ? JSON.parse(fs.readFileSync(ALIAS_FILE, 'utf8'))
    : {};
  return { ...DEFAULT_ALIASES, ...stored };
}

function saveAliases(aliases) {
  const custom = { ...aliases };
  Object.keys(DEFAULT_ALIASES).forEach((k) => {
    if (custom[k] === DEFAULT_ALIASES[k]) delete custom[k];
  });
  try {
    fs.writeFileSync(ALIAS_FILE, JSON.stringify(custom, null, 2));
  } catch (e) {
    console.error(chalk.yellow(`alias dosyası kaydedilemedi: ${e.message}`));
  }
}

function parseLine(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  return out;
}

function resolveAlias(aliases, value) {
  if (!value) return value;
  return aliases[value] || value;
}

function fmtMs(start) {
  return chalk.gray(`(${Date.now() - start}ms)`);
}

async function runShellCommand(line, ctx) {
  const tokens = parseLine(line);
  if (!tokens.length) return;
  const [rawCmd, ...rawArgs] = tokens;
  const cmd = rawCmd.toLowerCase();
  // `alias` komutu kendi isimleriyle çalıştığı için resolve etmiyoruz; diğer
  // komutlarda token alias ise gerçek ID'ye çevriliyor.
  const args =
    cmd === 'alias' ? rawArgs : rawArgs.map((a) => resolveAlias(ctx.aliases, a));
  const t0 = Date.now();

  switch (cmd) {
    case 'help':
    case '?': {
      console.log(chalk.cyan('Komutlar:'));
      console.log('  list [parentId]                Alt sayfaları listele');
      console.log('  find <name> [parentId]         Sayfa ara');
      console.log('  show <pageId>                  Sayfa + içerik özeti');
      console.log('  content <pageId>               pageContents blok özetini göster');
      console.log('  orders <parentId>              Kardeş pageOrders listesi');
      console.log('  raw <coll> <id>                Tek doc ham JSON (pages, pageContents, ...)');
      console.log('  query <coll> <jsonFilter> [limit]   Ad-hoc Mongo find');
      console.log('  create-cards <parentId> <title> [url]   Envanter kartları sayfası');
      console.log('  create-from-template <tpl> <parentId> <title> [url]');
      console.log('  update-content <pageId> <templateName>');
      console.log('  duplicate <sourceId> <title> [url] [parentId]');
      console.log('  export <pageId> [name]');
      console.log('  alias [name] [id]              Listele / set et / sil (id boşsa)');
      console.log('  exit | quit                    Çık');
      console.log(chalk.gray('Alias örneği: list mahmutcan  → 6802646ca01c352cdf350342'));
      break;
    }
    case 'list': {
      const [parentId] = args;
      const children = await listChildren(parentId || '');
      if (!children.length) console.log(chalk.yellow('Alt sayfa yok.'));
      else children.forEach(printPage);
      console.log(chalk.gray(`${children.length} sayfa`), fmtMs(t0));
      break;
    }
    case 'find': {
      const [name, parentId] = args;
      if (!name) return console.log(chalk.red('Kullanım: find <name> [parentId]'));
      const pages = await findPageByName(name, { parentId });
      if (!pages.length) console.log(chalk.yellow('Sonuç yok.'));
      else pages.forEach(printPage);
      console.log(chalk.gray(`${pages.length} sonuç`), fmtMs(t0));
      break;
    }
    case 'show': {
      const [pageId] = args;
      if (!pageId) return console.log(chalk.red('Kullanım: show <pageId>'));
      const page = await getPageById(pageId);
      if (!page) return console.log(chalk.red('Sayfa bulunamadı.'));
      printPage(page);
      const c = await getPageContent(pageId);
      console.log(chalk.gray(`pageContents: ${c ? (c.content || []).length + ' blok' : 'yok'}`), fmtMs(t0));
      break;
    }
    case 'content': {
      const [pageId] = args;
      if (!pageId) return console.log(chalk.red('Kullanım: content <pageId>'));
      const c = await getPageContent(pageId);
      if (!c) return console.log(chalk.yellow('pageContents yok.'));
      (c.content || []).forEach((b, i) => {
        const props = (b.properties || []).filter((p) => ['display-name', 'variable-name'].includes(p.key));
        const meta = props.map((p) => `${p.key}=${p.value}`).join(' ');
        console.log(`#${i + 1} ${chalk.cyan(b.type)} container=${b.isContainer} ${chalk.gray(meta)}`);
      });
      console.log(chalk.gray(`${(c.content || []).length} blok, styles=${(c.styles || '').length} char`), fmtMs(t0));
      break;
    }
    case 'orders': {
      const [parentId] = args;
      if (!parentId) return console.log(chalk.red('Kullanım: orders <parentId>'));
      const db = require('./db').getDb();
      const kids = await db.collection('pages').find({ parent: parentId }).toArray();
      const orders = await db.collection('pageOrders').find({}).toArray();
      const orderMap = Object.fromEntries(orders.map((o) => [o.pageId, o.order]));
      const rows = kids.map((k) => ({
        id: String(k._id),
        title: (k.properties || []).find((p) => p.key === 'display-name')?.value || '(isimsiz)',
        order: orderMap[String(k._id)],
      }));
      rows.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      rows.forEach((r) => console.log(`  order=${String(r.order).padStart(4)} id=${r.id} ${r.title}`));
      console.log(chalk.gray(`${rows.length} sayfa`), fmtMs(t0));
      break;
    }
    case 'raw': {
      const [coll, id] = args;
      if (!coll || !id) return console.log(chalk.red('Kullanım: raw <coll> <id>'));
      const { ObjectId } = require('mongodb');
      const db = require('./db').getDb();
      const filter = id.match(/^[a-f0-9]{24}$/i) ? { _id: ObjectId(id) } : { _id: id };
      const doc = await db.collection(coll).findOne(filter);
      if (!doc) console.log(chalk.yellow('Doc bulunamadı.'));
      else console.log(JSON.stringify(doc, null, 2));
      console.log(fmtMs(t0));
      break;
    }
    case 'query': {
      const [coll, jsonFilter, limit] = args;
      if (!coll || !jsonFilter) return console.log(chalk.red('Kullanım: query <coll> <jsonFilter> [limit]'));
      const filter = JSON.parse(jsonFilter);
      const lim = Number(limit) || 10;
      const db = require('./db').getDb();
      const docs = await db.collection(coll).find(filter).limit(lim).toArray();
      docs.forEach((d) => console.log(JSON.stringify(d)));
      console.log(chalk.gray(`${docs.length} doc`), fmtMs(t0));
      break;
    }
    case 'create-cards': {
      const [parentId, title, url] = args;
      if (!parentId || !title) return console.log(chalk.red('Kullanım: create-cards <parentId> <title> [url]'));
      const result = await createInventoryCardsPage({ parentId, title, url });
      console.log(chalk.green('Oluşturuldu:'), JSON.stringify(result));
      console.log(fmtMs(t0));
      break;
    }
    case 'create-from-template': {
      const [templateName, parentId, title, url] = args;
      if (!templateName || !parentId || !title) {
        return console.log(chalk.red('Kullanım: create-from-template <tpl> <parentId> <title> [url]'));
      }
      const result = await createPageFromTemplate({ templateName, parentId, title, url });
      console.log(chalk.green('Oluşturuldu:'), JSON.stringify(result));
      console.log(fmtMs(t0));
      break;
    }
    case 'update-content': {
      const [pageId, templateName] = args;
      if (!pageId || !templateName) {
        return console.log(chalk.red('Kullanım: update-content <pageId> <templateName>'));
      }
      const result = await updatePageContentFromTemplate({ pageId, templateName });
      console.log(chalk.green('Güncellendi:'), JSON.stringify(result));
      console.log(fmtMs(t0));
      break;
    }
    case 'duplicate': {
      const [source, title, url, parentId] = args;
      if (!source || !title) return console.log(chalk.red('Kullanım: duplicate <sourceId> <title> [url] [parentId]'));
      const result = await duplicatePage(source, { title, url, parentId });
      console.log(chalk.green('Oluşturuldu:'), JSON.stringify(result));
      console.log(fmtMs(t0));
      break;
    }
    case 'export': {
      const [pageId, name] = args;
      if (!pageId) return console.log(chalk.red('Kullanım: export <pageId> [name]'));
      const paths = await exportTemplate(pageId, name);
      console.log(chalk.green('Kaydedildi:'), paths);
      console.log(fmtMs(t0));
      break;
    }
    case 'alias': {
      if (args.length === 0) {
        Object.entries(ctx.aliases)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([k, v]) => console.log(`  ${chalk.cyan(k.padEnd(16))} ${v}`));
        return;
      }
      const [name, value] = args;
      if (!value) {
        if (DEFAULT_ALIASES[name]) {
          console.log(chalk.yellow(`Varsayılan alias silinemez: ${name}`));
        } else if (ctx.aliases[name]) {
          delete ctx.aliases[name];
          saveAliases(ctx.aliases);
          console.log(chalk.green(`Silindi: ${name}`));
        } else {
          console.log(chalk.yellow(`Alias yok: ${name}`));
        }
      } else {
        ctx.aliases[name] = value;
        saveAliases(ctx.aliases);
        console.log(chalk.green(`Kaydedildi: ${name} = ${value}`));
      }
      break;
    }
    case 'exit':
    case 'quit':
    case '.exit':
      ctx.exit = true;
      break;
    default:
      console.log(chalk.yellow(`Bilinmeyen komut: ${rawCmd}. 'help' yaz.`));
  }
}

async function startShell() {
  loadEnv();
  setShellMode(true);
  const t0 = Date.now();
  await connect();
  console.log(chalk.green(`MongoDB bağlandı ${chalk.gray(`(${Date.now() - t0}ms)`)}`));
  console.log(chalk.cyan("Haustro Shell. 'help' yaz, 'exit' ile çık. Alias örneği: list mahmutcan"));

  const ctx = { aliases: loadAliases(), exit: false };

  const historyLines = fs.existsSync(HISTORY_FILE)
    ? fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean).slice(-500).reverse()
    : [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('haustro> '),
    history: historyLines,
    historySize: 500,
    removeHistoryDuplicates: true,
    completer: (line) => {
      const commands = [
        'help', 'list', 'find', 'show', 'content', 'orders', 'raw', 'query',
        'create-cards', 'create-from-template', 'update-content', 'duplicate',
        'export', 'alias', 'exit', 'quit',
      ];
      const aliasNames = Object.keys(ctx.aliases);
      const firstSpace = line.indexOf(' ');
      if (firstSpace === -1) {
        const hits = commands.filter((c) => c.startsWith(line));
        return [hits.length ? hits : commands, line];
      }
      const lastToken = line.slice(line.lastIndexOf(' ') + 1);
      const hits = aliasNames.filter((a) => a.startsWith(lastToken));
      return [hits, lastToken];
    },
  });

  // Sıralı komut işleme kuyruğu — pipe (non-TTY) modunda bile her komutun
  // sıra ile tamamlanmasını garanti eder; close event'inde queue boşalana
  // kadar bekleriz.
  const queue = [];
  let processing = false;
  let stdinEnded = false;

  async function drain() {
    if (processing) return;
    processing = true;
    while (queue.length) {
      const line = queue.shift();
      try {
        fs.appendFileSync(HISTORY_FILE, line + '\n');
      } catch (e) {}
      try {
        await runShellCommand(line, ctx);
      } catch (e) {
        console.error(chalk.red(e.message || e));
      }
      if (ctx.exit) break;
    }
    processing = false;
    if (ctx.exit || stdinEnded) {
      rl.close();
    } else {
      rl.prompt();
    }
  }

  rl.prompt();
  rl.on('line', (raw) => {
    const line = raw.trim();
    if (!line) {
      if (!processing) rl.prompt();
      return;
    }
    queue.push(line);
    drain();
  });
  rl.on('close', async () => {
    stdinEnded = true;
    if (processing || queue.length) {
      // Henüz drain bitmedi; bekle.
      const wait = () =>
        new Promise((resolve) => {
          const tick = () => {
            if (!processing && queue.length === 0) resolve();
            else setTimeout(tick, 10);
          };
          tick();
        });
      await wait();
    }
    await close();
    console.log(chalk.gray('Bağlantı kapatıldı.'));
    process.exit(0);
  });

  process.on('SIGINT', () => {
    rl.close();
  });
}

program
  .command('shell')
  .description(
    'Interaktif REPL — tek MongoDB bağlantısı, alias destekli. Çok daha hızlı.'
  )
  .action(() => {
    startShell().catch((err) => {
      console.error(chalk.red(err.message || err));
      process.exit(1);
    });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(err.message || err));
  process.exit(1);
});
