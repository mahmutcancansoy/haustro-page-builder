import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { PageHeader, Result } from '../components/Layout';
import Modal from '../components/Modal';
import PageIdInput from '../components/PageIdInput';
import {
  COMPONENT_CATALOG,
  describeBlock,
} from '../lib/componentCatalog';
import {
  buildContext,
  renderTemplate,
  wrapForIframe,
} from '../lib/previewRenderer';

const TAILWIND_COLOR_MAP = {
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
  return TAILWIND_COLOR_MAP[c] || TAILWIND_COLOR_MAP.slate;
}

export default function ListPages({ aliases }) {
  const [parentId, setParentId] = useState('mahmutcan');
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalPageId, setModalPageId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState('components');
  const [useLive, setUseLive] = useState(false);
  const [liveData, setLiveData] = useState({});
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = query
        ? await api.searchPages(query, parentId || undefined)
        : await api.pages(parentId);
      setPages(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeModal() {
    setModalPageId(null);
    setDetail(null);
    setDetailLoading(false);
    setLiveData({});
    setUseLive(false);
    setLiveError(null);
  }

  async function openDetail(id) {
    setModalPageId(id);
    setError(null);
    setDetail(null);
    setLiveData({});
    setUseLive(false);
    setLiveError(null);
    setTab('components');
    setDetailLoading(true);
    try {
      const d = await api.page(id);
      setDetail(d);
    } catch (e) {
      setError(e.message);
      closeModal();
    } finally {
      setDetailLoading(false);
    }
  }

  const blocks = detail?.content?.blocks || [];
  const flatBlocks = useMemo(() => flatten(blocks), [blocks]);
  const dataSources = useMemo(
    () => flatBlocks.filter((b) => b.type === 'data-source'),
    [flatBlocks]
  );

  async function toggleLiveData(next) {
    setUseLive(next);
    setLiveError(null);
    if (!next || !dataSources.length) {
      setLiveData({});
      return;
    }
    setLiveLoading(true);
    const fetched = {};
    try {
      for (const ds of dataSources) {
        if (!ds.tableName || !ds.variableName) continue;
        try {
          const r = await api.dataSourceSample({
            tableName: ds.tableName,
            filter: ds.props['table-filters'] || '{}',
            limit: 6,
          });
          fetched[ds.variableName] = r.rows || [];
        } catch (e) {
          fetched[ds.variableName] = [];
          setLiveError(`${ds.tableName}: ${e.message}`);
        }
      }
      setLiveData(fetched);
    } finally {
      setLiveLoading(false);
    }
  }

  const previewCtx = useMemo(
    () => buildContext(flatBlocks, useLive ? liveData : {}),
    [flatBlocks, liveData, useLive]
  );

  const renderBlocks = useMemo(
    () => flatBlocks.filter((b) => b.type === 'render-template'),
    [flatBlocks]
  );

  return (
    <div>
      <PageHeader
        title="Sayfaları Listele"
        description="Parent altındaki alt sayfaları gör. Bir karta tıkla → modalda componentler ve önizleme."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="panel p-4 space-y-3 self-start">
          <PageIdInput
            label="Parent sayfa"
            value={parentId}
            onChange={setParentId}
            aliases={aliases}
          />
          <div>
            <label className="label">İsim ara (opsiyonel)</label>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="örn. envanter, render"
            />
          </div>
          <button onClick={load} className="btn-primary w-full" disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Listele / Ara'}
          </button>
          <div className="text-[11px] text-slate-500">
            {pages.length} sayfa bulundu
          </div>
        </aside>

        <section className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pages.map((p) => {
              const active = modalPageId === p._id;
              return (
                <button
                  key={p._id}
                  onClick={() => openDetail(p._id)}
                  className={
                    'panel p-4 text-left hover:border-indigo-500/40 transition-colors ' +
                    (active ? 'border-indigo-500/60 bg-indigo-500/5' : '')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-100 line-clamp-1">
                      {p.title}
                    </div>
                    <span
                      className={p.type === 'main' ? 'chip-indigo' : 'chip-slate'}
                    >
                      {p.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {p._id}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">/{p.url}</div>
                </button>
              );
            })}
            {pages.length === 0 && !loading && (
              <div className="col-span-full text-sm text-slate-500 italic p-6 text-center">
                Sonuç yok.
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={modalPageId !== null}
        onClose={closeModal}
        title={
          detailLoading
            ? 'Yükleniyor…'
            : detail?.page?.title || 'Sayfa detayı'
        }
        subtitle={
          detail?.page
            ? `${detail.page._id} · /${detail.page.url} · type=${detail.page.type}`
            : modalPageId
            ? modalPageId
            : ''
        }
        badge={
          detailLoading ? (
            <span className="chip-indigo animate-pulse">yükleniyor</span>
          ) : detail?.content ? (
            <span className="chip-emerald">
              {detail.content.blocks.length} kök blok
              {detail.content.hasStyles ? ' + styles' : ''}
            </span>
          ) : detail ? (
            <span className="chip-rose">içerik yok</span>
          ) : null
        }
      >
        {detailLoading && (
          <div className="py-16 text-center text-slate-400 text-sm">
            Sayfa içeriği yükleniyor…
          </div>
        )}

        {detail && !detailLoading && (
          <>
            <div className="flex gap-1 border-b border-slate-800 mb-4 sticky top-0 bg-slate-900/95 backdrop-blur z-10 -mx-1 px-1">
              <TabButton
                active={tab === 'components'}
                onClick={() => setTab('components')}
                label={`Componentler (${flatBlocks.length})`}
              />
              <TabButton
                active={tab === 'preview'}
                onClick={() => setTab('preview')}
                label={`Önizleme (${renderBlocks.length})`}
                disabled={renderBlocks.length === 0}
              />
              <TabButton
                active={tab === 'raw'}
                onClick={() => setTab('raw')}
                label="Ham JSON"
              />
            </div>

            {tab === 'components' && (
              <ComponentList blocks={blocks} depth={0} />
            )}

            {tab === 'preview' && (
              <PreviewPane
                renderBlocks={renderBlocks}
                ctx={previewCtx}
                styles={detail.content?.styles}
                useLive={useLive}
                toggleLive={toggleLiveData}
                liveLoading={liveLoading}
                liveError={liveError}
                dataSources={dataSources}
              />
            )}

            {tab === 'raw' && (
              <pre className="text-[11px] text-slate-400 font-mono bg-slate-950/60 border border-slate-800 rounded-lg p-3 max-h-[min(50vh,400px)] overflow-auto">
                {JSON.stringify(blocks, null, 2)}
              </pre>
            )}
          </>
        )}
      </Modal>

      <Result error={error} />
    </div>
  );
}

function TabButton({ active, onClick, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ' +
        (disabled
          ? 'text-slate-600 border-transparent cursor-not-allowed'
          : active
          ? 'text-indigo-300 border-indigo-400'
          : 'text-slate-400 border-transparent hover:text-slate-200')
      }
    >
      {label}
    </button>
  );
}

function ComponentList({ blocks, depth }) {
  if (!blocks?.length) {
    return (
      <div className="text-sm text-slate-500 italic p-4 text-center">
        İçerik yok.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <ComponentCard key={i} block={b} depth={depth} />
      ))}
    </div>
  );
}

function ComponentCard({ block, depth }) {
  const cat = describeBlock(block.type);
  const [expanded, setExpanded] = useState(false);
  const isKnown = !!COMPONENT_CATALOG[block.type];
  return (
    <div
      className="rounded-lg border border-slate-800 bg-slate-950/40"
      style={{ marginLeft: depth * 16 }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-slate-900/40 rounded-lg"
      >
        <div
          className={
            'shrink-0 size-9 rounded-lg border grid place-items-center text-base ' +
            colorClass(cat.color)
          }
        >
          {cat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-100">{cat.label}</span>
            <span className="text-[10px] font-mono text-slate-500">
              {block.type}
            </span>
            {!isKnown && (
              <span className="chip-rose">katalog dışı</span>
            )}
            {block.variableName && (
              <span className="chip-indigo">
                var={block.variableName}
              </span>
            )}
            {block.tableName && (
              <span className="chip-slate">
                table={block.tableName}
              </span>
            )}
          </div>
          {block.displayName && (
            <div className="text-xs text-slate-300 mt-0.5">
              {block.displayName}
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-1">{cat.summary}</div>
        </div>
        <span className="text-slate-500 text-xs shrink-0">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800/60">
          {cat.docs?.length > 0 && (
            <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5 mt-2">
              {cat.docs.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          <KeyPropsTable props={block.props} highlight={cat.keyProps} />
          {block.content && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-300 font-medium">
                İnline HTML / template
                <span className="ml-2 text-slate-500">
                  {block.content.length} char
                </span>
              </summary>
              <pre className="text-[10px] text-slate-400 font-mono bg-slate-950/60 border border-slate-800 rounded-lg p-2 mt-2 max-h-60 overflow-auto whitespace-pre-wrap">
                {block.content}
              </pre>
            </details>
          )}
          {block.children?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                children ({block.children.length})
              </div>
              <ComponentList blocks={block.children} depth={depth + 1} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KeyPropsTable({ props, highlight = [] }) {
  const entries = Object.entries(props || {});
  if (!entries.length) return null;
  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <table className="w-full text-[11px]">
        <tbody>
          {entries.map(([k, v]) => {
            const isKey = highlight.includes(k);
            return (
              <tr key={k} className="border-b border-slate-800 last:border-0">
                <td
                  className={
                    'px-2 py-1 font-mono align-top w-40 ' +
                    (isKey ? 'text-indigo-300 font-bold' : 'text-slate-400')
                  }
                >
                  {k}
                </td>
                <td className="px-2 py-1 text-slate-200 break-all">
                  <PropValue value={v} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PropValue({ value }) {
  if (value === null || value === undefined)
    return <span className="text-slate-600">—</span>;
  if (typeof value === 'string') {
    if (value.length > 120) {
      return (
        <details>
          <summary className="cursor-pointer text-slate-400">
            {value.slice(0, 80)}…
          </summary>
          <pre className="whitespace-pre-wrap mt-1">{value}</pre>
        </details>
      );
    }
    return <span>{value}</span>;
  }
  if (typeof value === 'object') {
    return (
      <code className="text-[10px] text-slate-400">
        {JSON.stringify(value).slice(0, 200)}
      </code>
    );
  }
  return <span>{String(value)}</span>;
}

function PreviewPane({
  renderBlocks,
  ctx,
  styles,
  useLive,
  toggleLive,
  liveLoading,
  liveError,
  dataSources,
}) {
  if (!renderBlocks.length) {
    return (
      <div className="text-sm text-slate-500 italic p-4 text-center">
        Bu sayfada `render-template` componenti yok.
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-xs text-slate-400">
          {dataSources.length === 0
            ? 'Veri kaynağı yok — sadece statik HTML.'
            : `${dataSources.length} data-source: ${dataSources
                .map((d) => d.variableName)
                .join(', ')}`}
        </div>
        {dataSources.length > 0 && (
          <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
            <input
              type="checkbox"
              checked={useLive}
              onChange={(e) => toggleLive(e.target.checked)}
              className="accent-indigo-500"
            />
            <span className="text-slate-300">
              {useLive ? 'Canlı veri' : 'Mock veri'}
            </span>
            {liveLoading && (
              <span className="text-[10px] text-slate-500">yükleniyor…</span>
            )}
          </label>
        )}
      </div>
      {liveError && (
        <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded p-2 mb-2">
          {liveError}
        </div>
      )}
      <div className="space-y-4">
        {renderBlocks.map((b, i) => (
          <RenderTemplatePreview
            key={i}
            block={b}
            ctx={ctx}
            pageStyles={styles}
          />
        ))}
      </div>
    </div>
  );
}

function RenderTemplatePreview({ block, ctx, pageStyles }) {
  const { html, error } = useMemo(
    () => renderTemplate(block.content, ctx),
    [block.content, ctx]
  );
  const srcdoc = useMemo(() => wrapForIframe(html, pageStyles), [html, pageStyles]);
  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
      <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={'chip ' + colorClass('emerald')}>render-template</span>
          {block.displayName && (
            <span className="text-slate-300">{block.displayName}</span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          {block.content?.length || 0} char
        </div>
      </div>
      {error ? (
        <div className="p-3 text-xs text-rose-300 bg-rose-500/5">
          Render hatası: {error}
        </div>
      ) : (
        <iframe
          title={block.displayName || 'preview'}
          sandbox=""
          srcDoc={srcdoc}
          className="w-full"
          style={{ minHeight: 360, background: '#fff', border: 0 }}
        />
      )}
    </div>
  );
}

function flatten(blocks) {
  const out = [];
  function walk(list) {
    for (const b of list || []) {
      out.push(b);
      if (b.children?.length) walk(b.children);
    }
  }
  walk(blocks);
  return out;
}
