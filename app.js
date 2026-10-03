(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const els = {
    modeTabs:[...document.querySelectorAll('.mode-tab')], fileControls:$('fileControls'), webControls:$('webControls'), fileWorkspace:$('fileWorkspace'), webWorkspace:$('webWorkspace'),
    imageInput:$('imageInput'), dropzone:$('dropzone'), translateBtn:$('translateBtn'), cancelBtn:$('cancelBtn'),
    chapterUrl:$('chapterUrl'), openChapterBtn:$('openChapterBtn'), clearChapterBtn:$('clearChapterBtn'), autoScrollToggle:$('autoScrollToggle'), hideOriginalToggle:$('hideOriginalToggle'),
    proxyUrl:$('proxyUrl'), scrollPrefetch:$('scrollPrefetch'), processVisibleBtn:$('processVisibleBtn'), openOriginalLink:$('openOriginalLink'), readerMeta:$('readerMeta'), webEmptyState:$('webEmptyState'), webReader:$('webReader'),
    ocrLang:$('ocrLang'), translatorMode:$('translatorMode'), libreSettings:$('libreSettings'), libreEndpoint:$('libreEndpoint'), libreKey:$('libreKey'),
    progressBar:$('progressBar'), statusText:$('statusText'), viewer:$('viewer'), emptyState:$('emptyState'), pageImage:$('pageImage'), overlayLayer:$('overlayLayer'), canvasWrap:$('canvasWrap'), transcript:$('transcript'), pageCounter:$('pageCounter'), prevBtn:$('prevBtn'), nextBtn:$('nextBtn'), toggleOverlayBtn:$('toggleOverlayBtn'), exportPngBtn:$('exportPngBtn'), exportTxtBtn:$('exportTxtBtn'), installBtn:$('installBtn')
  };

  const state = {
    mode:'files', pages:[], current:0, running:false, cancelled:false, overlay:true, installPrompt:null,
    translator:null, translatorSource:null, ocrWorker:null, ocrWorkerLang:null,
    webPages:[], webQueue:[], webQueued:new Set(), webProcessing:false, observer:null, originalUrl:''
  };

  const LANG_MAP = {jpn:'ja',jpn_vert:'ja',kor:'ko',chi_sim:'zh-CN',chi_tra:'zh-TW',eng:'en'};
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function toast(msg){const el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),3400)}
  function setProgress(pct,text){els.progressBar.style.width=`${Math.max(0,Math.min(100,pct))}%`;els.statusText.textContent=text}
  function setRunning(r){state.running=r;els.translateBtn.disabled=r||!state.pages.length;els.cancelBtn.disabled=!r;els.imageInput.disabled=r;els.ocrLang.disabled=r;els.translatorMode.disabled=r}
  function safeName(name){return String(name||'page').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'_')}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}

  function setMode(mode){
    state.mode=mode;
    els.modeTabs.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    els.fileControls.classList.toggle('hidden',mode!=='files');
    els.webControls.classList.toggle('hidden',mode!=='web');
    els.fileWorkspace.classList.toggle('hidden',mode!=='files');
    els.webWorkspace.classList.toggle('hidden',mode!=='web');
    localStorage.setItem('mode',mode);
  }
  els.modeTabs.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));

  function makePage(file){return{file,url:URL.createObjectURL(file),naturalW:0,naturalH:0,lines:[],done:false}}
  function loadFiles(fileList){const files=[...fileList].filter(f=>f.type.startsWith('image/'));if(!files.length)return toast('Tidak ada file gambar yang dipilih.');state.pages.forEach(p=>URL.revokeObjectURL(p.url));state.pages=files.map(makePage);state.current=0;els.translateBtn.disabled=false;renderPage();setProgress(0,`${files.length} halaman siap diproses.`)}
  els.imageInput.addEventListener('change',e=>loadFiles(e.target.files));
  ['dragenter','dragover'].forEach(evt=>els.dropzone.addEventListener(evt,e=>{e.preventDefault();els.dropzone.classList.add('drag')}));
  ['dragleave','drop'].forEach(evt=>els.dropzone.addEventListener(evt,e=>{e.preventDefault();els.dropzone.classList.remove('drag')}));
  els.dropzone.addEventListener('drop',e=>loadFiles(e.dataTransfer.files));

  function renderPage(){
    const count=state.pages.length;els.pageCounter.textContent=count?`Halaman ${state.current+1} dari ${count}`:'0 halaman';els.prevBtn.disabled=!count||state.current<=0;els.nextBtn.disabled=!count||state.current>=count-1;els.toggleOverlayBtn.disabled=!count;els.exportPngBtn.disabled=!count||!state.pages[state.current]?.done;els.exportTxtBtn.disabled=!count||!state.pages[state.current]?.done;if(!count)return;
    const page=state.pages[state.current];els.emptyState.classList.add('hidden');els.viewer.classList.remove('hidden');els.pageImage.onload=()=>{page.naturalW=els.pageImage.naturalWidth;page.naturalH=els.pageImage.naturalHeight;renderOverlays()};els.pageImage.src=page.url;renderTranscript();
  }
  function renderOverlayInto(layer,img,page,hideOriginal=true){
    if(!page||!img.naturalWidth||!img.clientWidth)return;layer.innerHTML='';const displayedW=img.clientWidth,displayedH=img.clientHeight;page.lines.forEach((line,idx)=>{if(!line.bbox||!line.translated)return;const x=line.bbox.x0/page.naturalW*displayedW,y=line.bbox.y0/page.naturalH*displayedH,w=Math.max(24,(line.bbox.x1-line.bbox.x0)/page.naturalW*displayedW),h=Math.max(18,(line.bbox.y1-line.bbox.y0)/page.naturalH*displayedH);const div=document.createElement('div');div.className='ocr-overlay';div.dataset.idx=idx;Object.assign(div.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,minHeight:`${h}px`,fontSize:`${Math.max(9,Math.min(18,h*.45))}px`});div.textContent=line.translated;layer.appendChild(div)});if(layer.parentElement)layer.parentElement.classList.toggle('hide-original',hideOriginal)
  }
  function renderOverlays(){const page=state.pages[state.current];if(!page)return;els.canvasWrap.classList.toggle('overlay-off',!state.overlay);renderOverlayInto(els.overlayLayer,els.pageImage,page,true)}
  function renderTranscript(){const page=state.pages[state.current];if(!page||!page.lines.length){els.transcript.className='transcript empty-transcript';els.transcript.textContent='Belum ada hasil OCR.';return}els.transcript.className='transcript';els.transcript.innerHTML='';page.lines.forEach((line,i)=>{const card=document.createElement('div');card.className='line-card';card.innerHTML=`<div class="line-meta"><span>Baris ${i+1}</span><span>${Math.round(line.confidence||0)}% OCR</span></div><div class="line-grid"><label><span class="line-label">Asli</span><textarea data-field="source" data-index="${i}"></textarea></label><label><span class="line-label">Indonesia</span><textarea data-field="translated" data-index="${i}"></textarea></label></div>`;card.querySelector('[data-field="source"]').value=line.text;card.querySelector('[data-field="translated"]').value=line.translated||'';els.transcript.appendChild(card)});els.transcript.querySelectorAll('textarea').forEach(ta=>ta.addEventListener('input',e=>{const line=page.lines[Number(e.target.dataset.index)];line[e.target.dataset.field==='source'?'text':'translated']=e.target.value;if(e.target.dataset.field==='translated')renderOverlays()}))}
  els.prevBtn.addEventListener('click',()=>{if(state.current>0){state.current--;renderPage()}});els.nextBtn.addEventListener('click',()=>{if(state.current<state.pages.length-1){state.current++;renderPage()}});els.toggleOverlayBtn.addEventListener('click',()=>{state.overlay=!state.overlay;els.toggleOverlayBtn.textContent=state.overlay?'Matikan overlay':'Nyalakan overlay';renderOverlays()});

  function normalizeLines(data,naturalW=1000,naturalH=1400){
    const out=[];const add=(text,bbox,confidence=0)=>{text=(text||'').replace(/\s+/g,' ').trim();if(!text)return;out.push({text,translated:'',bbox,confidence})};
    if(Array.isArray(data.lines)&&data.lines.length)data.lines.forEach(l=>add(l.text,l.bbox,l.confidence));else if(Array.isArray(data.words)&&data.words.length)data.words.forEach(w=>add(w.text,w.bbox,w.confidence));else if(Array.isArray(data.blocks))data.blocks.forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>add(l.text,l.bbox,l.confidence))));
    if(!out.length&&data.text?.trim())add(data.text.trim(),{x0:0,y0:0,x1:Math.max(100,naturalW),y1:Math.max(60,naturalH*.15)},data.confidence||0);return out;
  }

  async function getOcrWorker(){
    if(!window.Tesseract)throw new Error('Tesseract.js gagal dimuat. Periksa koneksi internet.');const lang=els.ocrLang.value;
    if(state.ocrWorker&&state.ocrWorkerLang===lang)return state.ocrWorker;
    if(state.ocrWorker){try{await state.ocrWorker.terminate()}catch{}state.ocrWorker=null}
    setProgress(2,`Menyiapkan model OCR ${lang}…`);
    state.ocrWorker=await Tesseract.createWorker(lang,1,{logger:m=>{if(m.status==='recognizing text'&&typeof m.progress==='number')setProgress(5+m.progress*55,`OCR: ${Math.round(m.progress*100)}%`)}});state.ocrWorkerLang=lang;return state.ocrWorker;
  }
  async function ocrSource(src,naturalW,naturalH){const worker=await getOcrWorker();const result=await worker.recognize(src,{}, {blocks:true});return normalizeLines(result.data,naturalW,naturalH)}

  async function getBrowserTranslator(source){
    const API=window.Translator||globalThis.Translator;if(!API?.create)throw new Error('Translator API bawaan belum tersedia di browser ini. Pilih MyMemory atau LibreTranslate.');
    if(state.translator&&state.translatorSource===source)return state.translator;
    if(state.translator?.destroy)try{state.translator.destroy()}catch{}
    if(API.availability){const a=await API.availability({sourceLanguage:source,targetLanguage:'id'});if(a==='unavailable')throw new Error(`Model terjemahan ${source} → id tidak tersedia di browser ini.`)}
    state.translator=await API.create({sourceLanguage:source,targetLanguage:'id'});state.translatorSource=source;return state.translator;
  }
  async function translateText(text){
    const cleaned=String(text||'').trim();if(!cleaned)return'';const source=LANG_MAP[els.ocrLang.value]||'ja';const mode=els.translatorMode.value;
    if(mode==='browser'){const tr=await getBrowserTranslator(source);return await tr.translate(cleaned)}
    if(mode==='mymemory'){const q=encodeURIComponent(cleaned.slice(0,450));const pair=`${encodeURIComponent(source)}|id`;const r=await fetch(`https://api.mymemory.translated.net/get?q=${q}&langpair=${pair}`);if(!r.ok)throw new Error(`MyMemory HTTP ${r.status}`);const j=await r.json();if(!j.responseData?.translatedText)throw new Error('MyMemory tidak mengembalikan terjemahan.');return j.responseData.translatedText}
    const endpoint=els.libreEndpoint.value.trim();if(!endpoint)throw new Error('Endpoint LibreTranslate kosong.');const payload={q:cleaned,source:source.startsWith('zh')?'zh':source,target:'id',format:'text'};const key=els.libreKey.value.trim();if(key)payload.api_key=key;const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`LibreTranslate HTTP ${r.status}`);const j=await r.json();if(!j.translatedText)throw new Error('LibreTranslate tidak mengembalikan terjemahan.');return j.translatedText;
  }
  async function translateLines(page,onProgress){for(let i=0;i<page.lines.length;i++){if(state.cancelled)throw new Error('__cancelled__');const line=page.lines[i];try{line.translated=await translateText(line.text)}catch(err){line.translated=`[Gagal] ${line.text}`;line.error=String(err.message||err)}if(onProgress)onProgress(i+1,page.lines.length);if(els.translatorMode.value!=='browser')await sleep(120)}page.done=true}

  els.translateBtn.addEventListener('click',async()=>{if(!state.pages.length||state.running)return;state.cancelled=false;setRunning(true);try{for(let p=0;p<state.pages.length;p++){if(state.cancelled)throw new Error('__cancelled__');state.current=p;renderPage();const page=state.pages[p];page.lines=await ocrSource(page.url,page.naturalW||1000,page.naturalH||1400);renderTranscript();renderOverlays();await translateLines(page,(i,n)=>{setProgress(60+(p/state.pages.length)*35+(i/Math.max(1,n))*(35/state.pages.length),`Terjemahan halaman ${p+1}/${state.pages.length}: ${i}/${n}`);if(p===state.current&&i%2===0){renderTranscript();renderOverlays()}})}setProgress(100,`Selesai. ${state.pages.length} halaman sudah diproses.`);renderPage();toast('OCR dan terjemahan selesai.')}catch(err){if(String(err.message)==='__cancelled__')setProgress(0,'Proses dibatalkan.');else{setProgress(0,`Gagal: ${err.message||err}`);toast(err.message||String(err))}}finally{setRunning(false)}});
  els.cancelBtn.addEventListener('click',()=>{state.cancelled=true;els.cancelBtn.disabled=true;setProgress(0,'Membatalkan setelah langkah aktif selesai…')});

  els.exportTxtBtn.addEventListener('click',()=>{const page=state.pages[state.current];if(!page)return;const txt=page.lines.map((l,i)=>`[${i+1}] ${l.text}\nID: ${l.translated||''}`).join('\n\n');downloadBlob(new Blob([txt],{type:'text/plain;charset=utf-8'}),`${safeName(page.file.name)}_ID.txt`)});
  function drawWrapped(ctx,text,x,y,w,h){const min=12,max=Math.max(min,Math.min(44,h*.42));let font=max;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#111';const centerX=x+w/2;while(font>min){ctx.font=`700 ${font}px system-ui,sans-serif`;const words=text.split(/\s+/);let rows=[],row='';for(const word of words){const test=row?`${row} ${word}`:word;if(ctx.measureText(test).width>w-10){if(row)rows.push(row);row=word}else row=test}if(row)rows.push(row);if(rows.length*font*1.15<=h-6){const start=y+h/2-(rows.length-1)*font*1.15/2;rows.forEach((r,i)=>ctx.fillText(r,centerX,start+i*font*1.15));return}font-=2}ctx.font=`700 ${min}px system-ui,sans-serif`;ctx.fillText(text.slice(0,80),centerX,y+h/2,Math.max(10,w-8))}
  els.exportPngBtn.addEventListener('click',async()=>{const page=state.pages[state.current];if(!page)return;const img=new Image();img.src=page.url;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);page.lines.forEach(l=>{if(!l.bbox||!l.translated)return;const b=l.bbox,w=b.x1-b.x0,h=b.y1-b.y0;ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(b.x0,b.y0,w,h);drawWrapped(ctx,l.translated,b.x0,b.y0,w,h)});c.toBlob(blob=>blob&&downloadBlob(blob,`${safeName(page.file.name)}_ID.png`),'image/png')});

  function withProxy(url){const p=els.proxyUrl.value.trim();return p?`${p}${encodeURIComponent(url)}`:url}
  async function fetchText(url){const direct=async()=>{const r=await fetch(url,{credentials:'omit'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()};try{return await direct()}catch(first){const p=els.proxyUrl.value.trim();if(!p)throw new Error(`Website memblokir akses browser (CORS) atau gagal dimuat. Isi Proxy URL di Pengaturan lanjutan. Detail: ${first.message}`);const r=await fetch(withProxy(url),{credentials:'omit'});if(!r.ok)throw new Error(`Proxy HTTP ${r.status}`);return await r.text()}}
  async function fetchImageObjectUrl(url){const tryFetch=async target=>{const r=await fetch(target,{credentials:'omit'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const blob=await r.blob();if(!blob.type.startsWith('image/'))throw new Error(`Bukan gambar (${blob.type||'unknown'})`);return URL.createObjectURL(blob)};try{return await tryFetch(url)}catch(first){const p=els.proxyUrl.value.trim();if(!p)throw first;return await tryFetch(withProxy(url))}}
  function bestFromSrcset(srcset){if(!srcset)return'';const items=srcset.split(',').map(s=>s.trim().split(/\s+/)).filter(a=>a[0]);return items.length?items[items.length-1][0]:''}
  function normalizeUrl(raw,base){if(!raw)return'';raw=raw.trim();if(!raw||raw.startsWith('data:')||raw.startsWith('blob:')||raw.startsWith('javascript:'))return'';try{return new URL(raw,base).href}catch{return''}}
  function extractImageUrls(html,pageUrl){const doc=new DOMParser().parseFromString(html,'text/html');const seen=new Set(),out=[];const attrs=['src','data-src','data-original','data-lazy-src','data-url','data-cfsrc'];doc.querySelectorAll('img,picture source').forEach(el=>{let raw='';if(el.hasAttribute('srcset'))raw=bestFromSrcset(el.getAttribute('srcset'));if(!raw)for(const a of attrs){const v=el.getAttribute(a);if(v){raw=v;break}}const u=normalizeUrl(raw,pageUrl);if(!u||seen.has(u))return;const lower=u.toLowerCase();if(/logo|avatar|icon|emoji|sprite|favicon|banner|ads?\b|tracking|pixel/.test(lower))return;seen.add(u);out.push(u)});return out}

  function clearWebReader(){if(state.observer)state.observer.disconnect();state.observer=null;state.webPages.forEach(p=>{if(p.objectUrl)URL.revokeObjectURL(p.objectUrl)});state.webPages=[];state.webQueue=[];state.webQueued.clear();state.webProcessing=false;els.webReader.innerHTML='';els.webReader.classList.add('hidden');els.webEmptyState.classList.remove('hidden');els.processVisibleBtn.disabled=true;els.readerMeta.textContent='Masukkan URL chapter di sebelah kiri.';els.openOriginalLink.classList.add('hidden');setProgress(0,'Reader dibersihkan.')}
  els.clearChapterBtn.addEventListener('click',clearWebReader);

  function makeWebPage(url,index){return{url,index,objectUrl:'',naturalW:0,naturalH:0,lines:[],status:'idle',done:false,element:null,imgEl:null,overlayEl:null,statusEl:null}}
  function setWebPageStatus(page,text,kind=''){if(!page.statusEl)return;page.statusEl.textContent=text;page.statusEl.className=`web-page-status ${kind}`.trim()}
  function renderWebPage(page){const wrap=document.createElement('article');wrap.className='web-page';wrap.dataset.index=page.index;wrap.classList.toggle('hide-original',els.hideOriginalToggle.checked);const status=document.createElement('div');status.className='web-page-status';status.textContent=`Halaman ${page.index+1} • menunggu`;const holder=document.createElement('div');holder.className='web-page-placeholder';holder.textContent='Memuat gambar saat mendekati layar…';const img=document.createElement('img');img.alt=`Halaman web ${page.index+1}`;img.loading='lazy';img.classList.add('hidden');const overlay=document.createElement('div');overlay.className='web-page-overlay';wrap.append(status,holder,img,overlay);els.webReader.appendChild(wrap);page.element=wrap;page.imgEl=img;page.overlayEl=overlay;page.statusEl=status;page.holderEl=holder;img.addEventListener('load',()=>{page.naturalW=img.naturalWidth;page.naturalH=img.naturalHeight;renderOverlayInto(page.overlayEl,page.imgEl,page,els.hideOriginalToggle.checked)});return wrap}

  function createObserver(){if(state.observer)state.observer.disconnect();const margin=Number(els.scrollPrefetch.value||1200);state.observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&els.autoScrollToggle.checked){const idx=Number(entry.target.dataset.index);queueWebPage(idx)}}},{root:null,rootMargin:`${margin}px 0px ${margin}px 0px`,threshold:.01});state.webPages.forEach(p=>p.element&&state.observer.observe(p.element))}
  els.scrollPrefetch.addEventListener('change',()=>{localStorage.setItem('scrollPrefetch',els.scrollPrefetch.value);createObserver()});
  els.autoScrollToggle.addEventListener('change',()=>{localStorage.setItem('autoScroll',els.autoScrollToggle.checked?'1':'0');if(els.autoScrollToggle.checked){createObserver();queueVisiblePages()}});
  els.hideOriginalToggle.addEventListener('change',()=>{localStorage.setItem('hideOriginal',els.hideOriginalToggle.checked?'1':'0');state.webPages.forEach(p=>{p.element?.classList.toggle('hide-original',els.hideOriginalToggle.checked);if(p.done)renderOverlayInto(p.overlayEl,p.imgEl,p,els.hideOriginalToggle.checked)})});

  function queueWebPage(index){const page=state.webPages[index];if(!page||page.done||page.status==='processing'||state.webQueued.has(index))return;state.webQueued.add(index);state.webQueue.push(index);runWebQueue()}
  function queueVisiblePages(){const vh=window.innerHeight;state.webPages.forEach(p=>{if(!p.element||p.done)return;const r=p.element.getBoundingClientRect();if(r.bottom>-600&&r.top<vh+600)queueWebPage(p.index)})}
  els.processVisibleBtn.addEventListener('click',queueVisiblePages);

  async function ensureWebImage(page){if(page.objectUrl)return;setWebPageStatus(page,`Halaman ${page.index+1} • mengambil gambar`);page.objectUrl=await fetchImageObjectUrl(page.url);page.imgEl.src=page.objectUrl;page.imgEl.classList.remove('hidden');page.holderEl.classList.add('hidden');await page.imgEl.decode();page.naturalW=page.imgEl.naturalWidth;page.naturalH=page.imgEl.naturalHeight;if(page.naturalW<220||page.naturalH<220)throw new Error('Gambar terlalu kecil, kemungkinan ikon/banner.')}

  async function processWebPage(page){page.status='processing';try{await ensureWebImage(page);setWebPageStatus(page,`Halaman ${page.index+1} • OCR`);page.lines=await ocrSource(page.objectUrl,page.naturalW,page.naturalH);renderOverlayInto(page.overlayEl,page.imgEl,page,els.hideOriginalToggle.checked);setWebPageStatus(page,`Halaman ${page.index+1} • menerjemahkan 0/${page.lines.length}`);await translateLines(page,(i,n)=>{setWebPageStatus(page,`Halaman ${page.index+1} • menerjemahkan ${i}/${n}`);if(i%2===0)renderOverlayInto(page.overlayEl,page.imgEl,page,els.hideOriginalToggle.checked)});renderOverlayInto(page.overlayEl,page.imgEl,page,els.hideOriginalToggle.checked);page.status='done';setWebPageStatus(page,`Halaman ${page.index+1} • selesai`,'done')}catch(err){page.status='error';page.error=String(err.message||err);setWebPageStatus(page,`Halaman ${page.index+1} • dilewati`,'error');page.holderEl?.classList.remove('hidden');if(page.holderEl)page.holderEl.textContent=`Gagal: ${page.error}`}}
  async function runWebQueue(){if(state.webProcessing)return;state.webProcessing=true;while(state.webQueue.length){const index=state.webQueue.shift();state.webQueued.delete(index);const page=state.webPages[index];if(!page||page.done)continue;setProgress(15,`Memproses halaman web ${index+1}/${state.webPages.length}…`);await processWebPage(page);const done=state.webPages.filter(p=>p.done).length;setProgress(Math.round(done/Math.max(1,state.webPages.length)*100),`${done}/${state.webPages.length} halaman web selesai. Scroll untuk melanjutkan.`)}state.webProcessing=false}

  els.openChapterBtn.addEventListener('click',async()=>{
    let url=els.chapterUrl.value.trim();if(!url)return toast('Masukkan URL chapter lebih dulu.');if(!/^https?:\/\//i.test(url))url=`https://${url}`;try{new URL(url)}catch{return toast('Format URL tidak valid.')}
    clearWebReader();state.originalUrl=url;els.openChapterBtn.disabled=true;setProgress(4,'Mengambil halaman website…');
    try{const html=await fetchText(url);const urls=extractImageUrls(html,url);if(!urls.length)throw new Error('Tidak menemukan gambar pada halaman. Situs mungkin memuat gambar lewat JavaScript atau memblokir akses.');state.webPages=urls.map(makeWebPage);els.webEmptyState.classList.add('hidden');els.webReader.classList.remove('hidden');state.webPages.forEach(renderWebPage);els.readerMeta.textContent=`${urls.length} kandidat gambar ditemukan • terjemahan berjalan saat scrolling`;els.processVisibleBtn.disabled=false;els.openOriginalLink.href=url;els.openOriginalLink.classList.remove('hidden');createObserver();setProgress(8,`${urls.length} gambar ditemukan. Scroll ke bawah untuk menerjemahkan.`);if(els.autoScrollToggle.checked)queueVisiblePages()}catch(err){els.readerMeta.textContent='Gagal membuka chapter.';setProgress(0,`Gagal: ${err.message||err}`);toast(err.message||String(err))}finally{els.openChapterBtn.disabled=false}
  });

  window.addEventListener('resize',()=>{if(state.mode==='files')renderOverlays();else state.webPages.forEach(p=>p.done&&renderOverlayInto(p.overlayEl,p.imgEl,p,els.hideOriginalToggle.checked))});
  window.addEventListener('scroll',()=>{if(state.mode==='web'&&els.autoScrollToggle.checked)queueVisiblePages()},{passive:true});

  function restoreSettings(){
    const mode=localStorage.getItem('translatorMode');if(mode)els.translatorMode.value=mode;const endpoint=localStorage.getItem('libreEndpoint');if(endpoint)els.libreEndpoint.value=endpoint;const lang=localStorage.getItem('ocrLang');if(lang)els.ocrLang.value=lang;const proxy=localStorage.getItem('proxyUrl');if(proxy)els.proxyUrl.value=proxy;const pre=localStorage.getItem('scrollPrefetch');if(pre)els.scrollPrefetch.value=pre;const auto=localStorage.getItem('autoScroll');if(auto!==null)els.autoScrollToggle.checked=auto==='1';const hide=localStorage.getItem('hideOriginal');if(hide!==null)els.hideOriginalToggle.checked=hide==='1';const savedMode=localStorage.getItem('mode');if(savedMode)setMode(savedMode);els.libreSettings.classList.toggle('hidden',els.translatorMode.value!=='libre')
  }
  els.translatorMode.addEventListener('change',()=>{els.libreSettings.classList.toggle('hidden',els.translatorMode.value!=='libre');localStorage.setItem('translatorMode',els.translatorMode.value)});els.libreEndpoint.addEventListener('change',()=>localStorage.setItem('libreEndpoint',els.libreEndpoint.value));els.ocrLang.addEventListener('change',async()=>{localStorage.setItem('ocrLang',els.ocrLang.value);if(state.ocrWorker){try{await state.ocrWorker.terminate()}catch{}state.ocrWorker=null;state.ocrWorkerLang=null}});els.proxyUrl.addEventListener('change',()=>localStorage.setItem('proxyUrl',els.proxyUrl.value.trim()));

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;els.installBtn.classList.remove('hidden')});els.installBtn.addEventListener('click',async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;els.installBtn.classList.add('hidden')});
  if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  restoreSettings();
})();
