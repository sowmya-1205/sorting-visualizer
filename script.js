/*
  Car Racing Sorting Visualizer
  - Generates colorful "cars" representing array values
  - Visualizes Bubble, Selection, Quick, Merge sorts with smooth animations
  - Interactive controls for algorithm, size, and speed
  - Green glow for sorted cars, highlights during comparisons, confetti at finish
  - Optional sound effects
*/

(() => {
  'use strict';

  // ---------- DOM ELEMENTS ----------
  const track = document.getElementById('track');
  const carsLayer = document.getElementById('carsLayer');
  const statusEl = document.getElementById('status');
  const confettiCanvas = document.getElementById('confettiCanvas');

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
   * Array of cars in visual/index order
   * @type {{ value: number, el: HTMLElement, color: string }[]}
   */
  let cars = [];
  let isSorting = false;
  let isSorted = false;

  // layout metrics for absolute positioning toward finish line
  const layout = {
    leftPad: 24,
    rightPad: 72, // leave space before finish line
    step: 80,
    carWidth: 60,
  };

  // animation speed map
  const speedToMs = {
    '1': 700, // slow
    '2': 380, // medium
    '3': 160, // fast
  };

  // sound fx
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

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function disableControls(disabled) {
    algoSelect.disabled = disabled;
    sizeSlider.disabled = disabled;
    speedSlider.disabled = disabled;
    btnGenerate.disabled = disabled;
    btnReset.disabled = disabled;
    btnStart.disabled = disabled ? true : isSorted ? true : false; // during sort disabled; after sort disabled
  }

  // generate distinct but nice colors
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

  function mapValuesToHeights(vals) {
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const minH = 40; // px
    const maxH = Math.max(60, Math.min(track.clientHeight - 70, 180));
    return vals.map(v => {
      if (maxV === minV) return (minH + maxH) / 2;
      const t = (v - minV) / (maxV - minV);
      return Math.round(minH + t * (maxH - minH));
    });
  }

  function createCarElement(value, color) {
    const car = document.createElement('div');
    car.className = 'car';
    car.style.background = `linear-gradient(180deg, ${color} 0%, rgba(0,0,0,0.15) 100%)`;

    const label = document.createElement('div');
    label.className = 'value';
    label.textContent = String(value);

    const body = document.createElement('div');
    body.className = 'car__body';

    car.appendChild(label);
    car.appendChild(body);
    return car;
  }

  function clearCars() {
    carsLayer.innerHTML = '';
    carEls = [];
  }

  function renderCars(vals) {
    clearCars();
    const colors = generateColors(vals.length);
    const heights = mapValuesToHeights(vals);

    // car width is flexible with gap; use flex + translate for swaps
    for (let i = 0; i < vals.length; i++) {
      const car = createCarElement(vals[i], colors[i]);
      car.style.setProperty('--anim', `${speedToMs[speedSlider.value]}ms`);
      car.style.height = `${heights[i]}px`;
      carsLayer.appendChild(car);
      carEls.push(car);
    }
  }

  function updateHeights(vals) {
    const heights = mapValuesToHeights(vals);
    carEls.forEach((el, i) => {
      el.style.height = `${heights[i]}px`;
      const label = el.querySelector('.value');
      if (label) label.textContent = String(vals[i]);
    });
  }

  // highlight helpers
  function setCompare(i, j, on) {
    if (carEls[i]) carEls[i].classList.toggle('car--compare', on);
    if (carEls[j]) carEls[j].classList.toggle('car--compare', on);
    if (on) playBeep(660, 60, 'square', 0.02);
  }
  function pulseSwap(i, j) {
    if (carEls[i]) carEls[i].classList.add('car--swap');
    if (carEls[j]) carEls[j].classList.add('car--swap');
    setTimeout(() => {
      if (carEls[i]) carEls[i].classList.remove('car--swap');
      if (carEls[j]) carEls[j].classList.remove('car--swap');
    }, 260);
    playBeep(420, 80, 'sawtooth', 0.03);
  }

  function markSorted() {
    carEls.forEach(el => el.classList.add('car--sorted'));
  }

  function unmarkState() {
    carEls.forEach(el => {
      el.classList.remove('car--sorted');
      el.classList.remove('car--compare');
      el.classList.remove('car--swap');
    });
  }

  // swapping visual by swapping nodes and array
  function swap(i, j) {
    if (i === j) return;
    const a = carEls[i];
    const b = carEls[j];
    if (!a || !b) return;

    // swap in DOM: insert a before b, then b before a's old position. Use placeholder technique.
    const aNext = a.nextSibling;
    const bNext = b.nextSibling;
    const parent = a.parentNode;
    if (!parent) return;

    if (aNext === b) {
      parent.insertBefore(b, a);
    } else if (bNext === a) {
      parent.insertBefore(a, b);
    } else {
      parent.insertBefore(b, aNext);
      parent.insertBefore(a, bNext);
    }

    // swap references
    const tmpEl = carEls[i];
    carEls[i] = carEls[j];
    carEls[j] = tmpEl;

    const tmpVal = values[i];
    values[i] = values[j];
    values[j] = tmpVal;
  }

  // animated swap helper with FLIP technique for smooth horizontal slide
  async function swapAnimated(i, j) {
    if (i === j) return;
    const a = carEls[i];
    const b = carEls[j];
    if (!a || !b) return;

    pulseSwap(i, j);

    // First: capture initial positions
    const aRect1 = a.getBoundingClientRect();
    const bRect1 = b.getBoundingClientRect();

    // Swap in DOM
    swap(i, j);

    // Last: capture final positions
    const aRect2 = carEls[i].getBoundingClientRect();
    const bRect2 = carEls[j].getBoundingClientRect();

    // Invert: compute delta
    const aDx = aRect1.left - aRect2.left;
    const bDx = bRect1.left - bRect2.left;

    // Apply transform to invert
    carEls[i].style.transform = `translateX(${aDx}px)`;
    carEls[j].style.transform = `translateX(${bDx}px)`;

    // Play: next frame, transition to identity
    await new Promise(requestAnimationFrame);
    const duration = speedToMs[speedSlider.value];
    carEls[i].style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    carEls[j].style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    carEls[i].style.transform = 'translateX(0)';
    carEls[j].style.transform = 'translateX(0)';

    await wait(duration);

    // cleanup
    carEls[i].style.transition = '';
    carEls[j].style.transition = '';
    carEls[i].style.transform = '';
    carEls[j].style.transform = '';
  }

  // ---------- CONFETTI ----------
  const confetti = (() => {
    const ctx = confettiCanvas.getContext('2d');
    let pieces = [];
    let running = false;
    const colors = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ffd6e6', '#9b5de5'];

    function createPiece(w, h) {
      return {
        x: Math.random() * w,
        y: -10,
        size: 6 + Math.random() * 6,
        color: colors[rand(0, colors.length - 1)],
        speedY: 2 + Math.random() * 2,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.2,
      };
    }

    function start() {
      const { width, height } = confettiCanvas.getBoundingClientRect();
      confettiCanvas.width = width * devicePixelRatio;
      confettiCanvas.height = height * devicePixelRatio;
      const w = confettiCanvas.width;
      const h = confettiCanvas.height;
      pieces = Array.from({ length: 120 }, () => createPiece(w, h));
      running = true;
      confettiCanvas.style.opacity = '1';
      loop();
      setTimeout(stop, 2500);
    }

    function stop() {
      running = false;
      confettiCanvas.style.opacity = '0';
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }

    function loop() {
      if (!running) return;
      const w = confettiCanvas.width;
      const h = confettiCanvas.height;
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        p.y += p.speedY * devicePixelRatio;
        p.rot += p.rotSpeed;
        if (p.y > h + 20) {
          p.y = -10;
          p.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      requestAnimationFrame(loop);
    }

    return { start, stop };
  })();

  // ---------- GENERATION / RESET ----------
  function generateValues(n) {
    const vals = [];
    for (let i = 0; i < n; i++) {
      // ensure variety and avoid duplicates clustering by spreading
      vals.push(rand(10, 99));
    }
    return vals;
  }

  function generateCars() {
    isSorted = false;
    isSorting = false;
    const n = parseInt(sizeSlider.value, 10);
    values = generateValues(n);
    renderCars(values);
    setStatus('Cars generated. Choose an algorithm and start the race!');
    btnStart.disabled = false;
  }

  function reset() {
    isSorting = false;
    isSorted = false;
    unmarkState();
    setStatus('Reset. Generate cars to begin.');
    clearCars();
    values = [];
    btnStart.disabled = true;
  }

  // ---------- SORTING HELPERS ----------
  async function compare(i, j) {
    setCompare(i, j, true);
    await wait(speedToMs[speedSlider.value] * 0.4);
    setCompare(i, j, false);
  }

  // Bubble Sort
  async function bubbleSort() {
    const n = values.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        await compare(j, j + 1);
        if (values[j] > values[j + 1]) {
          await swapAnimated(j, j + 1);
        }
      }
    }
  }

  // Selection Sort
  async function selectionSort() {
    const n = values.length;
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) {
        await compare(minIdx, j);
        if (values[j] < values[minIdx]) minIdx = j;
      }
      if (minIdx !== i) {
        await swapAnimated(i, minIdx);
      }
    }
  }

  // Quick Sort
  async function quickSort() {
    async function partition(low, high) {
      // choose pivot as last element
      const pivot = values[high];
      let i = low - 1;
      for (let j = low; j < high; j++) {
        await compare(j, high);
        if (values[j] <= pivot) {
          i++;
          await swapAnimated(i, j);
        }
      }
      await swapAnimated(i + 1, high);
      return i + 1;
    }
    async function qs(low, high) {
      if (low < high) {
        const p = await partition(low, high);
        await qs(low, p - 1);
        await qs(p + 1, high);
      }
    }
    await qs(0, values.length - 1);
  }

  // Merge Sort (stable) with visual moves
  async function mergeSort() {
    async function merge(left, mid, right) {
      const leftArr = values.slice(left, mid + 1);
      const rightArr = values.slice(mid + 1, right + 1);
      let i = 0, j = 0, k = left;

      while (i < leftArr.length && j < rightArr.length) {
        // find actual indices of k and source element in DOM (since swaps changed positions)
        const idxK = k; // target index in visual array
        const valL = leftArr[i];
        const valR = rightArr[j];
        // show comparison between an element at k (target) and candidate from left/right by picking nearest visual
        const visIdxL = values.indexOf(valL, left); // search from left for stability
        const visIdxR = values.indexOf(valR, left);
        if (visIdxL !== -1 && visIdxR !== -1) await compare(visIdxL, visIdxR);

        if (valL <= valR) {
          // move valL into position k if not already
          const currIdx = values.indexOf(valL, left);
          if (currIdx !== idxK) {
            await moveElementToIndex(currIdx, idxK);
          }
          values[idxK] = valL;
          i++; k++;
        } else {
          const currIdx = values.indexOf(valR, left);
          if (currIdx !== idxK) {
            await moveElementToIndex(currIdx, idxK);
          }
          values[idxK] = valR;
          j++; k++;
        }
      }

      while (i < leftArr.length) {
        const valL = leftArr[i++];
        const currIdx = values.indexOf(valL, left);
        const idxK = k++;
        if (currIdx !== idxK) {
          await moveElementToIndex(currIdx, idxK);
        }
        values[idxK] = valL;
      }

      while (j < rightArr.length) {
        const valR = rightArr[j++];
        const currIdx = values.indexOf(valR, left);
        const idxK = k++;
        if (currIdx !== idxK) {
          await moveElementToIndex(currIdx, idxK);
        }
        values[idxK] = valR;
      }
    }

    async function ms(left, right) {
      if (left >= right) return;
      const mid = Math.floor((left + right) / 2);
      await ms(left, mid);
      await ms(mid + 1, right);
      await merge(left, mid, right);
    }

    await ms(0, values.length - 1);
  }

  // Move a car at fromIdx to toIdx visually by performing adjacent swaps
  async function moveElementToIndex(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (fromIdx < toIdx) {
      for (let i = fromIdx; i < toIdx; i++) {
        await swapAnimated(i, i + 1);
      }
    } else {
      for (let i = fromIdx; i > toIdx; i--) {
        await swapAnimated(i, i - 1);
      }
    }
  }

  // ---------- UI WIRING ----------
  function updateSpeedLabel() {
    const map = { '1': 'Slow', '2': 'Medium', '3': 'Fast' };
    speedLabel.textContent = map[speedSlider.value];
    carEls.forEach(el => el.style.setProperty('--anim', `${speedToMs[speedSlider.value]}ms`));
  }

  sizeSlider.addEventListener('input', () => {
    sizeValue.textContent = sizeSlider.value;
  });
  speedSlider.addEventListener('input', () => {
    updateSpeedLabel();
  });

  btnGenerate.addEventListener('click', () => {
    if (isSorting) return;
    generateCars();
  });

  btnReset.addEventListener('click', () => {
    if (isSorting) return;
    reset();
  });

  btnStart.addEventListener('click', async () => {
    if (isSorting || values.length === 0) return;

    // resume audio context on user gesture for mobile browsers
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isSorting = true;
    setStatus('Sorting in progress...');
    disableControls(true);

    const algo = algoSelect.value;
    try {
      switch (algo) {
        case 'bubble': await bubbleSort(); break;
        case 'selection': await selectionSort(); break;
        case 'quick': await quickSort(); break;
        case 'merge': await mergeSort(); break;
        default: await bubbleSort(); break;
      }
      isSorted = true;
      isSorting = false;
      markSorted();
      setStatus('Race Finished! Cars Sorted 🚗✅');
      confetti.start();
      disableControls(false);
      btnStart.disabled = true;
    } catch (err) {
      console.error(err);
      isSorting = false;
      disableControls(false);
      setStatus('An error occurred. Please Reset and try again.');
    }
  });

  // Handle window resize for dynamic heights
  window.addEventListener('resize', () => {
    if (values.length > 0) updateHeights(values);
  });

  // Initialize defaults
  updateSpeedLabel();
  sizeValue.textContent = sizeSlider.value;
  setStatus('Ready. Generate cars to begin.');
  // disable start until cars exist
  btnStart.disabled = true;
})();
