#!/usr/bin/env node
// Idiomas: que ningún texto se quede sin traducción (gate de push, sin navegador).
// El español es el código; el inglés vive en diccionarios español → inglés
// (ver viewer/src/05-i18n.js). Este chequeo falla si:
//   - un elemento `data-t`, un title/placeholder/aria-label/alt o un T`…` no
//     tiene entrada en el diccionario de su superficie;
//   - hay texto en el HTML fuera de un `data-t` (y fuera de `data-nt`, la marca
//     de «esto no se traduce»: marca, nombres propios, teclas);
//   - un literal de JS con letras españolas (á é í ó ú ñ ¿ ¡) no pasa por T
//     (salvo que su línea diga `i18n-ok`);
//   - el diccionario tiene entradas que ya nadie usa.
// Uso: node tools/check_i18n.mjs            comprueba el producto
//      node tools/check_i18n.mjs --mark f   propone marcas data-t para un HTML
//      node tools/check_i18n.mjs --list f   lista los literales de un JS
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RUNTIME = path.join(PRODUCT, 'viewer', 'src', '05-i18n.js');
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const INLINE = new Set(['b', 'i', 'em', 'strong', 'kbd', 'code', 'br', 'a', 'span', 'small', 'u', 'sup', 'sub', 'wbr']);
const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'wbr', 'source', 'col', 'area', 'base', 'embed', 'track']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lsaquo: '‹', rsaquo: '›', larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  ndash: '–', mdash: '—', middot: '·', times: '×', hellip: '…', laquo: '«', raquo: '»', bull: '•', check: '✓', minus: '−', copy: '©', deg: '°', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
const SPANISH = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
const WORDS = /\p{L}{2,}/u;
const norm = s => s.replace(/\s+/g, ' ').trim();
const decode = (s, where, problems) => s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  if (e in ENT) return ENT[e];
  problems.push(`${where}: entidad &${e}; desconocida para el chequeo (agrégala a ENT en tools/check_i18n.mjs)`);
  return m;
});
const lineOf = (src, pos) => src.slice(0, pos).split('\n').length;

