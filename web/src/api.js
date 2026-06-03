async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  aliases: () => request('/api/aliases'),
  templates: () => request('/api/templates'),
  template: (name) => request(`/api/templates/${encodeURIComponent(name)}`),
  pages: (parent) =>
    request(`/api/pages?parent=${encodeURIComponent(parent || '')}`),
  searchPages: (q, parent) =>
    request(
      `/api/pages/search?q=${encodeURIComponent(q)}` +
        (parent ? `&parent=${encodeURIComponent(parent)}` : '')
    ),
  page: (id) => request(`/api/pages/${encodeURIComponent(id)}`),
  createPage: (body) => request('/api/pages', { method: 'POST', body }),
  duplicatePage: (body) =>
    request('/api/pages/duplicate', { method: 'POST', body }),
  updateContent: (id, body) =>
    request(`/api/pages/${encodeURIComponent(id)}/content`, {
      method: 'PUT',
      body,
    }),
  exportTemplate: (body) =>
    request('/api/templates/export', { method: 'POST', body }),
  brief: (body) => request('/api/brief', { method: 'POST', body }),
  dataSourceSample: (body) =>
    request('/api/data-source/sample', { method: 'POST', body }),
  componentUsage: (refresh = false) =>
    request(
      '/api/components/usage' + (refresh ? '?refresh=1' : '')
    ),
  componentCatalog: () => request('/api/components/catalog'),
};
