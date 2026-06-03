import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import ListPages from './views/ListPages';
import BriefAgent from './views/BriefAgent';
import ComponentExplorer from './views/ComponentExplorer';
import { api } from './api';

const TABS = [
  { id: 'brief', label: '✨ AI Brief' },
  { id: 'components', label: 'Componentler' },
  { id: 'list', label: 'Listele' },
];

export default function App() {
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TABS.find((t) => t.id === hash)?.id || 'brief';
  });
  const [aliases, setAliases] = useState({});
  const [healthy, setHealthy] = useState(null);

  useEffect(() => {
    window.location.hash = tab;
  }, [tab]);

  useEffect(() => {
    api
      .aliases()
      .then((a) => {
        setAliases(a);
        setHealthy(true);
      })
      .catch(() => setHealthy(false));
  }, []);

  return (
    <Layout tabs={TABS} current={tab} onChange={setTab}>
      {healthy === false && (
        <div className="panel border-rose-500/40 bg-rose-500/5 p-4 mb-4 text-sm text-rose-200">
          API'ya ulaşılamıyor (<code>/api/aliases</code>). Server çalışıyor mu?
          Terminalde <code>npm run web</code>.
        </div>
      )}
      {tab === 'brief' && <BriefAgent aliases={aliases} />}
      {tab === 'components' && <ComponentExplorer />}
      {tab === 'list' && <ListPages aliases={aliases} />}
    </Layout>
  );
}
