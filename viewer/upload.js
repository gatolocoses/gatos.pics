/* Explicit uploads only. XHR exposes transmitted bytes; fetch does not. */
'use strict';
class GatosUpload {
  constructor({panel, progress, status, cancel, retry, onBusy = () => {}, onSuccess, retryCaution, onApiKeyRequired}){
    Object.assign(this, {panel, progress, status, cancelButton:cancel, retryButton:retry, onBusy, onSuccess, retryCaution, onApiKeyRequired});
    this.busy = false; this.generation = 0;
    cancel.onclick = () => {
      ++this.generation;
      if (this.xhr) this.xhr.abort();
      else this.finish('Preparación cancelada. No se inició el envío.', false);
    };
    retry.onclick = () => { if (!this.busy && this.request) this.send(); };
  }
  finish(message, retryable){
    this.status.textContent = message;
    this.busy = false; this.xhr = null;
    this.cancelButton.hidden = true; this.retryButton.hidden = !retryable;
    this.onBusy(false);
  }
  async start(prepare){
    if (this.busy) return;
    const generation = ++this.generation;
    const cancelled = () => generation !== this.generation;
    this.request = null; this.busy = true;
    this.panel.hidden = false; this.retryButton.hidden = true; this.cancelButton.hidden = false;
    this.progress.removeAttribute('value'); this.status.textContent = 'Preparando el envío…';
    this.onBusy(true);
    try {
      const request = await prepare(cancelled);
      if (cancelled()) return;
      this.request = request; this.send();
    } catch(e){ if (!cancelled()) this.finish(e.message, false); }
  }
  send(){
    this.busy = true; this.onBusy(true);
    this.retryButton.hidden = true; this.cancelButton.hidden = false;
    this.progress.max = 1; this.progress.value = 0;
    this.status.textContent = 'Iniciando el envío…';
    const xhr = this.xhr = new XMLHttpRequest();
    const request = this.request;
    let sent = 0, total = this.request.body.size || 0;
    const uncertain = 'No se pudo confirmar el resultado. '+this.retryCaution;
    try {
    xhr.open('POST', this.request.url);
    // Large packages on slow connections need no arbitrary total deadline.
    // The visible cancel button remains available while awaiting the server.
    xhr.timeout = 0;
    for (const [key,value] of Object.entries(this.request.headers || {})) xhr.setRequestHeader(key,value);
    xhr.upload.onprogress = event => {
      if (this.xhr !== xhr) return;
      sent = event.loaded;
      if (event.lengthComputable) total = event.total;
      if (total) this.progress.value = Math.min(1, sent/total);
      else this.progress.removeAttribute('value');
      const size = bytes => (bytes/1048576).toFixed(2)+' MiB';
      this.status.textContent = total
        ? `Enviando: ${size(sent)} de ${size(total)} (${Math.floor(Math.min(1,sent/total)*100)} %).`
        : `Enviando: ${size(sent)}.`;
    };
    xhr.upload.onload = () => {
      if (this.xhr !== xhr) return;
      this.progress.value = 1;
      this.status.textContent = 'Envío completo. Esperando confirmación del servidor…';
    };
    const fail = message => { if (this.xhr === xhr) this.finish(message, true); };
    xhr.onabort = () => fail('Envío cancelado. '+this.retryCaution);
    xhr.onerror = () => fail(uncertain);
    xhr.ontimeout = () => fail('Se agotó el tiempo de espera. '+uncertain);
    xhr.onload = () => {
      if (this.xhr !== xhr) return;
      let response;
      try { response = JSON.parse(xhr.responseText); } catch(e){}
      if (xhr.status >= 200 && xhr.status < 300 && response?.url){
        this.progress.value = 1; this.finish('El servidor confirmó el envío.', false);
        this.request = null;
        this.onSuccess(response, request.meta);
      } else {
        const retryable = xhr.status === 429 || xhr.status >= 500 || (xhr.status >= 200 && xhr.status < 300);
        const message = response?.error || `No se pudo enviar (HTTP ${xhr.status}).`;
        this.finish(message + (xhr.status === 429 ? ' Espera antes de reintentar.' : retryable ? ' '+uncertain : ''), retryable);
        if (xhr.status === 403 && this.onApiKeyRequired) this.onApiKeyRequired();
      }
    };
    xhr.send(this.request.body);
    } catch(e){ this.finish('No se pudo iniciar el envío: '+e.message, false); }
  }
}
