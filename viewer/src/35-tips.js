/* ---------- tarjetas al pasar el mouse (gatos-ops#394) ----------
   El tooltip del navegador (title) se va solo a los pocos segundos en algunos
   sistemas: los textos largos no se alcanzaban a leer. En pantallas con mouse,
   el primer mouseover pasa el title a data-tip (así el del navegador nunca sale)
   y, tras una pausa corta, se muestra una tarjeta que se queda mientras el
   puntero esté encima. El texto sigue para los lectores de pantalla en
   aria-description. Los botones principales tienen un texto más completo
   (TIPS, traducidos al cargar); el resto muestra su title tal cual, con la tecla «(X)» del final
   como atajo. En pantallas táctiles no cambia nada: ahí está la ayuda «?». */
const TIPS = {
  diffBtn: ['Diff', 'D', T('Muestra solo lo que cambia entre las dos versiones, amplificado. El color dice en qué canal difieren; Intensidad y Calor ajustan cuánto se ve.')],
  heatBtn: [T('Calor'), 'H', T('Pinta de rojo lo que difiere más que un umbral: dónde están las diferencias, de un vistazo.')],
  blinkBtn: [T('Parpadeo'), 'B', T('Alterna izquierda y derecha en el mismo lugar, dos veces por segundo. Lo que cambia entre las versiones salta a la vista.')],
  testBtn: [T('Prueba ciega'), 'G', T('Un juego aparte: compara las versiones de a pares sin saber cuál es cuál y elige la que se ve mejor. Al final se revela cuál era cada una.')],
  solarBtn: ['Solar', 'L', T('Exagera los cambios pequeños de brillo. Sirve para ver banding, bloques y sombras aplastadas que a simple vista casi no se notan.')],
  cropBtn: [T('Recortes'), 'C', T('Haz clic en un punto y compara ese recorte 1:1 en todas las versiones a la vez.')],
  oneBtn: ['1:1', 'O', T('Un píxel de la imagen es un píxel de tu pantalla: el tamaño real, sin escalar.')],
  pixBtn: [T('Nítido'), 'N', T('Al hacer zoom, cada píxel se ve como un cuadrado nítido en vez de suavizado: para inspeccionar píxel por píxel.')],
  resetBtn: [T('Ajustar'), 'F', T('Vuelve a mostrar la imagen entera.')],
  shareBtn: [T('Compartir'), '', T('El enlace a esta vista, el código para foros (BBCode), Markdown, HTML y la imagen de lo que ves.')],
  helpBtn: [T('Ayuda'), '?', T('Todos los atajos de teclado y los controles.')],
  swapBtn: [T('Intercambiar'), 'S', T('Pasa la versión de la izquierda a la derecha y la de la derecha a la izquierda.')],
};
const tipCard = document.createElement('div');
tipCard.id = 'tipCard'; tipCard.setAttribute('role', 'tooltip'); tipCard.hidden = true;
document.body.appendChild(tipCard);
const HOVER_MQ = matchMedia('(hover: hover) and (pointer: fine)');
let tipFor = null, tipTimer = null;
function tipText(el){
  const own = TIPS[el.id];
  if (own) return {name: own[0], key: own[1], text: own[2]};
  const m = el.dataset.tip.match(/^(.*?)\s*\(([^()]{1,9})\)$/);
  return m ? {name: '', key: m[2], text: m[1]} : {name: '', key: '', text: el.dataset.tip};
}
function showHoverTip(el){
  if (!el.isConnected || cmdPinned) return;
  const t = tipText(el);
  tipCard.replaceChildren();
  if (t.name || t.key){
    const h = document.createElement('div'); h.className = 'th';
    if (t.name){ const b = document.createElement('b'); b.textContent = t.name; h.appendChild(b); }
    if (t.key){ const k = document.createElement('kbd'); k.textContent = t.key; h.appendChild(k); }
    tipCard.appendChild(h);
  }
  const p = document.createElement('p'); p.textContent = t.text; tipCard.appendChild(p);
  tipCard.hidden = false;
  const r = el.getBoundingClientRect(), w = tipCard.offsetWidth, h = tipCard.offsetHeight;
  tipCard.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
  tipCard.style.top = (r.bottom + 8 + h > innerHeight - 8 ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px';
}
function hideHoverTip(){ clearTimeout(tipTimer); tipFor = null; tipCard.hidden = true; }
document.addEventListener('mouseover', e => {
  if (!HOVER_MQ.matches) return;
  const el = e.target.closest && e.target.closest('[title], [data-tip]');
  if (el === tipFor) return;
  hideHoverTip();
  if (!el) return;
  if (el.hasAttribute('title')){
    el.dataset.tip = el.title;
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-description')) el.setAttribute('aria-description', el.title);
    el.removeAttribute('title');
  }
  if (!el.dataset.tip) return;
  tipFor = el;
  tipTimer = setTimeout(() => showHoverTip(el), 350);
});
document.addEventListener('mouseout', e => { if (!e.relatedTarget) hideHoverTip(); });
for (const ev of ['mousedown', 'keydown', 'wheel', 'scroll']) window.addEventListener(ev, hideHoverTip, {capture: true, passive: true});
