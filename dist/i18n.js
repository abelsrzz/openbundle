const supported = ['es', 'en', 'fr', 'de', 'pt', 'it'];
const storageKey = 'openbundle-language';
let messages = {};
try {
  const response = await fetch(new URL('./locales/messages.json', import.meta.url));
  if (response.ok) messages = await response.json();
} catch { /* The Spanish source remains usable if translations cannot load. */ }
const available = ['es', ...supported.filter(code => code !== 'es' && messages[code])];
const validPreference = value => value === 'system' || available.includes(value) ? value : 'system';
function systemLanguage() {
  for (const candidate of navigator.languages || [navigator.language]) {
    const code = String(candidate).toLowerCase().split(/[-_]/)[0];
    if (available.includes(code)) return code;
  }
  return available.includes('en') ? 'en' : 'es';
}
let preference = 'system';
try { preference = validPreference(localStorage.getItem(storageKey)); } catch {}
export let language = preference === 'system' ? systemLanguage() : preference;
export function t(source, params = {}) {
  const template = language === 'es' ? source : messages[language]?.[source] ?? source;
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(params, key) ? String(params[key]) : match);
}
export function translateError(source) {
  if (messages.en?.[source]) return t(source);
  for (const translations of Object.values(messages)) {
    const entry = Object.entries(translations).find(([, value]) => value === source);
    if (entry) return t(entry[0]);
  }
  const savedSuffix = ' Selección guardada en este navegador.';
  if (source.endsWith(savedSuffix)) return translateError(source.slice(0, -savedSuffix.length)) + ' ' + t(savedSuffix.trim());
  if (language === 'es') return source;
  for (const key of Object.keys(messages.en || {}).filter(key => key.includes('{name}'))) {
    const escaped = key.split('{name}').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const match = source.match(new RegExp('^' + escaped.join('(.*?)') + '$'));
    if (match) return t(key, {name: match[1]});
  }
  return source;
}
// Preserve source text across repeated switches; never translate code or user data.
const originals = new WeakMap();
const originalAttributes = new WeakMap();
const sourceTitle = document.title;
export function translatePage() {
  const excluded = 'script,style,code,textarea,#catalog,#selected-list,#custom-list,#file-feedback,#pending-note,#size,#status,#visible-count,#category,#review-result,#review-status,#review-file-name,.catalog-index li';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement.closest(excluded)) continue;
    if (!originals.has(node)) originals.set(node, node.textContent);
    const source = originals.get(node);
    const trimmed = source.trim();
    if (trimmed) node.textContent = source.replace(trimmed, t(trimmed));
  }
  for (const element of document.querySelectorAll('[aria-label],[placeholder],[title]')) {
    if (element.closest('#catalog,#selected-list,#custom-list')) continue;
    if (!originalAttributes.has(element)) {
      const attrs = {};
      for (const attr of ['aria-label', 'placeholder', 'title']) if (element.hasAttribute(attr)) attrs[attr] = element.getAttribute(attr);
      originalAttributes.set(element, attrs);
    }
    for (const [attr, source] of Object.entries(originalAttributes.get(element))) element.setAttribute(attr, t(source));
  }
  document.title = t(sourceTitle);
  document.documentElement.lang = language;
  document.documentElement.dataset.languagePreference = preference;
  const select = document.getElementById('language-select');
  if (select) select.value = preference;
}
function apply() {
  language = preference === 'system' ? systemLanguage() : preference;
  translatePage();
  document.dispatchEvent(new CustomEvent('openbundle:languagechange'));
}
translatePage();
const select = document.getElementById('language-select');
if (select) select.addEventListener('change', () => {
  preference = validPreference(select.value);
  try {
    if (preference === 'system') localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, preference);
  } catch {}
  apply();
});
window.addEventListener('languagechange', () => { if (preference === 'system') apply(); });
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) { preference = validPreference(event.newValue); apply(); }
});
