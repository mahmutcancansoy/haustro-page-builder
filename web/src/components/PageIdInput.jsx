import React, { useState, useMemo } from 'react';

/**
 * Alias destekli sayfa id girişi. Kullanıcı alias adı (örn. "mahmutcan") ya da
 * direkt 24 karakterlik Mongo _id yazabilir. Otomatik öneri açılır listesi
 * görüntülenir.
 */
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export default function PageIdInput({
  label,
  value,
  onChange,
  aliases,
  placeholder = 'alias veya 24 char id',
  required,
}) {
  const [focus, setFocus] = useState(false);
  const matches = useMemo(() => {
    if (!aliases) return [];
    const q = (value || '').toLowerCase();
    return Object.entries(aliases)
      .filter(([k, v]) => k.toLowerCase().includes(q) || v.includes(q))
      .slice(0, 8);
  }, [aliases, value]);

  const resolved = aliases?.[value];
  const effectiveId = resolved || value || '';
  const isEmpty = !value || !String(value).trim();
  const isValid = isEmpty || OBJECT_ID_RE.test(effectiveId);
  const showInvalid = !isEmpty && !isValid && !focus;

  return (
    <div className="relative">
      <label className="label">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      <input
        type="text"
        className={
          'input ' +
          (showInvalid ? 'border-rose-500/60 focus:ring-rose-500/40' : '')
        }
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {resolved && (
        <div className="text-[10px] text-emerald-400/80 mt-1 font-mono">
          → {resolved}
        </div>
      )}
      {showInvalid && (
        <div className="text-[10px] text-rose-400 mt-1">
          Geçersiz ID. 24 karakterlik hex veya tanımlı alias ({Object.keys(aliases || {}).slice(0, 4).join(', ')}, …) gerekiyor.
        </div>
      )}
      {focus && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 panel z-10 max-h-64 overflow-y-auto">
          {matches.map(([k, v]) => (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(k);
                setFocus(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-3"
            >
              <span className="font-medium text-sm text-slate-200">{k}</span>
              <span className="text-[10px] font-mono text-slate-500">{v}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
