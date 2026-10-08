/* i18n: español (fuente) e inglés. El idioma sale del navegador, sin red y sin
   guardar nada de quien visita; el interruptor manual vive en localStorage.

   El español ES el código. Cada texto visible lleva su traducción en un
   diccionario español → inglés:
   - HTML fijo: el elemento lleva `data-t`; su clave es su texto (sin etiquetas)
     y la traducción es su innerHTML en inglés. title, placeholder, aria-label
     y alt se buscan por su valor.
   - JS: T`Texto con ${valor}` (clave: 'Texto con {}') o T('Texto').
   Sin entrada, queda el español. tools/check_i18n.mjs (gate de push) exige
   que cada clave tenga traducción y que ningún texto quede sin marcar. */
'use strict';
const I18N = (() => {
  const dict = Object.create(null), miss = new Set();
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const ok = l => l === 'es' || l === 'en';
  const lang = (() => {
    if (ok(globalThis.GATOS_LANG)) return globalThis.GATOS_LANG;
    try { const q = new URLSearchParams(location.search).get('lang'); if (ok(q)) return q; } catch (e){}
    try { const s = localStorage.getItem('gatos.lang'); if (ok(s)) return s; } catch (e){}
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (const l of list){ const p = String(l).toLowerCase().slice(0, 2); if (ok(p)) return p; }
    return 'en';
  })();
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  const find = key => {
    if (lang === 'es') return undefined;
    const v = dict[key];
    if (v === undefined) miss.add(key);
    return v;
  };
  function t(strings, ...vals){
    if (typeof strings === 'string'){ const v = find(strings); return v === undefined ? strings : v; }
    const tpl = find(strings.join('{}'));
    if (tpl === undefined) return strings.reduce((out, s, i) => out + vals[i - 1] + s);
    let n = 0;
    return tpl.replace(/\{(\d*)\}/g, (m, d) => vals[d === '' ? n++ : +d]);
  }
  function apply(root = document){
    document.documentElement.lang = lang === 'es' ? 'es-419' : 'en';
    if (lang === 'es') return;
    for (const el of root.querySelectorAll('[data-t]')){ const v = find(norm(el.textContent)); if (v !== undefined) el.innerHTML = v; }
    for (const a of ATTRS) for (const el of root.querySelectorAll('[' + a + ']')){ const v = dict[norm(el.getAttribute(a))]; if (v !== undefined) el.setAttribute(a, v); }
    if (root === document){ const v = dict[norm(document.title)]; if (v !== undefined) document.title = v; }
  }
  // el interruptor: recuerda la elección en este navegador y recarga
  function set(l){
    if (!ok(l) || l === lang) return;
    try { localStorage.setItem('gatos.lang', l); } catch (e){}
    try { const u = new URL(location.href); if (u.searchParams.has('lang')){ u.searchParams.delete('lang'); location.replace(u.href); return; } } catch (e){}
    location.reload();
  }
  // enlaces [data-lang="es|en"]: se marca el idioma actual y el otro lo cambia
  function wire(root = document){
    for (const el of root.querySelectorAll('[data-lang]')){
      const l = el.dataset.lang;
      if (l === lang) el.setAttribute('aria-current', 'true');
      el.addEventListener('click', e => { e.preventDefault(); set(l); });
    }
  }
  return { lang, dict, miss, t, apply, set, wire, add: o => Object.assign(dict, o) };
})();
const T = I18N.t;
