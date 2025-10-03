/*
  Car Racing Sorting Visualizer (Lively Edition)
  - Lively cars with roof, windows, lights, spoiler, wheels
  - Absolute positioning: cars spread across track, rightmost near finish line
  - Bubble, Selection, Quick, Merge with smooth horizontal slide swaps
  - Highlights during comparisons, green glow when sorted, confetti on finish
  - Sidebar shows algorithm definition
  - Optional beeps on compare/swap
*/

(() => {
  'use strict';

  // ---------- DOM ELEMENTS ----------
  const track = document.getElementById('track');
  const carsLayer = document.getElementById('carsLayer');
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
  /**
   * Visual cars in current left-to-right order
   * @type {{ value: number, el: HTMLElement, color: string }[]}
   */
  let cars = [];
  let isSorting = false;
  let isSorted = false;

  // layout metrics for absolute positioning toward finish line
  const layout = {
    leftPad: 24,
    rightPad: 72, // leave space before finish line
    carWidth: 76,
    baseOffsetY: 56, // distance from top bound of layer to car baseline
  };

  // animation speed map
  const speedToMs = {
    '1': 700, // slow
    '2': 380, // medium
    '3': 160, // fast
  };

  // ---------- ALGORITHM DEFINITIONS ----------
  const ALGO_DEFS = {
    bubble: `
      <b>Bubble Sort</b><br/>
      Repeatedly compares adjacent cars and swaps them if out of order. Each pass "bubbles" the largest car value to the right.<br/>
      Best: O(n), Average/Worst: O(n²), Stable: Yes.
    `,
    selection: `
      <b>Selection Sort</b><br/>
      Repeatedly finds the smallest remaining car and places it at the current position. Minimizes swaps but still quadratic comparisons.<br/>
      Best/Average/Worst: O(n²), Stable: No (naive version).
    `,
    quick: `
      <b>Quick Sort</b><br/>
      Divides the array around a pivot so smaller cars go left, larger go right. Recursively sorts partitions. Very fast on average.<br/>
      Best/Average: O(n log n), Worst: O(n²), Stable: No.
    `,
    merge: `
      <b>Merge Sort</b><br/>
      Recursively splits cars into halves, sorts each half, then merges them back together in order. Predictable performance and stable.<br/>
      Best/Average/Worst: O(n log n), Stable: Yes.
    `,
  };

  function updateAlgoInfo(algo) {
    algoInfo.innerHTML = ALGO_DEFS[algo] || '';
  }

  // ---------- SOUND ----------
  const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
  function playBeep(freq = 600, durationMs = 80, type = 'sine', volume = 0.03) {
    if (!soundToggle.checked || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  }

  // ---------- UTILITIES ----------
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

  function setStatus(text) { statusEl.textContent = text; }

  function disableControls(disabled) {
    algoSelect.disabled = disabled;
    sizeSlider.disabled = disabled;
    speedSlider.disabled = disabled;
    btnGenerate.disabled = disabled;
    btnReset.disabled = disabled;
    btnStart.disabled = disabled ? true : isSorted ? true : false;
  }

  function computeStep(n) {
    const w = track.clientWidth;
    const available = Math.max(0, w - layout.leftPad - layout.rightPad - layout.carWidth);
    if (n <= 1) return 0;
    return available / (n - 1);
  }

  function generateColors(n) {
    const colors = [];
    const hueStep = 360 / Math.max(n, 1);
    for (let i = 0; i < n; i++) {
      const hue = Math.round(i * hueStep + rand(-6, 6));
      const sat = 75 + rand(-8, 8);
      const light = 55 + rand(-8, 8);
      colors.push(`hsl(${hue} ${sat}% ${light}%)`);
    }
    return colors;
  }

  function computeScales(vals) {
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const minS = 0.7;
    const maxS = 1.6;
    return vals.map(v => {
      if (maxV === minV) return 1.15;
      const t = (v - minV) / (maxV - minV);
      return +(minS + t * (maxS - minS)).toFixed(2);
    });
  }

  function createCarElement(value, color, scale) {
    const car = document.createElement('div');
    car.className = 'car';
    car.style.background = `linear-gradient(180deg, ${color} 0%, rgba(0,0,0,0.15) 100%)`;
    car.style.setProperty('--anim', `${speedToMs[speedSlider.value]}ms`);
    car.style.setProperty('--scale', String(scale));

    const label = document.createElement('div');
    label.className = 'value';
    label.textContent = String(value);

    const body = document.createElement('div');
    body.className = 'car__body';
    const roof = document.createElement('div');
    roof.className = 'car__roof';
    const windowEl = document.createElement('div');
    windowEl.className = 'car__window';
    const stripe = document.createElement('div');
    stripe.className = 'car__stripe';
    const lightFront = document.createElement('div');
    lightFront.className = 'car__light--front';
    const lightRear = document.createElement('div');
    lightRear.className = 'car__light--rear';
    const spoiler = document.createElement('div');
    spoiler.className = 'car__spoiler';

    const wheelRear = document.createElement('div');
    wheelRear.className = 'wheel wheel--rear';
    const wheelFront = document.createElement('div');
    wheelFront.className = 'wheel wheel--front';

    body.appendChild(roof);
    body.appendChild(windowEl);
    body.appendChild(stripe);
    body.appendChild(lightFront);
    body.appendChild(lightRear);
    body.appendChild(spoiler);

    car.appendChild(label);
    car.appendChild(body);
    car.appendChild(wheelRear);
    car.appendChild(wheelFront);
    return car;
  }

  function clearCars() {
    carsLayer.innerHTML = '';
    cars = [];
  }

  function renderCars(vals) {
    clearCars();
    const colors = generateColors(vals.length);
    const scales = computeScales(vals);
    const laneHeight = carsLayer.clientHeight;
    const baseY = laneHeight - layout.baseOffsetY;
    const step = computeStep(vals.length);

    for (let i = 0; i < vals.length; i++) {
      const el = createCarElement(vals[i], colors[i], scales[i]);
      const x = layout.leftPad + i * step;
      el.style.left = `${x}px`;
      el.style.top = `${baseY}px`;
      carsLayer.appendChild(el);
      cars.push({ value: vals[i], el, color: colors[i] });
    }
  }

  function updatePositions() {
    const laneHeight = carsLayer.clientHeight;
    const baseY = laneHeight - layout.baseOffsetY;
    const step = computeStep(cars.length);
    cars.forEach((c, i) => {
      const x = layout.leftPad + i * step;
      c.el.style.left = `${x}px`;
      c.el.style.top = `${baseY}px`;
      const label = c.el.querySelector('.value');
      if (label) label.textContent = String(c.value);
    });
  }

  // After sorting completes, let cars gently drive to the finish line area
  async function finalDriveToFinish() {
    const duration = Math.max(400, speedToMs[speedSlider.value] * 1.5);
    const step = computeStep(cars.length);
    const finishRight = track.clientWidth - layout.rightPad - layout.carWidth;
    // distribute cars tightly ending at finishRight (stable order preserved)
    const spacing = Math.min(step, 34);
    const startX = Math.max(layout.leftPad, finishRight - spacing * (cars.length - 1));
    const promises = [];
    cars.forEach((c, i) => {
      const el = c.el;
      const targetX = startX + i * spacing;
      const currentX = parseFloat(el.style.left || '0');
      const dx = targetX - currentX;
      el.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      el.style.transform = `translateX(${dx}px)`;
      promises.push(new Promise(res => setTimeout(res, duration)));
    });
    await Promise.all(promises);
    // fix absolute positions and clear transforms
    cars.forEach((c, i) => {
      const x = startX + i * spacing;
      c.el.style.transition = '';
      c.el.style.transform = '';
      c.el.style.left = `${x}px`;
    });
  }

  // highlight helpers
  function setCompare(i, j, on) {
    if (cars[i]) cars[i].el.classList.toggle('car--compare', on);
    if (cars[j]) cars[j].el.classList.toggle('car--compare', on);
    if (on) playBeep(660, 60, 'square', 0.02);
  }
  function pulseSwap(i, j) {
    if (cars[i]) cars[i].el.classList.add('car--swap');
    if (cars[j]) cars[j].el.classList.add('car--swap');
    setTimeout(() => {
      if (cars[i]) cars[i].el.classList.remove('car--swap');
      if (cars[j]) cars[j].el.classList.remove('car--swap');
    }, 260);
    playBeep(420, 80, 'sawtooth', 0.03);
  }

  function markSorted() { cars.forEach(c => c.el.classList.add('car--sorted')); }
  function unmarkState() {
    cars.forEach(c => {
      c.el.classList.remove('car--sorted');
      c.el.classList.remove('car--compare');
      c.el.classList.remove('car--swap');
    });
  }

  // swap in array only; visuals will animate
  function swapInArray(i, j) { const t = cars[i]; cars[i] = cars[j]; cars[j] = t; }

  async function swapAnimated(i, j) {
    if (i === j) return;
    pulseSwap(i, j);
    const duration = speedToMs[speedSlider.value];
    const step = computeStep(cars.length);
    const xI = layout.leftPad + i * step;
    const xJ = layout.leftPad + j * step;
    const elI = cars[i].el;
    const elJ = cars[j].el;
    const dxI = xJ - xI;
    const dxJ = xI - xJ;

    elI.style.setProperty('--tx', `${dxI}px`);
    elJ.style.setProperty('--tx', `${dxJ}px`);

    await wait(duration);

    // reset transforms and fix absolute positions
    elI.style.setProperty('--tx', '0px');
    elJ.style.setProperty('--tx', '0px');

    // swap in data and set final lefts
    swapInArray(i, j);
    cars[i].el.style.left = `${layout.leftPad + i * step}px`;
    cars[j].el.style.left = `${layout.leftPad + j * step}px`;
  }

  // Move element at fromIdx to toIdx via adjacent swaps
  async function moveElementToIndex(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (fromIdx < toIdx) {
      for (let k = fromIdx; k < toIdx; k++) await swapAnimated(k, k + 1);
    } else {
      for (let k = fromIdx; k > toIdx; k--) await swapAnimated(k, k - 1);
    }
  }

  // ---------- CONFETTI ----------
  const confetti = (() => {
    const ctx = confettiCanvas.getContext('2d');
    let pieces = [];
    let running = false;
    const colors = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ffd6e6', '#9b5de5'];

    function createPiece(w, h) {
      return { x: Math.random() * w, y: -10, size: 6 + Math.random() * 6, color: colors[rand(0, colors.length - 1)], speedY: 2 + Math.random() * 2, rot: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.2 };
    }
    function start() {
      const { width, height } = confettiCanvas.getBoundingClientRect();
      confettiCanvas.width = width * devicePixelRatio;
      confettiCanvas.height = height * devicePixelRatio;
      const w = confettiCanvas.width; const h = confettiCanvas.height;
      pieces = Array.from({ length: 120 }, () => createPiece(w, h));
      running = true; confettiCanvas.style.opacity = '1';
      loop(); setTimeout(stop, 2500);
    }
    function stop() { running = false; confettiCanvas.style.opacity = '0'; ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
    function loop() {
      if (!running) return; const w = confettiCanvas.width; const h = confettiCanvas.height; ctx.clearRect(0, 0, w, h);
      for (const p of pieces) { p.y += p.speedY * devicePixelRatio; p.rot += p.rotSpeed; if (p.y > h + 20) { p.y = -10; p.x = Math.random() * w; } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); }
      requestAnimationFrame(loop);
    }
    return { start, stop };
  })();

  // ---------- GENERATION / RESET ----------
  function generateValues(n) {
    // generate unique values between 10 and 99 to avoid duplicate-tracking issues
    const pool = Array.from({ length: 90 }, (_, i) => i + 10);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }

  function generateCars() {
    isSorted = false; isSorting = false;
    const n = parseInt(sizeSlider.value, 10);
    const values = generateValues(n);
    renderCars(values);
    setStatus('Cars generated. Choose an algorithm and start the race!');
    btnStart.disabled = false;
  }

  function reset() {
    isSorting = false; isSorted = false; unmarkState(); setStatus('Reset. Generate cars to begin.'); clearCars(); btnStart.disabled = true;
  }

  // ---------- SORTING HELPERS ----------
  async function compare(i, j) { setCompare(i, j, true); await wait(speedToMs[speedSlider.value] * 0.4); setCompare(i, j, false); }

  // Algorithms use cars[i].value
  async function bubbleSort() {
    const n = cars.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        await compare(j, j + 1);
        if (cars[j].value > cars[j + 1].value) await swapAnimated(j, j + 1);
      }
    }
  }

  async function selectionSort() {
    const n = cars.length;
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) { await compare(minIdx, j); if (cars[j].value < cars[minIdx].value) minIdx = j; }
      if (minIdx !== i) await swapAnimated(i, minIdx);
    }
  }

  async function quickSort() {
    async function partition(low, high) {
      const pivot = cars[high].value; let i = low - 1;
      for (let j = low; j < high; j++) { await compare(j, high); if (cars[j].value <= pivot) { i++; await swapAnimated(i, j); } }
      await swapAnimated(i + 1, high); return i + 1;
    }
    async function qs(low, high) { if (low < high) { const p = await partition(low, high); await qs(low, p - 1); await qs(p + 1, high); } }
    await qs(0, cars.length - 1);
  }

  async function mergeSort() {
    async function merge(left, mid, right) {
      const leftVals = cars.slice(left, mid + 1).map(c => c.value);
      const rightVals = cars.slice(mid + 1, right + 1).map(c => c.value);
      let i = 0, j = 0, k = left;
      while (i < leftVals.length && j < rightVals.length) {
        const valL = leftVals[i]; const valR = rightVals[j];
        // find their current indices in cars from left onward for stability
        const idxL = cars.findIndex((c, idx) => idx >= left && c.value === valL);
        const idxR = cars.findIndex((c, idx) => idx >= left && c.value === valR);
        if (idxL !== -1 && idxR !== -1) await compare(idxL, idxR);
        if (valL <= valR) {
          const currIdx = cars.findIndex((c, idx) => idx >= left && c.value === valL);
          if (currIdx !== k) await moveElementToIndex(currIdx, k);
          k++; i++;
        } else {
          const currIdx = cars.findIndex((c, idx) => idx >= left && c.value === valR);
          if (currIdx !== k) await moveElementToIndex(currIdx, k);
          k++; j++;
        }
      }
      while (i < leftVals.length) { const valL = leftVals[i++]; const currIdx = cars.findIndex((c, idx) => idx >= left && c.value === valL); if (currIdx !== k) await moveElementToIndex(currIdx, k); k++; }
      while (j < rightVals.length) { const valR = rightVals[j++]; const currIdx = cars.findIndex((c, idx) => idx >= left && c.value === valR); if (currIdx !== k) await moveElementToIndex(currIdx, k); k++; }
    }
    async function ms(left, right) { if (left >= right) return; const mid = Math.floor((left + right) / 2); await ms(left, mid); await ms(mid + 1, right); await merge(left, mid, right); }
    await ms(0, cars.length - 1);
  }

  // ---------- UI WIRING ----------
  function updateSpeedLabel() {
    const map = { '1': 'Slow', '2': 'Medium', '3': 'Fast' };
    speedLabel.textContent = map[speedSlider.value];
    cars.forEach(c => c.el.style.setProperty('--anim', `${speedToMs[speedSlider.value]}ms`));
  }

  sizeSlider.addEventListener('input', () => { sizeValue.textContent = sizeSlider.value; });
  speedSlider.addEventListener('input', () => { updateSpeedLabel(); });
  algoSelect.addEventListener('change', () => { updateAlgoInfo(algoSelect.value); });

  btnGenerate.addEventListener('click', () => { if (isSorting) return; generateCars(); });
  btnReset.addEventListener('click', () => { if (isSorting) return; reset(); });

  btnStart.addEventListener('click', async () => {
    if (isSorting || cars.length === 0) return;
    if (audioCtx && audioCtx.state === 'suspended') { audioCtx.resume(); }

    isSorting = true; setStatus('Sorting in progress...'); disableControls(true);

    const algo = algoSelect.value;
    try {
      switch (algo) {
        case 'bubble': await bubbleSort(); break;
        case 'selection': await selectionSort(); break;
        case 'quick': await quickSort(); break;
        case 'merge': await mergeSort(); break;
        default: await bubbleSort(); break;
      }
      isSorted = true; isSorting = false; markSorted();
      setStatus('Race Finished! Cars Sorted 🚗✅');
      await finalDriveToFinish();
      confetti.start();
      disableControls(false); btnStart.disabled = true;
    } catch (err) {
      console.error(err); isSorting = false; disableControls(false); setStatus('An error occurred. Please Reset and try again.');
    }
  });

  // Handle window resize for dynamic positions
  window.addEventListener('resize', () => { if (cars.length > 0) updatePositions(); });

  // Initialize defaults
  updateSpeedLabel(); sizeValue.textContent = sizeSlider.value; setStatus('Ready. Generate cars to begin.'); btnStart.disabled = true; updateAlgoInfo(algoSelect.value);
})();
