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

/* Inglés de viewer/upload.js: lo comparten el visor y el creador. */
I18N.add({
  'Preparación cancelada. No se inició el envío.': 'Preparation cancelled. Nothing was sent.',
  'Preparando el envío…': 'Preparing the upload…',
  'Iniciando el envío…': 'Starting the upload…',
  'No se pudo confirmar el resultado.': 'The result could not be confirmed.',
  'Enviando: {} de {} ({} %).': 'Uploading: {} of {} ({}%).',
  'Enviando: {}.': 'Uploading: {}.',
  'Envío completo. Esperando confirmación del servidor…': 'Upload complete. Waiting for the server to confirm…',
  'Envío cancelado.': 'Upload cancelled.',
  'Se agotó el tiempo de espera.': 'The request timed out.',
  'El servidor confirmó el envío.': 'The server confirmed the upload.',
  'No se pudo enviar (HTTP {}).': 'Could not send (HTTP {}).',
  'Espera antes de reintentar.': 'Wait before retrying.',
  'No se pudo iniciar el envío: {}': 'Could not start the upload: {}',
});

/* Inglés del visor: el HTML de viewer/index.html y los textos de las partes
   10 a 50. Al final se traduce la página, antes de que el motor tome sus
   elementos. */
I18N.add({
  // barra de herramientas
  'Frame anterior': 'Previous frame',
  'Frame siguiente': 'Next frame',
  'Herramientas de comparación': 'Comparison tools',
  'Diferencia amplificada por canal (D)': 'Per-channel amplified difference (D)',
  'Curva solar: revela banding y degradados (L)': 'Solar curve: reveals banding and gradients (L)',
  'Intensidad': 'Gain',
  'Resaltar diferencias en rojo (H)': 'Highlight differences in red (H)',
  'Calor': 'Heat',
  'Parpadeo izquierda/derecha (B)': 'Blink left/right (B)',
  'Parpadeo': 'Blink',
  'Ciego': 'Blind',
  'Elige un punto e inspecciona recortes 1:1 de todas las variantes (C)': 'Pick a point and inspect 1:1 crops of every variant (C)',
  'Recortes': 'Crops',
  '1:1 real en píxeles del dispositivo (O)': 'True 1:1 in device pixels (O)',
  'Escala con píxeles nítidos al hacer zoom (N)': 'Scale with sharp pixels when zooming (N)',
  'Nítido': 'Sharp',
  'Reiniciar zoom (F)': 'Reset zoom (F)',
  'Ajustar': 'Fit',
  'Compartir: link, BBCode para foros, Markdown y HTML': 'Share: link, BBCode for forums, Markdown and HTML',
  'Compartir': 'Share',
  'Atajos y controles (?)': 'Shortcuts and controls (?)',
  'Ayuda y atajos': 'Help and shortcuts',
  'Reportar esta página': 'Report this page',
  'Reportar': 'Report',
  'Izquierda': 'Left',
  'Derecha': 'Right',
  'Desplazar la lista': 'Scroll the list',
  'Variante izquierda': 'Left variant',
  'Variante derecha': 'Right variant',
  'Comando del encoder': 'Encoder command',
  'Ver el comando de la variante izquierda': 'Show the left variant\'s command',
  'Ver el comando de la variante derecha': 'Show the right variant\'s command',
  'Intercambiar izquierda y derecha (S)': 'Swap left and right (S)',
  // la comparación
  'Esta variante no tiene este cuadro': 'This variant does not have this frame',
  'ajustar': 'fit',
  'PARPADEO A/B': 'BLINK A/B',
  'haz clic en un punto (o muévelo con las flechas) para ver recortes 1:1': 'click a point (or move it with the arrow keys) to see 1:1 crops',
  'Recortes 1:1': '1:1 crops',
  'cerrar (Esc)': 'close (Esc)',
  // pie: atajos
  '←→ frame': '<kbd>←</kbd><kbd>→</kbd> frame',
  '1–9 variante (Shift = izquierda)': '<kbd>1</kbd>–<kbd>9</kbd> variant (<kbd>Shift</kbd> = left)',
  'S intercambiar': '<kbd>S</kbd> swap',
  'D diff': '<kbd>D</kbd> diff',
  'B parpadeo': '<kbd>B</kbd> blink',
  'C recortes': '<kbd>C</kbd> crops',
  'F ajustar': '<kbd>F</kbd> fit',
  '+/- ganancia': '<kbd>+</kbd>/<kbd>-</kbd> gain',
  'H calor': '<kbd>H</kbd> heat',
  'Espacio siguiente variante': '<kbd>Space</kbd> next variant',
  'N nítido': '<kbd>N</kbd> sharp',
  'L solar': '<kbd>L</kbd> solar',
  ',/. divisor': '<kbd>,</kbd>/<kbd>.</kbd> divider',
  'zoom con rueda/pellizco · arrastra para mover · doble clic ajusta': 'wheel or pinch to zoom · drag to move · double click to fit',
  // ayuda
  'Atajos y controles': 'Shortcuts and controls',
  'Cerrar (Esc)': 'Close (Esc)',
  'Frame anterior o siguiente.': 'Previous or next frame.',
  'Espacio': 'Space',
  'Siguiente variante a la derecha.': 'Next variant on the right.',
  '1 a 9': '<kbd>1</kbd> to <kbd>9</kbd>',
  'Elegir variante a la derecha. Con Shift, a la izquierda.': 'Pick the variant on the right. With Shift, on the left.',
  'Intercambiar izquierda y derecha.': 'Swap left and right.',
  'Activar o desactivar la diferencia amplificada.': 'Turn the amplified difference on or off.',
  'Aumentar o reducir la intensidad del diff.': 'Raise or lower the diff gain.',
  'Activar o desactivar el mapa de calor del diff.': 'Turn the diff heat map on or off.',
  'Activar o desactivar el parpadeo A/B.': 'Turn A/B blink on or off.',
  'Activar o desactivar la curva solar.': 'Turn the solar curve on or off.',
  'Elegir un punto para ver recortes 1:1. Con el modo activo, las flechas siembran y mueven el punto; con Shift, en pasos de 10 px.': 'Pick a point to see 1:1 crops. While the mode is on, the arrow keys place and move the point; with Shift, in 10 px steps.',
  'Ver un píxel de imagen por píxel del dispositivo.': 'Show one image pixel per device pixel.',
  'Ajustar la imagen al área disponible.': 'Fit the image to the available area.',
  'Alternar escala suave y píxeles nítidos.': 'Switch between smooth scaling and sharp pixels.',
  'Mover el divisor. Con Shift, moverlo en pasos mayores.': 'Move the divider. With Shift, in larger steps.',
  'Abrir esta ayuda.': 'Open this help.',
  'Cerrar ayuda, Compartir, comandos o recortes.': 'Close help, Share, commands or crops.',
  'Rueda o pellizco: zoom. Arrastra la imagen ampliada para moverla. Doble clic: ajustar. Mantén el cursor sobre una variante para consultar su comando, si tiene uno.': 'Wheel or pinch: zoom. Drag the zoomed image to move it. Double click: fit. Hover over a variant to see its command, if it has one.',
  'Teléfono: desliza para cambiar de frame, pellizca para acercar, cmd muestra el comando.': 'Phone: swipe to change frame, pinch to zoom, <b>cmd</b> shows the command.',
  'Los atajos no cambian la comparación mientras escribes en un campo.': 'Shortcuts do not change the comparison while you type in a field.',
  // reportar
  'Reportar página': 'Report page',
  'Contenido inapropiado': 'Inappropriate content',
  'Material ajeno / derechos': 'Someone else\'s material / copyright',
  'Spam o engaño': 'Spam or scam',
  'Otro': 'Other',
  'detalle (opcional)': 'details (optional)',
  'Enviar reporte': 'Send report',
  'Cerrar': 'Close',
  'Enviando…': 'Sending…',
  'Reporte enviado. Gracias.': 'Report sent. Thank you.',
  'No se pudo enviar: {}': 'Could not send: {}',
  // compartir
  'Compartir comparación': 'Share comparison',
  'Guarda la comparación visible como PNG sin pérdida. El enlace conserva el frame, las variantes y los ajustes.': 'Saves the visible comparison as a lossless PNG. The link keeps the frame, the variants and the settings.',
  'La imagen conserva el modo ciego. El enlace abre la comparación sin la asignación privada de esta sesión.': 'The image keeps blind mode. The link opens the comparison without this session\'s private assignment.',
  'vista a compartir': 'view to share',
  'Llave de borrado del autor': 'Author\'s delete key',
  'La recibiste al publicar': 'You received it when you published',
  'usar la llave guardada (esta sesión)': 'use the saved key (this session)',
  'Solo el autor puede reemplazar la imagen compartida. La nueva imagen aparecerá también en los enlaces que ya publicaste.': 'Only the author can replace the shared image. The new image will also show in the links you already posted.',
  'Descargar PNG': 'Download PNG',
  'sube esta imagen exacta a gatos.pics y arma el BBCode para foros': 'uploads this exact image to gatos.pics and builds the BBCode for forums',
  'Subir y obtener BBCode': 'Upload and get BBCode',
  'Progreso del envío de la imagen': 'Image upload progress',
  'Cancelar envío': 'Cancel upload',
  'Reintentar esta imagen': 'Retry this image',
  'Borrar esta página…': 'Delete this page…',
  'Enlace a esta vista': 'Link to this view',
  'copiado ✓': 'copied ✓',
  'seleccionado: Ctrl+C': 'selected: Ctrl+C',
  'No se pudo generar el PNG.': 'Could not create the PNG.',
  'pega la llave de borrado para poder eliminar la página': 'paste the delete key to remove the page',
  '¿Borrar esta página y su imagen compartida? No se puede deshacer.': 'Delete this page and its shared image? This cannot be undone.',
  'Borrando…': 'Deleting…',
  'Página borrada.': 'Page deleted.',
  'No se pudo borrar: {}': 'Could not delete: {}',
  'La imagen pudo actualizarse. Reintentar reemplaza la misma URL.': 'The image may have been updated. Retrying replaces the same URL.',
  // sumar una versión a una página publicada (gatos-ops#342)
  'Añadir una versión…': 'Add a version…',
  'Sube una imagen por frame, del mismo tamaño que las de la página, con tu llave de borrado. Se ordenan por nombre de archivo y van a los frames en este orden:': "Upload one picture per frame, the same size as the page's, with your delete key. They are sorted by file name and go to the frames in this order:",
  'Nombre de la versión': 'Version name',
  'Imágenes (una por frame)': 'Pictures (one per frame)',
  'Añadir a la página': 'Add to the page',
  'Progreso del envío de la versión': 'Version upload progress',
  'Reintentar el envío': 'Retry the upload',
  'No se pudo leer {}.': 'Could not read {}.',
  'La página ya tiene {} versiones, el máximo.': 'The page already has {} versions, the maximum.',
  'Elige {} imágenes, una por frame.': 'Choose {} pictures, one per frame.',
  'Elegiste {} imágenes y la página tiene {} frames.': 'You chose {} pictures and the page has {} frames.',
  'No se pudo leer {} como imagen.': 'Could not read {} as a picture.',
  '{} mide {}x{} y las imágenes de la página {}x{}.': "{} is {}x{} and the page's pictures are {}x{}.",
  'Ponle un nombre a la versión.': 'Give the version a name.',
  'Listo para enviar: {} imágenes, {} MiB.': 'Ready to send: {} pictures, {} MiB.',
  'Reintentar es seguro: vuelve a sumar la misma versión.': 'Retrying is safe: it adds the same version again.',
  'Versión añadida. Recargando la página…': 'Version added. Reloading the page…',
  'BBCode (foros, la vista exacta clicable)': 'BBCode (forums, the exact view, clickable)',
  'Imagen directa': 'Direct image',
  'Ingresa la llave que recibiste al publicar.': 'Enter the key you received when you published.',
  'No se puede compartir: una imagen no cargó.': 'Cannot share: an image did not load.',
  'Espera a que terminen de cargar las dos imágenes.': 'Wait for both images to finish loading.',
  'No se puede compartir el diff: revisa las dimensiones de las imágenes.': 'Cannot share the diff: check the image dimensions.',
  // prueba ciega
  'Prueba ciega': 'Blind test',
  'Prueba ciega: compara todas las versiones de a pares sin saber cuál es cuál, y mira cuál gana (G)': 'Blind test: compare every version in pairs without knowing which is which, and see which one wins (G)',
  'G prueba ciega': '<kbd>G</kbd> blind test',
  'Abrir la prueba ciega: todas las versiones de a pares, sin saber cuál es cuál.': 'Open the blind test: every version in pairs, without knowing which is which.',
  'Se ve mejor la de la izquierda (←)': 'The left one looks better (←)',
  'Se ve mejor la de la derecha (→)': 'The right one looks better (→)',
  'No veo diferencia (↑)': 'I see no difference (↑)',
  'Empate': 'Tie',
  'Volver a la comparación anterior (Retroceso)': 'Go back to the previous comparison (Backspace)',
  'Atrás': 'Back',
  'Salir de la prueba': 'Leave the test',
  'Variante {}': 'Variant {}',
  'Fuente': 'Source',
  'Recargar la página': 'Reload the page',
  'Marcar dónde': 'Mark where',
  'Opcional: marcar en la imagen dónde viste la diferencia': 'Optional: mark on the picture where you saw the difference',
  'Punto marcado ✓': 'Spot marked ✓',
  'Toca la imagen…': 'Tap the picture…',
  'En esta página algunas comparaciones se repiten o son de control: sirven para saber qué tan firmes son las respuestas y no cambian tu resultado.': 'On this page some comparisons are repeated or are controls: they show how firm the answers are and do not change your result.',
  'Se repitieron {} comparaciones con los lados cambiados: elegiste la misma versión en {}.': '{} comparisons were repeated with the sides swapped: you chose the same version in {}.',
  'En la comparación de control (la misma versión en los dos lados) dijiste empate: bien visto.': 'In the control comparison (the same version on both sides) you said tie: well spotted.',
  'En la comparación de control los dos lados eran la misma versión, y elegiste uno.': 'In the control comparison both sides were the same version, and you picked one.',
  '¿Por qué?': 'Why?',
  'Opcional: decir qué notaste en esta comparación': 'Optional: say what you noticed in this comparison',
  'Opcional, antes de elegir: ¿qué notaste?': 'Optional, before you choose: what did you notice?',
  'Nitidez': 'Sharpness',
  'Más grano o ruido': 'More grain or noise',
  'Menos grano o ruido': 'Less grain or noise',
  'Bloques': 'Blocking',
  'Bandas': 'Banding',
  'Color': 'Colour',
  'Movimiento borroso': 'Blur in motion',
  'Otra cosa': 'Something else',
  'Nota corta (opcional, sin datos personales)': 'Short note (optional, no personal details)',
  'Qué se guarda': 'What is stored',
  'Privacidad de la prueba ciega': 'Blind test privacy',
  'Qué se guarda:': 'What is stored:',
  'tus respuestas (qué lado elegiste en cada comparación), lo que marques o escribas en «¿Por qué?», cuánto tardaste en cada respuesta y la hora del envío, redondeada al minuto.': 'your answers (which side you chose in each comparison), anything you tick or type under "Why?", how long each answer took, and the time it was sent, rounded to the minute.',
  'Qué no se guarda:': 'What is not stored:',
  'tu dirección, tu navegador, una cuenta ni cookies de seguimiento. Tu resultado no lleva nada que diga quién eres. La dirección se usa un momento para frenar abusos y no se guarda.': 'your address, your browser, an account or tracking cookies. Your result carries nothing that says who you are. The address is used for a moment to limit abuse and is not stored.',
  'Quién lo ve:': 'Who sees it:',
  'la tabla con los totales es pública. El detalle (respuestas, motivos y notas) solo lo ve quien publicó la página.': 'the table of totals is public. The detail (answers, reasons and notes) is seen only by whoever published the page.',
  'Hasta cuándo:': 'For how long:',
  'mientras exista la página, o hasta que quien la publicó reinicie sus resultados.': 'for as long as the page exists, or until its publisher resets its results.',
  'En tu navegador queda una marca para que repetir la prueba reemplace tu resultado en vez de sumar otro. Si escribes una nota, no pongas datos personales.': 'Your browser keeps a mark so that repeating the test replaces your result instead of adding another. If you write a note, do not include personal details.',
  'Volver': 'Back',
  'Al terminar, tu resultado se suma a la tabla de todos.': 'When you finish, your result is added to everyone\'s standings.',
  'Tu resultado se sumó a la tabla de todos.': 'Your result was added to everyone\'s standings.',
  'Tus respuestas, comparación por comparación': 'Your answers, comparison by comparison',
  'Cuadro': 'Frame',
  'Elegiste': 'You chose',
  'La comparación que buscabas ya no existe. Mientras tanto: gatos.': 'The comparison you were looking for no longer exists. Meanwhile: cats.',
  'Cerrar este aviso': 'Close this notice',
  'En esta página las versiones no tienen la misma área de imagen: durante la prueba solo se ve la parte que todas comparten.': 'On this page the versions do not have the same picture area: during the test you only see the part they all share.',
  'Ya enviaste un resultado de esta página desde este navegador: si terminas esta prueba, el nuevo reemplaza al anterior.': 'You already sent a result for this page from this browser: if you finish this test, the new one replaces the earlier one.',
  'Tu resultado reemplazó en la tabla de todos al que habías enviado antes desde este navegador.': 'Your result replaced, in everyone\'s standings, the one you had sent before from this browser.',
  'Preparando la prueba…': 'Preparing the test…',
  'Esta página cambió desde que la abriste. Recárgala para hacer la prueba con las versiones de ahora.': 'This page changed since you opened it. Reload it to take the test with the current versions.',
  'la página cambió desde que la abriste': 'the page changed since you opened it',
  'Llegaron demasiados resultados desde tu conexión en la última hora: este no se sumó.': 'Too many results came from your connection in the last hour: this one was not added.',
  'La página cambió de versiones mientras hacías la prueba: este resultado no se sumó. Recarga la página para hacer la prueba con las versiones de ahora.': 'The page\'s versions changed while you were taking the test: this result was not added. Reload the page to take the test with the current versions.',
  'Vas a ordenar las {} versiones de mejor a peor sin saber cuál es cuál. En cada comparación solo ves «izquierda» y «derecha»: nada dice qué versión es ni si ya la viste antes.': 'You will rank the {} versions from best to worst without knowing which is which. Each comparison only shows "left" and "right": nothing says which version it is or whether you have seen it before.',
  'En cada una eliges la que se ve mejor, o empate. Puedes usar zoom, diff y parpadeo.': 'In each one you pick the one that looks better, or a tie. You can use zoom, diff and blink.',
  'Comparación {} · como mucho {} · ¿cuál se ve mejor?': 'Comparison {} · {} at most · which looks better?',
  'comparaciones ganadas, empatadas y perdidas': 'comparisons won, tied and lost',
  'Respondiste {} comparaciones.': 'You answered {} comparisons.',
  'Respondiste {} comparaciones nuevas; las otras {} vienen de tu resultado anterior.': 'You answered {} new comparisons; the other {} come from your earlier result.',
  'Los pares que no viste se ordenaron con tus respuestas: si una le gana a otra y esa a una tercera, la primera va antes.': 'The pairs you did not see were ordered from your answers: if one beats another and that one beats a third, the first goes ahead.',
  'de antes': 'earlier',
  'Si la página tiene versiones nuevas desde entonces, puedes comparar solo esas.': 'If the page has new versions since then, you can compare just those.',
  'Versiones sin comparar': 'Versions not compared yet',
  'Desde tu resultado anterior esta página tiene 1 versión sin comparar (nueva, o con imágenes nuevas).': 'Since your earlier result this page has 1 version you have not compared (new, or with new pictures).',
  'Desde tu resultado anterior esta página tiene {} versiones sin comparar (nuevas, o con imágenes nuevas).': 'Since your earlier result this page has {} versions you have not compared (new, or with new pictures).',
  'Puedes comparar solo esas con las que ya ordenaste: se reusan tus {} comparaciones de antes y son como mucho {} comparaciones nuevas. Tu resultado nuevo reemplaza al anterior.': 'You can compare just those against the ones you already ranked: your {} earlier comparisons are reused, with {} new ones at most. Your new result replaces the earlier one.',
  'Comparar solo lo nuevo': 'Compare only what is new',
  'Toda la prueba otra vez': 'The whole test again',
  'Ordenada por la probabilidad de ganarle a una versión promedio, con todas las comparaciones de todas las pruebas. Con pocas comparaciones ese número todavía dice poco.': 'Sorted by the chance of beating an average version, using every comparison of every test. With few comparisons that number still says little.',
  'Puntuación': 'Score',
  'probabilidad de ganarle a una versión promedio': 'chance of beating an average version',
  'Comparaciones': 'Comparisons',
  'pocas comparaciones': 'few comparisons',
  'Son como mucho {} comparaciones.': 'It takes {} comparisons at most.',
  'Son como mucho {} comparaciones, y suelen ser bastantes menos: la prueba elige cada una según lo que vas respondiendo y se detiene cuando el orden queda claro.': 'It takes {} comparisons at most, and usually far fewer: the test picks each one from your answers so far and stops when the order is settled.',
  'Empezar': 'Start',
  'Ver la tabla de todos': 'See everyone\'s standings',
  'Cancelar': 'Cancel',
  'Ver la tabla antes de hacer la prueba condiciona tu juicio.': 'Seeing the standings before taking the test will bias your judgment.',
  '¿Salir de la prueba? Se pierde lo que llevas.': 'Leave the test? Your answers so far will be lost.',
  'Tu resultado': 'Your result',
  'Puesto': 'Place',
  'Versión': 'Version',
  'G-E-P': 'W-T-L',
  'Ya enviaste un resultado de esta página desde este navegador: esta prueba no se suma otra vez.': 'You already sent a result for this page from this browser: this test will not be added again.',
  'Esta copia no está publicada en gatos.pics: el resultado no se envía.': 'This copy is not published on gatos.pics: the result is not sent.',
  'Ya habías enviado un resultado de esta página desde este navegador: este no se sumó.': 'You had already sent a result for this page from this browser: this one was not added.',
  'Sumando tu resultado a la tabla de todos…': 'Adding your result to everyone\'s standings…',
  'No se pudo enviar tu resultado: {}': 'Could not send your result: {}',
  'Reintentar el envío': 'Retry sending',
  'Enviando tus respuestas para saber qué versión era cada una…': 'Sending your answers to find out which version each one was…',
  'Repetir la prueba': 'Take the test again',
  'Ya hay suficientes respuestas': 'That is enough to rank them',
  'Con tus {} respuestas ya se pueden ordenar las versiones. Puedes ver tu resultado ahora o seguir con {} comparaciones más entre las que van arriba: si sigues, tu resultado se actualiza al terminar.': 'With your {} answers the versions can already be ordered. You can see your result now or keep going with {} more comparisons among the ones at the top: if you do, your result is updated at the end.',
  'Ver mi resultado': 'See my result',
  'Seguir comparando las mejores': 'Keep comparing the best ones',
  'Prueba ciega a medias': 'Unfinished blind test',
  'Se comparan:': 'Being compared:',
  'Copiar enlace a la prueba': 'Copy link to this test',
  'Copia el enlace que abre esta página directo en la prueba ciega': 'Copies the link that opens this page straight on the blind test',
  'Copia este enlace:': 'Copy this link:',
  'Enlace directo a la prueba ciega': 'Direct link to the blind test',
  'Dejaste una prueba ciega sin terminar en esta página, con 1 respuesta.': 'You left a blind test unfinished on this page, with 1 answer.',
  'Dejaste una prueba ciega sin terminar en esta página, con {} respuestas.': 'You left a blind test unfinished on this page, with {} answers.',
  'Puedes seguir donde ibas.': 'You can carry on where you stopped.',
  'Seguir la prueba': 'Continue the test',
  'Empezar otra': 'Start another',
  'Ahora no': 'Not now',
  'La prueba que dejaste ya venció: hay que empezar otra.': 'The test you left has expired: you need to start another.',
  'Tabla de todos': 'Everyone\'s standings',
  '1 prueba enviada.': '1 test sent.',
  '{} pruebas enviadas.': '{} tests sent.',
  'Volver a mi resultado': 'Back to my result',
  'Ver': 'View',
  'Abre esta comparación otra vez, con las mismas versiones a cada lado': 'Opens this comparison again, with the same versions on each side',
  'Comparación {} de {}:': 'Comparison {} of {}:',
  'dijiste empate': 'you said tie',
  'elegiste': 'you picked',
  'izquierda': 'left',
  'derecha': 'right',
  'Una comparación de tu prueba': 'One comparison from your test',
  'Hacer la prueba': 'Take the test',
  'No se pudo leer la tabla: {}': 'Could not read the standings: {}',
  // estado y modos
  'Comparación': 'Comparison',
  'Comparación a ciegas': 'Blind comparison',
  'manifest inválido: JSON truncado o malformado': 'invalid manifest: truncated or malformed JSON',
  'manifest inválido: faltan frames o hay menos de 2 variantes': 'invalid manifest: frames are missing or there are fewer than 2 variants',
  'no se encontraron datos de comparación (sin paquete embebido, sin manifest.json)': 'no comparison data found (no embedded package, no manifest.json)',
  'la imagen no cargó': 'the image did not load',
  'la imagen derecha no cargó': 'the right image did not load',
  'cargando…': 'loading…',
  'Diff no disponible: una variante no tiene este cuadro.': 'Diff unavailable: a variant does not have this frame.',
  'Diff no disponible: una imagen no cargó.': 'Diff unavailable: an image did not load.',
  'Diff no disponible: las imágenes tienen dimensiones distintas.': 'Diff unavailable: the images have different dimensions.',
  'Diff: cargando…': 'Diff: loading…',
  ' · calor (Δ≥{} en rojo)': ' · heat (Δ≥{} in red)',
  ' · calor': ' · heat',
  'Diff ×{}{} · color = canal que difiere · Δ media {}/255': 'Diff ×{}{} · color = channel that differs · mean Δ {}/255',
  'Diff ×{}{} · Δ media {}/255': 'Diff ×{}{} · mean Δ {}/255',
  'Diff ×{} · calculando…': 'Diff ×{} · computing…',
  'Parpadeo A/B': 'Blink A/B',
  'sin este cuadro': 'no such frame',
  'S2 media {}': 'S2 mean {}',
  'Recortes 1:1 @ {},{} (px nativos)': '1:1 crops @ {},{} (native px)',
  'izq.': 'left',
  'der.': 'right',
  ' y ': ' and ',
  ' · sin este cuadro: {}': ' · missing this frame: {}',
  'Frame {} · CIEGO{}': 'Frame {} · BLIND{}',
  'Frame {} · izquierda: {} · derecha: {} · CIEGO{}': 'Frame {} · left: {} · right: {} · BLIND{}',
  'Inicio del clip {} · ': 'Clip start {} · ',
  'CIEGO': 'BLIND',
  'PARPADEO': 'BLINK',
  '{}Frame {} (#{}{}) · izq. {} · der. {}{}{}': '{}Frame {} (#{}{}) · left {} · right {}{}{}',
  'en ámbar lo que difiere de <b>{}</b>': 'in amber, what differs from <b>{}</b>',
  'comando': 'command',
  'Copiar': 'Copy',
  'Copiado ✓': 'Copied ✓',
  'Falló la copia': 'Copy failed',
});
I18N.apply();
I18N.wire();

