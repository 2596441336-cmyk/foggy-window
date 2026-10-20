/* 玻璃：窗外画面（清晰 + 模糊两份）、雾气遮罩、雨珠、水痕与闪电。
   遮罩 mask 里不透明的地方 = 雾被擦掉、能看清窗外。 */
(function () {
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let W = 0, H = 0, dpr = 1;
  const view = document.getElementById('glass');
  const vctx = view.getContext('2d');
  const mk = () => document.createElement('canvas');
  const sharp = mk(), blur = mk(), small1 = mk(), small2 = mk(), mask = mk(), clear = mk(), fogTex = mk(), dropsCv = mk(), vignette = mk();
  const sctx = sharp.getContext('2d'), bctx = blur.getContext('2d'), mctx = mask.getContext('2d'), cctx = clear.getContext('2d'), dctx = dropsCv.getContext('2d');

  const state = {
    source: null,          // { type: 'scene'|'photo'|'video', ... }
    brush: 'finger',       // finger 指尖 | palm 手掌 | breath 哈气
    rain: 'heavy',         // light | heavy | storm
    regrow: 'mid',         // slow | mid | fast | off
    dark: true,
    onFlash: null,
    onStroke: null
  };
  const REGROW = { slow: 0.012, mid: 0.026, fast: 0.055, off: 0 };
  const RAIN = { light: { drops: 140, slide: 0.18, back: 50 }, heavy: { drops: 300, slide: 0.55, back: 110 }, storm: { drops: 380, slide: 0.95, back: 170 } };

  let droplets = [], sliders = [], backRain = [];
  let dropsDirty = true, lastDropsDraw = 0, lastFade = 0, lastHit = 0;
  let flash = 0, nextFlash = 0;
  let video = null;

  /* ---------- 尺寸 ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.round(window.innerWidth * dpr); H = Math.round(window.innerHeight * dpr);
    [view, sharp, blur, mask, clear, fogTex, dropsCv, vignette].forEach((c) => { c.width = W; c.height = H; });
    view.style.width = window.innerWidth + 'px'; view.style.height = window.innerHeight + 'px';
    small1.width = Math.max(8, Math.round(W / 7)); small1.height = Math.max(8, Math.round(H / 7));
    small2.width = Math.max(4, Math.round(W / 20)); small2.height = Math.max(4, Math.round(H / 20));
    mctx.clearRect(0, 0, W, H);
    buildVignette();
    droplets = []; sliders = [];
    seedBackRain();
    for (let i = 0; i < RAIN[state.rain].drops * 0.8; i++) addDroplet();
  }

  /* ---------- 窗外画面 ---------- */
  function drawCover(ctx, src, sw, sh) {
    const k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  function rebuildBlur(src) {
    const s1 = small1.getContext('2d'), s2 = small2.getContext('2d');
    s1.imageSmoothingQuality = 'high'; s2.imageSmoothingQuality = 'high'; bctx.imageSmoothingQuality = 'high';
    s1.drawImage(src || sharp, 0, 0, small1.width, small1.height);
    s2.drawImage(small1, 0, 0, small2.width, small2.height);
    bctx.globalAlpha = 1; bctx.drawImage(small2, 0, 0, W, H);
    bctx.globalAlpha = 0.45; bctx.drawImage(small1, 0, 0, W, H); bctx.globalAlpha = 1;
  }
  function measureDark() {
    try {
      const d = small2.getContext('2d').getImageData(0, 0, small2.width, small2.height).data;
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      return sum / (d.length / 4) < 110;
    } catch (e) { return true; }
  }
  function setScene(canvas) {
    stopVideo();
    sctx.drawImage(canvas, 0, 0, W, H);
    rebuildBlur(); state.dark = measureDark(); buildFog(); dropsDirty = true;
  }
  function setImage(img) {
    stopVideo();
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, W, H);
    drawCover(sctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    rebuildBlur(); state.dark = measureDark(); buildFog(); dropsDirty = true;
  }
  function setVideo(v) {
    video = v;
    state.dark = true; buildFog();
  }
  function stopVideo() { video = null; }
  let lastMeasure = 0;
  function updateVideo() {
    if (!video || video.readyState < 2) return;
    drawCover(sctx, video, video.videoWidth, video.videoHeight);
    rebuildBlur();
    const now = performance.now();
    if (now - lastMeasure > 2500) { lastMeasure = now; const d = measureDark(); if (d !== state.dark) { state.dark = d; buildFog(); } }
  }

  /* ---------- 雾 ---------- */
  function buildFog() {
    const g = fogTex.getContext('2d');
    g.clearRect(0, 0, W, H);
    const base = state.dark ? [196, 204, 214] : [226, 230, 234];
    const a0 = state.dark ? 0.36 : 0.5, a1 = state.dark ? 0.5 : 0.62;
    const lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, 'rgba(' + base + ',' + a0 + ')'); lg.addColorStop(1, 'rgba(' + base + ',' + a1 + ')');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // 不均匀的雾团
    for (let i = 0; i < 40; i++) {
      const x = rnd(0, W), y = rnd(0, H), r = rnd(80, 260) * dpr;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      const a = rnd(0.03, 0.09);
      rg.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(150,160,175,' + a + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 细小的凝结水点
    for (let i = 0; i < W * H / (600 * dpr * dpr); i++) {
      g.fillStyle = 'rgba(255,255,255,' + rnd(0.05, 0.22) + ')';
      const r = rnd(0.4, 1.3) * dpr;
      g.beginPath(); g.arc(rnd(0, W), rnd(0, H), r, 0, TAU); g.fill();
    }
  }
  function buildVignette() {
    const g = vignette.getContext('2d');
    g.clearRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // 窗框内沿的阴影
    const e = 10 * dpr;
    [['l', 0, 0, e, H], ['r', W - e, 0, e, H], ['t', 0, 0, W, e], ['b', 0, H - e, W, e]].forEach(([k, x, y, w, h]) => {
      const gr = k === 'l' ? g.createLinearGradient(0, 0, e, 0) : k === 'r' ? g.createLinearGradient(W, 0, W - e, 0) : k === 't' ? g.createLinearGradient(0, 0, 0, e) : g.createLinearGradient(0, H, 0, H - e);
      gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    });
  }

  /* ---------- 擦雾 / 哈气 ---------- */
  const brushCache = {};
  function brush(r, hard) {
    const key = Math.round(r) + (hard ? 'h' : 's');
    if (brushCache[key]) return brushCache[key];
    const c = mk(); c.width = c.height = Math.ceil(r * 2);
    const g = c.getContext('2d'); const rg = g.createRadialGradient(r, r, 0, r, r, r);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(hard ? 0.62 : 0.35, 'rgba(255,255,255,' + (hard ? 0.95 : 0.7) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, c.width, c.height);
    brushCache[key] = c; return c;
  }
  function brushSize() { return (state.brush === 'palm' ? 46 : state.brush === 'breath' ? 70 : 15) * dpr; }
  function stamp(x, y, r, mode) {
    const b = brush(r, mode === 'finger');
    if (mode === 'breath') {
      mctx.globalCompositeOperation = 'destination-out'; mctx.globalAlpha = 0.18;
      mctx.drawImage(b, x - r, y - r); mctx.globalAlpha = 1; mctx.globalCompositeOperation = 'source-over';
    } else {
      mctx.globalCompositeOperation = 'source-over'; mctx.globalAlpha = 1; mctx.drawImage(b, x - r, y - r);
    }
  }
  function strokeLine(x0, y0, x1, y1, r, mode) {
    const d = Math.hypot(x1 - x0, y1 - y0), step = Math.max(1, r * 0.3);
    for (let t = 0; t <= d; t += step) { const k = d ? t / d : 0; stamp(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r, mode); }
    if (mode !== 'breath') wipeDroplets(x0, y0, x1, y1, r * 0.8);
  }
  // 擦过的地方，外侧雨珠不受影响；但哈气会让附近重新生出小水点
  function wipeDroplets() { /* 雨珠在窗外，擦不掉 */ }

  /* ---------- 触摸 ---------- */
  const pointers = new Map();
  view.addEventListener('pointerdown', (e) => {
    view.setPointerCapture && view.setPointerCapture(e.pointerId);
    const x = e.clientX * dpr, y = e.clientY * dpr;
    pointers.set(e.pointerId, { x, y, len: 0, pts: [[x, y]] });
    stamp(x, y, brushSize(), state.brush);
    state.onStroke && state.onStroke('start');
  });
  view.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    evs.forEach((ev) => {
      const x = ev.clientX * dpr, y = ev.clientY * dpr;
      strokeLine(p.x, p.y, x, y, brushSize(), state.brush);
      p.len += Math.hypot(x - p.x, y - p.y); p.x = x; p.y = y;
      if (p.pts.length < 400) p.pts.push([x, y]);
    });
  });
  function endPointer(e) {
    const p = pointers.get(e.pointerId); if (!p) return;
    pointers.delete(e.pointerId);
    // 擦过的地方会聚出几滴水，慢慢往下流
    if (state.brush !== 'breath' && p.len > 80 * dpr) {
      const n = p.len > 500 * dpr ? 3 : p.len > 220 * dpr ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const pt = p.pts[Math.floor(Math.random() * p.pts.length)];
        sliders.push(makeSlider(pt[0] + rnd(-6, 6) * dpr, pt[1] + brushSize() * 0.5, rnd(1.6, 2.6) * dpr, true));
      }
    }
    if (!pointers.size) state.onStroke && state.onStroke('end');
  }
  view.addEventListener('pointerup', endPointer);
  view.addEventListener('pointercancel', endPointer);

  function writeText(text, size) {
    mctx.save();
    mctx.globalCompositeOperation = 'source-over';
    mctx.font = '600 ' + size * dpr + 'px "Kaiti SC", "STKaiti", "PingFang SC", serif';
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    mctx.shadowColor = '#fff'; mctx.shadowBlur = 6 * dpr;
    mctx.fillStyle = '#fff';
    mctx.fillText(text, W / 2, H * 0.42);
    mctx.restore();
  }
  function fogAll() { mctx.clearRect(0, 0, W, H); }

  /* ---------- 雨珠 ---------- */
  function addDroplet() {
    const r = Math.random() < 0.82 ? rnd(0.8, 2.6) * dpr : rnd(2.6, 5.5) * dpr;
    droplets.push({ x: rnd(0, W), y: rnd(0, H), r });
  }
  function makeSlider(x, y, r, slow) {
    return { x, y, r, vy: 0, pause: rnd(0.1, 0.6), slow: !!slow, wob: rnd(0, TAU), lx: x, ly: y, life: 0 };
  }
  function drawDrop(ctx, x, y, r) {
    if (r < 1.7 * dpr) {
      ctx.fillStyle = 'rgba(235,240,245,.32)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); return;
    }
    // 折射：雨珠里是上下颠倒、缩小的窗外画面
    const k = 5, sw = r * k * 2;
    let sx = x - r * k, sy = y - r * k;
    sx = Math.max(0, Math.min(W - sw, sx)); sy = Math.max(0, Math.min(H - sw, sy));
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.translate(x, y); ctx.scale(1, -1);
    try { ctx.drawImage(sharp, sx, sy, sw, sw, -r, -r, r * 2, r * 2); } catch (e) {}
    ctx.restore();
    const sh = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.6, 'rgba(255,255,255,.06)'); sh.addColorStop(1, 'rgba(255,255,255,.22)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.arc(x, y + r * 0.06, r * 0.92, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.24, r * 0.14, -0.6, 0, TAU); ctx.fill();
  }
  function redrawDroplets() {
    dctx.clearRect(0, 0, W, H);
    for (const d of droplets) drawDrop(dctx, d.x, d.y, d.r);
    dropsDirty = false;
  }

  /* ---------- 窗外的雨丝 ---------- */
  function seedBackRain() {
    backRain = [];
    const n = RAIN[state.rain].back;
    for (let i = 0; i < n; i++) backRain.push({ x: rnd(0, W), y: rnd(-H, H), l: rnd(14, 34) * dpr, v: rnd(900, 1400) * dpr, a: rnd(0.08, 0.22) });
  }
  function drawBackRain(ctx, dt, move) {
    ctx.strokeStyle = state.dark ? 'rgba(210,225,240,1)' : 'rgba(255,255,255,1)';
    ctx.lineWidth = Math.max(1, 0.9 * dpr); ctx.lineCap = 'round';
    for (const p of backRain) {
      if (move) { p.y += p.v * dt; p.x += p.v * dt * 0.08; if (p.y > H + 40) { p.y = rnd(-120, -20); p.x = rnd(-20, W); } }
      ctx.globalAlpha = p.a; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * 0.08, p.y - p.l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 主循环 ---------- */
  let last = 0, raf = 0;
  function frame(t) {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
    const cfg = RAIN[state.rain];
    if (video) updateVideo();

    // 雾慢慢回来
    if (t - lastFade > 200) {
      const rate = REGROW[state.regrow];
      if (rate) { mctx.globalCompositeOperation = 'destination-out'; mctx.fillStyle = 'rgba(0,0,0,' + rate + ')'; mctx.fillRect(0, 0, W, H); mctx.globalCompositeOperation = 'source-over'; }
      lastFade = t;
    }
    // 新雨点打在玻璃上
    if (t - lastHit > 120) {
      const n = state.rain === 'light' ? 1 : state.rain === 'heavy' ? 3 : 5;
      for (let i = 0; i < n; i++) addDroplet();
      while (droplets.length > cfg.drops) droplets.splice(Math.floor(Math.random() * droplets.length * 0.5), 1);
      dropsDirty = true; lastHit = t;
    }
    // 滑落的雨珠
    if (Math.random() < cfg.slide * dt) {
      const big = droplets.filter((d) => d.r > 3 * dpr);
      const src = big.length ? big[Math.floor(Math.random() * big.length)] : null;
      if (src) { droplets.splice(droplets.indexOf(src), 1); sliders.push(makeSlider(src.x, src.y, src.r * 1.15)); dropsDirty = true; }
      else sliders.push(makeSlider(rnd(0, W), rnd(0, H * 0.5), rnd(3.4, 5.5) * dpr));
    }
    for (let i = sliders.length - 1; i >= 0; i--) {
      const s = sliders[i];
      s.life += dt;
      if (s.pause > 0) { s.pause -= dt; continue; }
      const target = (s.slow ? rnd(25, 70) : rnd(110, 320)) * dpr * (s.r / (4 * dpr));
      s.vy += (target - s.vy) * Math.min(1, dt * 4);
      s.wob += dt * rnd(2, 6);
      const nx = s.x + Math.sin(s.wob) * 0.05 * dpr, ny = s.y + s.vy * dt;
      // 水痕：滑过的地方雾被冲开
      mctx.globalCompositeOperation = 'source-over';
      const tr = Math.max(1.2 * dpr, s.r * 0.7);
      const b = brush(tr, false);
      const d = Math.hypot(nx - s.x, ny - s.y);
      mctx.globalAlpha = 0.5;
      for (let k = 0; k <= d; k += tr * 0.5) mctx.drawImage(b, s.x + (nx - s.x) * k / (d || 1) - tr, s.y + (ny - s.y) * k / (d || 1) - tr);
      mctx.globalAlpha = 1;
      // 吞掉路过的小水珠，变大一点
      for (let j = droplets.length - 1; j >= 0; j--) {
        const q = droplets[j];
        if (Math.abs(q.y - ny) < s.r + q.r && Math.abs(q.x - nx) < s.r + q.r) { droplets.splice(j, 1); s.r = Math.min(7 * dpr, Math.sqrt(s.r * s.r + q.r * q.r * 0.5)); dropsDirty = true; }
      }
      // 偶尔停一下，留下一颗小水珠
      if (!s.slow && Math.random() < dt * 0.9) { s.pause = rnd(0.05, 0.5); s.vy *= 0.2; }
      if (Math.random() < dt * 2) { droplets.push({ x: nx + rnd(-1, 1) * dpr, y: ny - s.r * 2, r: rnd(0.8, 1.8) * dpr }); dropsDirty = true; }
      s.x = nx; s.y = ny;
      if (s.slow && s.life > rnd(3, 6)) { droplets.push({ x: s.x, y: s.y, r: s.r }); sliders.splice(i, 1); dropsDirty = true; continue; }
      if (s.y - s.r > H) sliders.splice(i, 1);
    }
    if (dropsDirty && t - lastDropsDraw > 220) { redrawDroplets(); lastDropsDraw = t; }
    else if (video && t - lastDropsDraw > 300) { redrawDroplets(); lastDropsDraw = t; }

    // 合成
    vctx.globalCompositeOperation = 'source-over'; vctx.globalAlpha = 1;
    vctx.drawImage(blur, 0, 0);
    drawBackRain(vctx, dt, true);
    vctx.drawImage(fogTex, 0, 0);
    vctx.globalCompositeOperation = 'screen'; vctx.globalAlpha = 0.45; vctx.drawImage(dropsCv, 0, 0); vctx.globalAlpha = 1; vctx.globalCompositeOperation = 'source-over';

    cctx.globalCompositeOperation = 'copy'; cctx.drawImage(sharp, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
    drawBackRain(cctx, 0, false);
    cctx.drawImage(dropsCv, 0, 0);
    cctx.globalCompositeOperation = 'destination-in'; cctx.drawImage(mask, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
    vctx.drawImage(clear, 0, 0);

    for (const s of sliders) drawDrop(vctx, s.x, s.y, s.r);
    vctx.drawImage(vignette, 0, 0);

    // 雷雨闪电
    if (state.rain === 'storm') {
      if (!nextFlash) nextFlash = t + rnd(6000, 14000);
      if (t > nextFlash) { flash = 1; nextFlash = t + rnd(9000, 25000); state.onFlash && state.onFlash(); }
    }
    if (flash > 0.01) {
      vctx.globalCompositeOperation = 'lighter';
      vctx.fillStyle = 'rgba(200,215,255,' + (flash * 0.5) + ')'; vctx.fillRect(0, 0, W, H);
      vctx.globalCompositeOperation = 'source-over';
      flash *= flash > 0.7 ? 0.82 : (Math.random() < 0.06 ? 1.6 : 0.9);
      if (flash > 1) flash = 0.9;
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else start(); });

  function snapshot() { return view.toDataURL('image/jpeg', 0.92); }

  window.Glass = {
    state, resize, start, setScene, setImage, setVideo, stopVideo, writeText, fogAll, snapshot,
    size: () => ({ W, H, dpr }),
    setRain(level) { state.rain = level; seedBackRain(); nextFlash = 0; },
    isVideo: () => !!video
  };
})();
