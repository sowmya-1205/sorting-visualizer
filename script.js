/*
  Card Sorting Visualizer (Cars removed, lively cards)
  - Cards with numbers; sorts according to algorithm
  - Bubble, Selection, Quick, Merge with horizontal slide swaps
  - Highlights during comparisons, green glow when sorted, confetti on finish
  - Sidebar shows algorithm definition
  - Optional beeps on compare/swap
*/

(() => {
  'use strict';

  // ---------- DOM ELEMENTS ----------
  const board = document.getElementById('board');
  const cardsLayer = document.getElementById('cardsLayer');
  const statusEl = document.getElementById('status');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const algoInfo = document.getElementById('algoInfo');

  const algoSelect = document.getElementById('algorithm');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');
  const speedSlider = document.getElementById('speedSlider');
  const speedLabel = document.getElementById('speedLabel');
  const soundToggle = document.getElementById('soundToggle');

  const btnGenerate = document.getElementById('btnGenerate');
  const btnStart = document.getElementById('btnStart');
  const btnReset = document.getElementById('btnReset');

  // ---------- STATE ----------
  /** @type {{ value: number, el: HTMLElement }[]} */
  let items = [];
  let isSorting = false;
  let isSorted = false;

  const CARD_W = 80;
  const paddingX = 16;

  // animation speed map
  const speedToMs = { '1': 700, '2': 380, '3': 160 };

  // ---------- ALGORITHM DEFINITIONS ----------
  const ALGO_DEFS = {
    bubble: `<b>Bubble Sort</b><br/>Adjacent comparisons and swaps; largest elements bubble to the end.<br/>Best: O(n), Avg/Worst: O(n²), Stable: Yes.`,
    selection: `<b>Selection Sort</b><br/>Selects the smallest remaining and places it next.<br/>Best/Avg/Worst: O(n²), Stable: No.`,
    quick: `<b>Quick Sort</b><br/>Partition around a pivot; recursively sort partitions.<br/>Best/Avg: O(n log n), Worst: O(n²), Stable: No.`,
    merge: `<b>Merge Sort</b><br/>Divide and conquer with stable merging.<br/>Best/Avg/Worst: O(n log n), Stable: Yes.`,
  };
  const updateAlgoInfo = (algo) => { algoInfo.innerHTML = ALGO_DEFS[algo] || ''; };

  // ---------- SOUND ----------
  const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
  function playBeep(freq = 600, durationMs = 80, type = 'sine', volume = 0.03) {
    if (!soundToggle.checked || !audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = volume;
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime; osc.start(now); osc.stop(now + durationMs / 1000);
  }

  // ---------- UTILS ----------
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const setStatus = (t) => statusEl.textContent = t;
  function disableControls(disabled) {
    algoSelect.disabled = disabled; sizeSlider.disabled = disabled; speedSlider.disabled = disabled;
    btnGenerate.disabled = disabled; btnReset.disabled = disabled;
    btnStart.disabled = disabled ? true : isSorted ? true : false;
  }

  function computeStep(n) {
    const w = board.clientWidth;
    const available = Math.max(0, w - paddingX * 2 - CARD_W);
    if (n <= 1) return 0;
    return available / (n - 1);
  }

  function createCard(value) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = String(value);
    el.style.setProperty('--anim', `${speedToMs[speedSlider.value]}ms`);
    return el;
  }

  function clearCards() { cardsLayer.innerHTML = ''; items = []; }

  function renderCards(values) {
    clearCards();
    const step = computeStep(values.length);
    for (let i = 0; i < values.length; i++) {
      const el = createCard(values[i]);
      el.style.left = `${paddingX + i * step}px`;
      el.style.position = 'absolute';
      el.style.top = `calc(50% - 50px)`;
      cardsLayer.appendChild(el);
      items.push({ value: values[i], el });
    }
  }

  function updatePositions() {
    const step = computeStep(items.length);
    items.forEach((it, i) => {
      it.el.style.left = `${paddingX + i * step}px`;
      it.el.style.top = `calc(50% - 50px)`;
      it.el.textContent = String(it.value);
    });
  }

  // highlight helpers
  function setCompare(i, j, on) {
    if (items[i]) items[i].el.classList.toggle('card--compare', on);
    if (items[j]) items[j].el.classList.toggle('card--compare', on);
    if (on) playBeep(660, 60, 'square', 0.02);
  }
  function pulseSwap(i, j) {
    if (items[i]) items[i].el.classList.add('card--swap');
    if (items[j]) items[j].el.classList.add('card--swap');
    setTimeout(() => {
      if (items[i]) items[i].el.classList.remove('card--swap');
      if (items[j]) items[j].el.classList.remove('card--swap');
    }, 260);
    playBeep(420, 80, 'sawtooth', 0.03);
  }
  const markSorted = () => items.forEach(it => it.el.classList.add('card--sorted'));
  const unmarkState = () => items.forEach(it => { it.el.classList.remove('card--sorted','card--compare','card--swap'); });

  function swapInArray(i, j) { const t = items[i]; items[i] = items[j]; items[j] = t; }
  async function swapAnimated(i, j) {
    if (i === j) return;
    pulseSwap(i, j);
    const duration = speedToMs[speedSlider.value];
    const step = computeStep(items.length);
    const xi = paddingX + i * step;
    const xj = paddingX + j * step;
    const elI = items[i].el, elJ = items[j].el;
    const dxi = xj - xi, dxj = xi - xj;
    elI.style.setProperty('--tx', `${dxi}px`);
    elJ.style.setProperty('--tx', `${dxj}px`);
    await wait(duration);
    elI.style.setProperty('--tx', '0px');
    elJ.style.setProperty('--tx', '0px');
    swapInArray(i, j);
    items[i].el.style.left = `${paddingX + i * step}px`;
    items[j].el.style.left = `${paddingX + j * step}px`;
  }

  // ---------- CONFETTI ----------
  const confetti = (() => {
    const ctx = confettiCanvas.getContext('2d');
    let pieces = []; let running = false;
    const colors = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ffd6e6', '#9b5de5'];
    function createPiece(w, h){ return { x: Math.random()*w, y: -10, size: 6+Math.random()*6, color: colors[rand(0, colors.length-1)], speedY: 2+Math.random()*2, rot: Math.random()*Math.PI, rotSpeed: (Math.random()-0.5)*0.2 }; }
    function start(){ const {width,height}=confettiCanvas.getBoundingClientRect(); confettiCanvas.width=width*devicePixelRatio; confettiCanvas.height=height*devicePixelRatio; const w=confettiCanvas.width,h=confettiCanvas.height; pieces=Array.from({length:120},()=>createPiece(w,h)); running=true; confettiCanvas.style.opacity='1'; loop(); setTimeout(stop,2500); }
    function stop(){ running=false; confettiCanvas.style.opacity='0'; ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height); }
    function loop(){ if(!running) return; const w=confettiCanvas.width,h=confettiCanvas.height; ctx.clearRect(0,0,w,h); for(const p of pieces){ p.y+=p.speedY*devicePixelRatio; p.rot+=p.rotSpeed; if(p.y>h+20){ p.y=-10; p.x=Math.random()*w; } ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore(); } requestAnimationFrame(loop); }
    return { start, stop };
  })();

  // ---------- DATA / UI ----------
  function generateValues(n){ const pool = Array.from({length:90},(_,i)=>i+10); for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]];} return pool.slice(0,n); }
  function generate(){ isSorted=false; isSorting=false; const n=+sizeSlider.value; renderCards(generateValues(n)); setStatus('Cards generated. Choose an algorithm and start sorting!'); btnStart.disabled=false; }
  function reset(){ isSorted=false; isSorting=false; unmarkState(); setStatus('Reset. Generate cards to begin.'); clearCards(); btnStart.disabled=true; }

  // ---------- SORTS ----------
  async function compare(i,j){ setCompare(i,j,true); await wait(speedToMs[speedSlider.value]*0.4); setCompare(i,j,false); }
  async function bubbleSort(){ const n=items.length; for(let i=0;i<n-1;i++){ for(let j=0;j<n-i-1;j++){ await compare(j,j+1); if(items[j].value>items[j+1].value) await swapAnimated(j,j+1); } } }
  async function selectionSort(){ const n=items.length; for(let i=0;i<n-1;i++){ let min=i; for(let j=i+1;j<n;j++){ await compare(min,j); if(items[j].value<items[min].value) min=j; } if(min!==i) await swapAnimated(i,min); } }
  async function quickSort(){ async function part(l,h){ const pivot=items[h].value; let i=l-1; for(let j=l;j<h;j++){ await compare(j,h); if(items[j].value<=pivot){ i++; await swapAnimated(i,j);} } await swapAnimated(i+1,h); return i+1;} async function qs(l,h){ if(l<h){ const p=await part(l,h); await qs(l,p-1); await qs(p+1,h);} } await qs(0,items.length-1);} 
  async function mergeSort(){ async function merge(l,m,r){ const L=items.slice(l,m+1).map(it=>it.value); const R=items.slice(m+1,r+1).map(it=>it.value); let i=0,j=0,k=l; while(i<L.length&&j<R.length){ const vL=L[i], vR=R[j]; const idxL=items.findIndex((it,idx)=>idx>=l&&it.value===vL); const idxR=items.findIndex((it,idx)=>idx>=l&&it.value===vR); if(idxL!==-1&&idxR!==-1) await compare(idxL,idxR); if(vL<=vR){ const cur=items.findIndex((it,idx)=>idx>=l&&it.value===vL); if(cur!==k) await moveToIndex(cur,k); k++; i++; } else { const cur=items.findIndex((it,idx)=>idx>=l&&it.value===vR); if(cur!==k) await moveToIndex(cur,k); k++; j++; } } while(i<L.length){ const vL=L[i++]; const cur=items.findIndex((it,idx)=>idx>=l&&it.value===vL); if(cur!==k) await moveToIndex(cur,k); k++; } while(j<R.length){ const vR=R[j++]; const cur=items.findIndex((it,idx)=>idx>=l&&it.value===vR); if(cur!==k) await moveToIndex(cur,k); k++; } } async function ms(l,r){ if(l>=r) return; const m=Math.floor((l+r)/2); await ms(l,m); await ms(m+1,r); await merge(l,m,r);} await ms(0,items.length-1);} 

  async function moveToIndex(from,to){ if(from===to) return; if(from<to){ for(let k=from;k<to;k++) await swapAnimated(k,k+1);} else { for(let k=from;k>to;k--) await swapAnimated(k,k-1);} }

  // ---------- UI WIRING ----------
  function updateSpeedLabel(){ const map={'1':'Slow','2':'Medium','3':'Fast'}; speedLabel.textContent=map[speedSlider.value]; items.forEach(it=>it.el.style.setProperty('--anim',`${speedToMs[speedSlider.value]}ms`)); }
  sizeSlider.addEventListener('input',()=>{ sizeValue.textContent=sizeSlider.value; });
  speedSlider.addEventListener('input',()=>{ updateSpeedLabel(); });
  algoSelect.addEventListener('change',()=>{ updateAlgoInfo(algoSelect.value); });

  btnGenerate.addEventListener('click',()=>{ if(isSorting) return; generate(); });
  btnReset.addEventListener('click',()=>{ if(isSorting) return; reset(); });

  btnStart.addEventListener('click', async ()=>{
    if(isSorting || items.length===0) return;
    if(audioCtx && audioCtx.state==='suspended'){ audioCtx.resume(); }
    isSorting=true; setStatus('Sorting in progress...'); disableControls(true);
    try{
      switch(algoSelect.value){
        case 'bubble': await bubbleSort(); break;
        case 'selection': await selectionSort(); break;
        case 'quick': await quickSort(); break;
        case 'merge': await mergeSort(); break;
        default: await bubbleSort(); break;
      }
      isSorted=true; isSorting=false; markSorted(); setStatus('Finished! Cards Sorted ✅'); confetti.start(); disableControls(false); btnStart.disabled=true;
    }catch(err){ console.error(err); isSorting=false; disableControls(false); setStatus('Error. Reset and try again.'); }
  });

  window.addEventListener('resize',()=>{ if(items.length>0) updatePositions(); });

  // init
  updateSpeedLabel(); sizeValue.textContent=sizeSlider.value; setStatus('Ready. Generate cards to begin.'); btnStart.disabled=true; updateAlgoInfo(algoSelect.value);
})();
