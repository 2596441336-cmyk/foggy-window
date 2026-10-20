/* 随机街景生成器：用简单的透视投影现场画一条街。
   风格：tokyo 东京小巷 / shanghai 上海弄堂 / europe 欧洲石板街 / seaside 海边小镇 / newyork 纽约街角 / country 乡间小路
   时间：dusk 黄昏 / night 深夜 / day 阴天白天 */
(function () {
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
  const rgba = (h, a) => { const c = hex(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  const SKY = {
    dusk: { top: '#252a52', mid: '#8d4f6f', low: '#f09a5a', shade: '#2c2238', amb: 0.55, lights: 1, ground: '#3a3240', wet: '#c98a6a' },
    night: { top: '#050913', mid: '#101a33', low: '#26304f', shade: '#0b0f1c', amb: 0.78, lights: 1.15, ground: '#14161f', wet: '#3a4560' },
    day: { top: '#8e99a4', mid: '#b2bac1', low: '#cfd4d7', shade: '#5b636b', amb: 0.25, lights: 0.25, ground: '#4d5257', wet: '#aab3ba' }
  };

  function generate(style, time, W, H, seed) {
    const rand = rng(seed || (Math.random() * 1e9));
    const R = (a, b) => a + rand() * (b - a);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const pal = SKY[time] || SKY.night;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const vp = { x: W * (style === 'seaside' ? 0.3 : 0.5 + R(-0.05, 0.05)), y: H * (style === 'seaside' ? 0.5 : style === 'country' ? 0.5 : 0.47) };
    const f = W * 0.85, camH = 1.6;
    const P = (X, Y, z) => [vp.x + X / z * f, vp.y + (camH - Y) / z * f];
    const lights = []; // {x,y,gy,r,color,a}
    const lit = pal.lights;
    const dark = (col) => mix(col, pal.shade, pal.amb); // 按时间压暗颜色
    const s = W / 390; // 尺寸比例

    function quad(a, b, cc, d, fill) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fillStyle = fill; g.fill(); }
    function addLight(X, Y, z, r, color, a) { const p = P(X, Y, z); const gp = P(X, 0, z); lights.push({ x: p[0], y: p[1], gy: gp[1], r: r / z * f, color, a: a == null ? 1 : a }); }

    /* ---- 天空 ---- */
    let sg = g.createLinearGradient(0, 0, 0, vp.y);
    sg.addColorStop(0, pal.top); sg.addColorStop(0.6, pal.mid); sg.addColorStop(1, pal.low);
    g.fillStyle = sg; g.fillRect(0, 0, W, vp.y + 2);
    if (time === 'night' && (style === 'country' || style === 'seaside' || rand() < 0.4)) {
      for (let i = 0; i < 160 * s; i++) { g.fillStyle = 'rgba(255,250,235,' + R(0.2, 0.8) + ')'; g.fillRect(R(0, W), R(0, vp.y * 0.85), R(0.6, 1.6) * s, R(0.6, 1.6) * s); }
      const mx = R(W * 0.15, W * 0.85), my = R(vp.y * 0.12, vp.y * 0.4);
      const mg = g.createRadialGradient(mx, my, 0, mx, my, 70 * s); mg.addColorStop(0, 'rgba(255,245,215,.35)'); mg.addColorStop(1, 'rgba(255,245,215,0)');
      g.fillStyle = mg; g.fillRect(0, 0, W, vp.y); g.fillStyle = '#f6efd9'; g.beginPath(); g.arc(mx, my, 13 * s, 0, 6.283); g.fill();
    }
    if (time === 'dusk') {
      const sx = R(W * 0.3, W * 0.7); const sgl = g.createRadialGradient(sx, vp.y, 0, sx, vp.y, W * 0.7);
      sgl.addColorStop(0, 'rgba(255,190,110,.55)'); sgl.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = sgl; g.fillRect(0, 0, W, vp.y + 4);
    }
    // 云层（阴天更明显）
    for (let i = 0; i < (time === 'day' ? 14 : 7); i++) {
      const cx = R(-50, W + 50), cy = R(0, vp.y * 0.7), r = R(60, 160) * s;
      const cg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      const cc = time === 'day' ? '214,219,223' : time === 'dusk' ? '120,80,110' : '40,48,72';
      cg.addColorStop(0, 'rgba(' + cc + ',' + (time === 'day' ? 0.45 : 0.35) + ')'); cg.addColorStop(1, 'rgba(' + cc + ',0)');
      g.fillStyle = cg; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    /* ---- 远景天际线 / 山 ---- */
    function skyline(hMin, hMax, color, density, windows) {
      let x = -20;
      while (x < W + 20) {
        const w = R(14, 46) * s * density, h = R(hMin, hMax) * s;
        g.fillStyle = color; g.fillRect(x, vp.y - h, w + 1, h + 2);
        if (windows && time !== 'day') for (let yy = vp.y - h + 5 * s; yy < vp.y - 3; yy += 5 * s) for (let xx = x + 3 * s; xx < x + w - 3 * s; xx += 5 * s) if (rand() < 0.22 * lit) { g.fillStyle = 'rgba(255,' + Math.round(R(190, 235)) + ',150,' + R(0.4, 0.9) + ')'; g.fillRect(xx, yy, 1.6 * s, 2 * s); }
        x += w;
      }
    }
    function mountains(layers) {
      for (let l = 0; l < layers; l++) {
        g.beginPath(); g.moveTo(0, vp.y + 2);
        let y = vp.y - R(30, 70) * s * (1 - l * 0.3);
        for (let x = 0; x <= W + 20; x += 20 * s) { y += R(-9, 9) * s; y = Math.min(vp.y - 8 * s, Math.max(vp.y - 120 * s * (1 - l * 0.3), y)); g.lineTo(x, y); }
        g.lineTo(W, vp.y + 2); g.closePath();
        g.fillStyle = mix(pal.low, pal.shade, 0.35 + l * 0.22); g.fill();
      }
    }
    if (style === 'country') mountains(3);
    else if (style === 'newyork') skyline(80, 220, mix('#2a3040', pal.low, 0.15), 1.1, true);
    else if (style !== 'seaside') skyline(14, 60, mix(pal.low, pal.shade, 0.55), 1, true);

    /* ---- 地面与湿路面 ---- */
    const roadHalf = { tokyo: 2.6, shanghai: 2.4, europe: 3.4, newyork: 6, seaside: 3, country: 2.2 }[style];
    const roadL = style === 'seaside' ? -3.4 : -roadHalf, roadR = style === 'seaside' ? 0.4 : roadHalf;
    const wallX = { tokyo: 3.4, shanghai: 3.3, europe: 5, newyork: 9, seaside: 5.5, country: 99 }[style];
    const gg = g.createLinearGradient(0, vp.y, 0, H);
    const groundCol = style === 'country' ? (time === 'day' ? '#5d6b4c' : mix('#3d4a33', pal.shade, pal.amb)) : pal.ground;
    gg.addColorStop(0, mix(groundCol, pal.low, 0.35)); gg.addColorStop(1, groundCol);
    g.fillStyle = gg; g.fillRect(0, vp.y, W, H - vp.y);
    // 路面（带天空倒影的湿亮感）
    const roadCol = style === 'country' ? mix('#6b5c48', pal.shade, pal.amb) : style === 'europe' ? mix('#5a5049', pal.shade, pal.amb * 0.8) : mix('#3a3d44', pal.shade, pal.amb * 0.7);
    const zNear = 0.6, zFar = 400;
    quad(P(roadL, 0, zNear), P(roadR, 0, zNear), P(roadR, 0, zFar), P(roadL, 0, zFar), roadCol);
    const wg = g.createLinearGradient(0, vp.y, 0, H);
    wg.addColorStop(0, rgba(pal.wet.length === 7 ? pal.wet : '#888888', 0.55)); wg.addColorStop(0.35, rgba(pal.wet, 0.12)); wg.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.beginPath(); const r1 = P(roadL, 0, zNear), r2 = P(roadR, 0, zNear), r3 = P(roadR, 0, zFar), r4 = P(roadL, 0, zFar);
    g.moveTo(r1[0], r1[1]); g.lineTo(r2[0], r2[1]); g.lineTo(r3[0], r3[1]); g.lineTo(r4[0], r4[1]); g.closePath(); g.clip();
    g.fillStyle = wg; g.fillRect(0, vp.y, W, H - vp.y);
    // 石板路 / 斑马线 / 路面标线
    if (style === 'europe' || style === 'shanghai') {
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
      for (let z = 1; z < 40; z *= 1.08) { const a = P(-roadHalf, 0, z), b = P(roadHalf, 0, z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      for (let X = -roadHalf; X <= roadHalf; X += 0.45) { const a = P(X, 0, 1), b = P(X, 0, 40); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    }
    if (style === 'newyork') {
      for (let X = -roadHalf + 0.4; X < roadHalf; X += 1.1) quad(P(X, 0, 2.4), P(X + 0.55, 0, 2.4), P(X + 0.55, 0, 3.4), P(X, 0, 3.4), 'rgba(235,235,230,.55)');
      for (let z = 5; z < 80; z += 4) quad(P(-0.08, 0, z), P(0.08, 0, z), P(0.08, 0, z + 2), P(-0.08, 0, z + 2), 'rgba(230,190,70,.6)');
    }
    if (style === 'tokyo') for (let z = 2; z < 60; z += 3) quad(P(-0.05, 0, z), P(0.05, 0, z), P(0.05, 0, z + 1.4), P(-0.05, 0, z + 1.4), 'rgba(230,230,230,.35)');
    g.restore();

    /* ---- 建筑立面 ---- */
    const facadeCols = {
      tokyo: ['#3b3a44', '#4a4038', '#2e3540', '#55504a', '#463a3a'],
      shanghai: ['#6f6a64', '#5e5852', '#7a6a5c', '#655f5a'],
      europe: ['#c9a46a', '#c27c5a', '#e0cfa8', '#9fae9a', '#d39a7b', '#b98f78'],
      newyork: ['#4a4038', '#5b4e44', '#3d4250', '#6a5a4a', '#33363f'],
      seaside: ['#e6dfd0', '#a9c4d0', '#e8c8a8', '#c7d6c0', '#f0e2c8']
    }[style];
    function facadeRow(side) {
      if (!facadeCols) return;
      const X = side * wallX;
      let z = 1.0;
      while (z < 70) {
        const len = style === 'newyork' ? R(4, 8) : R(3, 6.5);
        const h = style === 'newyork' ? R(35, 80) : style === 'europe' ? R(9, 14) : style === 'shanghai' ? R(7, 9.5) : style === 'seaside' ? R(5, 8) : R(7, 14);
        const z1 = z, z2 = z + len;
        const col = dark(pick(facadeCols));
        quad(P(X, 0, z1), P(X, h, z1), P(X, h, z2), P(X, 0, z2), col);
        // 屋檐线
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = Math.max(1, 2 / z1 * s);
        const e1 = P(X, h, z1), e2 = P(X, h, z2); g.beginPath(); g.moveTo(e1[0], e1[1]); g.lineTo(e2[0], e2[1]); g.stroke();
        // 窗户
        const floorH = style === 'newyork' ? 3.2 : 3;
        const startY = style === 'europe' || style === 'tokyo' || style === 'newyork' ? 4 : 2.2;
        for (let y = startY; y < h - 1; y += floorH) {
          for (let wz = z1 + 0.7; wz < z2 - 0.6; wz += style === 'newyork' ? 1.6 : 2.2) {
            const wy = 1.4, ww = style === 'newyork' ? 0.9 : 1.1;
            const on = rand() < (time === 'day' ? 0.15 : 0.5) * Math.min(1.1, lit);
            const wc = on ? (time === 'day' ? 'rgba(255,230,180,.55)' : 'rgba(255,' + Math.round(R(185, 230)) + ',' + Math.round(R(110, 170)) + ',' + R(0.75, 0.95) + ')') : 'rgba(10,14,22,.55)';
            quad(P(X, y, wz), P(X, y + wy, wz), P(X, y + wy, wz + ww), P(X, y, wz + ww), wc);
            if (on && time !== 'day' && rand() < 0.35) { addLight(X, y + wy / 2, wz + ww / 2, 0.9, '#ffc98a', 0.25); lights[lights.length - 1].noRef = true; }
            if (style === 'europe' && rand() < 0.4) quad(P(X - side * 0.25, y - 0.05, wz), P(X, y - 0.05, wz), P(X, y - 0.05, wz + ww), P(X - side * 0.25, y - 0.05, wz + ww), dark('#a8433a'));
          }
        }
        // 底层店面 / 石库门
        if (style === 'europe' || style === 'tokyo' || style === 'newyork') {
          const a = z1 + 0.4, b = z2 - 0.4;
          const on = time !== 'day' || rand() < 0.5;
          const sc = style === 'tokyo' ? pick(['#ffe7b0', '#bfe8ff', '#ffd0a0']) : '#ffd79a';
          quad(P(X, 0.2, a), P(X, 2.6, a), P(X, 2.6, b), P(X, 0.2, b), on ? rgba(sc, time === 'day' ? 0.55 : 0.88) : dark('#2a2a30'));
          if (on) { addLight(X - side * 0.2, 1.4, (a + b) / 2, 2.2, sc, 0.55); }
          if (style === 'europe' && rand() < 0.75) { // 条纹遮阳棚
            const stripes = 8; const ac = pick(['#7a2f2f', '#2f5a7a', '#3e6b45', '#8a6a2a']);
            for (let i = 0; i < stripes; i++) { const za = a + (b - a) * i / stripes, zb = a + (b - a) * (i + 1) / stripes; quad(P(X, 3.1, za), P(X - side * 1.1, 2.6, za), P(X - side * 1.1, 2.6, zb), P(X, 3.1, zb), dark(i % 2 ? '#efe6d6' : ac)); }
          }
        }
        if (style === 'shanghai' && rand() < 0.7) { // 石库门
          const m = (z1 + z2) / 2;
          quad(P(X, 0, m - 0.8), P(X, 3.2, m - 0.8), P(X, 3.2, m + 0.8), P(X, 0, m + 0.8), dark('#b8ad98'));
          quad(P(X, 0, m - 0.55), P(X, 2.7, m - 0.55), P(X, 2.7, m + 0.55), P(X, 0, m + 0.55), dark('#3a2418'));
          const t1 = P(X, 3.2, m - 0.9), t2 = P(X, 3.9, m), t3 = P(X, 3.2, m + 0.9);
          g.beginPath(); g.moveTo(t1[0], t1[1]); g.lineTo(t2[0], t2[1]); g.lineTo(t3[0], t3[1]); g.closePath(); g.fillStyle = dark('#c2b69e'); g.fill();
          if (time !== 'day' || rand() < 0.3) addLight(X - side * 0.15, 3.0, m, 0.7, '#ffcf7a', 0.9);
        }
        z = z2 + (rand() < 0.25 ? R(0.3, 1.2) : 0);
      }
    }
    // 先画远处一侧再画另一侧都可以，立面互不遮挡
    facadeRow(-1); if (style !== 'seaside') facadeRow(1);

    /* ---- 风格细节 ---- */
    if (style === 'seaside') {
      // 右侧是海：覆盖右边立面
      g.save();
      const zb = camH * f / (H - vp.y), xb = vp.x + (roadR + 0.4) / zb * f;
      const sea = [[xb, H + 5], [W + 5, H + 5], [W + 5, vp.y], P(roadR + 0.4, 0, 400)];
      g.beginPath(); sea.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      const sgr = g.createLinearGradient(0, vp.y, 0, H);
      sgr.addColorStop(0, mix(pal.low, '#2a4a62', 0.4)); sgr.addColorStop(1, mix('#1c3346', pal.shade, pal.amb * 0.6));
      g.fillStyle = sgr; g.fill(); g.clip();
      for (let i = 0; i < 60; i++) { const y = vp.y + Math.pow(rand(), 2) * (H - vp.y); g.fillStyle = 'rgba(255,255,255,' + R(0.03, 0.12) + ')'; g.fillRect(R(0, W), y, R(10, 60) * s * (y - vp.y) / (H - vp.y) + 4, 1.2 * s); }
      g.restore();
      // 灯塔
      const lx = W * R(0.72, 0.88), ly = vp.y;
      g.fillStyle = dark('#2c3138'); g.beginPath(); g.ellipse(lx, ly + 2, 40 * s, 10 * s, 0, Math.PI, 0); g.fill();
      g.fillStyle = dark('#e8e2d6'); g.beginPath(); g.moveTo(lx - 6 * s, ly - 4 * s); g.lineTo(lx - 4 * s, ly - 46 * s); g.lineTo(lx + 4 * s, ly - 46 * s); g.lineTo(lx + 6 * s, ly - 4 * s); g.fill();
      g.fillStyle = dark('#b0393a'); g.fillRect(lx - 5 * s, ly - 26 * s, 10 * s, 6 * s);
      if (time !== 'day') {
        lights.push({ x: lx, y: ly - 49 * s, gy: ly + 4, r: 22 * s, color: '#fff3c4', a: 1 });
        g.save(); g.globalCompositeOperation = 'lighter';
        const dir = rand() < 0.5 ? -1 : 1; const bg = g.createLinearGradient(lx, 0, lx + dir * W * 0.6, 0);
        bg.addColorStop(0, 'rgba(255,240,190,.35)'); bg.addColorStop(1, 'rgba(255,240,190,0)');
        g.fillStyle = bg; g.beginPath(); g.moveTo(lx, ly - 49 * s); g.lineTo(lx + dir * W * 0.6, ly - 80 * s); g.lineTo(lx + dir * W * 0.6, ly - 20 * s); g.closePath(); g.fill(); g.restore();
      }
      // 船灯
      for (let i = 0; i < 4; i++) if (time !== 'day') lights.push({ x: R(W * 0.55, W), y: vp.y + R(2, 14) * s, gy: vp.y + 18 * s, r: 4 * s, color: pick(['#ffd28a', '#ff6a5a', '#9fe0ff']), a: 0.9 });
      // 栏杆
      for (let z = 1; z < 40; z += 1.6) { const a = P(roadR + 0.4, 0, z), b = P(roadR + 0.4, 1.1, z); g.strokeStyle = dark('#d9d4c8'); g.lineWidth = Math.max(1, 3 / z * s); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      const ra = P(roadR + 0.4, 1.1, 1), rb = P(roadR + 0.4, 1.1, 60); g.lineWidth = 2 * s; g.beginPath(); g.moveTo(ra[0], ra[1]); g.lineTo(rb[0], rb[1]); g.stroke();
    }

    if (style === 'country') {
      // 树
      for (let i = 0; i < 18; i++) {
        const side = rand() < 0.5 ? -1 : 1, X = side * R(roadHalf + 1.5, 9), z = R(2, 45), th = R(4, 8);
        const base = P(X, 0, z), top = P(X, th, z), cr = R(1.6, 2.8) / z * f;
        g.strokeStyle = dark('#3a2a1e'); g.lineWidth = Math.max(1, 0.35 / z * f); g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(top[0], top[1] + cr * 0.5); g.stroke();
        const tc = dark(pick(['#2f4a2c', '#3b5532', '#28402a']));
        for (let k = 0; k < 5; k++) { g.fillStyle = tc; g.beginPath(); g.arc(top[0] + R(-0.6, 0.6) * cr, top[1] + R(-0.5, 0.4) * cr, cr * R(0.55, 0.85), 0, 6.283); g.fill(); }
      }
      // 小屋
      const cx = R(5, 9) * (rand() < 0.5 ? -1 : 1), cz = R(9, 16);
      const w = 2.4, h = 2.6;
      quad(P(cx - w, 0, cz), P(cx - w, h, cz), P(cx + w, h, cz), P(cx + w, 0, cz), dark('#7a5a40'));
      const r1p = P(cx - w - 0.3, h, cz), r2p = P(cx, h + 1.8, cz), r3p = P(cx + w + 0.3, h, cz);
      g.fillStyle = dark('#4a2e26'); g.beginPath(); g.moveTo(r1p[0], r1p[1]); g.lineTo(r2p[0], r2p[1]); g.lineTo(r3p[0], r3p[1]); g.fill();
      quad(P(cx - 1.4, 1, cz - 0.01), P(cx - 1.4, 1.9, cz - 0.01), P(cx - 0.4, 1.9, cz - 0.01), P(cx - 0.4, 1, cz - 0.01), time === 'day' ? 'rgba(255,220,160,.6)' : '#ffcf80');
      addLight(cx - 0.9, 1.45, cz, 1.6, '#ffc670', 0.8);
      if (time === 'night') for (let i = 0; i < 26; i++) lights.push({ x: R(0, W), y: R(vp.y - 20 * s, H * 0.85), gy: 0, r: R(2, 5) * s, color: '#e8ff9a', a: R(0.4, 0.9), noRef: true });
    }

    if (style === 'tokyo') {
      // 电线
      g.strokeStyle = 'rgba(10,10,14,.55)'; g.lineWidth = 1.2 * s;
      for (let i = 0; i < 4; i++) { const a = P(-wallX, R(9, 12), R(2, 6)), b = P(wallX, R(9, 12), R(3, 10)); g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, Math.max(a[1], b[1]) + R(10, 30) * s, b[0], b[1]); g.stroke(); }
      // 竖排霓虹招牌
      const words = ['ラーメン', '居酒屋', 'カラオケ', '喫茶', '焼鳥', '寿司', '薬', 'BAR', '酒場', '本屋'];
      for (let i = 0; i < 9; i++) {
        const side = rand() < 0.5 ? -1 : 1, z = R(1.8, 22), X = side * (wallX - 0.6), y0 = R(3.2, 6.5), hh = R(2, 3.4);
        const p0 = P(X, y0 + hh, z), p1 = P(X, y0, z); const wpx = 0.55 / z * f;
        const col = pick(['#ff4fa0', '#44e0ff', '#ff5a4a', '#ffc24a', '#9b7bff', '#5affa8']);
        g.fillStyle = dark('#15161c'); g.fillRect(p0[0] - wpx / 2, p0[1], wpx, p1[1] - p0[1]);
        g.strokeStyle = time === 'day' ? rgba(col, 0.6) : col; g.lineWidth = Math.max(1, 0.06 / z * f); g.strokeRect(p0[0] - wpx / 2, p0[1], wpx, p1[1] - p0[1]);
        const word = pick(words); const fs = Math.min(wpx * 0.72, (p1[1] - p0[1]) / (word.length + 0.6));
        g.fillStyle = time === 'day' ? rgba(col, 0.8) : '#fff'; g.font = '700 ' + fs + 'px "Hiragino Sans", "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let k = 0; k < word.length; k++) g.fillText(word[k], p0[0], p0[1] + (k + 0.8) * fs * 1.05);
        if (time !== 'day') lights.push({ x: p0[0], y: (p0[1] + p1[1]) / 2, gy: P(X, 0, z)[1], r: (p1[1] - p0[1]) * 0.7, color: col, a: 0.75 });
      }
      // 红灯笼
      for (let i = 0; i < 4; i++) { const side = rand() < 0.5 ? -1 : 1, z = R(2, 12), p = P(side * (wallX - 0.3), 2.8, z), rr = 0.32 / z * f; g.fillStyle = '#e8402e'; g.beginPath(); g.ellipse(p[0], p[1], rr * 0.8, rr, 0, 0, 6.283); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(p[0] - rr * 0.8, p[1] - rr * 0.1, rr * 1.6, rr * 0.18); lights.push({ x: p[0], y: p[1], gy: P(0, 0, z)[1], r: rr * 2.6, color: '#ff6a40', a: 0.8 }); }
      // 自动售货机
      { const side = rand() < 0.5 ? -1 : 1, z = R(2.2, 5); quad(P(side * (wallX - 0.05), 0, z), P(side * (wallX - 0.05), 1.8, z), P(side * (wallX - 0.05), 1.8, z + 1.1), P(side * (wallX - 0.05), 0, z + 1.1), '#eaf6ff'); addLight(side * (wallX - 0.4), 1, z + 0.5, 2.4, '#d8f0ff', 0.9); }
    }

    if (style === 'shanghai') {
      // 晾衣竿与衣服
      for (let i = 0; i < 5; i++) {
        const z = R(2.5, 18), y = R(4, 5.6), a = P(-wallX, y, z), b = P(wallX, y + R(-0.4, 0.4), z + R(-0.5, 0.5));
        g.strokeStyle = 'rgba(30,25,20,.7)'; g.lineWidth = Math.max(1, 0.05 / z * f); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        const n = Math.floor(R(2, 6));
        for (let k = 0; k < n; k++) { const t = R(0.1, 0.9), x = a[0] + (b[0] - a[0]) * t, yy = a[1] + (b[1] - a[1]) * t, cw = R(0.4, 0.8) / z * f, ch = R(0.6, 1.1) / z * f; g.fillStyle = dark(pick(['#c94a4a', '#e8e0cc', '#4a6a9a', '#d8a84a', '#6a8a6a', '#e6a0b0'])); g.fillRect(x - cw / 2, yy, cw, ch); }
      }
    }

    if (style === 'newyork') {
      // 红绿灯
      const z = R(6, 9), side = rand() < 0.5 ? -1 : 1;
      const pb = P(side * (roadHalf + 0.5), 0, z), pt = P(side * (roadHalf + 0.5), 6, z), arm = P(side * 0.5, 6, z);
      g.strokeStyle = dark('#1b1d22'); g.lineWidth = Math.max(1.5, 0.15 / z * f); g.beginPath(); g.moveTo(pb[0], pb[1]); g.lineTo(pt[0], pt[1]); g.lineTo(arm[0], arm[1]); g.stroke();
      const box = P(side * 1.2, 5.4, z), bw = 0.35 / z * f, bh = 1 / z * f;
      g.fillStyle = '#16181c'; g.fillRect(box[0] - bw / 2, box[1] - bh / 2, bw, bh);
      const red = rand() < 0.5; const lc = red ? '#ff3b30' : '#3bff7a';
      g.fillStyle = lc; g.beginPath(); g.arc(box[0], box[1] + (red ? -bh * 0.3 : bh * 0.3), bw * 0.32, 0, 6.283); g.fill();
      lights.push({ x: box[0], y: box[1] + (red ? -bh * 0.3 : bh * 0.3), gy: P(0, 0, z)[1], r: bw * 1.6, color: lc, a: 1 });
      // 黄色出租车（尾灯）
      for (let i = 0; i < 2; i++) {
        const tz = R(3, 7) + i * 4, tx = R(-roadHalf + 1.5, roadHalf - 1.5);
        const tl = P(tx - 0.9, 1.4, tz), br = P(tx + 0.9, 0.2, tz);
        g.fillStyle = dark(i ? '#2a2d34' : '#e8b820'); g.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
        const roof = P(tx - 0.6, 1.9, tz + 0.4), roofb = P(tx + 0.6, 1.4, tz + 0.4); g.fillRect(roof[0], roof[1], roofb[0] - roof[0], roofb[1] - roof[1]);
        g.fillStyle = 'rgba(20,24,30,.8)'; g.fillRect(roof[0] + 2, roof[1] + 2, roofb[0] - roof[0] - 4, (roofb[1] - roof[1]) * 0.7);
        [-0.7, 0.7].forEach((dx) => { const lp = P(tx + dx, 0.9, tz - 0.01); g.fillStyle = '#ff3a2a'; g.fillRect(lp[0] - 0.12 / tz * f, lp[1] - 0.06 / tz * f, 0.24 / tz * f, 0.12 / tz * f); lights.push({ x: lp[0], y: lp[1], gy: P(tx, 0, tz)[1], r: 0.7 / tz * f, color: '#ff3a2a', a: 0.95 }); });
      }
      // 井盖蒸汽
      { const z2 = R(4, 7), p = P(R(-2, 2), 0, z2); for (let k = 0; k < 9; k++) { const rr = R(0.4, 1.4) / z2 * f; const sgr = g.createRadialGradient(p[0], p[1] - k * rr * 0.5, 0, p[0], p[1] - k * rr * 0.5, rr); sgr.addColorStop(0, 'rgba(230,230,235,' + (0.25 - k * 0.02) + ')'); sgr.addColorStop(1, 'rgba(230,230,235,0)'); g.fillStyle = sgr; g.fillRect(p[0] - rr, p[1] - k * rr * 0.5 - rr, rr * 2, rr * 2); } }
    }

    /* ---- 路灯 ---- */
    const lampStyle = { tokyo: 'pole', shanghai: 'wall', europe: 'lantern', newyork: 'cobra', seaside: 'lantern', country: 'pole' }[style];
    const lampCol = { tokyo: '#fff1d6', shanghai: '#ffc56a', europe: '#ffc670', newyork: '#ffb45a', seaside: '#ffd28a', country: '#ffd08a' }[style];
    const lampOn = time !== 'day' || rand() < 0.2;
    const lampEvery = style === 'country' ? 30 : style === 'newyork' ? 9 : 7;
    if (lampStyle !== 'wall') {
      for (let z = R(2, 4); z < 90; z += lampEvery * R(0.85, 1.15)) {
        [-1, 1].forEach((side) => {
          if (style === 'seaside' && side === 1) return;
          if (style === 'country' && (side === 1 || z > 40)) return;
          if (style === 'tokyo' && rand() < 0.5) return;
          const X = side < 0 ? roadL - 0.6 : roadR + 0.6, hh = lampStyle === 'cobra' ? 7 : lampStyle === 'lantern' ? 4 : 5.5;
          const b = P(X, 0, z), t = P(X, hh, z);
          g.strokeStyle = dark('#15161a'); g.lineWidth = Math.max(1, 0.14 / z * f); g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(t[0], t[1]);
          let hx = X, hy = hh;
          if (lampStyle === 'cobra') { hx = X - side * 1.6; const a = P(hx, hh, z); g.lineTo(a[0], a[1]); }
          g.stroke();
          const hp = P(hx, hy - 0.15, z);
          if (lampStyle === 'lantern') { const lw = 0.35 / z * f; g.fillStyle = dark('#1a1a1a'); g.fillRect(hp[0] - lw / 2, hp[1] - lw * 1.3, lw, lw * 1.4); g.fillStyle = lampOn ? lampCol : dark('#8a8a80'); g.fillRect(hp[0] - lw * 0.32, hp[1] - lw * 1.05, lw * 0.64, lw * 0.95); }
          if (lampOn) addLight(hx, hy - 0.2, z, 2.6, lampCol, 1);
        });
      }
    }

    /* ---- 撑伞的行人 ---- */
    const people = style === 'country' ? 1 : Math.floor(R(1, 4));
    for (let i = 0; i < people; i++) {
      const z = R(3, 14), X = R(roadL - 0.6, roadR + (style === 'seaside' ? 0 : 0.6));
      const foot = P(X, 0, z), head = P(X, 1.65, z), u = 0.55 / z * f;
      g.fillStyle = dark('#18181c');
      g.fillRect(foot[0] - u * 0.28, head[1], u * 0.56, foot[1] - head[1]);
      const uc = dark(pick(['#2b2b30', '#c2413a', '#3a5f8f', '#e0c060', '#e8e6e0', '#2f6a5a']));
      g.fillStyle = uc; g.beginPath(); g.ellipse(head[0], head[1] - u * 0.2, u * 1.25, u * 0.75, 0, Math.PI, 0); g.fill();
      g.strokeStyle = dark('#18181c'); g.lineWidth = Math.max(1, u * 0.06); g.beginPath(); g.moveTo(head[0], head[1] - u * 0.9); g.lineTo(head[0], head[1] + u * 0.6); g.stroke();
    }

    /* ---- 灯光倒影与光晕 ---- */
    g.save(); g.globalCompositeOperation = 'lighter';
    lights.forEach((L) => {
      if (L.noRef || !L.gy || L.gy <= L.y) return;
      const len = Math.min((L.gy - L.y) * 1.5 + 16 * s, H * 0.4), w = Math.min(Math.max(2.5 * s, L.r * 0.22), 13 * s);
      const rg = g.createLinearGradient(0, L.gy, 0, L.gy + len);
      rg.addColorStop(0, rgba(L.color, 0.34 * L.a * lit)); rg.addColorStop(1, rgba(L.color, 0));
      g.fillStyle = rg;
      g.beginPath(); g.ellipse(L.x, L.gy + len / 2, w, len / 2, 0, 0, 6.283); g.fill();
    });
    lights.forEach((L) => {
      const r = Math.min(Math.max(4 * s, L.r), 80 * s);
      const lg = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      lg.addColorStop(0, rgba(L.color, 0.95 * L.a)); lg.addColorStop(0.18, rgba(L.color, 0.5 * L.a)); lg.addColorStop(1, rgba(L.color, 0));
      g.fillStyle = lg; g.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    });
    g.restore();

    // 整体雨天的灰蒙感
    const haze = g.createLinearGradient(0, 0, 0, H);
    haze.addColorStop(0, 'rgba(120,135,150,0)'); haze.addColorStop(0.45, time === 'day' ? 'rgba(200,205,210,.25)' : 'rgba(120,135,160,.10)'); haze.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = haze; g.fillRect(0, 0, W, H);
    return c;
  }

  const STYLES = { tokyo: '雨夜东京小巷', shanghai: '老上海弄堂', europe: '欧洲石板街', seaside: '海边小镇', newyork: '纽约街角', country: '乡间小路' };
  const TIMES = { dusk: '黄昏', night: '深夜', day: '阴天' };
  window.Scenes = { generate, STYLES, TIMES };
})();