/* gatos.pics compare engine (after the i18n parts 05-07).
   Two data sources, picked at boot:
   - Embedded: window.GATOS_PACKAGE = {format, manifest, images:{"<id>_<frame>": dataURL}}
     Set by a self-contained export or by the builder preview. Works from file://
     with zero network: images become object URLs (canvas-safe, so diff and
     1:1 crops keep working).
   - Http: manifest.json + img/<id>_<frame>.<ext> next to this page (classic
     static hosting). version -> ?v= cache busting for immutable image caches. */
const $ = id => document.getElementById(id);
const comp = $('comp'), imgA = $('imgA'), imgB = $('imgB'), diffCanvas = $('diffCanvas');
const paneA = $('paneA'), paneB = $('paneB');
const labelA = $('labelA'), labelB = $('labelB');
const labelAName = $('labelAName'), labelBName = $('labelBName');
const statsA = $('statsA'), statsB = $('statsB');
const divider = $('divider'), zoomBadge = $('zoomBadge'), diffNote = $('diffNote');
const modeBadge = $('modeBadge'), cropHint = $('cropHint'), cropPanel = $('cropPanel');
const cropRows = $('cropRows'), cropTitle = $('cropTitle');
const diffBtn = $('diffBtn'), blinkBtn = $('blinkBtn'), cropBtn = $('cropBtn');
const pixBtn = $('pixBtn');
const solarBtn = $('solarBtn');
const metaLine = $('metaLine'), pageTitle = $('pageTitle');
let originalTitle = T('Comparación');
const diffCtx = diffCanvas.getContext('2d', {willReadFrequently:true});

let FRAMES = [], VARIANTS = [];
let FRAME_LABELS = {}, FRAME_META = {};
let BLIND_CFG = {};    // opciones de la prueba ciega de esta página (gatos-ops#312): { repeat: 1|2, control: true }
let FRAME_AREAS = {};   // por cuadro, el área [x, y, ancho, alto] que todas las versiones tienen con imagen (gatos-ops#305)
let VERSION = '', CLIP = {};
const AMPLIFY_DEFAULT_IDX = 1;
const GAINS = [5, 10, 20, 40];
const HEAT_T = 4;

/* ---------- data sources ---------- */
function makeHttpSource(){
  return {
    async init(){
      const r = await fetch('manifest.json?t='+Date.now(), {cache:'no-store'});
      if (!r.ok) throw new Error('manifest.json HTTP '+r.status);
      let m;
      try { m = await r.json(); }
      catch(e){ throw Object.assign(new Error(T('manifest inválido: JSON truncado o malformado')), {manifestInvalid:true}); }
      VERSION = String(m?.version || '');
      return m;
    },
    srcFor(id, f){
      const ext = own(variant(id).image_exts, String(f)) || variant(id).ext || 'webp';
      return `img/${id}_${f}.${ext}${VERSION ? '?v='+VERSION : ''}`;
    }
  };
}
function makeEmbeddedSource(pkg){
  const urls = new Map();   // "<id>_<frame>" -> Promise<objectURL>
  function toObjectURL(dataurl){
    const parts = dataurl.split(',');
    const mime = (parts[0].match(/^data:([^;]+)/) || [,'image/png'])[1];
    const bin = atob(parts[1] || '');
    const buf = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([buf], {type:mime}));
  }
  // gatolocoses/gatos.pics#7: fetch(dataURL).blob() decodifica base64 en
  // código nativo y asíncrono (el bucle atob+byte a byte congelaba cada
  // interacción) y soltar la dataURL tras convertir evita que un paquete viva
  // dos veces en RAM. En about:srcdoc (vista previa del creador hospedado) la
  // CSP heredada bloquea connect-src data: y el intento ensuciaría consola:
  // ahí y ante cualquier fallo de fetch se decodifica síncrono como antes.
  async function convert(d, key){
    if (location.href !== 'about:srcdoc'){
      try {
        const u = URL.createObjectURL(await (await fetch(d)).blob());
        pkg.images[key] = null;
        return u;
      } catch(e){ /* sin fetch de data:: decodificador de respaldo síncrono */ }
    }
    try { const u = toObjectURL(d); pkg.images[key] = null; return u; } catch(e){ return ''; }
  }
  return {
    async init(){ return pkg.manifest; },
    srcFor(id, f){
      const key = id+'_'+f;
      if (!urls.has(key)){
        const d = pkg.images && pkg.images[key];
        urls.set(key, d ? convert(d, key) : Promise.resolve(''));
      }
      return urls.get(key);
    }
  };
}
const SOURCE = (typeof window !== 'undefined' && window.GATOS_PACKAGE)
  ? makeEmbeddedSource(window.GATOS_PACKAGE)
  : makeHttpSource();
// Opening another saved fragment in the same tab restores the complete view.
// Internal state writes use replaceState, which does not fire hashchange.
window.addEventListener('hashchange', () => location.reload());

let frame = null, varA = null, varB = null;
// modo teléfono del shell (misma consulta que su CSS): decide dónde se abre el
// panel de comando; la geometría no depende de esto
const PHONE_MQ = matchMedia('(max-width:820px), (pointer:coarse) and (max-height:520px)');
let diffMode = false, blinkMode = false, heat = false, gainIdx = AMPLIFY_DEFAULT_IDX;
let cropMode = false, cropUV = null;
let pendingCropFraction = null;
let dividerPos = 0.5;
let zoom = 1;                       // 1 = fit
let pan = {x:0, y:0};               // viewport-space px offset of the content rect
let fitScale = 1, rw = 0, rh = 0, ox = 0, oy = 0;
let drag = null, pinch = null;
let swipe = null;   // un dedo sobre la vista ajustada: deslizar a los lados cambia de frame
const pointers = new Map();
const realB = new Image();          // offscreen holder for B's true pixels (diff)
let diffData = null;                // cached abs-diff planes for current pair
// Carrera de generaciones: al cambiar de par, .src ya apunta a lo NUEVO
// mientras los pixeles siguen siendo los VIEJOS (complete=true), y el primer
// load que llega difunde A_nuevo−B_viejo y lo cachea bajo la clave nueva.
// La autoridad es la URL que cada lado TERMINO de cargar (la registra su
// handler de load); el diff solo se calcula cuando ambos lados coinciden
// con la URL actual del par.
let loadedUrlA = null, loadedUrlB = null;   // URLs que cada lado termino de cargar (A: imgA, B: realB)
let loadedUrlPaneB = null;                 // imgB carga sola fuera de diff: asentamiento propio (ops#24)
// Fallo de carga del par actual (ops#2): el panel afectado se vacia con
// estado de error visible y las etiquetas revierten al par asentado.
let loadFailA = false, loadFailB = false;
let shownA = null, shownB = null;   // ids del par cuyos pixeles hay en pantalla
// Variante parcial (ops#149): `frames` en la variante lista
// los cuadros que SÍ tiene. Si el lado no tiene el cuadro actual, no se pide
// ninguna imagen y su panel muestra un aviso neutro (miss*): nunca una imagen rota.
let missA = false, missB = false;
const cropImgs = new Map();         // variant id -> Image for current frame

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// lectura por clave PROPIA: un cuadro puede llamarse constructor, toString o
// __proto__ (ids válidos) y un objeto corriente los responde con lo heredado (ops#251)
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
function variant(id){ return VARIANTS.find(v=>v.id===id) || {id, name:id, color:'#ccc'}; }
function variantName(id){
  const v = variant(id);
  if (blindMode) return T`Variante ${blindOrder.findIndex(x => x.id === id)+1}`;
  return v.name || v.id;   // el nombre es opcional en el formato: si falta, el id (gatos-ops#376)
}
function orderedVariants(){ return blindMode ? blindOrder : VARIANTS; }
// sin `frames` (todas las páginas anteriores) la variante tiene todos los cuadros
function hasFrame(id, f){
  const fr = variant(id).frames;
  return !Array.isArray(fr) || fr.some(x => String(x) === String(f));
}
function setSideMissing(side, on){
  if (side === 'A') missA = on; else missB = on;
  $('miss'+side).hidden = !on;
  if (on){
    (side === 'A' ? imgA : imgB).style.visibility = 'hidden';
    if (diffMode) renderDiff();   // sin cuadro no hay diff: nota corta en vez de calcular
  }
}
// la fuente embebida convierte dataURLs de forma asíncrona (#7): se normaliza
// a promesa para que ambas fuentes se consuman igual. Memoizada por clave:
// la misma petición devuelve siempre el MISMO promesa (los consumidores
// comparan identidad para descartar carreras) y la fuente http, que no
// cachea, no genera promesas nuevos en cada llamada.
const srcCache = new Map();
// A ciegas la imagen llega como blob: su dirección ya no dice de qué versión
// es (img/x264_33295.webp se leía con «guardar imagen como», «abrir en otra
// pestaña» o arrastrándola). Si la descarga falla (file://) queda la dirección
// de siempre. Al salir del modo se sueltan (dropBlindSrc).
const blindSrc = new Map(), blindMade = [];
// En una página publicada la prueba ciega va más lejos (gatos-ops#207): el
// servidor reparte direcciones al azar y aquí solo se conocen números:
// blindPics = { <id de mentira>: { <cuadro>: <alias> } } y la imagen es b/<alias>.
let blindPics = null;
let blindGen = 0;   // una descarga que termina después de salir del modo no deja un blob suelto
function srcFor(id, f){
  const key = id+'_'+f;
  if (!srcCache.has(key)) srcCache.set(key, Promise.resolve(SOURCE.srcFor(id, f)));
  if (blindPics && blindPics[id]) return Promise.resolve('b/' + blindPics[id][String(f)]);
  if (!blindMode) return srcCache.get(key);
  const gen = blindGen;
  if (!blindSrc.has(key)) blindSrc.set(key, srcCache.get(key).then(u => /^(blob|data):/.test(u) ? u
    : fetch(u).then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r.blob(); }).then(b => { if (gen !== blindGen) return u; const o = URL.createObjectURL(b); blindMade.push(o); return o; }).catch(() => u)));
  return blindSrc.get(key);
}
function dropBlindSrc(){ blindGen++; for (const u of blindMade.splice(0)) URL.revokeObjectURL(u); blindSrc.clear(); }
// gana la última petición de cada lado: la resolución tardía de una petición
// vieja no puede sobreescribir el par que el usuario ya pidió
const sideReq = {A:0, B:0};
function setSideSrc(side, id){
  const gen = ++sideReq[side];
  const miss = !hasFrame(id, frame);
  const was = side === 'A' ? missA : missB;
  setSideMissing(side, miss);
  if (miss) return;
  srcFor(id, frame).then(url => {
    if (gen !== sideReq[side]) return;
    if (side === 'A') imgA.src = url;
    else if (diffMode){ realB.src = url; imgB.src = url; }
    else imgB.src = url;
    // la misma URL que ya estaba cargada: el load llega igual, pero no se espera
    // a ver el cuadro de vuelta tras un aviso (un src nuevo deja complete=false)
    const el = side === 'A' ? imgA : imgB;
    if (was && el.complete && el.naturalWidth) el.style.visibility = '';
  });
}
function naturalDims(){
  // el lado A sin cuadro todavía no cargó nada: las medidas son las del lado B (misma medida en toda la página)
  if (missA && !imgA.naturalWidth && imgB.naturalWidth) return {nw: imgB.naturalWidth, nh: imgB.naturalHeight};
  return {nw: imgA.naturalWidth || 1920, nh: imgA.naturalHeight || 1080};
}
function dpr(){ return window.devicePixelRatio || 1; }

/* ---------- fit geometry: the content rect is sized/positioned explicitly,
   so zoom/pan/1:1 math is exact regardless of window aspect ---------- */
function computeFit(){
  const w = comp.clientWidth, h = comp.clientHeight;
  const {nw, nh} = naturalDims();
  fitScale = Math.min(w/nw, h/nh);
  rw = nw*fitScale; rh = nh*fitScale;
  ox = (w-rw)/2; oy = (h-rh)/2;
  for (const el of [imgA, imgB, diffCanvas]){
    el.style.width = rw+'px'; el.style.height = rh+'px';
    el.style.left = ox+'px'; el.style.top = oy+'px';
  }
}
function zmax(){ return Math.max(1, 8/(fitScale*dpr())); }
function zmin(){ return Math.min(1, 1/(fitScale*dpr())); }
function clampPan(){
  const w = comp.clientWidth, h = comp.clientHeight;
  // ramificar por cobertura: si el contenido cubre el eje, sus bordes deben
  // poder llegar a 0 y al borde contrario (sin franjas muertas); si no cubre,
  // no hay pan posible y queda centrado. El origen de la transformación es la
  // esquina: con pan 0 y zoom < 1 la imagen quedaba pegada arriba a la
  // izquierda (gatos-ops#374); (rw - rw*zoom)/2 la centra y vale 0 en zoom 1
  if (rw*zoom >= w) pan.x = clamp(pan.x, w-ox-rw*zoom, -ox); else pan.x = (rw - rw*zoom)/2;
  if (rh*zoom >= h) pan.y = clamp(pan.y, h-oy-rh*zoom, -oy); else pan.y = (rh - rh*zoom)/2;
}
function updateBadge(){
  if (loadFailA || loadFailB){ zoomBadge.textContent = T('la imagen no cargó'); return; }
  if (!imgA.complete || !imgB.complete){ zoomBadge.textContent = T('cargando…'); return; }
  zoomBadge.textContent = zoom === 1 ? T('ajustar') : Math.round(fitScale*zoom*dpr()*100)+'%';
}
/* la marca del encabezado es un espejo del visor: el circulito cruza las
   palabras siguiendo al divisor real, como el divisor cruza la imagen */
function syncBrandSlider(){
  const dot = document.querySelector('.brand-dot');
  const brand = document.getElementById('brand');
  if (dot && brand){
    const t = blinkMode ? .5 : dividerPos;
    dot.style.left = (8 + t * (brand.clientWidth - 16)) + 'px';
  }
}
function applyTransform(){
  const t = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  imgA.style.transform = t;
  imgB.style.transform = t;
  diffCanvas.style.transform = t;
  paneB.style.clipPath = blinkMode ? 'inset(0 0 0 0)' : `inset(0 0 0 ${dividerPos*100}%)`;
  divider.style.display = blinkMode ? 'none' : '';
  divider.style.left = `${dividerPos*100}%`;
  // los avisos de "sin este cuadro" se centran en la mitad visible de su lado
  comp.style.setProperty('--da', (blinkMode ? 100 : dividerPos*100)+'%');
  comp.style.setProperty('--db', (blinkMode ? 0 : dividerPos*100)+'%');
  syncBrandSlider();
  updateBadge();
}
function setZoomAt(cx, cy, Z2){
  const r = comp.getBoundingClientRect();
  const x = cx-r.left, y = cy-r.top;
  const u = (x-ox-pan.x)/zoom, v = (y-oy-pan.y)/zoom;
  zoom = clamp(Z2, zmin(), zmax());
  if (zoom === 1){ pan = {x:0, y:0}; }
  else { pan.x = x-ox-u*zoom; pan.y = y-oy-v*zoom; clampPan(); }
  applyTransform(); writeHash();
}
function oneToOne(){
  const r = comp.getBoundingClientRect();
  setZoomAt(r.left+comp.clientWidth/2, r.top+comp.clientHeight/2, 1/(fitScale*dpr()));
}
function fitView(){ zoom = 1; pan = {x:0, y:0}; applyTransform(); writeHash(); }

// El panel de recortes vive dentro de #comp: lo que nace en él (clic en
// «cerrar», rueda sobre la lista) es suyo. Sin esto la captura del puntero se
// llevaba el clic del botón y la rueda hacía zoom en vez de desplazar (ops#250).
const inCropPanel = e => !!(e.target && e.target.closest && e.target.closest('#cropPanel, #goneNote'));   // paneles dentro de #comp: sus clics y su rueda son suyos
comp.addEventListener('wheel', e => {
  if (inCropPanel(e)) return;
  e.preventDefault();
  setZoomAt(e.clientX, e.clientY, zoom * (e.deltaY < 0 ? 1.15 : 1/1.15));
}, {passive:false});

