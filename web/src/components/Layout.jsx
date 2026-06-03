import React from 'react';

export function Layout({ tabs, current, onChange, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950/40">
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 grid place-items-center text-white font-bold text-sm shadow-lg shadow-indigo-500/30">
              H
            </div>
            <span className="font-semibold tracking-tight">Haustro Page Builder</span>
            <span className="chip-slate">galliardDb</span>
          </div>
          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={
                  'px-3 py-1.5 rounded-lg text-sm transition-colors ' +
                  (current === t.id
                    ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent')
                }
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>
      <footer className="text-center text-xs text-slate-600 py-4">
        canlı galliardDb · /api/* port 3000
      </footer>
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Result({ result, error }) {
  if (!result && !error) return null;
  return (
    <div
      className={
        'panel p-4 mt-6 ' +
        (error ? 'border-rose-500/40 bg-rose-500/5' : 'border-emerald-500/40 bg-emerald-500/5')
      }
    >
      <div
        className={
          'text-xs font-bold uppercase tracking-wider mb-2 ' +
          (error ? 'text-rose-300' : 'text-emerald-300')
        }
      >
        {error ? 'Hata' : 'Sonuç'}
      </div>
      <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">
        {error ? error : JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
