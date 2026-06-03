import React, { useEffect } from 'react';

/**
 * Tam ekran overlay + kaydırılabilir içerik paneli.
 */
export default function Modal({ open, onClose, title, subtitle, badge, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Kapat"
      />
      <div className="relative w-full max-w-4xl max-h-[min(90vh,900px)] flex flex-col panel panel-glow border-slate-700/80 shadow-2xl">
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0 flex-1">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-slate-100 truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge}
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost size-9 p-0 rounded-lg text-slate-400 hover:text-slate-100"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">{children}</div>
      </div>
    </div>
  );
}