/* ---------- pointer input: mouse + touch unified, pinch zoom ---------- */
const pdist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
comp.addEventListener('pointerdown', e => {
  if (inCropPanel(e)) return;
  if (blindSides && testMarkArmed){ e.preventDefault(); testMarkAt(e.clientX, e.clientY); return; }   // prueba ciega: marcar dónde se vio la diferencia (gatos-ops#312)
  comp.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2){
    const [p1, p2] = [...pointers.values()];
    const r = comp.getBoundingClientRect();
    pinch = {d0: pdist(p1,p2) || 1, z0: zoom,
      u: ((p1.x+p2.x)/2-r.left-ox-pan.x)/zoom,
      v: ((p1.y+p2.y)/2-r.top-oy-pan.y)/zoom};
    drag = null; swipe = null;
  } else if (pointers.size === 1){
    const r = comp.getBoundingClientRect();
    const x = e.clientX-r.left, w = comp.clientWidth;
    if (Math.abs(x - dividerPos*w) < (matchMedia('(pointer:coarse)').matches ? 34 : 18) && !blinkMode){ drag = {mode:'divider', sx:e.clientX, start:dividerPos}; }
    else if (cropMode){ pickCrop(e.clientX, e.clientY); }
    else if (zoom > 1){ drag = {mode:'pan', sx:e.clientX, sy:e.clientY, px:pan.x, py:pan.y}; }
    // capa de gestos (gatolocoses/gatos.pics#31): con la vista ajustada no hay
    // pan, así que un deslizamiento táctil franco queda libre para cambiar de
    // frame; el divisor (zona de arriba) y el pellizco conservan su prioridad
    if (!drag && !cropMode && zoom === 1 && e.pointerType === 'touch') swipe = {id:e.pointerId, sx:e.clientX, sy:e.clientY};
  }
  e.preventDefault();
});
comp.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2 && pinch){
    const [p1, p2] = [...pointers.values()];
    const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
    const r = comp.getBoundingClientRect();
    zoom = clamp(pinch.z0 * pdist(p1,p2)/pinch.d0, zmin(), zmax());
    pan.x = mx-r.left-ox-pinch.u*zoom;
    pan.y = my-r.top-oy-pinch.v*zoom;
    clampPan(); applyTransform(); writeHash();
  } else if (drag){
    const w = comp.clientWidth, h = comp.clientHeight;
    if (drag.mode === 'divider'){
      dividerPos = clamp(drag.start + (e.clientX-drag.sx)/w, 0, 1);
      applyTransform(); writeHash();
    } else {
      pan.x = drag.px + (e.clientX-drag.sx);
      pan.y = drag.py + (e.clientY-drag.sy);
      clampPan(); applyTransform(); writeHash();
    }
  }
});
function pointerEnd(e){
  if (swipe && swipe.id === e.pointerId){
    const dx = e.clientX-swipe.sx, dy = e.clientY-swipe.sy;
    swipe = null;
    if (e.type === 'pointerup' && pointers.size === 1 && Math.abs(dx) > 60 && Math.abs(dx) > 2*Math.abs(dy)) stepFrame(dx < 0 ? 1 : -1);
  }
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) drag = null;
}
comp.addEventListener('pointerup', pointerEnd);
comp.addEventListener('pointercancel', pointerEnd);
comp.addEventListener('dblclick', e => { if (!inCropPanel(e)) fitView(); });
window.addEventListener('resize', () => { computeFit(); clampPan(); applyTransform(); syncVariantOverflow(); });
new ResizeObserver(() => { computeFit(); clampPan(); applyTransform(); }).observe(comp);

/* ---------- pane strips: bounded, horizontally scrollable ---------- */
function syncVariantOverflow(){
  ['varA','varB'].forEach(id => {
    const s = $(id); if (!s) return;
    const g = s.closest('.group');
    const over = s.scrollWidth - s.clientWidth > 2;
    if (g) g.classList.toggle('overflowing', over);
    // keep the selected pane visible when the list is longer than its strip
    const act = s.querySelector('button.active') || s.querySelector('.on') || s.querySelector('button[aria-pressed="true"]');
    if (over && act) act.scrollIntoView({inline:'nearest', block:'nearest'});
  });
}
document.querySelectorAll('.vscroll').forEach(b => {
  b.addEventListener('click', () => {
    const s = $(b.dataset.scroll); if (!s) return;
    s.scrollBy({left: Number(b.dataset.dir) * 220, behavior:'smooth'});
  });
});
['varA','varB'].forEach(id => {
  const s = $(id); if (!s) return;
  s.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { s.scrollLeft += e.deltaY; e.preventDefault(); }
  }, {passive:false});
});

/* ---------- diff mode: cached abs-diff planes, canvas overlay ---------- */
function ensureDiffBase(){
  const keyA = imgA.src, keyB = realB.src;
  // pixeles asentados de ESTE par: el complete=true de pixeles previos no
  // prueba nada mientras la URL actual no haya terminado de cargar
  if (loadedUrlA !== keyA || loadedUrlB !== keyB) return null;
  if (loadFailA || loadFailB) return null;
  if (!imgA.naturalWidth || !realB.naturalWidth) return null;
  const w = imgA.naturalWidth, h = imgA.naturalHeight;
  if (realB.naturalWidth !== w || realB.naturalHeight !== h) return null;
  if (diffData && diffData.keyA === keyA && diffData.keyB === keyB) return diffData;
  const ca = document.createElement('canvas');
  ca.width = w; ca.height = h;
  const ctx = ca.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(imgA, 0, 0);
  const a = ctx.getImageData(0,0,w,h).data;
  ctx.drawImage(realB, 0, 0);
  const b = ctx.getImageData(0,0,w,h).data;
  const n = w*h;
  const dr = new Uint8Array(n), dg = new Uint8Array(n), db = new Uint8Array(n);
  let sum = 0;
  for (let i=0, j=0; j<n; i+=4, j++){
    dr[j] = Math.abs(a[i]-b[i]); dg[j] = Math.abs(a[i+1]-b[i+1]); db[j] = Math.abs(a[i+2]-b[i+2]);
    sum += dr[j]+dg[j]+db[j];
  }
  diffData = {keyA, keyB, w, h, dr, dg, db, mean: sum/(n*3)};
  return diffData;
}
function renderDiff(){
  if (!diffMode) return;
  if (missA || missB){
    diffCanvas.style.display = 'none';
    imgB.style.display = '';
    diffNote.style.display = 'block';
    diffNote.textContent = T('Diff no disponible: una variante no tiene este cuadro.');
    return;
  }
  const d = ensureDiffBase();
  if (!d){
    diffCanvas.style.display = 'none';
    imgB.style.display = '';
    const mismatch = loadedUrlA === imgA.src && loadedUrlB === realB.src &&
      imgA.naturalWidth && realB.naturalWidth &&
      (imgA.naturalWidth !== realB.naturalWidth || imgA.naturalHeight !== realB.naturalHeight);
    diffNote.textContent = loadFailA || loadFailB
      ? T('Diff no disponible: una imagen no cargó.')
      : mismatch ? T('Diff no disponible: las imágenes tienen dimensiones distintas.') : T('Diff: cargando…');
    return;
  }
  diffCanvas.width = d.w; diffCanvas.height = d.h;
  diffCanvas.style.display = 'block'; imgB.style.display = 'none';
  const A = GAINS[gainIdx];
  const out = diffCtx.createImageData(d.w, d.h);
  const o = out.data;
  for (let j=0, i=0; j<d.dr.length; j++, i+=4){
    if (heat && (d.dr[j] >= HEAT_T || d.dg[j] >= HEAT_T || d.db[j] >= HEAT_T)){
      o[i] = 255;
    } else {
      o[i] = Math.min(255, d.dr[j]*A);
      o[i+1] = Math.min(255, d.dg[j]*A);
      o[i+2] = Math.min(255, d.db[j]*A);
    }
    o[i+3] = 255;
  }
  diffCtx.putImageData(out, 0, 0);
  diffNote.textContent = T`Diff ×${A}${heat ? T` · calor (Δ≥${HEAT_T} en rojo)` : ''} · color = canal que difiere · Δ media ${d.mean.toFixed(2)}/255`;
}
function setDiff(on){
  diffMode = on;
  if (on) setBlink(false, true);
  diffBtn.classList.toggle('diff-on', on);
  diffBtn.setAttribute('aria-pressed', String(on));
  $('diffTools').hidden = !on;
  diffCanvas.style.display = on ? 'block' : 'none';
  imgB.style.display = on ? 'none' : '';
  diffNote.style.display = on ? 'block' : 'none';
  if (on){
    diffNote.textContent = T`Diff ×${GAINS[gainIdx]} · calculando…`;
    setSideSrc('B', varB);
    renderDiff();
  } else {
    diffData = null;
    setSideSrc('B', varB);
  }
  applyTransform(); updateMeta(); writeHash();
}
function setGain(i){
  gainIdx = clamp(i, 0, GAINS.length-1);
  $('diffGain').value = String(gainIdx);
  if (diffMode) renderDiff();
  writeHash();
}
function setHeat(on){
  heat = on;
  $('heatBtn').setAttribute('aria-pressed', String(on));
  if (diffMode) renderDiff();
  writeHash();
}
// el punto de recorte que trae el enlace espera a conocer las medidas: las da
// la izquierda, o la derecha cuando la izquierda no tiene este cuadro (ops#250)
function applyPendingCrop(){
  if (!pendingCropFraction) return;
  const {nw, nh} = naturalDims();
  cropUV = {u:Math.round(pendingCropFraction[0]*nw), v:Math.round(pendingCropFraction[1]*nh)};
  pendingCropFraction = null; openCropPanel();
}
imgA.addEventListener('load', () => {
  loadedUrlA = imgA.src; loadFailA = false;
  imgA.style.visibility = missA ? 'hidden' : ''; if (!missA) shownA = varA;
  computeFit();
  zoom = clamp(zoom, zmin(), zmax()); clampPan();
  applyPendingCrop();
  applyTransform(); renderDiff(); updateBadge();
});
imgA.addEventListener('error', () => {
  if (missA) return;   // el error de una petición vieja no mancha un lado que ya no pide imagen
  loadFailA = true; imgA.style.visibility = 'hidden';
  paintSide('A'); updateBadge(); renderDiff();
});

/* ---------- escala: suave o píxeles nítidos (inspección de píxel) ---------- */
let smoothScale = true;
try { smoothScale = localStorage.getItem('gatosSmooth') !== '0'; } catch(e){}
// keep=false: el ajuste vale para esta visita (lo trae un enlace) y no pisa la
// preferencia guardada de quien lo abre (ops#251)
function setSmooth(on, keep = true){
  smoothScale = on;
  for (const el of [imgA, imgB, diffCanvas]) el.style.imageRendering = on ? 'auto' : 'pixelated';
  pixBtn.classList.toggle('active', !on);
  pixBtn.setAttribute('aria-pressed', String(!on));
  if (keep) try { localStorage.setItem('gatosSmooth', on ? '1' : '0'); } catch(e){}
  if (FRAMES.length) writeHash();
}
pixBtn.addEventListener('click', () => setSmooth(!smoothScale));
setSmooth(smoothScale);
imgB.addEventListener('load', () => {
  loadedUrlPaneB = imgB.src; loadFailB = false; imgB.style.visibility = missB ? 'hidden' : ''; if (!missB) shownB = varB;
  if (!diffMode) diffNote.style.display = 'none';
  if (missA && !imgA.naturalWidth){ computeFit(); clampPan(); applyTransform(); }   // A sin cuadro: B da la medida
  if (missA) applyPendingCrop();
  updateBadge();
});
realB.addEventListener('load', () => { loadedUrlB = realB.src; loadFailB = false; if (!missB) shownB = varB; renderDiff(); });
// el lado B no deja pixeles viejos bajo etiquetas nuevas: panel vacio y
// etiquetas revertidas al par asentado hasta que un load exitoso las avance
function onBError(){
  if (missB) return;
  loadFailB = true; imgB.style.visibility = 'hidden';
  paintSide('B'); updateBadge();
  if (diffMode) renderDiff();
  else { diffNote.style.display = 'block'; diffNote.textContent = T('la imagen derecha no cargó'); }
}
imgB.addEventListener('error', onBError);
realB.addEventListener('error', onBError);
diffBtn.addEventListener('click', () => setDiff(!diffMode));
$('diffGain').addEventListener('change', () => setGain(Number($('diffGain').value)));
$('heatBtn').addEventListener('click', () => setHeat(!heat));

/* ---------- blink mode ---------- */
let blinkTimer = null;
// el aviso de B parpadea con su imagen: si B no tiene el cuadro, A y el aviso se alternan
// y el aviso de A, que ocupa todo el ancho en parpadeo y queda por encima de la
// imagen de B, se alterna al revés: si no, B no se veía nunca (ops#251)
const setBOpacity = v => { imgB.style.opacity = v; $('missB').style.opacity = v; $('missA').style.opacity = v === '' ? '' : (v === '0' ? '1' : '0'); };
function setBlink(on, quiet){
  blinkMode = on;
  if (on) setDiff(false);
  blinkBtn.classList.toggle('blink-on', on);
  blinkBtn.setAttribute('aria-pressed', String(on));
  clearInterval(blinkTimer);
  modeBadge.style.display = on ? 'block' : 'none';
  if (on){
    setBOpacity('1');
    blinkTimer = setInterval(() => { setBOpacity(imgB.style.opacity === '1' ? '0' : '1'); }, 500);
  } else {
    clearInterval(blinkTimer);
    setBOpacity('');
  }
  if (!quiet){ applyTransform(); updateMeta(); writeHash(); }
}
blinkBtn.addEventListener('click', () => setBlink(!blinkMode));

/* ---------- modo ciego: oculta qué variante es cuál (anti-sesgo) ----------
   Ya no tiene botón propio: lo usa la prueba ciega (45-test.js, gatos-ops#198). */
let blindMode = false;
let blindSides = false;   // en la prueba ciega no hay números: solo «Izquierda» y «Derecha» (gatos-ops#230)
const sideName = (side, id) => blindSides ? T(side === 'A' ? 'Izquierda' : 'Derecha') : variantName(id);
let blindOrder = null;
function sessionBlindOrder(){
  if (blindOrder) return blindOrder;
  const key = 'gatosBlind:'+location.pathname+':'+originalTitle+':'+VARIANTS.map(v=>v.id).join(',');
  let seed;
  try { seed = Number(sessionStorage.getItem(key)) || 0; } catch(e){}
  if (!seed){
    seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    try { sessionStorage.setItem(key, String(seed)); } catch(e){}
  }
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  // Allow every permutation. Forcing a swap would reveal two-variant tests.
  const order = [...VARIANTS];
  for (let i=order.length-1; i>0; i--){
    const j = Math.floor(random()*(i+1)); [order[i],order[j]] = [order[j],order[i]];
  }
  return order;
}
function setBlind(on){
  if (on && !blindMode){
    blindOrder = sessionBlindOrder();
    varA = blindOrder[0]?.id; varB = blindOrder[1]?.id || varA;
  }
  blindMode = on;
  pageTitle.textContent = on ? T('Comparación a ciegas') : originalTitle;
  document.title = pageTitle.textContent;
  if (on) hideTip();
  refreshVariantButtons();
  loadImg();
  updateMeta();
  writeHash();
}

/* ---------- curva solar: revela banding ---------- */
let solarMode = false;
// SVG transfer tables use normalized channel values, not byte values.
document.querySelectorAll('#solarCurve feFuncR, #solarCurve feFuncG, #solarCurve feFuncB').forEach(el => {
  const values = el.getAttribute('tableValues').trim().split(/\s+/).map(Number);
  el.setAttribute('tableValues', values.map(v => v/255).join(' '));
});
// Safari nunca implemento CanvasRenderingContext2D.filter: la asignacion se
// ignora en silencio y el PNG compartido salia sin curva. Deteccion de feature
// + LUT de 256 entradas desde la misma tabla normalizada (ops#4).
const CTX_FILTER_OK = (() => {
  try { return typeof document.createElement('canvas').getContext('2d').filter === 'string'; } catch(e){ return false; }
})();
const SOLAR_LUT = (() => {
  const el = document.querySelector('#solarCurve feFuncR');
  const v = el ? el.getAttribute('tableValues').trim().split(/\s+/).map(Number) : [];
  const lut = new Uint8Array(256);
  for (let i=0;i<256;i++){
    if (v.length < 2){ lut[i] = i; continue; }   // sin tabla: identidad
    const t = i/255*(v.length-1), j = Math.min(v.length-2, Math.floor(t)), f = t-j;
    lut[i] = Math.round(255*(v[j]*(1-f) + v[j+1]*f));
  }
  return lut;
})();
function setSolar(on){
  solarMode = on;
  solarBtn.classList.toggle('solar-on', on);
  solarBtn.setAttribute('aria-pressed', String(on));
  const f = on ? 'url(#solarCurve)' : '';
  imgA.style.filter = f;
  imgB.style.filter = f;
  updateMeta();
  writeHash();
}
solarBtn.addEventListener('click', () => setSolar(!solarMode));

/* ---------- crops N-up: 1:1 crops of every variant at a picked point ---------- */
function pickCrop(cx, cy){
  const r = comp.getBoundingClientRect();
  const {nw, nh} = naturalDims();
  const u = clamp(((cx-r.left)-ox-pan.x)/zoom/fitScale, 0, nw);
  const v = clamp(((cy-r.top)-oy-pan.y)/zoom/fitScale, 0, nh);
  cropUV = {u: Math.round(u), v: Math.round(v)};
  openCropPanel();
  writeHash();
}
// teclado (gatolocoses/gatos.pics#10): sin puntero no había forma de elegir
// punto; las flechas siembran el centro y luego lo mueven en px nativos
// (Shift = pasos de 10). writeHash conserva el punto en el enlace compartido.
function moveCrop(dx, dy){
  const {nw, nh} = naturalDims();
  if (!cropUV) cropUV = {u: Math.round(nw/2), v: Math.round(nh/2)};
  cropUV = {u: clamp(cropUV.u+dx, 0, nw), v: clamp(cropUV.v+dy, 0, nh)};
  openCropPanel();
  writeHash();
}
const cropSrcReq = new Map();       // variant id -> promesa src en curso (carrera de frame)
function cropImg(id){
  if (!hasFrame(id, frame)){ cropSrcReq.delete(id); cropImgs.delete(id); return null; }   // parcial: sin cuadro no hay recorte
  const p = srcFor(id, frame);
  if (cropSrcReq.get(id) !== p){
    cropSrcReq.set(id, p);
    cropImgs.delete(id);            // en tránsito: no pintar píxeles del frame viejo
    p.then(url => {
      if (cropSrcReq.get(id) !== p) return;   // una petición más nueva ganó
      const im = new Image();
      im.decoding = 'async';
      im.src = url;
      cropImgs.set(id, im);
      if (cropPanel.style.display === 'block') openCropPanel();   // repinta filas en cargando
    });
  }
  return cropImgs.get(id);
}
function drawCropRow(id, canvas){
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (!hasFrame(id, frame)){
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9a9aa8'; ctx.fillText(T('sin este cuadro'), 10, 20);
    return;
  }
  const im = cropImg(id);
  if (!im || !im.complete || !im.naturalWidth){
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9a9aa8'; ctx.fillText(T('cargando…'), 10, 20);
    if (im) im.addEventListener('load', () => { if (cropPanel.style.display !== 'none') drawCropRow(id, canvas); }, {once:true});
    return;
  }
  const sw = Math.min(canvas.width, im.naturalWidth), sh = Math.min(canvas.height, im.naturalHeight);
  const sx = clamp(Math.round(cropUV.u - sw/2), 0, im.naturalWidth - sw);
  const sy = clamp(Math.round(cropUV.v - sh/2), 0, im.naturalHeight - sh);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(im, sx, sy, sw, sh, Math.floor((canvas.width-sw)/2), Math.floor((canvas.height-sh)/2), sw, sh);
}
function openCropPanel(){
  if (blindSides) return;   // en la prueba ciega no hay recortes: numeran las versiones (gatos-ops#239)
  const wasHidden = cropPanel.style.display !== 'block';
  cropPanel.style.display = 'block';
  cropHint.style.display = 'none';
  const d = dpr();
  let CW = Math.max(64, Math.min(480, comp.clientWidth - (innerWidth <= 820 ? 64 : 220))), CH = Math.round(CW*9/16);
  // hoja inferior del teléfono (apaisado sobre todo): un recorte más alto que
  // media vista taparía la comparación entera; se acota por alto
  if (PHONE_MQ.matches && CH > comp.clientHeight*0.45){ CH = Math.round(comp.clientHeight*0.45); CW = Math.max(64, Math.round(CH*16/9)); }
  cropTitle.textContent = T`Recortes 1:1 @ ${cropUV.u},${cropUV.v} (px nativos)`;
  cropRows.innerHTML = '';
  orderedVariants().forEach(v => {
    const row = document.createElement('div');
    row.className = 'cropRow';
    const name = document.createElement('span');
    name.className = 'cname';
    name.textContent = variantName(v.id);
    name.style.color = blindMode ? '#e8e8f0' : v.color;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(CW*d); canvas.height = Math.round(CH*d);
    canvas.style.width = CW+'px'; canvas.style.height = CH+'px';
    row.appendChild(name); row.appendChild(canvas);
    cropRows.appendChild(row);
    drawCropRow(v.id, canvas);
  });
  // el panel entra al orden de foco al abrirse (no en repintados del mismo
  // panel): sin esto, un usuario de teclado quedaba fuera del diálogo
  if (wasHidden) $('cropClose').focus();
}
function closeCrop(){
  cropPanel.style.display = 'none';
  cropUV = null;
  if (cropMode) cropHint.style.display = 'block';
  else cropBtn.focus();   // retorno de foco al botón que abre el modo (gatolocoses/gatos.pics#10)
  writeHash();
}
function setCropMode(on){
  cropMode = on;
  cropBtn.classList.toggle('crop-on', on);
  cropBtn.setAttribute('aria-pressed', String(on));
  cropHint.style.display = on ? 'block' : 'none';
  // calentado incremental (#7): solo el par visible; el resto de variantes se
  // pide al abrir el panel, así entrar a Recortes no calienta todo de golpe
  if (on){ [varA, varB].forEach(v => cropImg(v)); }
  else if (cropUV) closeCrop();
  writeHash();
}
cropBtn.addEventListener('click', () => setCropMode(!cropMode));
$('cropClose').addEventListener('click', () => { setCropMode(false); closeCrop(); });

