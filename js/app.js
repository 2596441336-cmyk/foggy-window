/* 起雾的窗户 · 界面与窗外来源（随机街景 / 照片 / 实时相机） */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const KEY = 'foggywindow.v1';
  const prefs = Object.assign({ rain: 'heavy', regrow: 'mid', volume: 0.7, brush: 'finger', style: 'random', time: 'random' }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} };
  const STYLES = Scenes.STYLES, TIMES = Scenes.TIMES;
  const BRUSH = { finger: '指尖', palm: '手掌', breath: '哈气' };

  let current = null; // { type:'scene', style, time, seed } | { type:'photo', img } | { type:'video', stream, video }

  /* ---------- 提示 ---------- */
  let tt = 0;
  function toast(t, ms) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), ms || 2600); }

  /* ---------- 窗外 ---------- */
  function setWhere(text) { $('#whereText').textContent = text; }
  function newScene(style, time, seed) {
    const keys = Object.keys(STYLES), tkeys = Object.keys(TIMES);
    style = style && style !== 'random' ? style : keys[Math.floor(Math.random() * keys.length)];
    time = time && time !== 'random' ? time : (Math.random() < 0.15 ? 'day' : tkeys[Math.floor(Math.random() * 2)]);
    seed = seed || Math.floor(Math.random() * 1e9);
    stopCamera();
    const { W, H } = Glass.size();
    Glass.setScene(Scenes.generate(style, time, W, H, seed));
    current = { type: 'scene', style, time, seed };
    setWhere(STYLES[style] + ' · ' + TIMES[time]);
  }
  function usePhoto(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { stopCamera(); Glass.setImage(img); current = { type: 'photo', img }; setWhere('你的照片'); toast('擦一擦，看看你的照片'); };
    img.onerror = () => toast('这张图片打不开，换一张试试');
    img.src = url;
  }
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('这个浏览器不能打开相机，可以改用「拍照或选照片」', 3600); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      stopCamera();
      const v = document.createElement('video');
      v.setAttribute('playsinline', ''); v.muted = true; v.autoplay = true; v.srcObject = stream;
      await v.play().catch(() => {});
      Glass.setVideo(v);
      current = { type: 'video', stream, video: v };
      setWhere('实时窗外');
      toast('现在玻璃后面就是你眼前的样子');
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) toast('没有相机权限。可以在 iPhone「设置 → Safari → 相机」里改成允许', 4600);
      else toast('相机没能打开，可以改用「拍照或选照片」', 3600);
    }
  }
  function stopCamera() {
    if (current && current.type === 'video') { current.stream.getTracks().forEach((t) => t.stop()); Glass.stopVideo(); current = null; }
  }
  $('#photoInput').addEventListener('change', (e) => { usePhoto(e.target.files[0]); e.target.value = ''; });
  $('#where').addEventListener('click', () => { newScene(prefs.style, prefs.time); });

  /* ---------- 面板 ---------- */
  const wrap = $('#panelWrap'), panel = $('#panel');
  function openPanel(html, mount) {
    panel.innerHTML = html; wrap.hidden = false;
    requestAnimationFrame(() => wrap.classList.add('on'));
    if (mount) mount(panel);
  }
  function closePanel() { wrap.classList.remove('on'); setTimeout(() => { wrap.hidden = true; panel.innerHTML = ''; }, 260); }
  $('#panelBack').addEventListener('click', closePanel);
  function seg(name, opts, val) { return '<div class="seg" data-seg="' + name + '">' + Object.keys(opts).map((k) => '<button type="button" data-v="' + k + '"' + (k === val ? ' class="on"' : '') + '>' + opts[k] + '</button>').join('') + '</div>'; }
  function bindSeg(root, name, fn) {
    const el = $('[data-seg="' + name + '"]', root); if (!el) return;
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach((x) => x.classList.toggle('on', x === b)); fn(b.dataset.v); });
  }

  const panels = {
    view() {
      const camOn = current && current.type === 'video';
      openPanel(
        '<h3>窗外</h3>' +
        '<button type="button" class="btn" id="pRandom">随机换一条街</button>' +
        '<div class="group"><span class="label">街区风格</span><div class="styles">' +
          Object.keys(STYLES).map((k) => '<button type="button" class="style-card' + (current && current.style === k ? ' on' : '') + '" data-style="' + k + '"><canvas width="120" height="160"></canvas><span>' + STYLES[k] + '</span></button>').join('') +
        '</div></div>' +
        '<div class="group"><span class="label">时间</span>' + seg('time', { random: '随机', dusk: '黄昏', night: '深夜', day: '阴天' }, prefs.time) + '</div>' +
        '<div class="row"><button type="button" class="btn ghost" id="pPhoto"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5"/><circle cx="12" cy="12.5" r="3.4"/><path d="M8.5 6l1.5-2.2h4L15.5 6"/></svg>拍照或选照片</button>' +
        '<button type="button" class="btn ghost" id="pCam"><svg viewBox="0 0 24 24"><rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>' + (camOn ? '关掉相机' : '实时窗外') + '</button></div>' +
        '<p class="note">照片和相机画面只在你的手机上处理，不会上传。实时窗外会用后置摄像头，第一次会问你是否允许。</p>',
        (root) => {
          // 小预览图
          $$('.style-card', root).forEach((c) => { const cv = c.querySelector('canvas'); cv.getContext('2d').drawImage(Scenes.generate(c.dataset.style, 'night', 120, 160, 42), 0, 0); });
          $('#pRandom', root).addEventListener('click', () => { prefs.style = 'random'; save(); newScene('random', prefs.time); closePanel(); });
          $$('.style-card', root).forEach((c) => c.addEventListener('click', () => { prefs.style = c.dataset.style; save(); newScene(c.dataset.style, prefs.time); closePanel(); }));
          bindSeg(root, 'time', (v) => { prefs.time = v; save(); if (current && current.type === 'scene') newScene(current.style, v); });
          $('#pPhoto', root).addEventListener('click', () => { closePanel(); $('#photoInput').click(); });
          $('#pCam', root).addEventListener('click', () => { closePanel(); if (camOn) { stopCamera(); newScene(prefs.style, prefs.time); } else startCamera(); });
        }
      );
    },
    brush() {
      openPanel(
        '<h3>笔触</h3>' +
        '<div class="group">' + seg('brush', { finger: '指尖 · 写字画画', palm: '手掌 · 大片擦', breath: '哈气 · 让雾回来' }, prefs.brush) + '</div>' +
        '<button type="button" class="btn ghost" id="pFogAll">整扇窗重新起雾</button>',
        (root) => {
          bindSeg(root, 'brush', (v) => { prefs.brush = v; save(); Glass.state.brush = v; $('#brushLabel').textContent = BRUSH[v]; setTimeout(closePanel, 180); });
          $('#pFogAll', root).addEventListener('click', () => { Glass.fogAll(); closePanel(); });
        }
      );
    },
    rain() {
      openPanel(
        '<h3>雨</h3>' +
        '<div class="group">' + seg('rain', { light: '小雨', heavy: '大雨', storm: '雷雨' }, prefs.rain) + '</div>' +
        '<div class="group"><span class="label">雨声音量</span><input type="range" id="pVol" min="0" max="1" step="0.05" value="' + prefs.volume + '" aria-label="雨声音量"></div>' +
        '<p class="note">没有声音的话，看看 iPhone 侧边的静音开关是不是打开了。</p>',
        (root) => {
          bindSeg(root, 'rain', (v) => { prefs.rain = v; save(); Glass.setRain(v); Rain.setLevel(v); });
          $('#pVol', root).addEventListener('input', (e) => { prefs.volume = Number(e.target.value); save(); Rain.start(); Rain.setVolume(prefs.volume); });
        }
      );
    },
    fog() {
      openPanel(
        '<h3>雾</h3>' +
        '<div class="group"><span class="label">雾气回来的速度</span>' + seg('regrow', { slow: '慢', mid: '中', fast: '快', off: '不回来' }, prefs.regrow) + '</div>' +
        '<button type="button" class="btn ghost" id="pFogAll2">整扇窗重新起雾</button>',
        (root) => {
          bindSeg(root, 'regrow', (v) => { prefs.regrow = v; save(); Glass.state.regrow = v; });
          $('#pFogAll2', root).addEventListener('click', () => { Glass.fogAll(); closePanel(); });
        }
      );
    }
  };
  $$('.bar [data-panel]').forEach((b) => b.addEventListener('click', () => panels[b.dataset.panel]()));

  /* ---------- 存图 ---------- */
  $('#saveBtn').addEventListener('click', () => {
    const url = Glass.snapshot();
    let file = null;
    try {
      const bin = atob(url.split(',')[1]); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      file = new File([arr], 'foggy-window.jpg', { type: 'image/jpeg' });
    } catch (e) {}
    const showOverlay = () => { $('#saveImg').src = url; $('#saveDl').href = url; $('#save').hidden = false; };
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: '起雾的窗户' }).then(() => toast('已保存')).catch((e) => { if (!e || e.name !== 'AbortError') showOverlay(); });
    } else showOverlay();
  });
  $('#saveClose').addEventListener('click', () => { $('#save').hidden = true; });

  /* ---------- 擦的时候隐藏工具栏 ---------- */
  let hideT = 0;
  Glass.state.onStroke = (phase) => {
    if (phase === 'start') { clearTimeout(hideT); document.body.classList.add('is-wiping'); startSound(); }
    else hideT = setTimeout(() => document.body.classList.remove('is-wiping'), 1300);
  };
  Glass.state.onFlash = () => Rain.thunder();

  /* ---------- 雨声：第一次触摸时开始（浏览器要求） ---------- */
  let soundStarted = false;
  function startSound() {
    if (soundStarted || prefs.volume <= 0) return;
    soundStarted = true;
    Rain.setLevel(prefs.rain); Rain.start(); Rain.setVolume(prefs.volume);
  }
  document.addEventListener('pointerdown', startSound, { capture: true });

  /* ---------- 尺寸变化（旋转屏幕） ---------- */
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      Glass.resize();
      if (!current || current.type === 'scene') newScene(current ? current.style : prefs.style, current ? current.time : prefs.time, current && current.seed);
      else if (current.type === 'photo') Glass.setImage(current.img);
    }, 200);
  });

  /* ---------- 启动 ---------- */
  Glass.state.brush = prefs.brush; Glass.state.rain = prefs.rain; Glass.state.regrow = prefs.regrow;
  $('#brushLabel').textContent = BRUSH[prefs.brush];
  Glass.resize();
  newScene(prefs.style, prefs.time);
  Glass.writeText('用手指擦一擦', 42);
  Glass.start();

  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
