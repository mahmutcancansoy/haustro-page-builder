/**
 * Component kataloğu — tek kaynak: data/component-catalog.json
 */
import catalogJson from '@haustro/catalog';

const raw = catalogJson;

function buildCatalogMap(components) {
  const map = {};
  for (const c of components) {
    map[c.type] = {
      label: c.label,
      icon: c.icon,
      color: c.color,
      category: c.category,
      summary: c.summary,
      renders: !!c.renders,
      isContainer: !!c.isContainer,
      keyProps: c.keyProps || [],
      docs: c.docs || [],
      whenToUse: c.whenToUse || '',
      example: c.example,
      properties: c.properties || [],
      childrenAllowed: c.childrenAllowed,
      parentTypes: c.parentTypes,
      aiPriority: c.aiPriority,
      contentField: c.contentField,
      isTextEditor: c.isTextEditor,
    };
  }
  return map;
}

export const RAW_CATALOG = raw;
export const COMPONENT_CATALOG = buildCatalogMap(raw.components);
export const COMPONENT_CATEGORIES = Object.fromEntries(
  Object.entries(raw.categories || {}).map(([id, c]) => [id, { label: c.label, color: c.color }])
);
export const CATALOG_PATTERNS = raw.patterns || [];
export const HANDLEBARS_GUIDE = raw.handlebars || {};

export function describeBlock(type) {
  return (
    COMPONENT_CATALOG[type] || {
      label: type,
      icon: '◻',
      color: 'slate',
      category: 'view',
      summary: 'Bilinmeyen / katalogda olmayan component tipi.',
      keyProps: [],
      docs: [],
      properties: [],
    }
  );
}

export function getComponentList() {
  return raw.components.map((c) => ({
    type: c.type,
    ...describeBlock(c.type),
    aiPriority: c.aiPriority,
  }));
}

export function propsToMap(properties = []) {
  const out = {};
  for (const p of properties || []) {
    if (!p || !p.key) continue;
    out[p.key] = p.value;
  }
  return out;
}

export function getDisplayName(block) {
  const m = propsToMap(block?.properties);
  return m['display-name'] || block?.type;
}

export function getVariableName(block) {
  const m = propsToMap(block?.properties);
  return m['variable-name'] || null;
}