/* ---------- state: URL hash (shareable) > localStorage > defaults ---------- */
let hashTimer = null;
function stateParams(){
    const p = new URLSearchParams();
    if (frame != null) p.set('f', frame);
    if (!blindMode && varA) p.set('a', varA);
    if (!blindMode && varB) p.set('b', varB);
    if (dividerPos !== 0.5) p.set('d', dividerPos.toFixed(3));
    // vista con zoom, portable entre pantallas (ops#253): escala absoluta (px de
    // pantalla por px de imagen, lo que dice la insignia) y el punto de la imagen
    // que queda al centro, en fracciones. Antes iban z relativo al ajuste y x/y
    // en px de la ventana, que en otra pantalla mostraban otra región.
    if (pendingView){ p.set('s', pendingView.s.toFixed(5)); p.set('cx', pendingView.cx.toFixed(5)); p.set('cy', pendingView.cy.toFixed(5)); }
    else if (zoom !== 1 && rw > 0 && rh > 0){
      p.set('s', (fitScale*zoom*dpr()).toFixed(5));
      p.set('cx', clamp((comp.clientWidth/2-ox-pan.x)/zoom/rw, 0, 1).toFixed(5));
      p.set('cy', clamp((comp.clientHeight/2-oy-pan.y)/zoom/rh, 0, 1).toFixed(5));
    }
    if (diffMode){ p.set('diff', 1); if (gainIdx !== AMPLIFY_DEFAULT_IDX) p.set('g', gainIdx); if (heat) p.set('heat', 1); }
    if (blinkMode) p.set('blink', 1);
    if (solarMode) p.set('solar', 1);
    p.set('smooth', smoothScale ? '1' : '0');
    if (cropMode) p.set('crops', 1);
    if (cropUV){
      const {nw, nh} = naturalDims();
      p.set('crop', (cropUV.u/nw).toFixed(4)+','+(cropUV.v/nh).toFixed(4));
    } else if (pendingCropFraction){   // aún sin medidas: el enlace no pierde su punto
      p.set('crop', pendingCropFraction[0].toFixed(4)+','+pendingCropFraction[1].toFixed(4));
    }
    return p;
}
// La vista de un enlace (s, cx, cy) espera a las medidas reales de la imagen:
// antes de cargar, el ajuste se calcula con 1920×1080 supuestos. Solo decide
// zoom y pan con las mismas reglas de siempre (zmin/zmax, clampPan); la
// geometría de ajuste y el PNG no cambian.
let pendingView = null;
function applyPendingView(){
  if (!pendingView) return;
  const {s, cx, cy} = pendingView;
  pendingView = null;
  computeFit();
  zoom = clamp(s/(fitScale*dpr()), zmin(), zmax());
  if (Math.abs(zoom-1) < 1e-4) zoom = 1;
  if (zoom === 1) pan = {x:0, y:0};
  else {
    pan.x = comp.clientWidth/2 - ox - cx*rw*zoom;
    pan.y = comp.clientHeight/2 - oy - cy*rh*zoom;
    clampPan();
  }
  applyTransform(); writeHash();
}
// después de los manejadores de 20-modes.js, que ya midieron el ajuste
imgA.addEventListener('load', applyPendingView);
imgB.addEventListener('load', () => { if (missA) applyPendingView(); });   // izquierda sin cuadro: mide la derecha
const stateStorageKey = 'gatosState:' + location.pathname;
// La vista previa del creador y el visor oculto que dibuja la imagen para
// compartir son about:srcdoc: comparten el localStorage del creador y su ruta
// es siempre "srcdoc", así que el estado de una vista previa aparecía en la
// siguiente y en la imagen publicada (la misma versión en los dos lados). Ahí
// el estado de la vista no se guarda ni se lee (ops#255).
const stateKept = location.href !== 'about:srcdoc';
function writeHash(){
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    try { history.replaceState(null, '', '#'+stateParams()); } catch(e){}
    try {
      if (blindMode || !stateKept) return; // Never persist the anonymous-to-real assignment.
      localStorage.setItem(stateStorageKey, JSON.stringify({f:frame, a:varA, b:varB, d:dividerPos, g:gainIdx, h:heat}));
    } catch(e){}
  }, 150);
}
function readState(){
  let saved = {};
  const h = new URLSearchParams(location.hash.slice(1));
  // .size llego en Safari 17.4: en navegadores viejos es undefined y el estado
  // local siempre ganaba; la vacuidad se mide sin depender de esa propiedad
  if (stateKept && h.toString() === '') try { saved = JSON.parse(localStorage.getItem(stateStorageKey)) || {}; } catch(e){}
  const num = s => { const n = parseFloat(s); return isFinite(n) ? n : null; };
  const findFrame = value => value == null ? undefined : FRAMES.find(f => String(f) === String(value));
  frame = findFrame(h.get('f')) ?? findFrame(saved.f) ?? FRAMES[0];
  const hv = (k, fb) => VARIANTS.some(v=>v.id===h.get(k)) ? h.get(k) : (VARIANTS.some(v=>v.id===fb) ? fb : null);
  varA = hv('a', saved.a) || (VARIANTS[0] && VARIANTS[0].id);
  varB = hv('b', saved.b) || (VARIANTS[Math.min(1, VARIANTS.length-1)] || VARIANTS[0] || {}).id;
  const hd = num(h.get('d'));
  dividerPos = clamp(hd != null ? hd : (isFinite(saved.d) ? saved.d : 0.5), 0, 1);
  const hg = parseInt(h.get('g'));
  gainIdx = clamp(Number.isInteger(hg) ? hg : (Number.isInteger(saved.g) ? saved.g : AMPLIFY_DEFAULT_IDX), 0, GAINS.length-1);
  heat = h.get('heat') === '1' || saved.h === true;
  const hs = num(h.get('s')), hz = num(h.get('z'));
  if (hs != null && hs > 0){
    const frac = k => { const n = num(h.get(k)); return n == null ? 0.5 : clamp(n, 0, 1); };
    pendingView = {s: hs, cx: frac('cx'), cy: frac('cy')};
  } else if (hz != null && hz > 0){   // enlaces anteriores: z relativo al ajuste, x/y en px de la ventana
    zoom = hz;
    pan.x = num(h.get('x')) || 0;
    pan.y = num(h.get('y')) || 0;
  }
  return h;
}

/* ---------- UI ---------- */
// metricas de un .cmp abierto a mano o exportado: el import del creador y el
// servicio las sanean, pero el visor local no tiene a nadie detras (#103).
// Solo se pinta un numero finito; objetos/cadenas hostiles se omiten sin tirar.
function metricNum(v){ return typeof v === 'number' && isFinite(v) ? v : null; }
function variantStats(id){
  if (blindMode) return '';
  const m = variant(id).metrics;
  if (!m) return '';
  const lines = [];
  const pf = own(m.per_frame, String(frame));
  if (pf){
    const l = [];
    const pfS2 = metricNum(pf.ssimulacra2), pfPsnr = metricNum(pf.psnr_avg), pfSsim = metricNum(pf.ssim_all);
    if (pfS2 != null) l.push('S2 '+pfS2.toFixed(1));
    if (pfPsnr != null) l.push('PSNR '+pfPsnr.toFixed(2)+' dB');
    if (pfSsim != null) l.push('SSIM '+pfSsim.toFixed(4));
    if (l.length) lines.push(l.join(' \u00B7 ')+' · '+(FRAME_LABELS[frame] || 'frame '+frame));
  }
  const l2 = [];
  if (m.custom_note) l2.push(m.custom_note);
  const mS2 = metricNum(m.ssimulacra2), mPsnr = metricNum(m.psnr_avg), mSsim = metricNum(m.ssim_all);
  const mBytes = metricNum(m.size_bytes), mKbps = metricNum(m.kbps);
  if (mS2 != null) l2.push(T`S2 media ${mS2.toFixed(1)}`);
  if (mPsnr != null) l2.push('clip PSNR '+mPsnr.toFixed(2));
  if (mSsim != null) l2.push('SSIM '+mSsim.toFixed(4));
  if (mBytes) l2.push((mBytes/1048576).toFixed(1)+' MB');
  if (mKbps) l2.push(Math.round(mKbps)+' kbps');
  if (l2.length) lines.push(l2.join(' \u00B7 '));
  return lines.join('\n');
}
function updateMeta(){
  // variante parcial: qué lado no tiene el cuadro (vacío en las páginas completas)
  const gaps = [missA ? T('izq.') : '', missB ? T('der.') : ''].filter(Boolean);
  const noFrame = gaps.length ? T` · sin este cuadro: ${gaps.join(T(' y '))}` : '';
  if (blindSides){ metaLine.textContent = T`Frame ${FRAMES.indexOf(frame)+1} · CIEGO${noFrame}`; return; }
  if (blindMode){
    metaLine.textContent = T`Frame ${FRAMES.indexOf(frame)+1} · izquierda: ${variantName(varA)} · derecha: ${variantName(varB)} · CIEGO${noFrame}`;
    return;
  }
  const lbl = FRAME_LABELS[frame] || String(frame);
  const m = FRAME_META[frame] || {};
  const clipS = metricNum(m.clip_s);
  const where = clipS != null ? ` \u00B7 clip +${clipS.toFixed(1)}s` : '';
  const origin = CLIP.start_label ? T`Inicio del clip ${CLIP.start_label} · ` : '';
  const modes = [diffMode ? 'DIFF' : '', blinkMode ? T('PARPADEO') : '', blindMode ? T('CIEGO') : '', solarMode ? 'SOLAR' : ''].filter(Boolean).join('+');
  metaLine.textContent =
    T`${origin}Frame ${lbl} (#${frame}${where}) · izq. ${blindMode ? '?' : varA} · der. ${blindMode ? '?' : varB}${modes ? ' · '+modes : ''}${noFrame}`;
}
function preload(){
  const i = FRAMES.indexOf(frame);
  [i-1, i+1].forEach(j => {
    if (j >= 0 && j < FRAMES.length){
      for (const id of [varA, varB]) if (hasFrame(id, FRAMES[j])) srcFor(id, FRAMES[j]).then(u => { new Image().src = u; });
    }
  });
}
// repinta la etiqueta de un lado desde el par asentado (reversion en error)
function paintSide(side){
  const id = side === 'A' ? shownA : shownB;
  if (id == null) return;   // primer par sin carga exitosa: etiqueta inicial
  $('label'+side+'Name').textContent = sideName(side, id);
  $('stats'+side).textContent = variantStats(id);
  $('label'+side).style.color = blindMode ? '#e8e8f0' : variant(id).color;
}
function loadImg(){
  loadFailA = loadFailB = false;   // arranca un intento nuevo del par actual
  setSideSrc('A', varA);
  setSideSrc('B', varB);
  labelAName.textContent = sideName('A', varA);
  labelBName.textContent = sideName('B', varB);
  statsA.textContent = variantStats(varA);
  statsB.textContent = variantStats(varB);
  labelA.style.color = blindMode ? '#e8e8f0' : variant(varA).color;
  labelB.style.color = blindMode ? '#e8e8f0' : variant(varB).color;

  refreshFrameButtons(); refreshVariantButtons(); syncVariantOverflow();
  updateMeta();
  updateBadge();
  preload();
  if (cropMode) [varA, varB].forEach(v => cropImg(v));
  if (cropUV && cropPanel.style.display !== 'none') openCropPanel();
  writeHash();
}
function makeButtons(containerId, items, activeId, onPick){
  const c = $(containerId);
  c.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button');
    if (item.sub != null){
      b.className = 'vbtn' + (item.id === activeId ? ' active' : '');
      if (item.cmd) b.dataset.cmd = item.cmd;
      const main = document.createElement('span'); main.className = 'main'; main.textContent = item.main;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = item.sub;
      b.append(main, sub);
    } else {
      b.textContent = item.label;
      b.className = item.id === activeId ? 'active' : '';
    }
    // variante parcial sin este cuadro: atenuada pero elegible (verla es ver el aviso)
    if (item.dim){ b.classList.add('nofr'); b.title = T('Esta variante no tiene este cuadro'); }
    b.addEventListener('click', () => onPick(item.id));
    b.setAttribute('aria-pressed', String(item.id === activeId));
    c.appendChild(b);
  });
}
const cmdTip = document.createElement('div');
cmdTip.id = 'cmdTip'; document.body.appendChild(cmdTip);
let cmdPinned = false, cmdFor = null, cmdTimer = null, cmdText = '';
function cmdKey(t){
  // a line starting with '|' is the second stage of a piped command
  return t.startsWith('|') ? '|piped' : t.split(/\s+/)[0];
}
function showTip(b){
  if (blindMode) return;
  cmdText = b.dataset.cmd;
  // el botón cmd del teléfono declara su lado; los vbtn lo heredan de su tira
  const pane = b.dataset.pane || (b.closest('.variants') ? b.closest('.variants').id : null);
  const otherId = pane === 'varA' ? varB : (pane === 'varB' ? varA : null);
  const other = otherId ? variant(otherId) : null;
  const hlOk = {'--crf':1, '--preset':1, '--film-grain':1, '--film-grain-denoise':1};
  const omap = {};
  if (other && other.cmd){
    other.cmd.split('\n').forEach(l => {
      const t = l.trim().replace(/\\$/,'').trim();
      if (t) omap[cmdKey(t)] = t;
    });
  }
  const esc = x => x.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  let body;
  if (other && other.cmd){
    body = cmdText.split('\n').map(l => {
      const t = l.trim().replace(/\\$/,'').trim();
      if (!t) return esc(l);
      const key = cmdKey(t);
      const differs = !!hlOk[key] && (!(key in omap) || omap[key] !== t);
      return differs ? '<span class="dline">' + esc(l) + '</span>' : esc(l);
    }).join('\n');
  } else {
    body = esc(cmdText);
  }
  const legend = other && other.cmd ? T`en ámbar lo que difiere de <b>${esc(other.name || other.id)}</b>`   // el nombre es opcional en el formato
                                     : T('comando');
  cmdTip.innerHTML = '<div class="tiphead"><span class="tt">' + legend + '</span>'
    + '<button data-act="copy">' + T('Copiar') + '</button><button data-act="close">\u00d7</button></div>'
    + '<div class="cmdtext">' + body + '</div>';
  cmdTip.style.display = 'block';
  if (PHONE_MQ.matches){ cmdTip.style.left = ''; cmdTip.style.top = ''; return; }   // hoja desde abajo (CSS)
  const r = b.getBoundingClientRect();
  cmdTip.style.left = Math.min(window.innerWidth - cmdTip.offsetWidth - 8, Math.max(8, r.left)) + 'px';
  const below = r.bottom + 6;
  cmdTip.style.top = (below + cmdTip.offsetHeight > window.innerHeight - 8
    ? Math.max(8, r.top - cmdTip.offsetHeight - 6) : below) + 'px';
}
// teléfono: sin hover no hay tooltip; el botón cmd junto al selector lo fija
document.querySelectorAll('.vcmd').forEach(b => b.addEventListener('click', () => {
  if (cmdPinned && cmdFor === b){ hideTip(); return; }
  showTip(b); cmdPinned = true; cmdFor = b;
}));
function hideTip(){
  cmdPinned = false; cmdFor = null; clearTimeout(cmdTimer);
  cmdTip.style.display = 'none';
}
document.addEventListener('mouseover', e => {
  const b = e.target.closest('button.vbtn');
  if (cmdPinned) return;
  if (!b || !b.dataset.cmd){ clearTimeout(cmdTimer); cmdFor = null; cmdTip.style.display = 'none'; return; }
  if (cmdFor === b) return;
  clearTimeout(cmdTimer); cmdFor = b; cmdTip.style.display = 'none';
  cmdTimer = setTimeout(() => { showTip(b); cmdPinned = true; }, 2000);
});
document.addEventListener('click', e => {
  const act = e.target.closest('#cmdTip [data-act]');
  if (act && act.dataset.act === 'copy'){
    const done = ok => { const b = act; b.textContent = ok ? T('Copiado ✓') : T('Falló la copia');
      setTimeout(() => { b.textContent = T('Copiar'); }, 1200); };
    if (navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(cmdText).then(() => done(true), () => done(false));
    } else {
      const ta = document.createElement('textarea');
      ta.value = cmdText; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(true); } catch (err) { done(false); }
      ta.remove();
    }
    return;
  }
  if (act && act.dataset.act === 'close'){ hideTip(); return; }
  if (cmdPinned && !e.target.closest('#cmdTip') && !e.target.closest('.vcmd')) hideTip();
});
// Escape pertenece al modal abierto (compartir/reportar): no cierra a la vez
// el tooltip de comandos fijado detras del overlay
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sharePanel.style.display !== 'flex' && reportPanel.style.display !== 'flex') hideTip();
});
function refreshFrameButtons(){
  makeButtons('frames', FRAMES.map((f,i)=>({id:f, label: blindMode ? 'Frame '+(i+1) : FRAME_LABELS[f] || String(f)})), frame, f => { frame = f; loadImg(); });
}
function variantButtonItems(){
  // en modo ciego no se atenúa: no delata qué variante es la parcial antes de elegirla
  return orderedVariants().map((v, vi) => ({...variantItem(v, vi), dim: !blindMode && !hasFrame(v.id, frame)}));
}
function variantItem(v, vi){
  if (blindMode) return {id: v.id, main: T`Variante ${vi+1}`, sub: '', cmd: null};
  const cmd = v.cmd || null;
  if (v.id === 'src') return {id: v.id, main: v.name || T('Fuente'), sub: (v.note || '').replace(/Source \u00B7 /, ''), cmd: null};
  const m = v.id.match(/^crf(\d+)_p(\d)(?:_fg(\d+))?$/);
  if (!m) return {id: v.id, main: v.name || v.id, sub: v.note || '', cmd: cmd};   // sin nombre, el id (gatos-ops#376)
  const parts = (v.note || '').split(' \u00B7 ');
  const mbps = (parts[1] || '').replace(' Mbps', ' Mb/s');
  const s2 = (parts[2] || '');
  const main = `CRF ${m[1]}` + (m[3] ? ` \u00B7 FG ${m[3]}` : '');
  return {id: v.id, main: main, sub: `P${m[2]} \u00B7 ${mbps}${s2 ? ' \u00B7 ' + s2 : ''}`, cmd: cmd};
}
function fillSelect(selId, items, activeId, onPick){
  const s = $(selId);
  s.innerHTML = '';
  items.forEach((it,i) => {
    const o = document.createElement('option');
    o.value = blindMode ? 'blind-'+i : it.id;
    o.textContent = [it.main, it.sub, it.dim ? T('sin este cuadro') : ''].filter(Boolean).join(' · ');
    s.appendChild(o);
  });
  s.selectedIndex = items.findIndex(it=>it.id === activeId);
  s.onchange = () => onPick(items[s.selectedIndex].id);
}
function refreshVariantButtons(){
  const items = variantButtonItems();
  makeButtons('varA', items, varA, v => { varA = v; loadImg(); });
  makeButtons('varB', items, varB, v => { varB = v; loadImg(); });
  fillSelect('selA', items, varA, v => { varA = v; loadImg(); });
  fillSelect('selB', items, varB, v => { varB = v; loadImg(); });
  [['varA', varA], ['varB', varB]].forEach(([pane, id]) => {
    const b = document.querySelector('.vcmd[data-pane="'+pane+'"]');
    const cmd = !blindMode && variant(id).cmd;
    b.hidden = !cmd;
    if (cmd) b.dataset.cmd = cmd; else delete b.dataset.cmd;
  });
  if (cmdPinned && cmdFor && cmdFor.classList.contains('vcmd')) hideTip();
}
function stepFrame(d){
  if (testRun) return;   // en la prueba ciega el cuadro lo pone la prueba
  const i = FRAMES.indexOf(frame)+d;
  if (i >= 0 && i < FRAMES.length){ frame = FRAMES[i]; loadImg(); }
}
document.querySelectorAll('.fnav').forEach(b => b.addEventListener('click', () => stepFrame(Number(b.dataset.fdir))));
function swapAB(){ if (testRun) return; [varA, varB] = [varB, varA]; loadImg(); }
function nudgeDivider(delta){ dividerPos = clamp(dividerPos+delta, 0, 1); applyTransform(); writeHash(); }

$('oneBtn').addEventListener('click', oneToOne);
$('resetBtn').addEventListener('click', fitView);
$('swapBtn').addEventListener('click', swapAB);

const helpDialog = $('helpDialog');
$('helpBtn').addEventListener('click', () => helpDialog.showModal());
$('helpClose').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('close', () => $('helpBtn').focus());

