import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { PageHeader, Result } from '../components/Layout';
import Modal from '../components/Modal';
import {
  COMPONENT_CATEGORIES,
  CATALOG_PATTERNS,
  HANDLEBARS_GUIDE,
  RAW_CATALOG,
  describeBlock,
  getComponentList,
} from '../lib/componentCatalog';

const COLOR_MAP = {
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  slate: 'bg-slate-700/40 text-slate-300 border-slate-700',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  pink: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  teal: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

function colorClass(c) {
  return COLOR_MAP[c] || COLOR_MAP.slate;
}

function groupByPage(instances) {
  const map = new Map();
  for (const inst of instances) {
    if (!map.has(inst.pageId)) {
      map.set(inst.pageId, {
        pageId: inst.pageId,
        pageTitle: inst.pageTitle,
        pageUrl: inst.pageUrl,
        pageType: inst.pageType,
        items: [],
      });
    }
    map.get(inst.pageId).items.push(inst);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.pageTitle.localeCompare(b.pageTitle, 'tr')
  );
}

const CATALOG_LIST = getComponentList();

export default function ComponentExplorer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [modalTab, setModalTab] = useState('usage');
  const [showGuide, setShowGuide] = useState(true);

  async function load(refresh = false) {
    setError(null);
    setLoading(true);
    try {
      const r = await api.componentUsage(refresh);
      setData(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const usageByType = useMemo(() => {
    const m = new Map();
    for (const c of data?.components || []) m.set(c.type, c);
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    let list = CATALOG_LIST.map((meta) => {
      const u = usageByType.get(meta.type);
      return {
        type: meta.type,
        inCatalog: true,
        count: u?.count ?? 0,
        pageCount: u?.pageCount ?? 0,
        instances: u?.instances ?? [],
      };
    });
    const unknown = (data?.components || []).filter((c) => !c.inCatalog);
    list = [...list, ...unknown];

    if (category !== 'all') {
      list = list.filter((c) => describeBlock(c.type).category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const meta = describeBlock(c.type);
        return (
          c.type.toLowerCase().includes(q) ||
          meta.label.toLowerCase().includes(q) ||
          meta.summary.toLowerCase().includes(q) ||
          (meta.whenToUse || '').toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [data, category, search, usageByType]);

  const selectedMeta = selected ? describeBlock(selected.type) : null;
  const rawComponent = selected
    ? RAW_CATALOG.components.find((c) => c.type === selected.type)
    : null;
  const pagesGrouped = selected ? groupByPage(selected.instances) : [];

  function openComponent(c) {
    setSelected(c);
    setModalTab('docs');
  }

  return (
    <div>
      <PageHeader
        title="Component Kataloğu"
        description="Tüm block tipleri, property şeması ve Handlebars kuralları. AI brief bu kataloğu kullanır (@data/component-catalog.json)."
        action={
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="btn-secondary"
          >
            {loading ? 'Taranıyor…' : 'Kullanımı yenile'}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span className="chip-slate font-mono">v{RAW_CATALOG.version}</span>
        <span className="chip-slate">{CATALOG_LIST.length} tip tanımlı</span>
        <a
          href="/docs/COMPONENTS_REFERENCE.md"
          className="text-indigo-400 hover:underline"
          onClick={(e) => e.preventDefault()}
          title="Proje kökünde docs/COMPONENTS_REFERENCE.md"
        >
          docs/COMPONENTS_REFERENCE.md
        </a>
      </div>

      {showGuide && (
        <div className="panel p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Handlebars & yaygın desenler
            </h3>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-300"
              onClick={() => setShowGuide(false)}
            >
              Gizle
            </button>
          </div>
          <p className="text-xs text-slate-400">{HANDLEBARS_GUIDE.engine}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(HANDLEBARS_GUIDE.syntax || []).map((s, i) => (
              <div
                key={i}
                className="text-[11px] font-mono bg-slate-950/60 border border-slate-800 rounded px-2 py-1.5"
              >
                <span className="text-indigo-300">{s.pattern}</span>
                <span className="text-slate-500 ml-2">{s.use}</span>
              </div>
            ))}
          </div>
          {HANDLEBARS_GUIDE.forbidden?.length > 0 && (
            <p className="text-[11px] text-rose-300/90">
              Yasak: {HANDLEBARS_GUIDE.forbidden.join(', ')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {CATALOG_PATTERNS.map((p) => (
              <span key={p.id} className="chip-indigo text-[10px]" title={p.templateRef}>
                {p.name}: {(p.blocks || []).join(' → ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {!showGuide && (
        <button
          type="button"
          className="text-xs text-indigo-400 mb-4 hover:underline"
          onClick={() => setShowGuide(true)}
        >
          Handlebars rehberini göster
        </button>
      )}

      {loading && (
        <div className="panel p-4 mb-6 text-sm text-slate-400">
          Canlı DB taranıyor — ilk seferde 30–60 sn sürebilir…
        </div>
      )}

      {data?.stats && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="chip-slate">{data.stats.totalPages} sayfa</span>
          <span className="chip-slate">
            {data.stats.pagesWithContent} içerikli
          </span>
          <span className="chip-indigo">{data.stats.totalBlocks} blok</span>
          <span className="chip-emerald">
            {data.stats.typesInUse} tip kullanımda
          </span>
          {data.scannedAt && (
            <span className="text-[10px] text-slate-500 self-center">
              {new Date(data.scannedAt).toLocaleString('tr-TR')}
              {data.cached ? ' (önbellek)' : ''}
            </span>
          )}
        </div>
      )}

      <div className="panel p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Ara</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="tip, isim, özet…"
          />
        </div>
        <div>
          <label className="label">Kategori</label>
          <select
            className="select min-w-[140px]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Tümü</option>
            {Object.entries(COMPONENT_CATEGORIES).map(([id, c]) => (
              <option key={id} value={id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((c) => {
          const meta = describeBlock(c.type);
          return (
            <button
              key={c.type}
              type="button"
              onClick={() => openComponent(c)}
              className="panel p-4 text-left hover:border-indigo-500/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={
                    'shrink-0 size-10 rounded-lg border grid place-items-center text-lg ' +
                    colorClass(meta.color)
                  }
                >
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-100 truncate">
                    {meta.label}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {c.type}
                  </div>
                  {!c.inCatalog && (
                    <span className="chip-rose mt-1">katalog dışı</span>
                  )}
                  {meta.aiPriority === 'high' && (
                    <span className="chip-indigo mt-1 ml-1">AI öncelik</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <span className={c.count > 0 ? 'chip-indigo' : 'chip-slate'}>
                  {c.count} kullanım
                </span>
                <span className="chip-slate">{c.pageCount} sayfa</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                {meta.summary}
              </p>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center text-slate-500 text-sm py-12">Sonuç yok.</div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selectedMeta?.label || selected?.type}
        subtitle={selected?.type}
        badge={
          selected && (
            <span className="chip-indigo">
              {selected.count} kullanım · {selected.pageCount} sayfa
            </span>
          )
        }
      >
        {selected && selectedMeta && (
          <div className="space-y-4">
            <div className="flex gap-1 border-b border-slate-800">
              <TabBtn
                active={modalTab === 'docs'}
                onClick={() => setModalTab('docs')}
                label="Kullanım rehberi"
              />
              <TabBtn
                active={modalTab === 'usage'}
                onClick={() => setModalTab('usage')}
                label="Canlı DB"
              />
              {rawComponent?.example && (
                <TabBtn
                  active={modalTab === 'example'}
                  onClick={() => setModalTab('example')}
                  label="Örnek JSON"
                />
              )}
            </div>

            {modalTab === 'docs' && (
              <DocsPane meta={selectedMeta} raw={rawComponent} />
            )}

            {modalTab === 'usage' && (
              <UsagePane
                selected={selected}
                meta={selectedMeta}
                pagesGrouped={pagesGrouped}
              />
            )}

            {modalTab === 'example' && rawComponent?.example && (
              <pre className="text-[10px] text-slate-300 font-mono bg-slate-950/60 border border-slate-800 rounded-lg p-3 max-h-[50vh] overflow-auto">
                {JSON.stringify(rawComponent.example, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Modal>

      <Result error={error} />
    </div>
  );
}

function TabBtn({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-2 text-xs font-medium border-b-2 -mb-px ' +
        (active
          ? 'text-indigo-300 border-indigo-400'
          : 'text-slate-400 border-transparent hover:text-slate-200')
      }
    >
      {label}
    </button>
  );
}

function DocsPane({ meta, raw }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-slate-400">{meta.summary}</p>
      {meta.whenToUse && (
        <div className="panel p-3 text-xs text-slate-300">
          <span className="font-semibold text-slate-200">Ne zaman: </span>
          {meta.whenToUse}
        </div>
      )}
      {meta.properties?.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Property şeması
          </h4>
          <table className="w-full text-[11px] border border-slate-800 rounded overflow-hidden">
            <thead>
              <tr className="bg-slate-900/80 text-slate-500">
                <th className="px-2 py-1 text-left">key</th>
                <th className="px-2 py-1 text-left">zorunlu</th>
                <th className="px-2 py-1 text-left">açıklama</th>
              </tr>
            </thead>
            <tbody>
              {meta.properties.map((p) => (
                <tr key={p.key} className="border-t border-slate-800">
                  <td className="px-2 py-1 font-mono text-indigo-300">{p.key}</td>
                  <td className="px-2 py-1 text-slate-500">
                    {p.required === true ? 'evet' : String(p.required || '—')}
                  </td>
                  <td className="px-2 py-1 text-slate-300">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(meta.childrenAllowed || raw?.childrenAllowed) && (
        <p className="text-xs text-slate-500">
          İzinli children:{' '}
          <code className="text-indigo-300">
            {(raw?.childrenAllowed || meta.childrenAllowed || []).join(', ')}
          </code>
        </p>
      )}
      {meta.docs?.length > 0 && (
        <ul className="text-[11px] text-slate-500 list-disc list-inside space-y-0.5">
          {meta.docs.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {raw?.settings && (
        <div>
          <h4 className="text-xs font-bold uppercase text-slate-400 mb-1">
            settings bayrakları
          </h4>
          <ul className="text-[11px] text-slate-500 space-y-0.5">
            {Object.entries(raw.settings).map(([k, v]) => (
              <li key={k}>
                <code className="text-indigo-300">{k}</code>: {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UsagePane({ selected, meta, pagesGrouped }) {
  if (selected.count === 0) {
    return (
      <div className="text-sm text-slate-500 italic py-8 text-center panel">
        Canlı DB'de bu component hiç kullanılmıyor.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {meta.docs?.length > 0 && (
        <ul className="text-[11px] text-slate-500 list-disc list-inside">
          {meta.docs.slice(0, 3).map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Kullanıldığı sayfalar
      </h4>
      {pagesGrouped.map((pg) => (
        <div
          key={pg.pageId}
          className="border border-slate-800 rounded-lg overflow-hidden"
        >
          <div className="px-3 py-2 bg-slate-900/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-100 truncate">
                {pg.pageTitle}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                /{pg.pageUrl} · {pg.pageId}
              </div>
            </div>
            <span className="chip-slate shrink-0">
              {pg.items.length}× bu sayfada
            </span>
          </div>
          <div className="divide-y divide-slate-800/80">
            {pg.items.map((inst, idx) => (
              <div key={idx} className="px-3 py-2 text-xs">
                {inst.displayName && (
                  <div className="text-slate-300 mb-1">{inst.displayName}</div>
                )}
                <DataFieldsTable fields={inst.dataFields} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataFieldsTable({ fields }) {
  const entries = Object.entries(fields || {});
  if (!entries.length) {
    return <span className="text-slate-600 italic">Özel alan yok</span>;
  }
  return (
    <table className="w-full text-[11px] border border-slate-800 rounded overflow-hidden">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-slate-800 last:border-0">
            <td className="px-2 py-1 font-mono text-indigo-300/90 align-top w-36">
              {k}
            </td>
            <td className="px-2 py-1 text-slate-300 break-all">
              <FieldValue value={v} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FieldValue({ value }) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    return <code className="text-[10px]">{JSON.stringify(value)}</code>;
  }
  return String(value);
}
