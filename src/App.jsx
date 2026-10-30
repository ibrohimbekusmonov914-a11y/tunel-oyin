import { useEffect, useRef, useState } from "react";
import "./App.css";

const W = 900;
const H = 600;
const STEP = 2;
const N = W / STEP;
const FOV = 0.66;
const KEY = "dark-tunnel-best";
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const getBest = () => {
  try {
    return Number(localStorage.getItem(KEY) || 0);
  } catch {
    return 0;
  }
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeMaze(c, r) {
  const gw = 2 * c + 1;
  const gh = 2 * r + 1;
  const g = Array.from({ length: gh }, () => Array(gw).fill(true));
  const vis = Array.from({ length: r }, () => Array(c).fill(false));
  const stack = [[0, 0]];
  vis[0][0] = true;
  g[1][1] = false;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = DIRS.map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(
      ([x, y]) => x >= 0 && y >= 0 && x < c && y < r && !vis[y][x]
    );
    if (!nb.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = nb[Math.floor(Math.random() * nb.length)];
    vis[ny][nx] = true;
    g[2 * ny + 1][2 * nx + 1] = false;
    g[2 * cy + 1 + dy][2 * cx + 1 + dx] = false;
    stack.push([nx, ny]);
  }
  return { g, gw, gh };
}

// Soya o'yinchiga qarab keyingi katakka qadam tashlaydi (BFS)
function nextStep(g, gw, gh, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [sx, sy];
  const start = sy * gw + sx;
  const prev = new Int16Array(gw * gh).fill(-1);
  const q = [start];
  prev[start] = start;
  let found = false;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    const cx = cur % gw;
    const cy = (cur - cx) / gw;
    if (cx === tx && cy === ty) {
      found = true;
      break;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || g[ny][nx]) continue;
      const id = ny * gw + nx;
      if (prev[id] !== -1) continue;
      prev[id] = cur;
      q.push(id);
    }
  }
  if (!found) return [sx, sy];
  let id = ty * gw + tx;
  while (prev[id] !== start) id = prev[id];
  return [id % gw, Math.floor(id / gw)];
}

