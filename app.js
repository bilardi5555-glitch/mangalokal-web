(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    imageInput: $('imageInput'), dropzone: $('dropzone'), ocrLang: $('ocrLang'), translatorMode: $('translatorMode'),
    libreSettings: $('libreSettings'), libreEndpoint: $('libreEndpoint'), libreKey: $('libreKey'), translateBtn: $('translateBtn'),
    cancelBtn: $('cancelBtn'), progressBar: $('progressBar'), statusText: $('statusText'), viewer: $('viewer'), emptyState: $('emptyState'),
    pageImage: $('pageImage'), overlayLayer: $('overlayLayer'), canvasWrap: $('canvasWrap'), transcript: $('transcript'), pageCounter: $('pageCounter'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'), toggleOverlayBtn: $('toggleOverlayBtn'), exportPngBtn: $('exportPngBtn'),
    exportTxtBtn: $('exportTxtBtn'), installBtn: $('installBtn')
  };

  const state = {
    pages: [], current: 0, running: false, cancelled: false, overlay: true, installPrompt: null, translator: null
  };

  const LANG_MAP = {
    jpn: 'ja', jpn_vert: 'ja', kor: 'ko', chi_sim: 'zh-CN', chi_tra: 'zh-TW', eng: 'en'
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg; document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function setProgress(pct, text) {
    els.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    els.statusText.textContent = text;
  }

  function setRunning(running) {
    state.running = running;
    els.translateBtn.disabled = running || !state.pages.length;
    els.cancelBtn.disabled = !running;
    els.imageInput.disabled = running;
    els.ocrLang.disabled = running;
    els.translatorMode.disabled = running;
  }

  function makePage(file) {
    return { file, url: URL.createObjectURL(file), naturalW: 0, naturalH: 0, lines: [], done: false };
  }

  function loadFiles(fileList) {
    const files = [...fileList].filter(f => f.type.startsWith('image/'));
    if (!files.length) return toast('Tidak ada file gambar yang dipilih.');
    state.pages.forEach(p => URL.revokeObjectURL(p.url));
    state.pages = files.map(makePage); state.current = 0;
    els.translateBtn.disabled = false;
    renderPage();
    setProgress(0, `${files.length} halaman siap diproses.`);
  }

  els.imageInput.addEventListener('change', e => loadFiles(e.target.files));
  ['dragenter','dragover'].forEach(evt => els.dropzone.addEventListener(evt, e => { e.preventDefault(); els.dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(evt => els.dropzone.addEventListener(evt, e => { e.preventDefault(); els.dropzone.classList.remove('drag'); }));
  els.dropzone.addEventListener('drop', e => loadFiles(e.dataTransfer.files));

  els.translatorMode.addEventListener('change', () => {
    els.libreSettings.classList.toggle('hidden', els.translatorMode.value !== 'libre');
    localStorage.setItem('translatorMode', els.translatorMode.value);
  });
  els.libreEndpoint.addEventListener('change', () => localStorage.setItem('libreEndpoint', els.libreEndpoint.value));
  els.ocrLang.addEventListener('change', () => localStorage.setItem('ocrLang', els.ocrLang.value));

  function restoreSettings() {
    const mode = localStorage.getItem('translatorMode'); if (mode) els.translatorMode.value = mode;
    const endpoint = localStorage.getItem('libreEndpoint'); if (endpoint) els.libreEndpoint.value = endpoint;
    const lang = localStorage.getItem('ocrLang'); if (lang) els.ocrLang.value = lang;
    els.libreSettings.classList.toggle('hidden', els.translatorMode.value !== 'libre');
  }

  function renderPage() {
    const count = state.pages.length;
    els.pageCounter.textContent = count ? `Halaman ${state.current + 1} dari ${count}` : '0 halaman';
    els.prevBtn.disabled = !count || state.current <= 0;
    els.nextBtn.disabled = !count || state.current >= count - 1;
    els.toggleOverlayBtn.disabled = !count;
    els.exportPngBtn.disabled = !count || !state.pages[state.current]?.done;
    els.exportTxtBtn.disabled = !count || !state.pages[state.current]?.done;
    if (!count) return;

    const page = state.pages[state.current];
    els.emptyState.classList.add('hidden'); els.viewer.classList.remove('hidden');
    els.pageImage.onload = () => {
      page.naturalW = els.pageImage.naturalWidth; page.naturalH = els.pageImage.naturalHeight;
      renderOverlays();
    };
    els.pageImage.src = page.url;
    renderTranscript();
  }

  function renderOverlays() {
    const page = state.pages[state.current]; if (!page || !page.naturalW || !page.naturalH) return;
    els.overlayLayer.innerHTML = '';
    const displayedW = els.pageImage.clientWidth, displayedH = els.pageImage.clientHeight;
    els.overlayLayer.style.width = `${displayedW}px`; els.overlayLayer.style.height = `${displayedH}px`;
    els.canvasWrap.classList.toggle('overlay-off', !state.overlay);
    page.lines.forEach((line, idx) => {
      if (!line.bbox || !line.translated) return;
      const x = line.bbox.x0 / page.naturalW * displayedW;
      const y = line.bbox.y0 / page.naturalH * displayedH;
      const w = Math.max(24, (line.bbox.x1 - line.bbox.x0) / page.naturalW * displayedW);
      const h = Math.max(18, (line.bbox.y1 - line.bbox.y0) / page.naturalH * displayedH);
      const div = document.createElement('div'); div.className = 'ocr-overlay'; div.dataset.idx = idx;
      Object.assign(div.style, { left:`${x}px`, top:`${y}px`, width:`${w}px`, minHeight:`${h}px`, fontSize:`${Math.max(9, Math.min(18, h * .45))}px` });
      div.textContent = line.translated; els.overlayLayer.appendChild(div);
    });
  }

  function renderTranscript() {
    const page = state.pages[state.current];
    if (!page || !page.lines.length) { els.transcript.className = 'transcript empty-transcript'; els.transcript.textContent = 'Belum ada hasil OCR.'; return; }
    els.transcript.className = 'transcript'; els.transcript.innerHTML = '';
    page.lines.forEach((line, i) => {
      const card = document.createElement('div'); card.className = 'line-card';
      card.innerHTML = `<div class="line-meta"><span>Baris ${i+1}</span><span>${Math.round(line.confidence || 0)}% OCR</span></div>
      <div class="line-grid"><label><span class="line-label">Asli</span><textarea data-field="source" data-index="${i}"></textarea></label>
      <label><span class="line-label">Indonesia</span><textarea data-field="translated" data-index="${i}"></textarea></label></div>`;
      card.querySelector('[data-field="source"]').value = line.text;
      card.querySelector('[data-field="translated"]').value = line.translated || '';
      els.transcript.appendChild(card);
    });
    els.transcript.querySelectorAll('textarea').forEach(ta => ta.addEventListener('input', e => {
      const line = page.lines[Number(e.target.dataset.index)];
      line[e.target.dataset.field === 'source' ? 'text' : 'translated'] = e.target.value;
      if (e.target.dataset.field === 'translated') renderOverlays();
    }));
  }

  els.prevBtn.addEventListener('click', () => { if (state.current > 0) { state.current--; renderPage(); } });
  els.nextBtn.addEventListener('click', () => { if (state.current < state.pages.length - 1) { state.current++; renderPage(); } });
  els.toggleOverlayBtn.addEventListener('click', () => { state.overlay = !state.overlay; els.toggleOverlayBtn.textContent = state.overlay ? 'Matikan overlay' : 'Nyalakan overlay'; renderOverlays(); });
  window.addEventListener('resize', () => renderOverlays());

  function normalizeLines(data) {
    const out = [];
    const add = (text, bbox, confidence = 0) => {
      text = (text || '').replace(/\s+/g, ' ').trim(); if (!text) return;
      out.push({ text, translated: '', bbox, confidence });
    };
    if (Array.isArray(data.lines) && data.lines.length) data.lines.forEach(l => add(l.text, l.bbox, l.confidence));
    else if (Array.isArray(data.words) && data.words.length) data.words.forEach(w => add(w.text, w.bbox, w.confidence));
    else if (Array.isArray(data.blocks)) {
      data.blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => add(l.text, l.bbox, l.confidence))));
    }
    if (!out.length && data.text?.trim()) add(data.text.trim(), {x0:0,y0:0,x1:Math.max(100,els.pageImage.naturalWidth),y1:Math.max(60,els.pageImage.naturalHeight*.15)}, data.confidence || 0);
    return out;
  }

  async function ocrPage(page, index, total) {
    if (!window.Tesseract) throw new Error('Tesseract.js gagal dimuat. Periksa koneksi internet.');
    const lang = els.ocrLang.value;
    setProgress((index / total) * 65, `OCR halaman ${index + 1}/${total}: menyiapkan model ${lang}…`);
    const worker = await Tesseract.createWorker(lang, 1, {
      logger: m => {
        if (state.cancelled) return;
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          const base = index / total * 65, span = 65 / total;
          setProgress(base + m.progress * span, `OCR halaman ${index + 1}/${total}: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    try {
      const result = await worker.recognize(page.url, {}, { blocks: true });
      page.lines = normalizeLines(result.data);
    } finally { await worker.terminate(); }
  }

  async function getBrowserTranslator(source) {
    const TranslatorAPI = window.Translator || globalThis.Translator;
    if (!TranslatorAPI?.create) throw new Error('Translator API bawaan belum tersedia di browser ini. Pilih MyMemory atau LibreTranslate.');
    if (state.translator && state.translator.__src === source) return state.translator;
    if (TranslatorAPI.availability) {
      const availability = await TranslatorAPI.availability({ sourceLanguage: source, targetLanguage: 'id' });
      if (availability === 'unavailable') throw new Error(`Model terjemahan ${source} → id tidak tersedia di browser ini.`);
    }
    const translator = await TranslatorAPI.create({ sourceLanguage: source, targetLanguage: 'id' });
    translator.__src = source; state.translator = translator; return translator;
  }

  async function translateBrowser(text, source) {
    const translator = await getBrowserTranslator(source);
    return await translator.translate(text);
  }

  async function translateMyMemory(text, source) {
    const src = source.startsWith('zh') ? 'zh-CN' : source;
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text); url.searchParams.set('langpair', `${src}|id`);
    const r = await fetch(url); if (!r.ok) throw new Error(`MyMemory HTTP ${r.status}`);
    const j = await r.json();
    if (j.responseStatus && Number(j.responseStatus) >= 400) throw new Error(j.responseDetails || 'MyMemory gagal menerjemahkan.');
    return j.responseData?.translatedText || text;
  }

  async function translateLibre(text, source) {
    const endpoint = els.libreEndpoint.value.trim(); if (!endpoint) throw new Error('Endpoint LibreTranslate kosong.');
    const body = { q: text, source: source.startsWith('zh') ? 'zh' : source, target: 'id', format: 'text' };
    const key = els.libreKey.value.trim(); if (key) body.api_key = key;
    const r = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    if (!r.ok) throw new Error(`LibreTranslate HTTP ${r.status}`);
    const j = await r.json(); return j.translatedText || text;
  }

  async function translateText(text) {
    const source = LANG_MAP[els.ocrLang.value] || 'en';
    if (els.translatorMode.value === 'browser') return translateBrowser(text, source);
    if (els.translatorMode.value === 'mymemory') return translateMyMemory(text, source);
    return translateLibre(text, source);
  }

  async function translatePage(page, pageIndex, totalPages) {
    const lines = page.lines.filter(l => l.text.trim());
    for (let i = 0; i < lines.length; i++) {
      if (state.cancelled) throw new Error('__cancelled__');
      const line = lines[i];
      const base = 65 + (pageIndex / totalPages) * 35;
      const pageSpan = 35 / totalPages;
      setProgress(base + (i / Math.max(1, lines.length)) * pageSpan, `Terjemahan halaman ${pageIndex + 1}/${totalPages}: ${i + 1}/${lines.length}`);
      try { line.translated = await translateText(line.text); }
      catch (err) { line.translated = line.text; line.error = String(err.message || err); }
      if (els.translatorMode.value !== 'browser') await sleep(130);
      if (pageIndex === state.current && i % 2 === 0) { renderTranscript(); renderOverlays(); }
    }
    page.done = true;
  }

  els.translateBtn.addEventListener('click', async () => {
    if (!state.pages.length || state.running) return;
    state.cancelled = false; setRunning(true);
    try {
      for (let p = 0; p < state.pages.length; p++) {
        if (state.cancelled) throw new Error('__cancelled__');
        state.current = p; renderPage();
        await ocrPage(state.pages[p], p, state.pages.length);
        renderTranscript(); renderOverlays();
        await translatePage(state.pages[p], p, state.pages.length);
      }
      setProgress(100, `Selesai. ${state.pages.length} halaman sudah diproses.`);
      renderPage(); toast('OCR dan terjemahan selesai.');
    } catch (err) {
      if (String(err.message) === '__cancelled__') setProgress(0, 'Proses dibatalkan.');
      else { setProgress(0, `Gagal: ${err.message || err}`); toast(err.message || String(err)); }
    } finally { setRunning(false); }
  });
  els.cancelBtn.addEventListener('click', () => { state.cancelled = true; els.cancelBtn.disabled = true; setProgress(0, 'Membatalkan setelah langkah aktif selesai…'); });

  function safeName(name) { return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi,'_'); }
  function downloadBlob(blob, name) { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }

  els.exportTxtBtn.addEventListener('click', () => {
    const page = state.pages[state.current]; if (!page) return;
    const txt = page.lines.map((l,i)=>`[${i+1}] ${l.text}\nID: ${l.translated || ''}`).join('\n\n');
    downloadBlob(new Blob([txt],{type:'text/plain;charset=utf-8'}), `${safeName(page.file.name)}_ID.txt`);
  });

  function drawWrapped(ctx, text, x, y, w, h) {
    const min=12, max=Math.max(min, Math.min(44, h*.42)); let font=max;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#111';
    const centerX=x+w/2;
    while(font>min){ctx.font=`700 ${font}px system-ui,sans-serif`; const words=text.split(/\s+/); let rows=[], row='';
      for(const word of words){const test=row?`${row} ${word}`:word;if(ctx.measureText(test).width>w-10){if(row)rows.push(row);row=word}else row=test} if(row)rows.push(row);
      if(rows.length*font*1.15<=h-6){const start=y+h/2-(rows.length-1)*font*1.15/2;rows.forEach((r,i)=>ctx.fillText(r,centerX,start+i*font*1.15));return} font-=2}
    ctx.font=`700 ${min}px system-ui,sans-serif`;ctx.fillText(text.slice(0,80),centerX,y+h/2,max(10,w-8));
  }

  els.exportPngBtn.addEventListener('click', async () => {
    const page=state.pages[state.current]; if(!page) return;
    const img=new Image(); img.src=page.url; await img.decode();
    const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    page.lines.forEach(l=>{if(!l.bbox||!l.translated)return;const b=l.bbox,w=b.x1-b.x0,h=b.y1-b.y0;ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(b.x0,b.y0,w,h);drawWrapped(ctx,l.translated,b.x0,b.y0,w,h)});
    c.toBlob(blob=>blob&&downloadBlob(blob,`${safeName(page.file.name)}_ID.png`),'image/png');
  });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installPrompt=e; els.installBtn.classList.remove('hidden'); });
  els.installBtn.addEventListener('click', async () => { if(!state.installPrompt) return; state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt=null; els.installBtn.classList.add('hidden'); });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  restoreSettings();
})();