window.addEventListener('keydown', e => {
  const t = e.target;
  // reportar es un modal: bloquea los atajos y Escape lo cierra (ops#5)
  if (reportPanel.style.display === 'flex'){
    if (e.key === 'Escape') closeReport();
    return;
  }
  if (helpDialog.open){
    if (e.key === 'Escape'){ e.preventDefault(); helpDialog.close(); }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || t?.isContentEditable) return;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')){
    if (e.key === 'Escape'){ t.blur(); closeShareIfOpen(); }
    return;   // escribiendo/seleccionando: los atajos esperan
  }
  if (e.key === '?'){ e.preventDefault(); helpDialog.showModal(); return; }
  if (sharePanel.style.display === 'flex'){
    if (e.key === 'Escape') closeShareIfOpen();
    return;
  }
  if (testKeys(e)) return;   // prueba ciega: sus teclas, y su panel bloquea las demás
  const CROP_ARROWS = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
  if (CROP_ARROWS[e.key] && (cropMode || cropUV)){
    // con el modo recortes activo las flechas son del punto (gatolocoses/gatos.pics#10):
    // siembran el centro si aún no hay punto; para cambiar frame, cierra el modo (C o Esc)
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    moveCrop(CROP_ARROWS[e.key][0]*s, CROP_ARROWS[e.key][1]*s);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
    e.preventDefault();
    stepFrame(e.key === 'ArrowRight' ? 1 : -1);
  } else if (e.key === ' ' && !e.repeat && t?.tagName !== 'BUTTON'){
    e.preventDefault();   // no hacer scroll de página
    const ids = orderedVariants().map(v => v.id);
    varB = ids[(ids.indexOf(varB)+1) % ids.length];
    loadImg();
  } else if (!e.repeat && (e.key === 'n' || e.key === 'N')){ setSmooth(!smoothScale);
  } else if (/^[1-9]$/.test(e.key) || /^Digit[1-9]$/.test(e.code)){
    const idx = Number(/^Digit/.test(e.code) ? e.code.slice(-1) : e.key)-1;
    if (idx >= VARIANTS.length) return;
    if (e.shiftKey) varA = orderedVariants()[idx].id; else varB = orderedVariants()[idx].id;
    loadImg();
  } else if (!e.repeat && (e.key === 'd' || e.key === 'D')){ setDiff(!diffMode); }
  else if (!e.repeat && (e.key === 'b' || e.key === 'B')){ setBlink(!blinkMode); }
  else if (!e.repeat && (e.key === 'g' || e.key === 'G')){ if (!$('testBtn').hidden) testEnter(); }
  else if (!e.repeat && (e.key === 'l' || e.key === 'L')){ setSolar(!solarMode); }
  else if (!e.repeat && (e.key === 'c' || e.key === 'C')){ setCropMode(!cropMode); }
  else if (!e.repeat && (e.key === 's' || e.key === 'S')){ swapAB(); }
  else if (!e.repeat && (e.key === 'o' || e.key === 'O')){ oneToOne(); }
  else if (!e.repeat && (e.key === 'f' || e.key === 'F')){ fitView(); }
  else if (!e.repeat && (e.key === 'h' || e.key === 'H')){ setHeat(!heat); }
  else if (e.key === '+' || e.key === '='){ setGain(gainIdx+1); }
  else if (e.key === '-' || e.key === '_'){ setGain(gainIdx-1); }
  else if (e.key === ',' || e.code === 'Comma'){ nudgeDivider(e.shiftKey ? -0.05 : -0.01); }
  else if (e.key === '.' || e.code === 'Period'){ nudgeDivider(e.shiftKey ? 0.05 : 0.01); }
  else if (e.key === 'Escape'){ if (cropMode || cropUV){ setCropMode(false); closeCrop(); } }
});

/* ---------- compartir: imagen PNG sin pérdida de la vista actual ---------- */
const sharePanel = $('sharePanel'), shareRows = $('shareRows');
const reportPanel = $('reportPanel');
let shareBlobUrl = null, shareName = 'gatos.pics.png';
function escq(x){ return String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function drawBrand(ctx, x, y){
  // espejo en miniatura: verde/amarillo fijos, el circulito cruza las palabras
  const W = 78, H = 16, cy = y + H/2;
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.fillStyle = '#7bd389';
  ctx.beginPath(); ctx.roundRect(x, y, 44, H, [3,0,0,3]); ctx.fill();
  ctx.fillStyle = '#ffb454';
  ctx.beginPath(); ctx.roundRect(x+44, y, 34, H, [0,3,3,0]); ctx.fill();
  const cx = x + 8 + (W - 16) * (blinkMode ? .5 : dividerPos);
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#000c'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx-1.8, cy-3.2); ctx.lineTo(cx-4.4, cy); ctx.lineTo(cx-1.8, cy+3.2);
  ctx.moveTo(cx+1.8, cy-3.2); ctx.lineTo(cx+4.4, cy); ctx.lineTo(cx+1.8, cy+3.2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '700 9px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('gatos', x+22, cy);
  ctx.fillText('pics', x+61, cy);
  ctx.restore();
}

// curva solar aplicada píxel a píxel en una copia offscreen (motores sin
// ctx.filter: el PNG debe mostrar lo mismo que la pantalla)
function solarizedCopy(img){
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cx = c.getContext('2d', {willReadFrequently:true});
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i=0;i<d.length;i+=4){ d[i]=SOLAR_LUT[d[i]]; d[i+1]=SOLAR_LUT[d[i+1]]; d[i+2]=SOLAR_LUT[d[i+2]]; }
  cx.putImageData(id, 0, 0);
  return c;
}

function renderViewCanvas(){
  if (loadFailA || loadFailB) throw new Error(T('No se puede compartir: una imagen no cargó.'));
  // autoridad de URL asentada (misma clase de carrera que el diff): complete
  // puede seguir en true con pixeles de la generacion anterior; el PNG exige
  // el par actual asentado en ambos lados (en diff realB es la autoridad)
  // variante parcial: un lado sin cuadro no carga nada; la pantalla muestra su aviso
  // (y el diff no existe), así que el PNG dibuja lo mismo en vez de esperar o fallar
  const diffLive = diffMode && !missA && !missB;
  const bSettled = diffLive ? loadedUrlB === realB.src : loadedUrlPaneB === imgB.src;
  if ((!missA && (loadedUrlA !== imgA.src || !imgA.naturalWidth)) || (!missB && (!bSettled || !imgB.naturalWidth)))
    throw Object.assign(new Error(T('Espera a que terminen de cargar las dos imágenes.')), {wait:true});
  if (diffLive && !ensureDiffBase()) throw new Error(T('No se puede compartir el diff: revisa las dimensiones de las imágenes.'));
  const comp2 = $('comp');
  const w = comp2.clientWidth, h = comp2.clientHeight, d = dpr();
  // region visible del contenido, sin barras negras: el lienzo es exactamente
  // la interseccion del cuadro de contenido (con zoom/pan) con la ventana
  const cx = ox + pan.x, cy = oy + pan.y, cw = rw * zoom, chh = rh * zoom;
  const ix = Math.max(0, cx), iy = Math.max(0, cy);
  const ir = Math.min(w, cx + cw), ib = Math.min(h, cy + chh);
  const vw = Math.max(1, ir - ix), vh = Math.max(1, ib - iy);
  const c = document.createElement('canvas');
  c.width = Math.round(vw * d); c.height = Math.round(vh * d);
  const x = c.getContext('2d');
  x.scale(d, d);
  x.translate(-ix, -iy);
  x.fillStyle = '#000';
  x.fillRect(ix, iy, vw, vh);
  x.imageSmoothingEnabled = smoothScale;
  const drawImg = (img) => {
    x.save();
    if (solarMode && img !== diffCanvas){
      if (CTX_FILTER_OK) x.filter = 'url(#solarCurve)';
      else img = solarizedCopy(img);   // Safari: LUT sobre copia offscreen
    }
    // CSS left/top are outside the transform. Scaling them shifts the export.
    x.drawImage(img, ox + pan.x, oy + pan.y, rw * zoom, rh * zoom);
    x.restore();
  };
  // aviso neutro de "sin este cuadro", el mismo texto y tono que el panel de la pantalla
  const drawMissing = (x0, x1) => {
    x.save();
    x.fillStyle = '#16161d'; x.fillRect(x0, iy, x1 - x0, vh);
    x.fillStyle = '#b4b4c2'; x.font = '600 13px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(T('Esta variante no tiene este cuadro'), (x0 + x1) / 2, iy + vh / 2, Math.max(20, x1 - x0 - 24));
    x.restore();
  };
  const divX = dividerPos * w;
  const split = clamp(divX, ix, ir);
  if (missA) drawMissing(ix, blinkMode ? ir : split); else drawImg(imgA);
  if (!blinkMode){
    x.save();
    x.beginPath();
    x.rect(split, iy, ir - split, vh);
    x.clip();
    if (missB) drawMissing(split, ir); else drawImg(diffLive ? diffCanvas : imgB);
    x.restore();
    // linea del divisor, solo dentro del contenido
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.fillRect(divX - 1, iy, 2, vh);
  } else if (imgB.style.opacity !== '0') {
    if (missB) drawMissing(ix, ir); else drawImg(imgB);
  }
  x.filter = 'none';
  // etiquetas DENTRO del area de contenido, pegadas a sus esquinas
  const ellipsis = (text, max) => {
    let s = text;
    if (x.measureText(s).width <= max) return s;
    while (s.length && x.measureText(s+'…').width > max) s = s.slice(0, -1);
    return s+'…';
  };
  const pill = (right, id) => {
    const name = variantName(id), stats = variantStats(id).split('\n').filter(Boolean);
    const maxWidth = Math.max(20, (vw-36)/2);
    x.font = '600 13px system-ui, sans-serif';
    const wName = x.measureText(name).width;
    x.font = '400 10px system-ui, sans-serif';
    const wStats = Math.max(0, ...stats.map(s => x.measureText(s).width));
    x.font = '600 13px system-ui, sans-serif';
    const pw = Math.min(maxWidth, Math.max(wName, wStats) + 20);
    const px2 = right ? ir-pw-12 : ix+12, py2 = iy+10;
    x.fillStyle = 'rgba(0,0,0,.75)';
    x.beginPath();
    x.roundRect(px2, py2, pw, 24+stats.length*14, 6);
    x.fill();
    x.fillStyle = blindMode ? '#e8e8f0' : variant(id).color || '#e8e8f0';
    x.fillText(ellipsis(name, pw-20), px2 + 10, py2 + 17);
    if (stats.length){
      x.font = '400 10px system-ui, sans-serif';
      x.fillStyle = '#c8c8d4';
      stats.forEach((s, i) => x.fillText(ellipsis(s, pw-20), px2+10, py2+31+i*14));
    }
  };
  if (vw >= 160 && vh >= 80){ pill(false, varA); pill(true, varB); }
  if (vw >= 108 && vh >= 60) drawBrand(x, ix+(vw-78)/2, ib-24);
  // el chip resume los modos activos: sin las entradas de parpadeo y Δ media,
  // un PNG congelado no indicaba su origen ni cuánto difiere el par
  const modes = [
    diffLive ? T`Diff ×${GAINS[gainIdx]}${heat ? T(' · calor') : ''} · Δ media ${diffData.mean.toFixed(2)}/255` : '',
    blinkMode ? T('Parpadeo A/B') : '',
    solarMode ? 'Solar' : '',
    blindMode ? T('Ciego') : '',
  ].filter(Boolean).join(' · ');
  if (modes && vw >= 160 && vh >= 100){
    x.font = '600 11px system-ui, sans-serif';
    const mw = Math.min(vw-16, x.measureText(modes).width+16);
    x.fillStyle = '#101014e6'; x.fillRect(ix+8, ib-54, mw, 18);
    x.fillStyle = '#ffb454'; x.fillText(ellipsis(modes, mw-16), ix+16, ib-41);
  }
  return c;
}

// el enlace directo a la prueba ciega: ?test=1, que el servidor ve y le da su propia tarjeta
// en Discord, sin imagen ni nombres (gatos-ops#336); al abrirlo, 50-boot lo vuelve #test=1
function testLink(){ const u = new URL(location.href); u.hash = ''; u.searchParams.set('test', '1'); return u.href; }

let shotUploader = null;
async function openShare(){
  if (shotUploader?.busy){ sharePanel.style.display = 'flex'; return; }
  let c;
  try { c = renderViewCanvas(); } catch(e){ alert(e.message); return; }
  const url = location.href.split('#')[0]+'#'+stateParams();
  const title = document.title || T('Comparación');
  const snapshotNames = [variantName(varA),variantName(varB)];
  const snapshotFrame = blindMode ? FRAMES.indexOf(frame)+1 : frame;
  $('shotUpload').hidden = true;
  $('shareUp').disabled = true;
  const rows = location.protocol === 'file:' || location.href === 'about:srcdoc' ? [] : [[T('Enlace a esta vista'), url]];
  if (rows.length && !blindMode && !$('testBtn').hidden) rows.push([T('Enlace directo a la prueba ciega'), testLink()]);
  $('shareBlindNote').hidden = !blindMode;
  $('shareCodes').replaceChildren(); $('shareCodes').style.display = 'none';
  $('shareOwner').hidden = true;
  shareRows.innerHTML = '';
  for (const [label, text] of rows){
    const l = document.createElement('div');
    l.style.cssText = 'font-size:11px; color:var(--dim); margin:6px 0 3px;';
    l.textContent = label;
    const box = document.createElement('textarea');
    box.readOnly = true;
    box.value = text;
    box.style.cssText = 'width:100%; height:36px; background:#23232e; color:#e8e8f0; border:1px solid #333; border-radius:6px; padding:5px 8px; font:11px ui-monospace,Menlo,Consolas,monospace; resize:none;';
    box.onclick = async () => {
      box.select();
      let ok = false;
      if (navigator.clipboard && window.isSecureContext){
        try { await navigator.clipboard.writeText(text); ok = true; } catch(e){}
      }
      if (!ok){ try { ok = document.execCommand('copy'); } catch(e){} }
      const hint = $('shareHint');
      hint.textContent = ok ? T('copiado ✓') : T('seleccionado: Ctrl+C');
      box.style.borderColor = ok ? '#7bd389' : '#ffb454';
      setTimeout(() => { hint.textContent = ''; box.style.borderColor = '#333'; }, 1500);
    };
    shareRows.appendChild(l);
    shareRows.appendChild(box);
  }
  sharePanel.style.display = 'flex';
  // generar la imagen de la vista actual
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob){ $('shareHint').textContent = T('No se pudo generar el PNG.'); return; }
  if (shareBlobUrl) URL.revokeObjectURL(shareBlobUrl);
  shareBlobUrl = URL.createObjectURL(blob);
  const prev = $('sharePreview');
  prev.src = shareBlobUrl;
  prev.style.display = 'block';
  const dl = $('shareDl');
  dl.style.display = 'inline-block';
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'x';
  shareName = `gatos-${slug(snapshotNames[0])}-vs-${slug(snapshotNames[1])}-${snapshotFrame}.png`;
  dl.onclick = () => {
    const a = document.createElement('a');
    a.href = shareBlobUrl;
    a.download = shareName;
    a.click();
  };
  // subir la imagen exacta y armar los formatos para compartir
  // una sola imagen por pagina: el link es siempre el mismo y no se rompe
  const m = location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/);
  const up = $('shareUp');
  if (!m){ up.style.display = 'none'; $('shareDel').style.display = 'none'; return; }
  $('shareDel').style.display = 'block';
  $('pageDelete').onclick = async () => {
    const key = ($('shareKey').value || '').trim();
    if (!key){
      $('shareHint').textContent = T('pega la llave de borrado para poder eliminar la página');
      $('shareKey').focus();
      return;
    }
    if (!confirm(T('¿Borrar esta página y su imagen compartida? No se puede deshacer.'))) return;
    const btn = $('pageDelete');
    btn.disabled = true; btn.textContent = T('Borrando…');
    try {
      const resp = await fetch('/api/page/' + m[1], { method: 'DELETE', headers: { 'x-delete-key': key, 'accept-language': I18N.lang } });
      if (!resp.ok){
        let j = null; try { j = await resp.json(); } catch(e){}
        throw new Error((j && j.error) || ('HTTP ' + resp.status));
      }
      alert(T('Página borrada.'));
      location.href = '/';
    } catch (e) {
      alert(T`No se pudo borrar: ${e.message}`);
      btn.disabled = false; btn.textContent = T('Borrar esta página…');
    }
  };
  $('shareUseKey').onclick = () => {
    try { $('shareKey').value = sessionStorage.getItem('gatosOwner:'+m[1]) || ''; } catch(e){}
    $('shareUseKey').hidden = true;
  };
  up.style.display = 'inline-block';
  up.disabled = false;
  $('shareOwner').hidden = false;
  addVerSetup(m[1]);   // sumar una versión con la llave (42-addversion.js, #342)
  // la llave de borrado ya no se autocompleta ni persiste para siempre: migra
  // a sessionStorage (vive una sesion) y se pega explicitamente (ops#97/#100 —
  // un marco hostil no hereda la llave lista para un solo clic)
  try {
    const lk = 'gatosOwner:'+m[1];
    const oldKey = localStorage.getItem(lk);
    if (oldKey !== null){ sessionStorage.setItem(lk, oldKey); localStorage.removeItem(lk); }
    if (sessionStorage.getItem(lk)) $('shareUseKey').hidden = false;
  } catch(e){}
  shotUploader = new GatosUpload({
    panel:$('shotUpload'), progress:$('shotProgress'), status:$('shotStatus'),
    cancel:$('shotCancel'), retry:$('shotRetry'),
    retryCaution:T('La imagen pudo actualizarse. Reintentar reemplaza la misma URL.'),
    onBusy:busy => { up.disabled = busy; $('shareKey').disabled = busy; },
    onSuccess:j => {
      const page = url;
      const codes = [
        [T('BBCode (foros, la vista exacta clicable)'), '[url=' + page + '][img]' + j.url + '[/img][/url]'],
        ['Markdown', '[![' + title.replace(/[\[\]\\]/g, '\\$&') + '](' + j.url + ')](' + page + ')'],
        ['HTML', '<a href="' + escq(page) + '"><img src="' + escq(j.url) + '" alt="' + escq(title) + '" loading="lazy"></a>'],
        [T('Imagen directa'), j.url],
      ];
      const host2 = $('shareCodes');
      host2.innerHTML = '';
      for (const [label, text] of codes){
        const l = document.createElement('div');
        l.style.cssText = 'font-size:11px; color:var(--dim); margin:10px 0 3px;';
        l.textContent = label;
        const box = document.createElement('textarea');
        box.readOnly = true;
        box.value = text;
        box.style.cssText = 'width:100%; height:40px; background:#23232e; color:#e8e8f0; border:1px solid #333; border-radius:6px; padding:5px 8px; font:11px ui-monospace,Menlo,Consolas,monospace; resize:none;';
        box.onclick = async () => {
          box.select();
          let ok2 = false;
          if (navigator.clipboard && window.isSecureContext){ try { await navigator.clipboard.writeText(text); ok2 = true; } catch(e){} }
          if (!ok2){ try { ok2 = document.execCommand('copy'); } catch(e){} }
          $('shareHint').textContent = ok2 ? T('copiado ✓') : T('seleccionado: Ctrl+C');
          box.style.borderColor = ok2 ? '#7bd389' : '#ffb454';
          setTimeout(() => { $('shareHint').textContent = ''; box.style.borderColor = '#333'; }, 1500);
        };
        host2.appendChild(l);
        host2.appendChild(box);
      }
      host2.style.display = 'block';
    }
  });
  up.onclick = () => {
    const key = $('shareKey').value.trim();
    if (!key){ $('shareHint').textContent = T('Ingresa la llave que recibiste al publicar.'); $('shareKey').focus(); return; }
    shotUploader.start(async () => ({url:'/api/shot/'+m[1],
      headers:{'content-type':'image/png','x-delete-key':key,'accept-language':I18N.lang}, body:blob}));
  };
}
$('shareBtn').addEventListener('click', openShare);
/* ---------- reporte de pagina (solo paginas /p/) ---------- */
function closeReport(){
  if (reportPanel.style.display === 'flex'){ reportPanel.style.display = 'none'; $('reportBtn').focus(); }
}
{
  const rm = location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/);
  const rBtn = $('reportBtn');
  if (rm){
    rBtn.style.display = '';
    rBtn.onclick = () => { reportPanel.style.display = 'flex'; $('reportReason').focus(); };
    $('reportClose').onclick = closeReport;
    $('reportSend').onclick = async () => {
      const send = $('reportSend');
      send.disabled = true; send.textContent = T('Enviando…');
      try {
        const resp = await fetch('/api/report/' + rm[1], {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: $('reportReason').value, note: $('reportNote').value }),
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        $('reportStatus').textContent = T('Reporte enviado. Gracias.');
        setTimeout(() => { closeReport(); $('reportStatus').textContent = ''; }, 1400);
      } catch (e) {
        $('reportStatus').textContent = T`No se pudo enviar: ${e.message}`;
      } finally {
        send.disabled = false; send.textContent = T('Enviar reporte');
      }
    };
    for (const ev of ['pointerdown','mousedown','touchstart'])
      reportPanel.addEventListener(ev, e => e.stopPropagation());
  }
}
$('shareClose').addEventListener('click', closeShareIfOpen);
function closeShareIfOpen(){ if (sharePanel.style.display === 'flex'){ sharePanel.style.display = 'none'; $('shareBtn').focus(); } }
for (const ev of ['pointerdown','mousedown','touchstart','wheel'])
  sharePanel.addEventListener(ev, e => e.stopPropagation());

/* ---------- sumar una versión a una página publicada (gatos-ops#342) ----------
   Quien publicó, con su llave de borrado, sube una imagen por frame y la página
   la suma al final como versión nueva (PATCH /api/page/<código>): solo viajan
   esas imágenes, lo demás queda igual. Las imágenes se ordenan por nombre de
   archivo y van a los frames en el orden de la página (la lista lo muestra antes
   de enviar); se comprueba que sean una por frame y que midan lo mismo que las
   de la página. Reintentar es seguro: el mismo id reemplaza a la misma versión. */