export default function App() {
  const ref = useRef(null);
  const [screen, setScreen] = useState("menu");
  const [res, setRes] = useState({ score: 0, level: 1, why: "" });
  const [best, setBest] = useState(getBest);

  useEffect(() => {
    if (screen !== "play") return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const keys = {};
    const touch = { on: false, sx: 0, sy: 0, dx: 0, dy: 0 };

    const p = { x: 1.5, y: 1.5, a: 0, bob: 0 };
    const s = {
      level: 1,
      score: 0,
      left: 60,
      t: 0,
      banner: 120,
      alert: 0,
      ghostWait: 600,
      over: false,
      overT: 0,
      why: "",
      done: false,
    };
    const gst = { x: 0, y: 0, tx: 0, ty: 0, rep: 0 };
    const zbuf = new Float32Array(N);
    let g, mw, mh, visited, ex, ey, hueBase;

    const build = () => {
      const c = Math.min(4 + s.level, 15);
      const m = makeMaze(c, c);
      g = m.g;
      mw = m.gw;
      mh = m.gh;
      visited = new Uint8Array(mw * mh);
      p.x = 1.5;
      p.y = 1.5;
      p.a = !g[1][2] ? 0 : Math.PI / 2;
      ex = mw - 1.5;
      ey = mh - 1.5;
      hueBase = (s.level * 47) % 360;
      s.left = 40 + c * c * 0.8;
      s.banner = 120;
      s.alert = 0;
      s.ghostWait = 600;
      gst.x = mw - 1.5;
      gst.y = 1.5;
      gst.tx = gst.x;
      gst.ty = gst.y;
      gst.rep = 0;
    };
    build();

    const R = 0.2;
    const wall = (x, y) => {
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      return gx < 0 || gy < 0 || gx >= mw || gy >= mh || g[gy][gx];
    };
    const free = (x, y) =>
      !(wall(x - R, y - R) || wall(x + R, y - R) || wall(x - R, y + R) || wall(x + R, y + R));

    const finish = (why) => {
      s.over = true;
      s.overT = 60;
      s.why = why;
      try {
        const b = Number(localStorage.getItem(KEY) || 0);
        if (s.score > b) localStorage.setItem(KEY, String(s.score));
      } catch {
        /* ignore */
      }
    };

    const update = (dt) => {
      s.t += dt;
      s.banner = Math.max(0, s.banner - dt);
      s.alert = Math.max(0, s.alert - dt);

      if (s.over) {
        s.overT -= dt;
        if (s.overT <= 0 && !s.done) {
          s.done = true;
          setRes({ score: s.score, level: s.level, why: s.why });
          setBest((pr) => Math.max(pr, s.score));
          setScreen("over");
        }
        return;
      }

      // boshqaruv
      let turn = (keys.arrowright || keys.e ? 1 : 0) - (keys.arrowleft || keys.q ? 1 : 0);
      let fwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
      const str = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      if (touch.on) {
        turn += clamp(touch.dx / 60, -1, 1) * 1.2;
        fwd += clamp(-touch.dy / 50, -1, 1);
      }
      p.a += turn * 0.045 * dt;
      const dx = Math.cos(p.a);
      const dy = Math.sin(p.a);
      let mx = dx * fwd - dy * str;
      let my = dy * fwd + dx * str;
      const ml = Math.hypot(mx, my);
      if (ml > 1) {
        mx /= ml;
        my /= ml;
      }
      const sp = 0.05 * dt;
      const nx = p.x + mx * sp;
      const ny = p.y + my * sp;
      if (free(nx, p.y)) p.x = nx;
      if (free(p.x, ny)) p.y = ny;
      if (ml > 0.05) p.bob += 0.2 * dt;

      // kashf qilingan joylar
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      for (let yy = cy - 1; yy <= cy + 1; yy++) {
        for (let xx = cx - 1; xx <= cx + 1; xx++) {
          if (xx >= 0 && yy >= 0 && xx < mw && yy < mh) visited[yy * mw + xx] = 1;
        }
      }

      // soya
      if (s.ghostWait > 0) {
        s.ghostWait -= dt;
        if (s.ghostWait <= 0) s.alert = 150;
      } else {
        gst.rep -= dt;
        if (gst.rep <= 0) {
          gst.rep = 12;
          const [qx, qy] = nextStep(g, mw, mh, Math.floor(gst.x), Math.floor(gst.y), cx, cy);
          gst.tx = qx + 0.5;
          gst.ty = qy + 0.5;
        }
        const ddx = gst.tx - gst.x;
        const ddy = gst.ty - gst.y;
        const d = Math.hypot(ddx, ddy);
        const gs = (0.012 + 0.003 * Math.min(s.level, 8)) * dt;
        if (d > 1e-4) {
          const k = Math.min(1, gs / d);
          gst.x += ddx * k;
          gst.y += ddy * k;
        }
        if (Math.hypot(p.x - gst.x, p.y - gst.y) < 0.5) {
          finish("Soya sizni tutib oldi!");
          return;
        }
      }

      // vaqt
      s.left -= dt / 60;
      if (s.left <= 0) {
        s.left = 0;
        finish("Vaqt tugadi!");
        return;
      }

      // chiqish
      if (Math.hypot(p.x - ex, p.y - ey) < 0.5) {
        s.score += 100 * s.level + Math.round(s.left * 5);
        s.level++;
        try {
          if (navigator.vibrate) navigator.vibrate(120);
        } catch {
          /* ignore */
        }
        build();
      }
    };

    // ===== YORUG'LIK =====
    const lightAt = (dist, camX, flick) => {
      const cone = Math.pow(clamp(1 - Math.abs(camX) / 0.55, 0, 1), 1.3);
      const l =
        0.025 +
        0.95 * cone * Math.exp(-dist * 0.55) * flick +
        clamp(1 - dist / 1.5, 0, 1) * 0.18;
      return Math.min(1, l);
    };

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.65);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.9)");

    const strips = (scrX, cy, r, tall, color, alpha, ty) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      const x0 = Math.floor((scrX - r) / STEP) * STEP;
      const x1 = scrX + r;
      for (let x = x0; x < x1; x += STEP) {
        if (x < 0 || x >= W) continue;
        const col = x / STEP;
        if (ty >= zbuf[col]) continue;
        const u = (x + STEP / 2 - scrX) / r;
        if (Math.abs(u) >= 1) continue;
        const h = r * Math.sqrt(1 - u * u) * tall;
        ctx.fillRect(x, cy - h, STEP, 2 * h);
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      const flick = 0.94 + Math.random() * 0.06;
      const dx = Math.cos(p.a);
      const dy = Math.sin(p.a);
      const plx = -dy * FOV;
      const ply = dx * FOV;
      const bob = Math.sin(p.bob) * 4;
      const horizon = H / 2 + bob;

      ctx.save();
      ctx.fillStyle = "#020106";
      ctx.fillRect(0, 0, W, H);

      // yerdagi nur dog'i
      ctx.globalCompositeOperation = "lighter";
      const fg = ctx.createRadialGradient(W / 2, horizon + H * 0.26, 10, W / 2, horizon + H * 0.26, 260);
      fg.addColorStop(0, "rgba(120,105,70,0.10)");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.globalCompositeOperation = "source-over";

      // devorlar
      for (let i = 0; i < N; i++) {
        const camX = (2 * i) / N - 1;
        const rdx = dx + plx * camX;
        const rdy = dy + ply * camX;
        let mapX = Math.floor(p.x);
        let mapY = Math.floor(p.y);
        const ddx = Math.abs(1 / (rdx || 1e-9));
        const ddy = Math.abs(1 / (rdy || 1e-9));
        let stepX, stepY, sdx, sdy;
        if (rdx < 0) {
          stepX = -1;
          sdx = (p.x - mapX) * ddx;
        } else {
          stepX = 1;
          sdx = (mapX + 1 - p.x) * ddx;
        }
        if (rdy < 0) {
          stepY = -1;
          sdy = (p.y - mapY) * ddy;
        } else {
          stepY = 1;
          sdy = (mapY + 1 - p.y) * ddy;
        }
        let side = 0;
        let hit = false;
        for (let k = 0; k < 80; k++) {
          if (sdx < sdy) {
            sdx += ddx;
            mapX += stepX;
            side = 0;
          } else {
            sdy += ddy;
            mapY += stepY;
            side = 1;
          }
          if (mapX < 0 || mapY < 0 || mapX >= mw || mapY >= mh) {
            hit = true;
            break;
          }
          if (g[mapY][mapX]) {
            hit = true;
            break;
          }
        }
        let perp = side === 0 ? sdx - ddx : sdy - ddy;
        if (!hit || perp < 0.05) perp = 0.05;
        zbuf[i] = perp;

        const light = lightAt(perp, camX, flick);
        const l = 52 * light * (side ? 0.78 : 1);
        if (l < 0.6) continue;
        const lineH = Math.min(H * 4, H / perp);
        const top = horizon - lineH / 2;
        const hue = (hueBase + mapX * 17 + mapY * 29) % 360;
        const x = i * STEP;
        ctx.fillStyle = `hsl(${hue},100%,${l.toFixed(1)}%)`;
        ctx.fillRect(x, top, STEP, lineH);
        if (light > 0.12) {
          ctx.fillStyle = `hsl(${hue},100%,${Math.min(88, l * 1.8).toFixed(1)}%)`;
          const t = Math.max(2, 4 / perp);
          ctx.fillRect(x, top, STEP, t);
          ctx.fillRect(x, top + lineH - t, STEP, t);
        }
      }

      // sprite'lar: chiqish va soya
      const list = [{ x: ex, y: ey, type: "exit" }];
      if (s.ghostWait <= 0) list.push({ x: gst.x, y: gst.y, type: "ghost" });
      list.sort(
        (a, b) =>
          Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y)
      );
      const inv = 1 / (plx * dy - dx * ply);
      for (const sp of list) {
        const sx = sp.x - p.x;
        const sy = sp.y - p.y;
        const tx = inv * (dy * sx - dx * sy);
        const ty = inv * (-ply * sx + plx * sy);
        if (ty < 0.15) continue;
        const scrX = (W / 2) * (1 + tx / ty);
        const camX = scrX / (W / 2) - 1;
        const light = lightAt(ty, camX, flick);
        if (sp.type === "exit") {
          const size = Math.abs(H / ty) * 0.22;
          const cy = horizon + Math.abs(H / ty) * 0.12;
          const pulse = 0.85 + Math.sin(s.t * 0.12) * 0.15;
          const a = Math.min(1, (0.22 + light) * pulse);
          strips(scrX, cy, size * 1.5, 1, "#00ff6a", a * 0.25, ty);
          strips(scrX, cy, size, 1, "#00ff6a", a * 0.8, ty);
          strips(scrX, cy, size * 0.45, 1, "#eafff1", a, ty);
        } else {
          const size = Math.abs(H / ty) * 0.34;
          const a = Math.min(1, light * 1.4 + (ty < 1.3 ? 0.4 : 0));
          if (a < 0.03) continue;
          strips(scrX, horizon, size, 1.5, "#2a0010", a, ty);
          strips(scrX, horizon, size * 0.8, 1.4, "#7a0030", a * 0.7, ty);
          const col = clamp(Math.floor(scrX / STEP), 0, N - 1);
          if (ty < zbuf[col]) {
            ctx.globalAlpha = a;
            ctx.fillStyle = "#ffffff";
            const ew = Math.max(2, size * 0.16);
            ctx.fillRect(scrX - size * 0.35, horizon - size * 0.35, ew, ew * 1.4);
            ctx.fillRect(scrX + size * 0.35 - ew, horizon - size * 0.35, ew, ew * 1.4);
            ctx.globalAlpha = 1;
          }
        }
      }

      // vinyetka (qorong'u chetlar)
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // xavf: soya yaqinlashganda qizil
      if (s.ghostWait <= 0 && !s.over) {
        const dg = Math.hypot(p.x - gst.x, p.y - gst.y);
        const danger = clamp(1 - dg / 4, 0, 1);
        if (danger > 0) {
          const beat = 0.6 + Math.abs(Math.sin(s.t * (0.08 + danger * 0.15))) * 0.4;
          ctx.fillStyle = `rgba(255,0,40,${danger * 0.28 * beat})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
      ctx.restore();

      // mini xarita (faqat kashf qilingan joylar)
      ctx.save();
      const sc = clamp(Math.floor(150 / Math.max(mw, mh)), 3, 8);
      const ox = W - 14 - mw * sc;
      const oy = 14;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(ox - 4, oy - 4, mw * sc + 8, mh * sc + 8);
      for (let yy = 0; yy < mh; yy++) {
        for (let xx = 0; xx < mw; xx++) {
          if (!visited[yy * mw + xx]) continue;
          ctx.fillStyle = g[yy][xx] ? "#4a3a8a" : "#15122e";
          ctx.fillRect(ox + xx * sc, oy + yy * sc, sc, sc);
        }
      }
      if (visited[Math.floor(ey) * mw + Math.floor(ex)]) {
        ctx.fillStyle = "#00ff6a";
        ctx.fillRect(ox + Math.floor(ex) * sc, oy + Math.floor(ey) * sc, sc, sc);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffe600";
      ctx.beginPath();
      ctx.arc(ox + p.x * sc, oy + p.y * sc, Math.max(2, sc * 0.45), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffe600";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox + p.x * sc, oy + p.y * sc);
      ctx.lineTo(ox + (p.x + Math.cos(p.a) * 1.4) * sc, oy + (p.y + Math.sin(p.a) * 1.4) * sc);
      ctx.stroke();
      ctx.restore();

      // HUD
      ctx.save();
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillText(`BALL ${s.score}`, 16, 28);
      ctx.fillStyle = "#00d0ff";
      ctx.fillText(`LEVEL ${s.level}`, 16, 54);
      ctx.fillStyle = s.left < 15 ? "#ff2d55" : "#ffe600";
      ctx.fillText(`VAQT ${Math.ceil(s.left)}`, 16, 80);
      ctx.textAlign = "center";
      if (s.banner > 0 && !s.over) {
        ctx.globalAlpha = Math.min(1, s.banner / 40);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 54px 'Courier New', monospace";
        ctx.fillText(`LEVEL ${s.level}`, W / 2, H / 2 - 120);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText("Yashil nurni toping. Soya 10 soniyada uyg'onadi...", W / 2, H / 2 - 90);
        ctx.globalAlpha = 1;
      }
      if (s.alert > 0 && !s.over) {
        ctx.globalAlpha = Math.min(1, s.alert / 40);
        ctx.fillStyle = "#ff2d55";
        ctx.font = "bold 40px 'Courier New', monospace";
        ctx.fillText("SOYA UYG'ONDI!", W / 2, H / 2 - 120);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    // ===== KIRITISH =====
    const kd = (e) => {
      const k = e.key.toLowerCase();
      if (k.startsWith("arrow") || k === " ") e.preventDefault();
      keys[k] = true;
    };
    const ku = (e) => {
      keys[e.key.toLowerCase()] = false;
    };
    const mm = (e) => {
      if (document.pointerLockElement === canvas) p.a += e.movementX * 0.0025;
    };
    const cl = () => {
      try {
        const r = canvas.requestPointerLock && canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch {
        /* ignore */
      }
    };
    const ts = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      touch.on = true;
      touch.sx = t.clientX;
      touch.sy = t.clientY;
      touch.dx = 0;
      touch.dy = 0;
    };
    const tm = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      touch.dx = t.clientX - touch.sx;
      touch.dy = t.clientY - touch.sy;
    };
    const te = () => {
      touch.on = false;
      touch.dx = 0;
      touch.dy = 0;
    };
    const blur = () => {
      for (const k in keys) keys[k] = false;
    };

    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    document.addEventListener("mousemove", mm);
    canvas.addEventListener("click", cl);
    canvas.addEventListener("touchstart", ts, { passive: false });
    canvas.addEventListener("touchmove", tm, { passive: false });
    canvas.addEventListener("touchend", te);
    canvas.addEventListener("touchcancel", te);

    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 16.667;
      last = now;
      if (!(dt >= 0)) dt = 0;
      if (dt > 2.5) dt = 2.5;
      update(dt);
      draw();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
      document.removeEventListener("mousemove", mm);
      canvas.removeEventListener("click", cl);
      canvas.removeEventListener("touchstart", ts);
      canvas.removeEventListener("touchmove", tm);
      canvas.removeEventListener("touchend", te);
      canvas.removeEventListener("touchcancel", te);
      try {
        if (document.pointerLockElement) document.exitPointerLock();
      } catch {
        /* ignore */
      }
    };
  }, [screen]);

  const start = () => setScreen("play");

  return (
    <div className="app">
      <h1 className="title">DARK TUNNEL</h1>
      <div className="stage">
        <canvas
          ref={ref}
          width={W}
          height={H}
          className={`canvas ${screen === "play" ? "playing" : ""}`}
        />
        {screen === "menu" && (
          <div className="overlay">
            <p className="sub">Qorong'u labirintdan chiqish yo'lini toping</p>
            <div className="help">
              <span>⌨️ W/S – oldinga/orqaga, A/D – yon, ← → yoki Q/E – burilish</span>
              <span>🖱️ Ekranni bosing, sichqoncha bilan atrofga qarang</span>
              <span>📱 Telefon: barmoq bilan suring (yuqoriga – yurish, yon – burilish)</span>
              <span>🟢 Yashil nurga yeting, 👻 soyadan qoching</span>
            </div>
            <p className="best">Rekord: {best}</p>
            <button className="btn" onClick={start}>BOSHLASH</button>
          </div>
        )}
        {screen === "over" && (
          <div className="overlay">
            <h2 className="over">{res.why || "O'YIN TUGADI"}</h2>
            <p className="big">Ball: {res.score}</p>
            <p className="sub">Level: {res.level}</p>
            <p className="best">Rekord: {best}</p>
            <button className="btn" onClick={start}>QAYTA O'YNASH</button>
          </div>
        )}
      </div>
    </div>
  );
}