/* ---------- JS: claves de T y literales sueltos ---------- */
export function scanJs(src, where, problems){
  const keys = [], loose = [];
  const cook = (raw, pos) => { try { return new Function('return `' + raw + '`')(); } catch (e){ problems.push(`${where}:${lineOf(src, pos)}: no se pudo leer el literal`); return raw; } };
  let i = 0, prev = '';          // prev: último token significativo, para distinguir regex de división
  const regexAllowed = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|in|of|do|else|void|delete|throw|new)$/.test(prev);
  function str(q){
    const start = i; i++;
    while (i < src.length && src[i] !== q){ if (src[i] === '\\') i++; i++; }
    i++;
    return { start, lit: src.slice(start, i) };
  }
  function template(tagged){
    const start = i; i++;
    const chunks = ['']; const subs = [];
    while (i < src.length && src[i] !== '`'){
      if (src[i] === '\\'){ chunks[chunks.length - 1] += src[i] + src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{'){
        i += 2; const from = i; code(true); subs.push(src.slice(from, i)); i++;
        chunks.push(''); continue;
      }
      chunks[chunks.length - 1] += src[i++];
    }
    i++;
    const cooked = chunks.map(c => cook(c, start));
    if (tagged) keys.push({ key: cooked.join('{}'), line: lineOf(src, start), n: subs.length });
    else for (const c of cooked) if (SPANISH.test(c)) loose.push({ text: norm(c).slice(0, 70), line: lineOf(src, start), pos: start });
  }
  function code(inSub){
    let depth = 0;
    while (i < src.length){
      const c = src[i];
      if (inSub && c === '}' && depth === 0) return;
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (c === '/' && src[i + 1] === '/'){ while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*'){ i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
      if (c === '/' && regexAllowed()){
        i++; let cls = false;
        while (i < src.length && (cls || src[i] !== '/') && src[i] !== '\n'){ if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; }
        i++; while (/[a-z]/.test(src[i] || '')) i++;
        prev = ')'; continue;
      }
      if (c === "'" || c === '"'){
        const { start, lit } = str(c);
        let val = lit.slice(1, -1);
        try { val = new Function('return ' + lit)(); } catch (e){}
        if (/(^|[^\w$.])T\($/.test(src.slice(Math.max(0, start - 3), start)) && /^\s*\)/.test(src.slice(i, i + 20))) keys.push({ key: val, line: lineOf(src, start), n: 0 });
        else if (SPANISH.test(val)) loose.push({ text: norm(val).slice(0, 70), line: lineOf(src, start), pos: start });
        prev = ')'; continue;
      }
      if (c === '`'){ template(/(^|[^\w$.])T$/.test(src.slice(Math.max(0, i - 2), i))); prev = ')'; continue; }
      if (/\s/.test(c)){ i++; continue; }
      if (/[\w$]/.test(c)){ const from = i; while (/[\w$]/.test(src[i] || '')) i++; prev = src.slice(from, i); continue; }
      prev = c; i++;
    }
  }
  code(false);
  const lines = src.split('\n');
  for (const l of loose) if (!/i18n-ok/.test(lines[l.line - 1])) problems.push(`${where}:${l.line}: texto en español sin T: «${l.text}»`);
  return keys;
}

/* ---------- HTML: unidades data-t, atributos y texto sin marcar ---------- */
export function scanHtml(src, where, problems, { mark = false } = {}){
  const keys = [], scripts = [], marks = [];
  const re = /<!--[\s\S]*?-->|<![^>]*>|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<\/?[a-zA-Z][^>]*>|[^<]+/g;
  const stack = []; let unit = null, m;
  const top = () => stack[stack.length - 1];
  while ((m = re.exec(src))){
    const tok = m[0], line = lineOf(src, m.index);
    if (tok.startsWith('<!') || /^<style/i.test(tok)) continue;
    if (/^<script/i.test(tok)){
      const open = tok.indexOf('>') + 1;
      if (!/\bsrc=/.test(tok.slice(0, open))) scripts.push({ src: tok.slice(open, tok.lastIndexOf('</script')), line });
      continue;
    }
    if (tok[0] !== '<'){
      const text = decode(tok, `${where}:${line}`, problems);
      if (unit){ unit.text += text; continue; }
      if (!WORDS.test(text) || stack.some(e => e.nt)) continue;
      if (top() && top().name === 'title'){ keys.push({ key: norm(text), line, optional: true }); continue; }
      if (mark && top()) top().direct = true;
      else problems.push(`${where}:${line}: texto fuera de data-t: «${norm(text).slice(0, 60)}»`);
      continue;
    }
    if (tok[1] === '/'){
      const name = tok.slice(2, -1).trim().toLowerCase();
      while (stack.length){
        const e = stack.pop();
        if (e === unit){ keys.push({ key: norm(unit.text), line: unit.line }); unit = null; }
        e.end = m.index;
        if (mark && e.direct){ if (e.block) problems.push(`${where}:${e.line}: <${e.name}> tiene texto junto a elementos con id o de bloque: envuelve ese texto en un <span data-t>`); else marks.push(e); }
        if (e.name === name) break;
      }
      continue;
    }
    const name = /^<([a-zA-Z0-9]+)/.exec(tok)[1].toLowerCase();
    const attrs = {};
    for (const a of tok.matchAll(/\s([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) attrs[a[1].toLowerCase()] = a[2] === undefined ? '' : a[2].replace(/^["']|["']$/g, '');
    const nt = 'data-nt' in attrs;
    for (const a of ATTRS) if (a in attrs){   // los atributos se traducen siempre: data-nt solo cubre el texto
      const v = norm(decode(attrs[a], `${where}:${line}`, problems));
      if (WORDS.test(v)) keys.push({ key: v, line, attr: a });
    }
    if (unit){
      if (!INLINE.has(name) || 'id' in attrs) problems.push(`${where}:${line}: <${name}${'id' in attrs ? ' id' : ''}> dentro de un data-t (línea ${unit.line}): solo formato en línea y sin id; parte la unidad`);
    }
    if (!INLINE.has(name) || 'id' in attrs) for (const up of stack) up.block = true;
    const e = { name, nt, line, pos: m.index, tag: tok, text: '' };
    if (!unit && 'data-t' in attrs) unit = e;
    if (!VOID.has(name) && !tok.endsWith('/>')) stack.push(e);
    else if (e === unit){ unit = null; }
  }
  return { keys, scripts, marks };
}

/* ---------- diccionarios ---------- */
// Evalúa el runtime real con los diccionarios y devuelve lo que add() juntó.
export function loadDict(sources, where, problems){
  const fake = { documentElement: {}, title: '', querySelectorAll: () => [] };
  try { return new Function('document', sources.join('\n;') + '\n;return I18N.dict;')(fake); }
  catch (e){ problems.push(`${where}: el diccionario no se pudo evaluar: ${e.message}`); return {}; }
}

/* ---------- una superficie: sus HTML, sus JS y sus diccionarios ---------- */
export function checkSurface({ name, html = [], js = [], dicts = [], ident = [] }, read = f => readFileSync(f, 'utf8')){
  const problems = [], used = new Set(), same = new Set(ident);
  const runtime = read(RUNTIME);
  const inline = [];           // <script> en línea: los que traen diccionario y los que traen código
  const wanted = [];
  for (const f of html){
    const rel = path.relative(PRODUCT, f);
    const { keys, scripts } = scanHtml(read(f), rel, problems);
    for (const k of keys) wanted.push({ ...k, where: rel });
    for (const s of scripts){
      if (/\bI18N\.add\(/.test(s.src)) inline.push(s.src);
      else for (const k of scanJs(s.src, `${rel} (script, línea ${s.line})`, problems)) wanted.push({ ...k, where: rel });
    }
  }
  for (const f of js){
    const rel = path.relative(PRODUCT, f);
    for (const k of scanJs(read(f), rel, problems)) wanted.push({ ...k, where: rel });
  }
  // un <script> en línea con diccionario ya trae su copia del runtime
  const dict = loadDict(inline.length ? inline : [runtime, ...dicts.map(read)], name, problems);
  for (const k of wanted){
    used.add(k.key);
    if (k.key in dict){
      const holes = (dict[k.key].match(/\{\d*\}/g) || []).length;
      if (k.n !== undefined && holes > k.n) problems.push(`${k.where}:${k.line}: la traducción de «${k.key.slice(0, 50)}» pide ${holes} valores y el texto da ${k.n}`);
    } else if (!k.optional && !same.has(k.key)) problems.push(`${k.where}:${k.line}: sin traducción: «${k.key}»${k.attr ? ` (${k.attr})` : ''}`);
  }
  for (const key of Object.keys(dict)) if (!used.has(key)) problems.push(`${name}: entrada del diccionario que ya nadie usa: «${key.slice(0, 70)}»`);
  return { problems, count: Object.keys(dict).length };
}

export function report(results){
  const problems = results.flatMap(r => r.problems);
  if (problems.length){ for (const p of problems) console.error('idiomas: ' + p); console.error(`idiomas: ${problems.length} problemas`); return 1; }
  console.log(`idiomas: ${results.reduce((n, r) => n + r.count, 0)} textos, todos con su traducción al inglés`);
  return 0;
}

const p = (...parts) => path.join(PRODUCT, ...parts);
export const PRODUCT_SURFACES = [
  { name: 'visor', html: [p('viewer', 'index.html')],
    js: ['10-core.js', '20-modes.js', '30-ui.js', '40-share.js', '45-test.js', '50-boot.js'].map(f => p('viewer', 'src', f)).concat(p('viewer', 'upload.js')),
    dicts: [p('viewer', 'src', '06-lang-upload.js'), p('viewer', 'src', '07-lang.js')], ident: ['gatos.pics', 'A', 'B'] },
  { name: 'creador', html: [p('app', 'index.html')],
    js: ['assets.js', 'builder.js', 'capture.js', 'publish.js', 'guide.js', 'zip.js', 's2.js'].map(f => p('app', f)).concat(p('viewer', 'upload.js')),
    dicts: [p('viewer', 'src', '06-lang-upload.js'), p('app', 'lang.js')], ident: ['gatos.pics'] },
];

if (process.argv[1] === fileURLToPath(import.meta.url)){
  const [mode, file] = process.argv.slice(2);
  if (mode === '--list'){
    const problems = []; const src = readFileSync(file, 'utf8');
    const srcJs = /\.html$/.test(file) ? scanHtml(src, file, []).scripts.map(s => s.src).join('\n') : src;
    for (const k of scanJs(srcJs, file, problems)) console.log(`T ${k.line}: ${k.key}`);
    for (const q of problems) console.log(q);
  } else if (mode === '--mark'){
    // marca con data-t cada elemento que tiene texto directo y solo formato en línea dentro
    const src = readFileSync(file, 'utf8'); const problems = [];
    const { marks } = scanHtml(src, file, problems, { mark: true });
    let out = src; let n = 0;
    for (const q of problems) console.log(q);
    for (const e of marks.sort((a, b) => b.pos - a.pos)){
      if (/\bdata-t\b/.test(e.tag) || marks.some(o => o !== e && o.pos < e.pos && o.end > e.pos)) continue;
      out = out.slice(0, e.pos) + e.tag.replace(/^<([a-zA-Z0-9]+)/, '<$1 data-t') + out.slice(e.pos + e.tag.length); n++;
    }
    writeFileSync(file, out);
    console.log(`${file}: ${n} elementos marcados; revisa los avisos del chequeo`);
  } else process.exit(report(PRODUCT_SURFACES.map(s => checkSurface(s))));
}