let addVerUploader = null, addVerFiles = [], addVerGen = 0;
const ADDVER_MAX = 12;   // el servicio acepta páginas de 2 a 12 versiones
const ADDVER_MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp' };
// id desde el nombre: [a-z0-9-], nunca uno reservado ni uno que la página ya tenga
function addVerId(name){
  let base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  if (!base || base === 'constructor' || base === 'prototype') base = 'v' + (VARIANTS.length + 1);
  const taken = new Set(VARIANTS.map(v => String(v.id)));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = base.slice(0, 20) + '-' + n;
  return id;
}
function addVerDims(file){
  return new Promise(resolve => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); resolve([im.naturalWidth, im.naturalHeight]); };
    im.onerror = () => { URL.revokeObjectURL(u); resolve(null); };
    im.src = u;
  });
}
function addVerRead(file){
  const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1];
  const typed = new Blob([file], { type: file.type || ADDVER_MIME[String(ext).toLowerCase()] || 'application/octet-stream' });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error(T`No se pudo leer ${file.name}.`));
    r.readAsDataURL(typed);
  });
}
function addVerRender(){
  const list = $('addVerFrames');
  list.replaceChildren(...FRAMES.map((f, i) => {
    const li = document.createElement('li');
    li.textContent = (FRAME_LABELS[f] || String(f)) + ' ← ' + (addVerFiles[i] ? addVerFiles[i].name : '—');
    return li;
  }));
}
// true si se puede enviar; si no, la nota dice qué falta
async function addVerCheck(){
  const gen = ++addVerGen, note = $('addVerNote'), send = $('addVerSend');
  send.disabled = true;
  addVerRender();
  const say = (t) => { if (gen === addVerGen) note.textContent = t; return false; };
  if (VARIANTS.length >= ADDVER_MAX) return say(T`La página ya tiene ${ADDVER_MAX} versiones, el máximo.`);
  if (!addVerFiles.length) return say(T`Elige ${FRAMES.length} imágenes, una por frame.`);
  if (addVerFiles.length !== FRAMES.length) return say(T`Elegiste ${addVerFiles.length} imágenes y la página tiene ${FRAMES.length} frames.`);
  const want = imgA.naturalWidth ? [imgA.naturalWidth, imgA.naturalHeight] : null;   // sin medida a mano, la controla el servicio
  for (const f of addVerFiles){
    const d = await addVerDims(f);
    if (gen !== addVerGen) return false;
    if (!d) return say(T`No se pudo leer ${f.name} como imagen.`);
    if (want && (d[0] !== want[0] || d[1] !== want[1])) return say(T`${f.name} mide ${d[0]}x${d[1]} y las imágenes de la página ${want[0]}x${want[1]}.`);
  }
  if (!$('addVerName').value.trim()) return say(T('Ponle un nombre a la versión.'));
  const mib = (addVerFiles.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(1);
  say(T`Listo para enviar: ${addVerFiles.length} imágenes, ${mib} MiB.`);
  if (gen === addVerGen) send.disabled = false;
  return gen === addVerGen;
}
function addVerSetup(token){
  $('addVer').hidden = false;
  if (addVerUploader) return;
  $('addVerOpen').onclick = () => {
    const form = $('addVerForm'), open = form.hidden;
    form.hidden = !open; $('addVerOpen').setAttribute('aria-expanded', String(open));
    if (open){ addVerCheck(); $('addVerName').focus(); }
  };
  $('addVerFiles').onchange = () => {
    addVerFiles = [...$('addVerFiles').files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    addVerCheck();
  };
  $('addVerName').oninput = () => addVerCheck();
  addVerUploader = new GatosUpload({
    panel: $('addVerUpload'), progress: $('addVerProgress'), status: $('addVerStatus'),
    cancel: $('addVerCancel'), retry: $('addVerRetry'),
    retryCaution: T('Reintentar es seguro: vuelve a sumar la misma versión.'),
    onBusy: busy => { for (const id of ['addVerSend', 'addVerName', 'addVerFiles', 'shareKey']) $(id).disabled = busy; if (!busy) addVerCheck(); },
    onSuccess: () => { $('addVerStatus').textContent = T('Versión añadida. Recargando la página…'); setTimeout(() => location.reload(), 900); },
  });
  $('addVerSend').onclick = async () => {
    const key = $('shareKey').value.trim();
    if (!key){ $('shareHint').textContent = T('Ingresa la llave que recibiste al publicar.'); $('shareKey').focus(); return; }
    if (!(await addVerCheck())) return;
    const name = $('addVerName').value.trim(), id = addVerId(name), files = addVerFiles.slice(), frames = FRAMES.slice();
    addVerUploader.start(async (cancelled) => {
      const images = {};
      for (let i = 0; i < frames.length; i++){
        if (cancelled()) return null;
        images[`${id}_${frames[i]}`] = await addVerRead(files[i]);
      }
      const body = new Blob([JSON.stringify({ format: 'gatos.pics/cmp@1', manifest: { variants: [{ id, name }] }, images })], { type: 'application/json' });
      return { url: '/api/page/' + token, method: 'PATCH', headers: { 'content-type': 'application/json', 'x-delete-key': key }, body };
    });
  };
}

/* ---------- prueba ciega: qué comparar, según lo que se va respondiendo (gatos-ops#347) ----------
   Antes la prueba ordenaba por inserción binaria: una versión que entraba tarde podía quedar 2ª con
   dos comparaciones, y su lugar se deducía del resto. Ahora cada comparación es UN cuadro entre dos
   versiones y se elige con lo respondido hasta ahí. La idea: la basura obvia necesita pocas
   comparaciones, las mejores necesitan muchas.
   1. Cada versión juega primero un mínimo (testMin, 2) contra rivales distintos, de puntuación
      parecida a la suya: la que pierde dos veces ya se ve, y nadie sube con un solo acierto.
   2. El resto va a las que pelean arriba: el par más parejo entre las primeras, el que menos se ha
      enfrentado, en un cuadro que ese par no usó (el que menos se vio en la prueba).
   Termina cuando el orden de las primeras está claro (testClear) o se acaba el presupuesto
   (testBudget: 15 con hasta 5 versiones, 3 por versión con 6 a 8; la página puede cambiar ambos con
   blind.min y blind.budget). El resultado sale de la misma cuenta que la tabla de todos
   (Bradley-Terry, service/lib/rank.mjs): testStrengths y testGroups. El plan es un generador
   determinista dado `run` (orden de entrada, cuadros y lados sorteados): «Atrás», retomar y la
   precarga lo rehacen igual con las respuestas dadas.

   Prueba rápida (gatos-ops#354): a quien ya mandó un resultado y vuelve cuando la página tiene
   versiones sin comparar (nuevas, o con imágenes reemplazadas), el servidor le devuelve las
   comparaciones de aquel resultado que siguen valiendo (run.session.prior, en números). El plan
   arranca con ellas ya respondidas: solo juegan las versiones sin su mínimo, primero contra las ya
   ordenadas, y después, si alguna quedó arriba, contra las que pelean con ella. Como mucho
   TEST_QUICK comparaciones por versión sin comparar. */
const TEST_PRIOR = 2, TEST_MIN = 2, TEST_QUICK = 4;
const testMin = cfg => { const m = Math.round(Number(cfg.min)); return m >= 1 && m <= 6 ? m : TEST_MIN; };
const testBudget = (n, cfg) => { const b = Math.round(Number(cfg.budget)); return b >= n && b <= 60 ? b : n <= 5 ? 15 : 3 * n; };
// prueba rápida: las comparaciones de antes con los ids de esta prueba, y las versiones que no llegan al mínimo con ellas
const testPriorGames = run => run.quick && run.session && Array.isArray(run.session.prior) ? run.session.prior.map(([a, b, f, r]) => ['n' + a, 'n' + b, String(f), r]) : [];
function testFresh(run){
  const c = new Map(run.order.map(i => [i, 0]));
  for (const [a, b] of testPriorGames(run)){ if (c.has(a)) c.set(a, c.get(a) + 1); if (c.has(b)) c.set(b, c.get(b) + 1); }
  return run.order.filter(i => c.get(i) < testMin(run.blind || {}));
}
// comparaciones nuevas como mucho, sin «seguir» ni comprobaciones
const testPlanned = run => run.quick ? TEST_QUICK * testFresh(run).length : testBudget(run.order.length, run.blind || {});
// fuerza de cada versión (la promedio vale 1); cada una arranca con TEST_PRIOR ganadas y perdidas contra la promedio
function testStrengths(ids, games){
  const W = new Map(ids.map(i => [i, TEST_PRIOR])), N = new Map(ids.map(i => [i, new Map()]));
  for (const [a, b, , r] of games){
    if (!N.has(a) || !N.has(b) || a === b) continue;
    if (r === 't'){ W.set(a, W.get(a) + .5); W.set(b, W.get(b) + .5); } else { const w = r === 'a' ? a : b; W.set(w, W.get(w) + 1); }
    N.get(a).set(b, (N.get(a).get(b) || 0) + 1); N.get(b).set(a, (N.get(b).get(a) || 0) + 1);
  }
  let f = new Map(ids.map(i => [i, 1]));
  for (let it = 0; it < 2000; it++){
    const next = new Map(); let move = 0;
    for (const i of ids){
      let den = 2 * TEST_PRIOR / (f.get(i) + 1);
      for (const [j, n] of N.get(i)) den += n / (f.get(i) + f.get(j));
      const v = W.get(i) / den;
      move = Math.max(move, Math.abs(v - f.get(i)) / f.get(i));
      next.set(i, v);
    }
    f = next;
    if (move < 1e-10) break;
  }
  return f;
}
// grupos de mejor a peor; las de igual fuerza (todo empates, por ejemplo) comparten puesto
function testGroups(ids, games){
  const f = testStrengths(ids, games), out = [];
  for (const x of ids.map((id, k) => ({id, s: Math.log(f.get(id)), k})).sort((a, b) => b.s - a.s || a.k - b.k)){
    const last = out[out.length - 1];
    if (last && Math.abs(last.s - x.s) < 1e-9) last.ids.push(x.id); else out.push({s: x.s, ids: [x.id]});
  }
  return out.map(g => g.ids);
}
// el orden de las primeras ya está claro: cada una le saca a la siguiente al menos 1.2 (≈ 77 % de
// ganarle) y se enfrentaron de verdad. Con 2 versiones son 3 seguidas; con más, casi siempre se juega
// el presupuesto entero (medido con jueces simulados)
function testClear(order, th, met, top){
  for (let i = 0; i < top; i++){ const a = order[i], b = order[i + 1]; if (th(a) - th(b) < 1.2 || !met(a, b)) return false; }
  return true;
}
function* testPlan(run){
  const cfg = run.blind || {}, ids = run.order, n = ids.length, min = testMin(cfg), top = Math.min(3, n - 1);
  const budget = testPlanned(run) + (run.more || 0) * n, quick = !!run.quick, fresh = quick ? testFresh(run) : [];
  const pk = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const count = new Map(ids.map(i => [i, 0])), meets = new Map(), used = new Map(), seenF = new Map();
  const met = (a, b) => meets.get(pk(a, b)) || 0;
  const left = (a, b) => run.frames.filter(f => hasFrame(a, f) && hasFrame(b, f) && !(used.get(pk(a, b)) || []).includes(String(f)));
  let k = 0;
  // prueba rápida: lo de antes cuenta como ya jugado (no gasta presupuesto)
  for (const [a, b, f, r] of testPriorGames(run)){
    if (!count.has(a) || !count.has(b)) continue;
    run.games.push([a, b, f, r]);
    count.set(a, count.get(a) + 1); count.set(b, count.get(b) + 1);
    meets.set(pk(a, b), met(a, b) + 1);
    used.set(pk(a, b), [...(used.get(pk(a, b)) || []), f]);
    seenF.set(f, (seenF.get(f) || 0) + 1);
  }
  function* play(x, y){
    const fs = left(x, y); if (!fs.length) return false;
    const f = fs.reduce((best, g) => (seenF.get(String(g)) || 0) < (seenF.get(String(best)) || 0) ? g : best, fs[0]);
    const key = pk(x, y) + '|' + f;
    if (!run.flips.has(key)) run.flips.set(key, Math.random() < .5);
    const g = run.flips.get(key) ? {a: y, b: x, f} : {a: x, b: y, f}, r = yield g;
    run.games.push([g.a, g.b, String(f), r]);
    count.set(x, count.get(x) + 1); count.set(y, count.get(y) + 1);
    meets.set(pk(x, y), met(x, y) + 1);
    used.set(pk(x, y), [...(used.get(pk(x, y)) || []), String(f)]);
    seenF.set(String(f), (seenF.get(String(f)) || 0) + 1);
    if (++k === 1 && cfg.control) yield* testControl(run, x);
    return true;
  }
  const ranked = () => {
    const f = testStrengths(ids, run.games);
    return {th: id => Math.log(f.get(id)), order: ids.slice().sort((a, b) => f.get(b) - f.get(a) || ids.indexOf(a) - ids.indexOf(b))};
  };
  // 1. el mínimo para todas: la que menos jugó, contra la rival más cercana que menos enfrentó
  // (en la rápida, contra las ya ordenadas antes que contra otra sin comparar)
  const short = id => (count.get(id) < min) * (quick ? -1 : 1);
  while (k < budget){
    const {order} = ranked(), pos = id => order.indexOf(id);
    const x = ids.filter(i => count.get(i) < min).sort((a, b) => count.get(a) - count.get(b) || pos(a) - pos(b))[0];
    if (x === undefined) break;
    const y = ids.filter(o => o !== x && left(x, o).length).sort((a, b) => met(x, a) - met(x, b)
      || short(b) - short(a) || Math.abs(pos(a) - pos(x)) - Math.abs(pos(b) - pos(x)) || ids.indexOf(a) - ids.indexOf(b))[0];
    if (y === undefined || !(yield* play(x, y))) count.set(x, min);   // no queda con qué compararla
  }
  // 2. el resto, a las que pelean arriba: las primeras y las que no están a más de 0.7 (≈ 67 %) de ellas
  while (k < budget){
    const {th, order} = ranked();
    if (!run.more && testClear(order, th, met, top)) break;
    const cut = th(order[top - 1]) - .7, cont = order.filter((id, i) => i < top || th(id) >= cut);
    let best = null;
    for (let i = 0; i < cont.length; i++) for (let j = i + 1; j < cont.length; j++){
      const a = cont[i], b = cont[j];
      if (!left(a, b).length) continue;
      if (quick && !run.more && !fresh.includes(a) && !fresh.includes(b)) continue;   // la rápida solo afina lo nuevo
      const cost = Math.abs(th(a) - th(b)) + .2 * met(a, b) + .1 * j;   // parejas, poco vistas, cerca de arriba
      if (!best || cost < best[0]) best = [cost, a, b];
    }
    if (!best) break;
    yield* play(best[1], best[2]);
  }
  if (cfg.repeat) yield* testRepeats(run, cfg.repeat);
  return testGroups(ids, run.games);
}

/* ---------- prueba ciega: ordenar las versiones a ciegas (gatos-ops#196, #200) ----------
   Durante la prueba ninguna versión tiene nombre ni número en pantalla
   (gatos-ops#230): solo «Izquierda» y «Derecha», y el lado se sortea en cada
   comparación. Así no se sabe si la de ahora es la que ya se eligió antes.
   Por dentro cada versión sí tiene un número al azar (blindOrder): es como
   las respuestas viajan al servidor.

   La prueba no recorre todos los pares: elige cada comparación (un cuadro entre dos
   versiones) con lo que se va respondiendo (44-plan.js, gatos-ops#347): primero un mínimo
   para cada versión, después casi todo para las que pelean arriba, y para cuando el orden de
   las primeras queda claro o se acaba el presupuesto. El orden sale de la misma cuenta que la
   tabla de todos (Bradley-Terry): lo que no se comparó se estima con lo que sí.

   Al final salen los puestos con los nombres revelados, y en una página
   publicada el resultado se suma solo a la tabla de todos (/api/vote/<token>):
   la introducción lo avisa antes de empezar. Un navegador suma una vez por
   página. Usa el modo ciego del visor: blindOrder ES la numeración.

   En una página publicada la numeración la sortea el SERVIDOR (#207): el
   visor abre una sesión (/api/blind/<token>) y recibe solo números y
   direcciones al azar para las imágenes. Mientras dura la prueba VARIANTS son
   versiones de mentira («n1», «n2»…): ni este código ni las herramientas del
   navegador saben cuál es cuál. Al terminar manda las respuestas en números y
   el servidor contesta qué versión era cada uno. Sin sesión (copia sin
   publicar, o el servidor no responde) la numeración se sortea aquí y las
   imágenes van como blob.

   Una prueba a medias sobrevive a salir de la página (gatos-ops#222): con
   sesión, tras cada respuesta el navegador guarda en su propio almacenamiento
   lo que hace falta para rehacerla (la sesión: números y direcciones al azar;
   el orden y las respuestas). Al volver se ofrece seguir. Nada de eso dice
   qué versión es cada número, y nada nuevo se guarda en el servidor.

   Un enlace con ?test=1 (o #test=1, el de antes) abre la página directo en la introducción
   (gatos-ops#223, #336), sobre fondo opaco: la comparación normal, con sus nombres a
   cada lado, no se ve detrás. La introducción dice qué versiones se comparan,
   en el orden de la página (no dice qué número le toca a cada una). */
const TEST_MAX = 12, TEST_KEEP_MS = 2 * 3600e3;   // versiones como mucho: las de una página (gatos-ops#380; antes 8); lo que vive una sesión en el servidor
let testRun = null, testMine = null, testSeen = false;
const testToken = (location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/) || [])[1] || null;
const testPanel = $('testPanel'), testBody = $('testBody');
const shuffled = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const testPairs = () => VARIANTS.flatMap((a, i) => VARIANTS.slice(i + 1).map(b => [a.id, b.id]));
const testShared = (a, b, frames = FRAMES) => frames.filter(f => hasFrame(a, f) && hasFrame(b, f));
// se ofrece con 2 a 12 versiones y solo si cada par comparte al menos un cuadro
const testOk = () => VARIANTS.length >= 2 && VARIANTS.length <= TEST_MAX && testPairs().every(([a, b]) => testShared(a, b).length > 0);
/* Comprobaciones (gatos-ops#312), si la página las pide en su manifiesto (`blind`). Son comparaciones
   de más que NO entran en el resultado: dicen qué tan firmes fueron las respuestas.
   - control: una vez, la misma versión en los dos lados. Quien elige un lado adivina.
   - repeat: al final, una o dos comparaciones ya respondidas, con los lados cambiados.
   Salen del mismo plan, así «Atrás», retomar y «seguir» las rehacen igual que a las demás. */
function* testControl(run, v){
  const f = run.frames.find(f => hasFrame(v, f)); if (f === undefined) return;
  const key = 'c|' + v + '|' + f; let r = run.chkKnown ? run.chkKnown.get(key) : undefined;
  if (r === undefined) r = yield {a: v, b: v, f, chk: 'control'};
  run.checks.push({k: 'control', key, v, f, r});
}
function* testRepeats(run, n){
  const dec = run.games.filter(g => g[3] !== 't');
  const pick = [...new Set(n === 1 ? [dec[dec.length >> 1]] : [dec[0], dec[dec.length - 1]])].filter(Boolean);
  for (const [a, b, f, r] of pick){
    const key = 'r|' + [a, b].sort().join('|') + '|' + f; let r2 = run.chkKnown ? run.chkKnown.get(key) : undefined;
    if (r2 === undefined) r2 = yield {a: b, b: a, f, chk: 'repeat'};   // los lados, al revés
    const first = r === 'a' ? a : b, again = r2 === 't' ? null : r2 === 'a' ? b : a;
    run.checks.push({k: 'repeat', key, a, b, f, r: r2, same: again === first});
  }
}
const testEsc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const testName = id => `<b style="color:${testEsc(variant(id).color || '#e8e8f0')}">${testEsc(variant(id).name || id)}</b>`;
const testHttp = () => !!testToken && location.protocol !== 'file:';
// La marca «ya envié» de este navegador vale para una época de la tabla
// (gatos-ops#218): guarda la época en que se sumó, o '1' si la página nunca se
// reinició. testEpoch: undefined = todavía no se sabe (entonces la marca vale).
let testEpoch;
const testMark = () => { try { return localStorage.getItem('gatosVoted:' + testToken); } catch(e){ return null; } };
const testVoted = () => { const m = testMark(); return !!m && (testEpoch === undefined || m === (testEpoch || '1')); };
// Sello del resultado que este navegador ya sumó (gatos-ops#252): lo da el
// servidor, es opaco, y al repetir la prueba se devuelve para que el resultado
// nuevo reemplace a aquel. Vale para la época en que se emitió, como la marca.
const testSealKey = 'gatosSeal:' + testToken;
function testSeal(){
  try { const j = JSON.parse(localStorage.getItem(testSealKey)); return j && typeof j.s === 'string' && testVoted() && j.e === testMark() ? j.s : null; } catch(e){ return null; }
}
const testKeepSeal = s => { try { if (s) localStorage.setItem(testSealKey, JSON.stringify({e: testEpoch || '1', s})); } catch(e){} };
// este resultado cuenta: el navegador todavía no sumó en esta época, o tiene con qué reemplazar lo que sumó
const testCounts = () => !testVoted() || !!testSeal();
// en una copia sin publicar la clave es su ruta; la vista previa incrustada (about:srcdoc) no guarda nada
const testLocalOk = !testToken && location.protocol !== 'about:' && !/^about:/.test(location.href);
const testKey = 'gatosTest:' + (testToken || location.pathname);
function testSave(){
  const run = testRun; if (!run || !(run.session || testLocalOk)) return;
  // sin sesión (gatos-ops#264) se guarda también la numeración y el orden de los cuadros: en una copia local no hay servidor que los recuerde
  const local = run.session ? null : {ids: blindOrder.map(v => v.id), frames: run.frames};
  try { localStorage.setItem(testKey, JSON.stringify({v: 2, t: run.t, s: run.session, local, order: run.order, flips: [...run.flips], extra: [...run.extra], chk: run.chkKnown ? [...run.chkKnown] : null, answers: run.answers, more: run.more || 0, held: run.held, q: !!run.quick})); } catch(e){}
}
const testForget = () => { try { localStorage.removeItem(testKey); } catch(e){} };
// la prueba a medias de esta página, si la hay, respondió algo y su sesión todavía puede estar viva
function testSaved(){
  if (!(testHttp() || testLocalOk) || testRun) return null;
  try {
    const j = JSON.parse(localStorage.getItem(testKey));
    if (!j || j.v !== 2 || Date.now() - j.t >= TEST_KEEP_MS || !j.answers.length) return null;   // v2 (#347): una prueba del plan de antes no se retoma
    if (testHttp() && j.s && j.s.sid && j.s.n === VARIANTS.length) return j;
    // copia local: vale si sigue teniendo exactamente esas versiones y esos cuadros
    if (testLocalOk && j.local && j.local.ids.length === VARIANTS.length && j.local.ids.every(id => VARIANTS.some(v => v.id === id))
      && j.local.frames.every(f => FRAMES.some(x => String(x) === String(f)))) return j;
  } catch(e){}
  return null;
}
function testOpen(html){ testSeeEnd(); testBody.innerHTML = html; testPanel.style.display = 'flex'; const b = testBody.querySelector('button'); if (b) b.focus(); }
function testClose(){ if (testRun && testRun.settled) return;   // hay que elegir: ver el resultado o seguir
  testPanel.classList.remove('solid');
  if (testPanel.style.display === 'flex'){ testPanel.style.display = 'none'; $('testBtn').focus(); } }

// el botón (o G): si hay una prueba a medias, primero se ofrece seguirla
function testEnter(){ if (testOpening) return; const saved = testSaved(); if (saved) testOffer(saved); else testIntro(); }
function testOffer(saved){
  const n = saved.answers.length;
  testOpen(`<h2>${T('Prueba ciega a medias')}</h2>
    <p>${n === 1 ? T('Dejaste una prueba ciega sin terminar en esta página, con 1 respuesta.') : T`Dejaste una prueba ciega sin terminar en esta página, con ${n} respuestas.`} ${T('Puedes seguir donde ibas.')}</p>
    <p class="hint" id="testNote" role="status"></p>
    <div class="acts"><button class="xbtn" data-test="resume">${T('Seguir la prueba')}</button><button data-test="fresh">${T('Empezar otra')}</button><button data-test="close">${T('Ahora no')}</button></div>`);
}
// La sesión vive en la memoria del servidor: si venció o el servicio se
// reinició ya no hay cómo pedir sus imágenes, y la prueba empieza de nuevo.
async function testResume(){
  const saved = testSaved(); if (!saved){ testIntro(); return; }
  const btn = testBody.querySelector('[data-test="resume"]'); if (btn) btn.disabled = true;
  if (saved.local){ testStart(saved); return; }   // copia local: no hay sesión que pueda haber vencido
  let alive = false;
  try { alive = (await fetch('b/' + Object.values(saved.s.pics[1])[0], {method: 'HEAD', signal: testWait()})).ok; } catch(e){}
  // la tabla pudo reiniciarse mientras tanto: la época de ahora, no la guardada
  if (alive) try { const j = await (await fetch('/api/vote/' + testToken, {signal: testWait()})).json(); testEpoch = j.epoch || null; } catch(e){}
  if (testRun) return;
  if (alive){ testStart(saved); return; }
  testForget();
  testIntro(T('La prueba que dejaste ya venció: hay que empezar otra.'));
}
/* Aviso de privacidad (gatos-ops#310). Desde que quien publica puede ver el detalle de cada resultado,
   ya no es cierto que «no se guarda nada»: aquí se dice qué se guarda, qué no, quién lo ve y hasta cuándo. */
const testPrivLink = `<button class="tlink" data-test="privacy">${T('Qué se guarda')}</button>`;
function testPrivacy(back){
  testOpen(`<h2>${T('Privacidad de la prueba ciega')}</h2>
    <p><b>${T('Qué se guarda:')}</b> ${T('tus respuestas (qué lado elegiste en cada comparación), lo que marques o escribas en «¿Por qué?», cuánto tardaste en cada respuesta y la hora del envío, redondeada al minuto.')}</p>
    <p><b>${T('Qué no se guarda:')}</b> ${T('tu dirección, tu navegador, una cuenta ni cookies de seguimiento. Tu resultado no lleva nada que diga quién eres. La dirección se usa un momento para frenar abusos y no se guarda.')}</p>
    <p><b>${T('Quién lo ve:')}</b> ${T('la tabla con los totales es pública. El detalle (respuestas, motivos y notas) solo lo ve quien publicó la página.')}</p>
    <p><b>${T('Hasta cuándo:')}</b> ${T('mientras exista la página, o hasta que quien la publicó reinicie sus resultados.')}</p>
    <p class="hint">${T('En tu navegador queda una marca para que repetir la prueba reemplace tu resultado en vez de sumar otro. Si escribes una nota, no pongas datos personales.')}</p>
    <div class="acts"><button class="xbtn" data-test="${back === 'mine' ? 'mine' : 'intro'}">${T('Volver')}</button></div>`);
}
function testIntro(note){
  const n = VARIANTS.length, hi = testBudget(n, BLIND_CFG);
  testOpen(`<h2>${T('Prueba ciega')}</h2>
    <p>${T`Vas a ordenar las ${n} versiones de mejor a peor sin saber cuál es cuál. En cada comparación solo ves «izquierda» y «derecha»: nada dice qué versión es ni si ya la viste antes.`}</p>
    <p id="testNames">${T('Se comparan:')} ${VARIANTS.map(v => testName(v.id)).join(', ')}.</p>
    <p>${n === 2 ? T`Son como mucho ${hi} comparaciones.` : T`Son como mucho ${hi} comparaciones, y suelen ser bastantes menos: la prueba elige cada una según lo que vas respondiendo y se detiene cuando el orden queda claro.`} ${T('En cada una eliges la que se ve mejor, o empate. Puedes usar zoom, diff y parpadeo.')}</p>
    ${BLIND_CFG.repeat || BLIND_CFG.control ? `<p id="testChkNote">${T('En esta página algunas comparaciones se repiten o son de control: sirven para saber qué tan firmes son las respuestas y no cambian tu resultado.')}</p>` : ''}
    ${testAreas() ? `<p id="testAreaNote">${T('En esta página las versiones no tienen la misma área de imagen: durante la prueba solo se ve la parte que todas comparten.')}</p>` : ''}
    ${testHttp() ? `<p id="testIntroNote">${testSeal() ? T('Ya enviaste un resultado de esta página desde este navegador: si terminas esta prueba, el nuevo reemplaza al anterior.') + ' ' + T('Si la página tiene versiones nuevas desde entonces, puedes comparar solo esas.') : testVoted() ? T('Ya enviaste un resultado de esta página desde este navegador: esta prueba no se suma otra vez.') : T('Al terminar, tu resultado se suma a la tabla de todos.') + ' ' + testPrivLink}</p>` : ''}
    <div class="acts"><button class="xbtn" data-test="start">${T('Empezar')}</button>${testToken ? `<button data-test="all">${T('Ver la tabla de todos')}</button>` : ''}${testHttp() ? `<button data-test="link" title="${T('Copia el enlace que abre esta página directo en la prueba ciega')}">${T('Copiar enlace a la prueba')}</button>` : ''}<button data-test="close">${T('Cancelar')}</button></div>
    ${testToken ? `<p class="hint">${T('Ver la tabla antes de hacer la prueba condiciona tu juicio.')}</p>` : ''}
    ${typeof note === 'string' ? `<p class="hint" role="status">${testEsc(note)}</p>` : ''}`);
  // con marca y sin saber la época: se pregunta una vez, por si la tabla se reinició después
  if (testHttp() && testMark() && testEpoch === undefined && !testIntro.asked){
    testIntro.asked = true;
    fetch('/api/vote/' + testToken).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || testEpoch !== undefined) return;
      testEpoch = j.epoch || null;
      if (!testRun && testPanel.style.display === 'flex' && testBody.querySelector('#testIntroNote')) testIntro(note);
    }).catch(() => {});
  }
}
// el enlace directo a la prueba (testLink), también desde la introducción (gatos-ops#226)
async function testCopyLink(btn){
  const url = testLink();
  let ok = false;
  if (navigator.clipboard && window.isSecureContext){ try { await navigator.clipboard.writeText(url); ok = true; } catch(e){} }
  if (!ok){ prompt(T('Copia este enlace:'), url); return; }
  btn.textContent = T('copiado ✓');
  setTimeout(() => { if (btn.isConnected) btn.textContent = T('Copiar enlace a la prueba'); }, 1500);
}
let testOpening = false;
// ninguna petición de la prueba espera para siempre (gatos-ops#239)
const testWait = () => typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined;
// pre (gatos-ops#354): la sesión ya abierta y si la prueba es la rápida, cuando se eligió en testQuickOffer
async function testStart(saved, pre){
  if (testRun || testOpening) return;
  testSeeEnd();
  let session = saved ? saved.s : pre ? pre.session : null;
  const quick = saved ? !!saved.q : !!(pre && pre.quick);
  if (!saved) testForget();
  if (!saved && !pre && testHttp()){
    // el panel sigue puesto mientras se abre la sesión (gatos-ops#239): con el enlace directo tapa la comparación con nombres
    testOpening = true;
    testOpen(`<h2>${T('Prueba ciega')}</h2><p class="hint" role="status">${T('Preparando la prueba…')}</p>`);
    // con el sello del resultado anterior, el servidor devuelve lo que sirve para la prueba rápida (#354)
    const seal = testSeal(), init = {method: 'POST', headers: {'accept-language': I18N.lang, ...(seal ? {'content-type': 'application/json'} : {})}, ...(seal ? {body: JSON.stringify({from: seal})} : {}), signal: testWait()};
    try { const r = await fetch('/api/blind/' + testToken, init); if (r.ok) session = await r.json(); } catch(e){}
    testOpening = false;
    // la página cambió desde que se cargó esta pestaña: la sesión trae otra cantidad de versiones o cuadros que aquí no existen
    if (session && (session.n !== VARIANTS.length || session.frames.some(f => !FRAMES.some(x => String(x) === f)))){
      testOpen(`<h2>${T('Prueba ciega')}</h2><p>${T('Esta página cambió desde que la abriste. Recárgala para hacer la prueba con las versiones de ahora.')}</p>
        <div class="acts"><button class="xbtn" data-test="reload">${T('Recargar la página')}</button><button data-test="close">${T('Cerrar')}</button></div>`);
      return;
    }
    if (session && Array.isArray(session.prior) && session.prior.length){ testQuickOffer(session); return; }
  }
  testClose();
  closeCrop(); pendingCropFraction = null;   // el panel de recortes numera las versiones: fuera durante la prueba
  if (cropMode) setCropMode(false);
  const real = VARIANTS, before = {varA, varB, frame};
  if (!saved && session && session.epoch !== undefined) testEpoch = session.epoch;   // al retomar, la época guardada puede ser vieja
  if (session){
    // versiones de mentira: la «Variante k» es n<k>, y de cada una solo se sabe qué cuadros tiene
    VARIANTS = Array.from({length: session.n}, (_, k) => ({id: 'n' + (k + 1), name: '', color: '#e8e8f0', frames: Object.keys(session.pics[k + 1])}));
    blindPics = Object.fromEntries(VARIANTS.map((v, k) => [v.id, session.pics[k + 1]]));
    blindOrder = VARIANTS;
  } else blindOrder = saved && saved.local ? saved.local.ids.map(id => VARIANTS.find(v => v.id === id)) : shuffled(VARIANTS);   // la numeración de ESTA prueba
  // el orden en que entran a ordenarse es otro sorteo: el número no dice nada de cuándo le toca a cada una
  const frames = session ? session.frames.map(f => FRAMES.find(x => String(x) === f)).filter(f => f !== undefined)
    : saved && saved.local ? saved.local.frames.map(f => FRAMES.find(x => String(x) === String(f))) : shuffled(FRAMES);
  testRun = {sid: session && session.sid, session, t: saved ? saved.t : Date.now(), real, order: saved ? saved.order : shuffled(VARIANTS.map(v => v.id)), frames,
    flips: new Map(saved ? saved.flips : []), extra: new Map(saved && saved.extra || []), more: saved && saved.more || 0, quick: quick && !!session, blind: BLIND_CFG, checks: [], chkKnown: saved && saved.chk ? new Map(saved.chk) : null, answers: saved ? saved.answers : [], games: [], before};
  // lo que quedó en espera ya está sumado en el servidor: no se manda otra vez
  if (saved && saved.held !== undefined){ testRun.held = saved.held; testRun.holdP = Promise.resolve(); }
  blindMode = true; blindSides = true;
  document.body.classList.add('testing');
  $('testBar').hidden = false;
  pageTitle.textContent = T('Prueba ciega'); document.title = pageTitle.textContent;
  hideTip();
  testReplay();
  computeFit(); applyTransform();
}
/* Prueba rápida (gatos-ops#354): la página tiene versiones sin comparar desde el resultado que este
   navegador mandó. Se ofrece comparar solo esas, reusando las comparaciones de antes que siguen
   valiendo; el resultado nuevo (lo de antes y lo nuevo) reemplaza al anterior. */
