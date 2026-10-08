/* zip.js — empaquetado zip STORE sin dependencias.
   Extraído de builder.js (gatos.pics#26, serie de extracción sancionada por
   AGENTS.md: builder.js pasó el presupuesto blando). Nada de DOM ni red aquí:
   funciones puras de bytes, cargado antes que builder.js.

   makeZip consume las entradas DE A UNA vía fetchEntry (async () => entrada o
   null al agotarse): cada imagen se decodifica recién cuando le toca entrar y
   el llamador puede soltar su dataURL en ese momento, así el pico de memoria
   de una exportación grande no suma el paquete entero + los bytes decodificados
   de todas las imágenes + el zip (el comportamiento que motivó #26). Los bytes
   de salida son idénticos a la versión anterior, que acumulaba todas las
   entradas antes de empezar: mismo orden, mismas cabeceras STORE, fecha DOS
   fija (1996-08-01: el día 0 es ilegal), directorio central al final. */

/* dataURL -> bytes */
function dataURLtoBytes(du){
  const parts = du.split(',');
  const mime = (parts[0].match(/^data:([^;]+)/) || [,'image/png'])[1];
  const bin = atob(parts[1] || '');
  const buf = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
  return {mime, buf};
}
/* solo el mime del dataURL, sin decodificar el cuerpo base64 completo */
function dataURLMime(du){
  return (du.split(',')[0].match(/^data:([^;]+)/) || [,'image/png'])[1];
}
const te = new TextEncoder();
function strBytes(s){ return te.encode(s); }

let CRC_T = null;
function crc32(buf){
  if (!CRC_T){
    CRC_T = new Uint32Array(256);
    for (let n = 0; n < 256; n++){
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_T[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function makeZip(fetchEntry){
  // entradas diferidas: {name, data:Uint8Array} por llamada · método STORE
  // guardas del formato sin ZIP64: más de 65535 entradas o 4 GiB no se pueden
  // codificar y setUint32 tiraría un RangeError crudo o un archivo corrupto.
  // Se evalúan por entrada, antes de aceptar sus bytes.
  const out = [], central = [];
  let offset = 0, count = 0, projected = 22;
  for (;;){
    const e = await fetchEntry();
    if (!e) break;
    count++;
    if (count > 65535) throw new Error(T`Demasiadas entradas para un zip (${count}): el formato admite 65535.`);
    const nameB = te.encode(e.name);
    if (e.data.length > 0xFFFFFFFF) throw new Error(T`«${e.name}» no cabe en un zip: el límite por entrada son 4 GiB.`);
    projected += 76 + 2*nameB.length + e.data.length;
    if (projected > 0xFFFFFFFF) throw new Error(T`El zip proyectado pasa de 4 GiB (${(projected/1073741824).toFixed(1)}): el formato sin ZIP64 no lo admite. Exporta menos imágenes o más chicas.`);
    const crc = crc32(e.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);            // versión necesaria
    lh.setUint16(6, 0x0800, true);        // nombres UTF-8
    lh.setUint16(8, 0, true);             // store
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x2101, true);   // hora/fecha DOS fija
    lh.setUint32(14, crc, true);
    lh.setUint32(18, e.data.length, true);
    lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, nameB.length, true);
    lh.setUint16(28, 0, true);
    out.push(new Uint8Array(lh.buffer), nameB, e.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true); cd.setUint16(14, 0x2101, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, e.data.length, true); cd.setUint32(24, e.data.length, true);
    cd.setUint16(28, nameB.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameB);
    offset += 30 + nameB.length + e.data.length;
  }
  const cdStart = offset;
  let cdLen = 0;
  for (const c of central) cdLen += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, count, true);
  end.setUint16(10, count, true);
  end.setUint32(12, cdLen, true);
  end.setUint32(16, cdStart, true);
  return new Blob([...out, ...central, new Uint8Array(end.buffer)], {type:'application/zip'});
}
