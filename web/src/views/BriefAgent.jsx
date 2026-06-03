import React, { useState } from 'react';
import { api } from '../api';
import { PageHeader, Result } from '../components/Layout';
import PageIdInput from '../components/PageIdInput';

function copy(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

export default function BriefAgent({ aliases }) {
  const [pageType, setPageType] = useState('sub');
  const [parentId, setParentId] = useState('mahmutcan');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [references, setReferences] = useState('');

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const r = await api.brief({
        pageType,
        parentId: pageType === 'sub' ? parentId : '',
        label,
        url,
        description,
        notes,
        references,
      });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await copy(result.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <PageHeader
        title="AI Brief"
        description="Temel sayfa bilgilerini ve açıklamayı yaz. Brief markdown workspace'e kaydedilir; üretilen prompt'u kopyalayıp kullandığın AI aracına yapıştırırsın."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 panel panel-glow p-6 space-y-4 self-start"
        >
          <div>
            <label className="label">Sayfa Tipi</label>
            <div className="flex gap-2">
              {[
                { id: 'sub', label: 'Sub (bir parent altında)' },
                { id: 'main', label: 'Main (root)' },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPageType(o.id)}
                  className={
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ' +
                    (pageType === o.id
                      ? 'bg-indigo-500 border-indigo-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700')
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {pageType === 'sub' && (
            <PageIdInput
              label="Parent sayfa"
              value={parentId}
              onChange={setParentId}
              aliases={aliases}
              required
            />
          )}

          <div>
            <label className="label">Label / Display name *</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Örn. Personel Performans Paneli"
              required
            />
          </div>

          <div>
            <label className="label">URL slug</label>
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="otomatik üretilir"
            />
          </div>

          <div>
            <label className="label">
              Açıklama / Brief *{' '}
              <span className="text-slate-500 normal-case font-normal">
                (prompt ve brief içinde yer alır)
              </span>
            </label>
            <textarea
              className="textarea min-h-[160px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder={`Örn:
- Inventory tablosundan tüm envanterleri çek
- Kategoriye göre grupla (:inventoryCats:category)
- Her grup için açılır accordion göster
- Her envanteri küçük bir satır olarak listele
- Sağda toplam adet badge'i olsun`}
            />
          </div>

          <div>
            <label className="label">Ek Notlar (opsiyonel)</label>
            <textarea
              className="textarea min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Stil tercihleri, performans kısıtları, vs."
            />
          </div>

          <div>
            <label className="label">Referans Sayfalar / Şablonlar (opsiyonel)</label>
            <textarea
              className="textarea min-h-[60px]"
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              placeholder={'Örn: templates/inventory-cards-content.json benzeri olsun'}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !label || !description || (pageType === 'sub' && !parentId)}
            className="btn-primary w-full"
          >
            {loading ? 'Brief üretiliyor…' : 'Brief Oluştur'}
          </button>
        </form>

        <section className="lg:col-span-3">
          {!result && !error && (
            <div className="panel p-8 text-center">
              <div className="text-slate-400 text-sm">
                Brief üretildikten sonra burada:
              </div>
              <ul className="mt-4 text-xs text-slate-500 space-y-1 inline-block text-left">
                <li>• Workspace'e kaydedilen markdown dosyasının yolu</li>
                <li>• Kopyalanabilir prompt metni</li>
                <li>• Brief sonrası çalıştırılacak `create-from-template` komutu</li>
              </ul>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="panel panel-glow p-5 border-emerald-500/30 bg-emerald-500/5">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
                  Brief hazır
                </div>
                <div className="text-sm text-slate-200">
                  <span className="font-mono text-emerald-300">
                    {result.briefRelative}
                  </span>{' '}
                  dosyası yazıldı.
                </div>
              </div>

              <div className="panel p-5">
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-slate-100">Prompt</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kopyalayıp AI aracına yapıştır (brief dosyasına @ ile
                      referans verir).
                    </p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={copied ? 'btn-secondary' : 'btn-primary'}
                  >
                    {copied ? '✓ Kopyalandı' : 'Prompt\'u Kopyala'}
                  </button>
                </div>
                <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono bg-slate-950/60 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {result.prompt}
                </pre>
              </div>

              <div className="panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-100">
                    Template'ler yazıldıktan sonra
                  </h3>
                  <button
                    onClick={() => copy(result.nextStep)}
                    className="btn-ghost text-xs"
                  >
                    Komutu Kopyala
                  </button>
                </div>
                <pre className="text-xs text-indigo-300 whitespace-pre-wrap break-all font-mono bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  {result.nextStep}
                </pre>
                <div className="text-[11px] text-slate-500 mt-2">
                  Bu komutu terminalde çalıştırınca sayfa canlı{' '}
                  <code>galliardDb</code>'ye kaydedilir (template name:{' '}
                  <code>{result.slug}</code>).
                </div>
              </div>

              <details className="panel p-5">
                <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                  Üretilen brief markdown'u
                </summary>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono mt-3 max-h-96 overflow-y-auto">
                  {result.markdown}
                </pre>
              </details>
            </div>
          )}

          <Result error={error} />
        </section>
      </div>
    </div>
  );
}