let testOffered = null;
function testQuickOffer(session){
  testOffered = session;
  const sim = {quick: true, session, order: Array.from({length: session.n}, (_, k) => 'n' + (k + 1)), blind: BLIND_CFG};
  const fresh = testFresh(sim).length, reused = session.prior.length, most = testPlanned(sim);
  testOpen(`<h2>${T('Versiones sin comparar')}</h2>
    <p>${fresh === 1 ? T('Desde tu resultado anterior esta página tiene 1 versión sin comparar (nueva, o con imágenes nuevas).') : T`Desde tu resultado anterior esta página tiene ${fresh} versiones sin comparar (nuevas, o con imágenes nuevas).`}</p>
    <p>${T`Puedes comparar solo esas con las que ya ordenaste: se reusan tus ${reused} comparaciones de antes y son como mucho ${most} comparaciones nuevas. Tu resultado nuevo reemplaza al anterior.`}</p>
    <div class="acts"><button class="xbtn" data-test="quick">${T('Comparar solo lo nuevo')}</button><button data-test="whole">${T('Toda la prueba otra vez')}</button><button data-test="close">${T('Cancelar')}</button></div>`);
}
// rehace el plan con las respuestas dadas y deja en pantalla la comparación que toca (o termina)
function testReplay(){
  const run = testRun, gen = testPlan(run);
  run.games = []; run.checks = [];
  let step = gen.next();
  for (const r of run.answers){ if (step.done) break; step = gen.next(r); }
  run.gen = gen;
  if (step.done) testSettled(step.value); else { run.cur = step.value; testShow(); }
}
/* El orden ya salió de las respuestas. Se ofrece seguir una vez (gatos-ops#220, #347): quien sigue
   juega tantas comparaciones más como versiones hay, entre las que van arriba, con la misma
   numeración y sin que se haya revelado nada. En una página publicada el resultado se manda ya, en
   espera (`hold`): cuenta desde ahora y el resultado final de esta sesión lo reemplaza, así que irse
   a la mitad no pierde nada ni suma dos veces. */
// comparaciones como mucho: el presupuesto (más «seguir») y las comprobaciones
const testMax = run => testPlanned(run) + (run.more || 0) * VARIANTS.length + (BLIND_CFG.control ? 1 : 0) + (BLIND_CFG.repeat || 0);
// queda algún par con cuadros sin usar (si no, seguir no tiene qué preguntar)
const testRoom = run => testPairs().some(([a, b]) => testShared(a, b, run.frames).length > run.games.filter(g => (g[0] === a && g[1] === b) || (g[0] === b && g[1] === a)).length);
function testSettled(groups){
  const run = testRun;
  if (run.more || !testRoom(run)){ testFinish(groups); return; }
  run.settled = groups;
  if (run.sid && !run.holdP) run.holdP = testHold(run, groups);
  testSave();
  testOpen(`<h2>${T('Ya hay suficientes respuestas')}</h2>
    <p>${T`Con tus ${run.games.length} respuestas ya se pueden ordenar las versiones. Puedes ver tu resultado ahora o seguir con ${VARIANTS.length} comparaciones más entre las que van arriba: si sigues, tu resultado se actualiza al terminar.`}</p>
    <div class="acts"><button class="xbtn" data-test="done">${T('Ver mi resultado')}</button><button data-test="more">${T('Seguir comparando las mejores')}</button></div>`);
}
async function testHold(run, groups){
  const num = new Map(blindOrder.map((v, i) => [v.id, i + 1])), n = id => num.get(id), count = testCounts(), old = testSeal();
  const body = {sid: run.sid, rank: groups.map(g => g.map(n)), games: run.games.map(([a, b, f, r]) => [n(a), n(b), f, r]), extra: testExtras(run, run.games), checks: testChecks(run, n), count, hold: true, ...(old ? {replaces: old} : {})};
  try {
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify(body), signal: testWait()});
    if (!r.ok) return;
    const j = await r.json();
    if (j.epoch !== undefined) testEpoch = j.epoch;
    if (count && j.counted !== false) try { localStorage.setItem('gatosVoted:' + testToken, testEpoch || '1'); } catch(e){}
    testKeepSeal(j.seal);
    run.held = count && j.counted !== false;   // lo que mande esta sesión al final cuenta (reemplaza) solo si esto contó
    if (testRun === run) testSave();
  } catch(e){}
}
function testMore(){
  const run = testRun; if (!run || !run.settled) return;
  run.more = (run.more || 0) + 1; run.settled = null;   // las respuestas siguen: el plan las rehace y continúa
  testPanel.style.display = 'none';
  testReplay();
}
/* Área común (gatos-ops#305): si las versiones no tienen la misma área de imagen (una con el
   cuadro más alto, otra recortada y puesta sobre negro), las bandas dirían cuál es cuál. Con
   `frame_areas` en el manifiesto, durante la prueba cada imagen se recorta al área que todas
   comparten en ese cuadro. Se aplica al cargar cada imagen: la anterior conserva su recorte. */
const testArea = () => { const a = blindSides ? FRAME_AREAS[String(frame)] : null; return Array.isArray(a) && a.length === 4 ? a : null; };
function testClipOne(el){
  const a = testArea(), w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  const pct = n => Math.max(0, Math.min(100, n)).toFixed(4) + '%';
  el.style.clipPath = a && w && h ? `inset(${pct(a[1] / h * 100)} ${pct((w - a[0] - a[2]) / w * 100)} ${pct((h - a[1] - a[3]) / h * 100)} ${pct(a[0] / w * 100)})` : '';
}
imgA.addEventListener('load', () => { testClipOne(imgA); testClipOne(diffCanvas); });
imgB.addEventListener('load', () => { testClipOne(imgB); testClipOne(diffCanvas); });
const testAreas = () => VARIANTS.length && FRAMES.some(f => FRAME_AREAS[String(f)]);
/* Lo opcional de cada respuesta (gatos-ops#310): cuánto tardó, y si quien responde quiere, qué notó
   (etiquetas rápidas y una nota corta). Se marca ANTES de elegir, así saltarlo no cuesta ningún toque.
   Va por par y cuadro (run.extra), en los números de la prueba: no dice qué versión es cuál. */
