/* 雨声：现场合成，不需要音频文件。iPhone 静音开关打开时不会出声。 */
(function () {
  let ctx = null, master = null, hiss = null, low = null, hissGain = null, lowGain = null, tickTimer = 0;
  let level = 'heavy', volume = 0.7, running = false;
  const LV = { light: { hiss: 0.18, low: 0.08, ticks: 6 }, heavy: { hiss: 0.34, low: 0.2, ticks: 14 }, storm: { hiss: 0.42, low: 0.3, ticks: 20 } };

  function noise(c, secs, pink) {
    const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (pink) { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } else d[i] = w;
    }
    return b;
  }
  function loop(c, buf, filterType, freq, q, gain) {
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(master); s.start();
    return { s, f, g };
  }
  function tick() {
    if (!running) return;
    const c = ctx, t = c.currentTime, n = LV[level].ticks;
    for (let i = 0; i < n / 10; i++) {
      if (Math.random() > 0.7) continue;
      const when = t + Math.random() * 0.1;
      const src = c.createBufferSource(); src.buffer = tickBuf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 4500; f.Q.value = 3 + Math.random() * 4;
      const g = c.createGain(); const a = 0.04 + Math.random() * 0.12;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(a, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04 + Math.random() * 0.05);
      src.connect(f); f.connect(g); g.connect(master); src.start(when); src.stop(when + 0.12);
    }
  }
  let tickBuf = null;

  const Rain = {
    start() {
      if (running) { if (ctx.state !== 'running') ctx.resume(); return; }
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      ctx = new C();
      if (ctx.state !== 'running') ctx.resume();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      const pink = noise(ctx, 4, true);
      tickBuf = noise(ctx, 0.2, false);
      hiss = loop(ctx, pink, 'bandpass', 1800, 0.45, LV[level].hiss);
      low = loop(ctx, pink, 'lowpass', 380, 0.7, LV[level].low);
      master.gain.setTargetAtTime(volume, ctx.currentTime, 1.2);
      running = true;
      tickTimer = setInterval(tick, 100);
    },
    setLevel(l) {
      level = l;
      if (!running) return;
      hiss.g.gain.setTargetAtTime(LV[l].hiss, ctx.currentTime, 0.8);
      low.g.gain.setTargetAtTime(LV[l].low, ctx.currentTime, 0.8);
      hiss.f.frequency.setTargetAtTime(l === 'light' ? 2400 : 1800, ctx.currentTime, 0.8);
    },
    setVolume(v) { volume = v; if (running) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2); },
    thunder() {
      if (!running) return;
      const c = ctx, t = c.currentTime + 0.4 + Math.random() * 1.6, dur = 3 + Math.random() * 3;
      const src = c.createBufferSource(); src.buffer = noise(c, dur, false);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.12); g.gain.exponentialRampToValueAtTime(0.35, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.6, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
    },
    pause() { if (running && ctx.state === 'running') ctx.suspend(); },
    resume() { if (running && ctx.state !== 'running') ctx.resume(); },
    get on() { return running; }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) Rain.pause(); else Rain.resume(); });
  window.Rain = Rain;
})();
