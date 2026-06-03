function slugify(text) {
  const map = {
    ç: 'c',
    Ç: 'c',
    ğ: 'g',
    Ğ: 'g',
    ı: 'i',
    İ: 'i',
    ö: 'o',
    Ö: 'o',
    ş: 's',
    Ş: 's',
    ü: 'u',
    Ü: 'u',
  };
  return String(text)
    .trim()
    .split('')
    .map((ch) => map[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProperty(page, key) {
  const props = page.properties || [];
  return props.find((p) => p.key === key);
}

function getPropertyValue(page, key, fallback = '') {
  const prop = getProperty(page, key);
  return prop && prop.value != null ? String(prop.value) : fallback;
}

function setPropertyValue(page, key, value) {
  const props = page.properties || [];
  const prop = props.find((p) => p.key === key);
  if (prop) {
    prop.value = value;
    return;
  }
  props.push({
    key,
    type: 'input-text-property',
    header: key,
    value,
  });
  page.properties = props;
}

function pageTitle(page) {
  return (
    getPropertyValue(page, 'display-name') ||
    getPropertyValue(page, 'label') ||
    (page.properties && page.properties[0] && page.properties[0].value) ||
    '(isimsiz)'
  );
}

function pageUrl(page) {
  return getPropertyValue(page, 'url') || getPropertyValue(page, 'label') || '';
}

function stripMongoIds(doc) {
  const copy = JSON.parse(JSON.stringify(doc));
  delete copy._id;
  return copy;
}

function nowUtcDate() {
  return new Date();
}

module.exports = {
  slugify,
  getProperty,
  getPropertyValue,
  setPropertyValue,
  pageTitle,
  pageUrl,
  stripMongoIds,
  nowUtcDate,
};