const testWhy = $('testWhy'), testWhyNote = $('testWhyNote');
const testWhyTags = () => [...testWhy.querySelectorAll('[data-tag][aria-pressed="true"]')].map(b => b.dataset.tag);
// Marcar dónde (gatos-ops#312): con el botón armado, el siguiente toque en la imagen no mueve nada:
// guarda ese punto (de 0 a 1 del ancho y el alto de la imagen) para la respuesta de esta comparación.
let testMarkArmed = false, testMarkAtPoint = null;
function testMarkUi(){ const b = $('testMarkBtn'); b.setAttribute('aria-pressed', String(testMarkArmed)); b.textContent = testMarkAtPoint ? T('Punto marcado ✓') : testMarkArmed ? T('Toca la imagen…') : T('Marcar dónde'); }
function testMarkAt(cx, cy){
  const r = comp.getBoundingClientRect(), {nw, nh} = naturalDims();
  testMarkAtPoint = [clamp(((cx - r.left) - ox - pan.x) / zoom / fitScale / nw, 0, 1), clamp(((cy - r.top) - oy - pan.y) / zoom / fitScale / nh, 0, 1)];
  testMarkArmed = false; testMarkUi();
  const dot = $('testDot'); dot.style.left = (cx - r.left) + 'px'; dot.style.top = (cy - r.top) + 'px'; dot.hidden = false;
  clearTimeout(testMarkAt.t); testMarkAt.t = setTimeout(() => { dot.hidden = true; }, 1200);
}
$('testMarkBtn').addEventListener('click', () => { testMarkArmed = !testMarkArmed; if (testMarkArmed) testMarkAtPoint = null; testMarkUi(); });
function testWhyReset(){ for (const b of testWhy.querySelectorAll('[data-tag]')) b.setAttribute('aria-pressed', 'false'); testWhyNote.value = ''; testMarkArmed = false; testMarkAtPoint = null; testMarkUi(); $('testDot').hidden = true; }
testWhy.addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
$('testWhyBtn').addEventListener('click', () => { testWhy.hidden = !testWhy.hidden; $('testWhyBtn').setAttribute('aria-expanded', String(!testWhy.hidden)); computeFit(); applyTransform(); });
const testExtraKey = g => [g.a, g.b].sort().join('|') + '|' + g.f;
function testShow(){
  const g = testRun.cur;
  testWhyReset(); testRun.shownAt = performance.now();
  varA = g.a; varB = g.b; frame = g.f;
  $('testStep').textContent = T`Comparación ${testRun.answers.length + 1} · como mucho ${testMax(testRun)} · ¿cuál se ve mejor?`;
  $('testLeft').textContent = '← ' + T('Izquierda');
  $('testRight').textContent = T('Derecha') + ' →';
  $('testBack').disabled = !testRun.answers.length;
  testSave();
  loadImg();
  setTimeout(() => { if (testRun && testRun.cur === g) testWarm(); }, 120);   // primero las de ahora
}
// Precarga (gatos-ops#234): mientras se mira una comparación se piden las
// imágenes de la que sigue, sea cual sea la respuesta. El plan es determinista:
// se simula sobre una copia (lados y cuadros elegidos en la copia no cuentan).
function testWarm(){
  const run = testRun, cur = run && run.cur, seen = new Set();
  if (!cur || run.settled) return;
  run.warm = [];
  for (const r of ['a', 'b', 't']){
    const sim = {...run, flips: new Map(run.flips), games: [], checks: []}, gen = testPlan(sim);
    let step = gen.next();
    for (const x of [...run.answers, r]){ if (step.done) break; step = gen.next(x); }
    if (step.done) continue;
    for (const id of [step.value.a, step.value.b]){
      const k = id + '|' + step.value.f; if (seen.has(k)) continue; seen.add(k);
      srcFor(id, step.value.f).then(u => { if (testRun !== run || run.cur !== cur) return; const im = new Image(); im.src = u; run.warm.push(im); }).catch(() => {});
    }
  }
}
function testPick(r){
  if (!testRun || testRun.settled) return;
  const run = testRun;
  if (run.cur){
    const x = {ms: Math.round(performance.now() - (run.shownAt || performance.now()))}, tags = testWhyTags(), note = testWhyNote.value.trim().slice(0, 200);
    if (tags.length) x.t = tags; if (note) x.n = note; if (testMarkAtPoint) x.p = testMarkAtPoint;
    run.extra.set(testExtraKey(run.cur), x);
  }
  run.answers.push(r);
  const step = run.gen.next(r);   // el plan anota la respuesta en run.games
  if (step.done) testSettled(step.value); else { run.cur = step.value; testShow(); }
}
// las comprobaciones, en los números de la prueba (el servidor sabe qué versión es cada uno)
const testChecks = (run, n) => run.checks.map(c => c.k === 'control' ? {k: 'control', v: n(c.v), f: String(c.f), r: c.r} : {k: 'repeat', a: n(c.a), b: n(c.b), f: String(c.f), same: c.same});
// lo opcional, alineado con las comparaciones que se mandan (null donde no hay nada)
const testExtras = (run, games) => games.map(([a, b, f]) => run.extra.get([a, b].sort().join('|') + '|' + f) || null);
function testBackOne(){ if (testRun && !testRun.settled && testRun.answers.length){ testRun.answers.pop(); testReplay(); } }
// sale del modo: vuelve la vista de antes, se olvida la numeración y se sueltan las imágenes sin nombre
function testLeave(){
  const before = testRun.before;
  if (testRun.sid){ VARIANTS = testRun.real; blindPics = null; }   // vuelven las versiones de verdad
  testRun = null; blindOrder = null; blindSides = false;
  testWhy.hidden = true; $('testWhyBtn').setAttribute('aria-expanded', 'false'); testWhyReset();
  for (const el of [imgA, imgB, diffCanvas]) el.style.clipPath = '';   // fuera de la prueba la página se ve entera
  testForget();   // terminada o abandonada a propósito: ya no hay nada que seguir
  document.body.classList.remove('testing');
  $('testBar').hidden = true;
  ({varA, varB, frame} = before);
  setBlind(false);
  dropBlindSrc();
  computeFit(); applyTransform();
}
function testQuit(){ if (testRun && confirm(T('¿Salir de la prueba? Se pierde lo que llevas.'))) testLeave(); }
function testFinish(rank){
  const run = testRun, games = run.games, sid = run.sid, num = new Map(blindOrder.map((v, i) => [v.id, i + 1]));
  const prior = testPriorGames(run).length;   // las primeras de games, si fue la rápida
  run.settled = null; testSeen = false;
  testLeave();
  if (sid){
    // con sesión todavía no se sabe qué era cada número: las respuestas van en números y el servidor lo revela
    const n = id => num.get(id);
    testMine = {sid, run, prior, count: testCounts(), state: 'sending', rank: rank.map(g => g.map(n)), games: games.map(([a, b, f, r]) => [n(a), n(b), f, r]), extra: testExtras(run, games), checks: testChecks(run, n), chk: run.checks.slice()};
  } else testMine = {rank, games, extra: testExtras(run, games), checks: testChecks(run, id => id), chk: run.checks.slice(), state: !testHttp() ? 'local' : testCounts() ? 'sending' : 'voted'};
  testResult();
  if (testMine.state === 'sending') testSend();
}
// el resultado se suma solo al terminar; si falla queda el botón para reintentar
async function testSend(){
  const mine = testMine;
  mine.state = 'sending'; if (testMine === mine && testBody.querySelector('#testNote')) testResult();
  try {
    // si ya se mandó en espera (#220), este lo reemplaza: cuenta solo si aquel contó
    if (mine.run && mine.run.holdP){ await mine.run.holdP; if (mine.run.held !== undefined) mine.count = mine.run.held; }
    const old = testSeal();
    const body = {...(mine.sid ? {sid: mine.sid, rank: mine.rank, games: mine.games, extra: mine.extra, checks: mine.checks, count: mine.count} : {rank: mine.rank, games: mine.games, extra: mine.extra, checks: mine.checks}), ...(old ? {replaces: old} : {})};
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify(body)});
    const j = await r.json().catch(() => ({}));
    // la página cambió de versiones a mitad de la prueba (gatos-ops#228): no se suma y reintentar no sirve;
    // se muestra igual el resultado si esta copia de la página todavía conoce esas versiones
    const stale = r.status === 409 && !!mine.sid && Array.isArray(j.reveal);
    if (stale) mine.stale = true;
    const known = !!mine.sid && Array.isArray(j.reveal) && j.reveal.every(v => VARIANTS.some(x => x.id === v));
    if (!r.ok && !(stale && known)) throw new Error(j.error || 'HTTP ' + r.status);
    if (j.limited || j.counted === false) mine.count = false;
    // se sumó, pero esta pestaña es de antes de un cambio de la página y no conoce esas versiones
    if (mine.sid && !known){ mine.stale = true; if (mine.count !== false) try { localStorage.setItem('gatosVoted:' + testToken, (j.epoch !== undefined ? j.epoch : testEpoch) || '1'); } catch(e){}
      throw new Error(T('la página cambió desde que la abriste')); }
    if (mine.sid){   // la revelación: qué versión era cada número
      const id = k => j.reveal[k - 1];
      mine.rank = mine.rank.map(g => g.map(id)); mine.games = mine.games.map(([a, b, f, r]) => [id(a), id(b), f, r]);
      mine.sid = null;
    }
    if (j.epoch !== undefined) testEpoch = j.epoch;
    if (!stale && mine.count !== false) try { localStorage.setItem('gatosVoted:' + testToken, testEpoch || '1'); } catch(e){}
    if (!stale) testKeepSeal(j.seal);
    mine.state = stale ? 'stale' : j.limited ? 'limited' : mine.count === false ? 'voted' : j.replaced ? 'replaced' : 'sent';
  } catch (e){ mine.state = 'failed'; mine.error = e.message; }
  if (testMine === mine && testBody.querySelector('#testNote')) testResult();
}
// lo que dijeron las comprobaciones de esta prueba, para quien la hizo
function testChkLine(){
  const c = testMine.chk || [], rep = c.filter(x => x.k === 'repeat'), ctl = c.find(x => x.k === 'control'), out = [];
  if (rep.length) out.push(T`Se repitieron ${rep.length} comparaciones con los lados cambiados: elegiste la misma versión en ${rep.filter(x => x.same).length}.`);
  if (ctl) out.push(ctl.r === 't' ? T('En la comparación de control (la misma versión en los dos lados) dijiste empate: bien visto.') : T('En la comparación de control los dos lados eran la misma versión, y elegiste uno.'));
  return out.length ? `<p class="hint" id="testChkLine">${out.map(testEsc).join(' ')}</p>` : '';
}
function testResult(){
  const st = testMine.state, http = testHttp();
  if (testMine.sid){   // todavía sin revelar: solo el estado (y reintentar si falló)
    testOpen(`<h2>${T('Tu resultado')}</h2>
      <p class="hint" id="testNote" role="status">${st === 'failed' ? testEsc(T`No se pudo enviar tu resultado: ${testMine.error}`) : T('Enviando tus respuestas para saber qué versión era cada una…')}</p>
      <div class="acts">${st !== 'failed' ? '' : testMine.stale ? `<button class="xbtn" data-test="reload">${T('Recargar la página')}</button>` : `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>`}<button data-test="close">${T('Cerrar')}</button></div>`);
    return;
  }
  const note = {local: T('Esta copia no está publicada en gatos.pics: el resultado no se envía.'), voted: T('Ya habías enviado un resultado de esta página desde este navegador: este no se sumó.'),
    sending: T('Sumando tu resultado a la tabla de todos…'), sent: T('Tu resultado se sumó a la tabla de todos.'),
    replaced: T('Tu resultado reemplazó en la tabla de todos al que habías enviado antes desde este navegador.'),
    limited: T('Llegaron demasiados resultados desde tu conexión en la última hora: este no se sumó.'),
    stale: T('La página cambió de versiones mientras hacías la prueba: este resultado no se sumó. Recarga la página para hacer la prueba con las versiones de ahora.'), failed: T`No se pudo enviar tu resultado: ${testMine.error}`}[st];
  // lo que respondiste sobre cada versión: comparaciones ganadas, empatadas y perdidas
  const row = Object.fromEntries(VARIANTS.map(v => [v.id, {w: 0, t: 0, l: 0}]));
  for (const [a, b, , r] of testMine.games){ if (r === 't'){ row[a].t++; row[b].t++; } else { row[r === 'a' ? a : b].w++; row[r === 'a' ? b : a].l++; } }
  let place = 1;
  const lines = testMine.rank.map(g => { const p = place; place += g.length;
    return g.map(id => `<tr><td>${p}º</td><td>${testName(id)}</td><td>${row[id].w}-${row[id].t}-${row[id].l}</td></tr>`).join(''); }).join('');
  testOpen(`<h2>${T('Tu resultado')}</h2>
    <table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Versión')}</th><th title="${T('comparaciones ganadas, empatadas y perdidas')}">${T('G-E-P')}</th></tr>${lines}</table>
    ${testChkLine()}
    <details class="tgames"${testSeen ? ' open' : ''}><summary>${T('Tus respuestas, comparación por comparación')}</summary>
      <table class="tgtable"><tr><th>${T('Cuadro')}</th><th>${T('Izquierda')}</th><th>${T('Derecha')}</th><th>${T('Elegiste')}</th><th></th></tr>
      ${testMine.games.map(([a, b, f, r], i) => `<tr${i < (testMine.prior || 0) ? ' class="tprior"' : ''}><td>${testEsc(FRAME_LABELS[f] || f)}${i < (testMine.prior || 0) ? ` <span class="tfewtag">${T('de antes')}</span>` : ''}</td><td>${testName(a)}</td><td>${testName(b)}</td><td>${r === 't' ? T('Empate') : testName(r === 'a' ? a : b)}</td><td>${testCanSee(a, b, f) ? `<button data-test="see" data-i="${i}" title="${T('Abre esta comparación otra vez, con las mismas versiones a cada lado')}">${T('Ver')}</button>` : ''}</td></tr>`).join('')}</table></details>
    <p class="hint">${testMine.prior ? T`Respondiste ${testMine.games.length - testMine.prior} comparaciones nuevas; las otras ${testMine.prior} vienen de tu resultado anterior.` : T`Respondiste ${testMine.games.length} comparaciones.`} ${T('Los pares que no viste se ordenaron con tus respuestas: si una le gana a otra y esa a una tercera, la primera va antes.')}</p>
    <p class="hint" id="testNote" role="status">${testEsc(note)}${http && st !== 'local' ? ` <button class="tlink" data-test="privacy-mine">${T('Qué se guarda')}</button>` : ''}</p>
    <div class="acts">${st === 'failed' ? `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>` : ''}${http ? `<button${st === 'sent' || st === 'replaced' ? ' class="xbtn"' : ''} data-test="all">${T('Ver la tabla de todos')}</button>` : ''}${st === 'stale' ? `<button class="xbtn" data-test="reload">${T('Recargar la página')}</button>` : `<button data-test="start">${T('Repetir la prueba')}</button>`}<button data-test="close">${T('Cerrar')}</button></div>`);
}
// volver a mirar una comparación ya respondida: el mismo cuadro con las mismas versiones a cada lado,
// ya con sus nombres. Una barra dice qué se está viendo y lleva de vuelta al resultado
const testCanSee = (a, b, f) => FRAMES.some(x => String(x) === String(f)) && [a, b].every(id => VARIANTS.some(v => v.id === id));
function testSee(i){
  const [a, b, f, r] = testMine.games[i];
  testSeen = true; testClose();
  varA = a; varB = b; frame = FRAMES.find(x => String(x) === String(f));
  refreshFrameButtons(); refreshVariantButtons(); loadImg(); updateMeta(); writeHash();
  $('testSeeText').innerHTML = testEsc(T`Comparación ${i + 1} de ${testMine.games.length}:`) + ' ' + (r === 't' ? T('dijiste empate') : testEsc(T('elegiste')) + ' ' + testName(r === 'a' ? a : b) + ' (' + (r === 'a' ? T('izquierda') : T('derecha')) + ')');
  $('testSeeBar').hidden = false; $('testSeeBack').focus();
}
function testSeeEnd(){ $('testSeeBar').hidden = true; }
function testStandings(j){
  testOpen(`<h2>${T('Tabla de todos')}</h2>
    <p class="hint">${j.ballots === 1 ? T('1 prueba enviada.') : T`${j.ballots} pruebas enviadas.`} ${T('Ordenada por la probabilidad de ganarle a una versión promedio, con todas las comparaciones de todas las pruebas. Con pocas comparaciones ese número todavía dice poco.')}</p>
    ${j.ballots ? `<table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Versión')}</th><th title="${T('probabilidad de ganarle a una versión promedio')}">${T('Puntuación')}</th><th>${T('Comparaciones')}</th><th title="${T('comparaciones ganadas, empatadas y perdidas')}">${T('G-E-P')}</th></tr>
    ${j.standings.map((s, i) => `<tr${s.few ? ' class="tfew"' : ''}><td>${i + 1}º</td><td>${testName(s.id)}</td><td>${s.score == null ? '—' : Math.round(s.score * 100) + ' %'}</td><td>${s.n ?? s.w + s.t + s.l}${s.few ? ` <span class="tfewtag">${T('pocas comparaciones')}</span>` : ''}</td><td>${s.w}-${s.t}-${s.l}</td></tr>`).join('')}</table>` : ''}
    <div class="acts">${testMine ? `<button data-test="mine">${T('Volver a mi resultado')}</button>` : `<button class="xbtn" data-test="start">${T('Hacer la prueba')}</button>`}<button data-test="close">${T('Cerrar')}</button></div>`);
}
async function testAll(){
  const btn = testBody.querySelector('[data-test="all"]');
  if (btn) btn.disabled = true;
  try {
    const r = await fetch('/api/vote/' + testToken, {headers: {'accept-language': I18N.lang}});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    testStandings(j);
  } catch (e){
    const n = testBody.querySelector('.hint'); if (n) n.textContent = T`No se pudo leer la tabla: ${e.message}`;
    if (btn) btn.disabled = false;
  }
}
testBody.addEventListener('click', e => {
  const b = e.target.closest('[data-test]'); if (!b) return;
  const act = b.dataset.test;
  if (act === 'start') testStart(); else if (act === 'close') testClose(); else if (act === 'mine') testResult(); else if (act === 'see') testSee(+b.dataset.i);
  else if (act === 'send') testSend(); else if (act === 'all') testAll();
  else if (act === 'link') testCopyLink(b); else if (act === 'reload') location.reload();
  else if (act === 'privacy') testPrivacy('intro'); else if (act === 'privacy-mine') testPrivacy('mine'); else if (act === 'intro') testIntro();
  else if (act === 'resume') testResume(); else if (act === 'fresh'){ testForget(); testIntro(); }
  else if (act === 'done'){ if (testRun && testRun.settled) testFinish(testRun.settled); } else if (act === 'more') testMore();
  else if ((act === 'quick' || act === 'whole') && testOffered){ const session = testOffered; testOffered = null; testStart(null, {session, quick: act === 'quick'}); }
});
$('testBtn').addEventListener('click', testEnter);
$('testLeft').addEventListener('click', () => testPick('a'));
$('testRight').addEventListener('click', () => testPick('b'));
$('testTie').addEventListener('click', () => testPick('t'));
$('testBack').addEventListener('click', testBackOne);
$('testQuit').addEventListener('click', testQuit);
$('testSeeBack').addEventListener('click', () => { testSeeEnd(); testResult(); });
$('testSeeClose').addEventListener('click', testSeeEnd);
// teclas de la prueba: ← y → eligen lado, ↑/↓/0 empate, Retroceso vuelve una. Las
// que cambiarían el par o lo revelarían (números, espacio, G, R, S, C) no hacen nada
function testKeys(e){
  if (testPanel.style.display === 'flex'){ if (e.key === 'Escape'){ e.preventDefault(); testClose(); } return true; }
  if (!testRun) return false;
  if (e.key === 'ArrowLeft') testPick('a'); else if (e.key === 'ArrowRight') testPick('b');
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === '0') testPick('t');
  else if (e.key === 'Backspace') testBackOne(); else if (e.key === 'Escape') testQuit();
  else if (!(e.key === ' ' || /^[1-9]$/.test(e.key) || /^Digit[1-9]$/.test(e.code) || 'gGrRsScC'.includes(e.key))) return false;
  e.preventDefault();
  return true;
}

/* ---------- init ---------- */
function applyManifest(m){
  // un manifest truncado o mano-editado no es un fallo de transporte: sin
  // esto, readState revienta en .find/.some y el init culpa al transportista
  if (!m || !Array.isArray(m.frames) || !m.frames.length ||
      !Array.isArray(m.variants) || m.variants.length < 2)
    throw Object.assign(new Error(T('manifest inválido: faltan frames o hay menos de 2 variantes')), {manifestInvalid:true});
  FRAMES = m.frames;
  VARIANTS = m.variants;
  // sin prototipo: FRAME_LABELS['constructor'] no devuelve la función heredada (ops#251)
  FRAME_LABELS = Object.assign(Object.create(null), m.frame_labels);
  FRAME_META = Object.assign(Object.create(null), m.frame_meta);
  FRAME_AREAS = Object.assign(Object.create(null), m.frame_areas);
  BLIND_CFG = m.blind && typeof m.blind === 'object' ? m.blind : {};
  CLIP = m.clip || {};
  originalTitle = m.title || T('Comparación');
  document.title = originalTitle; pageTitle.textContent = originalTitle;
  const h = readState();
  $('diffGain').value = String(gainIdx);
  $('heatBtn').setAttribute('aria-pressed', String(heat));
  $('testBtn').hidden = !testOk();   // prueba ciega: con 2 a 12 versiones
  computeFit();
  loadImg();
  applyTransform();
  // arranca ajustada en todas las pantallas (gatolocoses/gatos.pics#31): el
  // salto a 1:1 en móvil dejaba la imagen más chica que la pantalla con
  // dpr ≥ 2 y recortada con capturas 1080p; 1:1 queda a un toque
  // enlace muerto (gatos-ops#307): se llegó aquí porque la página pedida ya no existe
  if (h.get('gone') === '1'){ $('goneNote').hidden = false; $('goneClose').onclick = () => { $('goneNote').hidden = true; }; }
  if (h.get('diff') === '1') setDiff(true);
  if (h.get('blink') === '1') setBlink(true);
  if (h.get('solar') === '1') setSolar(true);
  if (h.has('smooth')) setSmooth(h.get('smooth') !== '0', false);
  if (h.get('crops') === '1') setCropMode(true);
  if (h.get('crop')){
    const [cu, cv] = h.get('crop').split(',').map(Number);
    if (isFinite(cu) && isFinite(cv)){
      pendingCropFraction = [clamp(cu,0,1),clamp(cv,0,1)];
    }
  }
  // una prueba ciega que quedó a medias (gatos-ops#222) se ofrece seguirla; el
  // enlace directo (#test=1, gatos-ops#223) abre la introducción sobre fondo opaco
  if (!$('testBtn').hidden){
    const link = h.get('test') === '1';
    if (link) testPanel.classList.add('solid');
    if (link || testSaved()) testEnter();
  }
}
// ?test=1 (gatos-ops#336) es la forma del enlace a la prueba que el servidor ve, para darle su
// tarjeta; adentro vale #test=1, como siempre, y ningún otro enlace de la página lo arrastra
try {
  const u = new URL(location.href);
  if (u.searchParams.get('test') === '1'){
    u.searchParams.delete('test');
    const h = new URLSearchParams(u.hash.slice(1)); h.set('test', '1'); u.hash = h.toString();
    history.replaceState(history.state, '', u.href);
  }
} catch (e){}
(async () => {
  computeFit();
  applyTransform();
  try {
    const m = await SOURCE.init();
    applyManifest(m);
  } catch (err) {
    console.error('comparison data unavailable', err);
    metaLine.textContent = err?.manifestInvalid ? err.message
      : T('no se encontraron datos de comparación (sin paquete embebido, sin manifest.json)');
  }
})();
