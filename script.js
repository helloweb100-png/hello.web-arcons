/* ==========================================================================
   GRUPO ARCONS · interacciones y animaciones
   JavaScript puro (sin dependencias salvo Lenis para el scroll suave).

   Arquitectura:
   - Un único bucle requestAnimationFrame maestro. Cada módulo registra una
     tarea que lee la posición de scroll una sola vez por cuadro.
   - Los efectos ligados al scroll usan amortiguación (damp) para dar la
     sensación de movimiento lento y suave. Se escribe solo transform,
     opacity, clip-path y variables CSS.
   - Sin listeners de "scroll": se lee window.scrollY dentro del bucle.
   - prefers-reduced-motion desactiva loops, parallax y escenas fijadas.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIGURACIÓN DEL NEGOCIO
     ------------------------------------------------------------------ */
  const WA_NUMBER = '524423232920'; // +52 442 323 2920
  const WA_MESSAGES = {
    default: 'Hola Grupo Arcons, me gustaría recibir información sobre el servicio de recolección de residuos.',
    nav: 'Hola Grupo Arcons, me gustaría hablar con un asesor sobre la recolección de residuos.',
    hero: 'Hola Grupo Arcons, quiero información para programar una ruta de recolección de residuos.',
    expand: 'Hola Grupo Arcons, estoy listo para empezar con el servicio de recolección. ¿Cómo lo hacemos?',
    servicios: 'Hola Grupo Arcons, quiero cotizar el servicio de recolección para mi empresa o negocio.',
    proceso: 'Hola Grupo Arcons, quiero agendar mi primera recolección.',
    materiales: 'Hola Grupo Arcons, quiero contarles qué residuos genero para que me orienten.',
    final: 'Hola Grupo Arcons, quiero reciclar con ustedes. ¿Cómo empezamos en mi zona?',
    fab: 'Hola Grupo Arcons, tengo una duda sobre el servicio de recolección.'
  };

  /* ------------------------------------------------------------------
     UTILIDADES
     ------------------------------------------------------------------ */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const map = (v, a, b) => clamp((v - a) / (b - a));
  const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced) root.classList.add('reduced');

  /** Estado global de scroll/viewport, actualizado en el bucle maestro */
  const S = { y: 0, vel: 0, dir: 1, vw: window.innerWidth, vh: window.innerHeight };

  // Sonda de altura de viewport estable (svh): evita saltos por la barra del navegador móvil
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;pointer-events:none;visibility:hidden';
  document.body.appendChild(probe);
  const readViewport = () => {
    S.vw = window.innerWidth;
    S.vh = probe.offsetHeight || window.innerHeight;
  };
  readViewport();

  /* ------------------------------------------------------------------
     BUCLE MAESTRO Y MEDICIÓN
     ------------------------------------------------------------------ */
  const tasks = [];
  const trackers = [];
  let lenis = null;
  let lastT = performance.now();

  /** Registra un elemento y cachea su posición absoluta en el documento */
  function track(el) {
    const o = {
      el, top: 0, h: 0,
      measure() {
        const r = el.getBoundingClientRect();
        o.top = r.top + (window.scrollY || 0);
        o.h = r.height;
      },
      /** Progreso 0..1 de una escena fijada (sticky) */
      pin() { return clamp((S.y - o.top) / Math.max(1, o.h - S.vh)); },
      visible(pad = 0) { return S.y + S.vh + pad > o.top && S.y - pad < o.top + o.h; }
    };
    trackers.push(o);
    return o;
  }
  const measureAll = () => trackers.forEach((t) => t.measure());

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000) || 0.016;
    lastT = now;
    if (lenis) lenis.raf(now);
    const y = window.scrollY || 0;
    S.vel = (y - S.y) / dt;
    if (Math.abs(y - S.y) > 0.1) S.dir = y > S.y ? 1 : -1;
    S.y = y;
    for (let i = 0; i < tasks.length; i++) tasks[i](dt, S);
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     ENLACES DE WHATSAPP
     ------------------------------------------------------------------ */
  const waUrl = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  $$('[data-wa]').forEach((a) => {
    a.href = waUrl(WA_MESSAGES[a.dataset.wa] || WA_MESSAGES.default);
  });

  /* ------------------------------------------------------------------
     SCROLL SUAVE (Lenis) + ANCLAS
     ------------------------------------------------------------------ */
  function initLenis() {
    if (reduced || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      duration: 1.35,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.2,
      autoRaf: false
    });
    lenis.stop(); // se reactiva al terminar el loader
  }

  function goTo(target) {
    let y = 0;
    if (target && target !== 'top') {
      y = Math.max(0, target.getBoundingClientRect().top + S.y - 70);
    }
    if (lenis) lenis.scrollTo(y, { duration: 1.9, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#inicio' || id === '#') {
      e.preventDefault();
      setMenu(false);
      goTo('top');
      return;
    }
    const t = id.length > 1 ? $(id) : null;
    if (!t) return;
    e.preventDefault();
    setMenu(false);
    goTo(t);
  });

  /* ------------------------------------------------------------------
     LOADER
     ------------------------------------------------------------------ */
  const imgReady = (src) =>
    new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = src;
      if (im.complete) res();
    });
  const windowLoaded = () =>
    new Promise((res) => {
      if (document.readyState === 'complete') res();
      else window.addEventListener('load', () => res(), { once: true });
    });

  function runLoader() {
    const loader = $('#loader');
    if (!loader) return Promise.resolve();
    const pctEl = $('[data-loader-pct]', loader);
    const msgEl = $('[data-loader-msg]', loader);
    const arc = $('.loader__arc', loader);
    const msgs = ['Preparando tus rutas', 'Clasificando materiales', 'Cerrando el ciclo'];
    const MIN = reduced ? 500 : 2300; // tiempo mínimo para que la animación se aprecie
    const MAX = 6500;
    let loaded = false;
    let p = 0;
    let msgI = 0;
    const t0 = performance.now();

    Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : null,
      imgReady('img/fotos/hero-cuadrilla.jpg'),
      imgReady('img/arcons-emblema.webp'),
      windowLoaded()
    ]).then(() => { loaded = true; });

    return new Promise((resolve) => {
      let last = t0;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const el = now - t0;
        if (el > MAX) loaded = true;
        const timeP = easeOut(clamp(el / MIN)) * 100;
        const cap = loaded ? 100 : 88;
        p = damp(p, Math.min(cap, timeP), 5, dt);
        const shown = p > 99.4 && loaded && el >= MIN ? 100 : Math.min(p, 99.4);

        loader.style.setProperty('--p', shown.toFixed(2));
        arc.style.strokeDashoffset = String(100 - shown);
        pctEl.textContent = String(Math.round(shown));
        const mi = shown < 34 ? 0 : shown < 70 ? 1 : 2;
        if (mi !== msgI) { msgI = mi; msgEl.textContent = msgs[mi]; }

        if (shown >= 100) {
          loader.classList.add('is-done');
          setTimeout(() => { loader.classList.add('is-gone'); loader.setAttribute('aria-hidden', 'true'); }, 1400);
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ------------------------------------------------------------------
     NAVEGACIÓN, PROGRESO Y MENÚ MÓVIL
     ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  const progressBar = $('[data-progress]');
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  let menuOpen = false;
  if (menu) menu.inert = true;

  function setMenu(open) {
    if (!menu || open === menuOpen) return;
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    document.body.classList.toggle('menu-open', open);
    root.style.overflow = open ? 'hidden' : '';
    if (lenis) (open ? lenis.stop() : lenis.start());
  }
  if (burger) burger.addEventListener('click', () => setMenu(!menuOpen));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  const navLinks = $$('.nav__links a').map((a) => ({ a, t: track($(a.getAttribute('href'))) }));
  let navHidden = false;
  let navSolid = false;
  let navAcc = 0;
  let navActive = null;

  tasks.push((dt, s) => {
    // Barra de progreso global
    const max = root.scrollHeight - s.vh;
    progressBar.style.transform = `scaleX(${max > 0 ? clamp(s.y / max).toFixed(4) : 0})`;

    // Navegación: translúcida arriba, sólida al avanzar, se oculta al bajar
    const solid = s.y > 40;
    if (solid !== navSolid) { navSolid = solid; nav.classList.toggle('is-solid', solid); }
    const delta = s.vel * dt;
    navAcc = Math.sign(delta) === Math.sign(navAcc) ? navAcc + delta : delta;
    let hide = navHidden;
    if (s.y < 180 || menuOpen) hide = false;
    else if (navAcc > 36) hide = true;
    else if (navAcc < -24) hide = false;
    if (hide !== navHidden) { navHidden = hide; nav.classList.toggle('is-hidden', hide); }

    // Enlace activo según la sección visible
    let current = null;
    for (const l of navLinks) {
      if (s.y + s.vh * 0.4 >= l.t.top && s.y + s.vh * 0.4 < l.t.top + l.t.h) current = l;
    }
    if (current !== navActive) {
      navActive = current;
      navLinks.forEach((l) => {
        const on = l === current;
        l.a.classList.toggle('is-active', on);
        if (on) l.a.setAttribute('aria-current', 'true'); else l.a.removeAttribute('aria-current');
      });
    }
  });

  /* ------------------------------------------------------------------
     REVELADOS + DIVISIÓN DE TEXTO EN PALABRAS
     ------------------------------------------------------------------ */
  /** Envuelve cada palabra en spans. mask=true crea el efecto de máscara por línea */
  function splitWords(el, mask) {
    let idx = 0;
    const out = [];
    const walk = (node) => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            if (mask) {
              const w = document.createElement('span'); w.className = 'w';
              const wi = document.createElement('span'); wi.className = 'wi';
              wi.textContent = part; wi.style.setProperty('--i', String(idx++));
              w.appendChild(wi); frag.appendChild(w);
            } else {
              const w = document.createElement('span'); w.className = 'mw';
              w.textContent = part; out.push(w); frag.appendChild(w);
            }
          });
        } else if (n.nodeType === 1) {
          const c = n.cloneNode(false);
          c.appendChild(walk(n));
          frag.appendChild(c);
        }
      });
      return frag;
    };
    const frag = walk(el);
    el.textContent = '';
    el.appendChild(frag);
    return out;
  }

  $$('[data-split]').forEach((el) => splitWords(el, true));
  const manifestoWords = (() => {
    const el = $('[data-words]');
    return el ? splitWords(el, false) : [];
  })();

  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  $$('[data-reveal],[data-split],[data-giant]').forEach((el) => {
    if (el.dataset.delay) el.style.setProperty('--d', `${Number(el.dataset.delay) / 1000}s`);
    revealIO.observe(el);
  });

  // Contadores
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      const el = e.target;
      const end = Number(el.dataset.count);
      const suf = el.dataset.suffix || '';
      if (reduced || end === 0) { el.textContent = end + suf; return; }
      const dur = 1700;
      const t0 = performance.now();
      const step = (now) => {
        const k = clamp((now - t0) / dur);
        el.textContent = Math.round(easeExpo(k) * end) + (k >= 1 ? suf : '');
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => {
    if (!reduced) el.textContent = '0' + (el.dataset.suffix || '');
    countIO.observe(el);
  });

  /* ------------------------------------------------------------------
     CAMPO HEXAGONAL (canvas): panal reactivo con pulsos y partículas
     ------------------------------------------------------------------ */
  class HexField {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.light = canvas.dataset.variant === 'light';
      this.cells = [];
      this.parts = [];
      this.pulses = [];
      this.path = null;
      this.w = 0; this.h = 0; this.dpr = 1; this.t = 0;
      this.next = 0.8;
      this.visible = false;
      this.mouse = { x: -9999, y: -9999, k: 0, tk: 0, timer: 0 };
      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
      this.resize();
      if (finePointer && !reduced) {
        window.addEventListener('pointermove', (e) => this.onMove(e), { passive: true });
      }
      if (!reduced) window.addEventListener('pointerdown', (e) => this.onDown(e), { passive: true });
    }

    resize() {
      const r = this.c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, S.vw < 768 ? 1.5 : 2);
      this.w = r.width; this.h = r.height;
      this.c.width = Math.round(r.width * this.dpr);
      this.c.height = Math.round(r.height * this.dpr);
      this.build();
      this.draw();
    }

    build() {
      const R = this.w < 640 ? 26 : this.w < 1100 ? 34 : 40;
      const dx = Math.sqrt(3) * R;
      const dy = 1.5 * R;
      this.cells = [];
      const cols = Math.ceil(this.w / dx) + 2;
      const rows = Math.ceil(this.h / dy) + 2;
      for (let r = -1; r < rows; r++) {
        for (let c = -1; c < cols; c++) {
          this.cells.push({ x: c * dx + (r & 1 ? dx / 2 : 0), y: r * dy, ph: Math.random() * 6.283 });
        }
      }
      const p = new Path2D();
      const rr = R * 0.93;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        const x = rr * Math.cos(a); const y = rr * Math.sin(a);
        if (i) p.lineTo(x, y); else p.moveTo(x, y);
      }
      p.closePath();
      this.path = p;
      const n = this.light ? 0 : this.w < 640 ? 18 : 40;
      this.parts = Array.from({ length: n }, () => this.seed(true));
    }

    seed(anywhere) {
      return {
        x: Math.random() * this.w,
        y: anywhere ? Math.random() * this.h : this.h + 20,
        s: 0.8 + Math.random() * 2.1,
        vy: 8 + Math.random() * 22,
        ph: Math.random() * 6.283,
        gold: Math.random() < 0.32,
        a: 0.25 + Math.random() * 0.5
      };
    }

    local(e) {
      const r = this.c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
    }
    onMove(e) {
      if (!this.visible || e.pointerType === 'touch') return;
      const p = this.local(e);
      if (!p.inside) { this.mouse.tk = 0; return; }
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.tk = 1;
      clearTimeout(this.mouse.timer);
      this.mouse.timer = setTimeout(() => { this.mouse.tk = 0; }, 1800);
    }
    onDown(e) {
      if (!this.visible) return;
      const p = this.local(e);
      if (p.inside) this.pulses.push({ x: p.x, y: p.y, r: 0, life: 1, v: 360 });
    }

    update(dt) {
      if (!this.visible || reduced) return;
      this.t += dt;
      this.next -= dt;
      if (this.next <= 0) {
        this.next = 2 + Math.random() * 2.4;
        this.pulses.push({ x: Math.random() * this.w, y: Math.random() * this.h, r: 0, life: 1, v: 240 });
      }
      for (const p of this.pulses) { p.r += p.v * dt; p.life -= dt * 0.3; }
      this.pulses = this.pulses.filter((p) => p.life > 0);
      this.mouse.k = damp(this.mouse.k, this.mouse.tk, 6, dt);
      for (const p of this.parts) {
        p.y -= p.vy * dt;
        p.x += Math.sin(this.t * 0.6 + p.ph) * 9 * dt;
        if (p.y < -20) Object.assign(p, this.seed(false));
      }
      this.draw();
    }

    draw() {
      const { ctx, w, h, dpr } = this;
      if (!w || !this.path) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const col = this.light ? '0,35,29' : '25,210,142';
      const base = this.light ? 0.11 : 0.075;
      const gain = this.light ? 0.3 : 0.55;
      const m = this.mouse;
      const mr = 190;
      ctx.lineWidth = 1;
      for (const c of this.cells) {
        let v = 0;
        for (const p of this.pulses) {
          const d = Math.hypot(c.x - p.x, c.y - p.y) - p.r;
          if (d > -100 && d < 100) v += Math.exp(-(d * d) / 3200) * p.life;
        }
        if (m.k > 0.01) {
          const d = Math.hypot(c.x - m.x, c.y - m.y);
          if (d < mr) { const k = 1 - d / mr; v += k * k * m.k; }
        }
        const tw = Math.sin(this.t * 0.8 + c.ph);
        if (tw > 0.8) v += (tw - 0.8) * 0.9;
        if (v > 1) v = 1;
        ctx.setTransform(dpr, 0, 0, dpr, c.x * dpr, c.y * dpr);
        ctx.strokeStyle = `rgba(${col},${(base + v * gain).toFixed(3)})`;
        if (v > 0.22) {
          ctx.fillStyle = `rgba(${col},${((v - 0.22) * 0.17).toFixed(3)})`;
          ctx.fill(this.path);
        }
        ctx.stroke(this.path);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const p of this.parts) {
        const tw = 0.65 + 0.35 * Math.sin(this.t * 1.4 + p.ph);
        const rgb = this.light ? '0,35,29' : p.gold ? '236,211,163' : '91,232,178';
        ctx.fillStyle = `rgba(${rgb},${(p.a * 0.3 * tw).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 3, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${rgb},${(p.a * tw).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
      }
    }
  }

  const fields = $$('[data-hexfield]').map((c) => new HexField(c));
  tasks.push((dt) => { for (const f of fields) f.update(dt); });

  /* ------------------------------------------------------------------
     HERO: palabra rotativa, parallax de puntero y salida con scroll
     ------------------------------------------------------------------ */
  const hero = $('[data-hero]');
  if (hero) {
    const heroT = track(hero);
    const copy = $('[data-hero-copy]', hero);
    const visual = $('[data-hero-visual]', hero);
    const words = $$('.swap__w', hero);
    let wi = 0;
    let swapT = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;

    const nextWord = () => {
      const cur = words[wi];
      wi = (wi + 1) % words.length;
      const nx = words[wi];
      cur.classList.remove('is-on'); cur.classList.add('is-out');
      nx.classList.remove('is-out'); nx.classList.add('is-on');
      setTimeout(() => cur.classList.remove('is-out'), 950);
    };

    if (finePointer && !reduced) {
      window.addEventListener('pointermove', (e) => {
        tx = (e.clientX / S.vw - 0.5) * 2;
        ty = (e.clientY / S.vh - 0.5) * 2;
      }, { passive: true });
    }

    tasks.push((dt, s) => {
      if (s.y > heroT.h * 1.1) return;
      if (!reduced && root.classList.contains('is-ready')) {
        swapT += dt;
        if (swapT > 2.7) { swapT = 0; nextWord(); }
      }
      // Entrada/salida con scroll (propiedades individuales: no chocan con las transiciones de revelado)
      const p = clamp(s.y / (s.vh * 0.85));
      if (!reduced) {
        copy.style.translate = `0 ${(-p * 70).toFixed(1)}px`;
        copy.style.opacity = String(1 - p * 1.15);
        visual.style.translate = `0 ${(-p * 110).toFixed(1)}px`;
        visual.style.scale = String(1 - p * 0.07);
        cx = damp(cx, tx, 5, dt); cy = damp(cy, ty, 5, dt);
        visual.style.setProperty('--px', cx.toFixed(3));
        visual.style.setProperty('--py', cy.toFixed(3));
      }
    });
  }

  /* ------------------------------------------------------------------
     MARQUEE ligado a la velocidad y dirección del scroll
     ------------------------------------------------------------------ */
  const mq = $('[data-marquee]');
  if (mq && !reduced) {
    const mqT = track(mq.parentElement);
    const group = mq.firstElementChild;
    let gw = group.offsetWidth;
    let x = 0;
    let boost = 0;
    window.addEventListener('resize', () => { gw = group.offsetWidth; });
    tasks.push((dt, s) => {
      if (!mqT.visible(200)) return;
      boost = damp(boost, clamp(s.vel, -3000, 3000) * 0.22, 4, dt);
      x -= (70 + boost) * dt;
      if (x <= -gw) x += gw;
      if (x > 0) x -= gw;
      mq.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    });
  }

  /* ------------------------------------------------------------------
     MANIFIESTO: el texto se ilumina palabra por palabra
     ------------------------------------------------------------------ */
  if (manifestoWords.length && !reduced) {
    const textEl = $('[data-words]');
    const mT = track(textEl);
    const n = manifestoWords.length;
    const lit = new Array(n).fill(-1);
    let pv = 0;
    tasks.push((dt, s) => {
      if (!mT.visible(120)) return;
      const ty = mT.top - s.y;
      const p = clamp((s.vh * 0.84 - ty) / (s.vh * 0.34 + mT.h));
      pv = damp(pv, p, 7, dt);
      for (let i = 0; i < n; i++) {
        const o = smooth(clamp((pv - (i / n) * 0.86) / 0.14));
        const q = Math.round(o * 40) / 40;
        if (q === lit[i]) continue;
        lit[i] = q;
        const w = manifestoWords[i];
        w.style.opacity = (0.16 + 0.84 * q).toFixed(3);
        if (w.parentElement.tagName === 'MARK') w.classList.toggle('is-hot', q > 0.6);
      }
    });
  }

  /* ------------------------------------------------------------------
     IMAGEN QUE SE EXPANDE A PANTALLA COMPLETA
     ------------------------------------------------------------------ */
  const expand = $('[data-expand]');
  if (expand && !reduced) {
    const exT = track(expand);
    const frameEl = $('[data-expand-frame]', expand);
    const img = $('img', frameEl);
    let cx0 = 17, cy0 = 27;
    const readConsts = () => {
      const cs = getComputedStyle(expand);
      cx0 = parseFloat(cs.getPropertyValue('--cx0')) || 17;
      cy0 = parseFloat(cs.getPropertyValue('--cy0')) || 27;
    };
    readConsts();
    window.addEventListener('resize', readConsts);
    let pv = 0;
    let full = false;
    let shown = false;
    tasks.push((dt, s) => {
      if (!exT.visible(80)) return;
      pv = damp(pv, exT.pin(), 9, dt);
      const t = easeIO(map(pv, 0, 0.62));
      const c = smooth(map(pv, 0.64, 0.82));
      const st = expand.style;
      st.setProperty('--t', t.toFixed(4));
      st.setProperty('--cx', (cx0 * (1 - t)).toFixed(3));
      st.setProperty('--cy', (cy0 * (1 - t)).toFixed(3));
      st.setProperty('--cr', `${(28 * (1 - t)).toFixed(2)}px`);
      st.setProperty('--wo', clamp(1 - t * 1.9).toFixed(3));
      st.setProperty('--shade', lerp(0.12, 0.62, smooth(map(pv, 0.2, 0.75))).toFixed(3));
      st.setProperty('--c', c.toFixed(3));
      // Zoom de entrada que se asienta, más un empuje lento al final
      img.style.transform = `scale(${(lerp(1.32, 1.03, t) + map(pv, 0.62, 1) * 0.06).toFixed(4)})`;
      const isFull = c > 0.5;
      if (isFull !== full) { full = isFull; expand.classList.toggle('is-full', isFull); }
      const isShow = c > 0.02;
      if (isShow !== shown) { shown = isShow; expand.classList.toggle('is-show', isShow); }
    });
  }

  /* ------------------------------------------------------------------
     PROCESO: escena fija con ruta y camión
     ------------------------------------------------------------------ */
  const flow = $('.flow');
  if (flow) {
    const flowT = track(flow);
    const steps = $$('[data-step]', flow);
    const route = $('[data-route]', flow);
    const nodes = $$('[data-node]', flow);
    const truck = $('[data-truck]', flow);
    const L = route.getTotalLength();
    route.style.strokeDasharray = String(L);
    route.style.strokeDashoffset = String(reduced ? 0 : L);

    // Posiciona nodos sobre el trazado (grupo exterior = posición, interior = animación)
    const nodeAt = nodes.map((g) => Number(g.dataset.at));
    nodes.forEach((g, i) => {
      const p = route.getPointAtLength(L * nodeAt[i]);
      g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    });
    const nodeEls = nodes.map((g) => g.firstElementChild);
    let active = -1;
    let rv = 0;

    const apply = (rp) => {
      route.style.strokeDashoffset = String((L * (1 - rp)).toFixed(1));
      const tp = route.getPointAtLength(L * rp);
      truck.setAttribute('transform', `translate(${tp.x.toFixed(1)} ${tp.y.toFixed(1)})`);
      truck.style.opacity = String(1 - map(rp, 0.965, 1)); // al llegar al destino el camión cede el lugar al ícono
      let idx = 0;
      nodeAt.forEach((at, i) => {
        const on = rp >= at - 0.012;
        if (on) idx = i;
        if (nodeEls[i].classList.contains('is-on') !== on) nodeEls[i].classList.toggle('is-on', on);
      });
      if (idx !== active) {
        active = idx;
        steps.forEach((st, i) => st.classList.toggle('is-active', i === idx));
      }
    };

    if (reduced) {
      apply(1);
      steps.forEach((st) => st.classList.add('is-active'));
    } else {
      apply(0);
      tasks.push((dt) => {
        if (!flowT.visible(80)) return;
        const target = map(flowT.pin(), 0.05, 0.93);
        rv = damp(rv, target, 6, dt);
        apply(rv);
      });
    }
  }

  /* ------------------------------------------------------------------
     MATERIALES: galería horizontal fijada (escritorio) / carrusel (móvil)
     ------------------------------------------------------------------ */
  const mats = $('[data-mats]');
  let matsSetup = null;
  if (mats) {
    const matsT = track(mats);
    const viewport = $('[data-mats-viewport]', mats);
    const trackEl = $('[data-mats-track]', mats);
    const bar = $('[data-mats-bar]', mats);
    let pinned = false;
    let dist = 0;
    let mv = 0;

    const setupMats = () => {
      pinned = !reduced && window.matchMedia('(min-width: 900px)').matches && S.vh >= 520;
      mats.classList.toggle('is-pinned', pinned);
      trackEl.style.transform = '';
      if (pinned) {
        viewport.removeAttribute('tabindex');
        mats.style.removeProperty('--mats-h');
        dist = Math.max(0, trackEl.scrollWidth - viewport.clientWidth);
        mats.style.setProperty('--mats-h', `${Math.round(dist + S.vh)}px`);
      } else {
        viewport.setAttribute('tabindex', '0');
        mats.style.removeProperty('--mats-h');
        dist = 0;
      }
    };
    setupMats();
    matsSetup = setupMats;

    // Accesibilidad por teclado: si algo de la galería recibe foco, se desplaza la página hasta esa tarjeta
    const sticky = $('.mats__sticky', mats);
    sticky.addEventListener('focusin', (e) => {
      if (!pinned) return;
      const card = e.target.closest('.mat');
      if (!card) return;
      sticky.scrollLeft = 0;
      const pad = parseFloat(getComputedStyle(trackEl).paddingLeft) || 0;
      const need = clamp((card.offsetLeft - pad) / Math.max(1, dist));
      const y = matsT.top + (0.03 + need * 0.94) * Math.max(1, matsT.h - S.vh);
      if (lenis) lenis.scrollTo(y, { duration: 1.2 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    });

    tasks.push((dt, s) => {
      if (pinned) {
        if (!matsT.visible(80)) return;
        mv = damp(mv, map(matsT.pin(), 0.03, 0.97), 7, dt);
        trackEl.style.transform = `translate3d(${(-dist * mv).toFixed(1)}px,0,0)`;
        bar.style.transform = `scaleX(${mv.toFixed(4)})`;
      }
    });
  }

  /* ------------------------------------------------------------------
     PARALLAX, SPOTLIGHT Y BOTONES MAGNÉTICOS
     ------------------------------------------------------------------ */
  const plx = $$('[data-parallax]').map((el) => ({ el, f: Number(el.dataset.parallax) || 0.1, base: 0, h: 0 }));
  const measureParallax = () => {
    plx.forEach((p) => {
      p.el.style.translate = '';
      const r = p.el.getBoundingClientRect();
      p.base = r.top + (window.scrollY || 0);
      p.h = r.height;
    });
  };
  if (!reduced) {
    tasks.push((dt, s) => {
      for (const p of plx) {
        const c = p.base + p.h / 2 - s.y - s.vh / 2;
        if (Math.abs(c) > s.vh * 1.3) continue;
        p.el.style.translate = `0 ${(c * -p.f).toFixed(1)}px`;
      }
    });
  }

  $$('[data-spot]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  });

  if (finePointer && !reduced) {
    const mags = $$('[data-magnetic]').map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
    let px = -999, py = -999;
    let moved = false;
    window.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; moved = true; }, { passive: true });
    tasks.push((dt) => {
      if (!moved) return; // sin movimiento de puntero no hay nada que calcular
      for (const m of mags) {
        const r = m.el.getBoundingClientRect();
        const dx = px - (r.left + r.width / 2);
        const dy = py - (r.top + r.height / 2);
        const near = Math.abs(dx) < r.width / 2 + 70 && Math.abs(dy) < r.height / 2 + 70;
        m.tx = near ? dx * 0.22 : 0;
        m.ty = near ? dy * 0.3 : 0;
        m.x = damp(m.x, m.tx, 9, dt); m.y = damp(m.y, m.ty, 9, dt);
        if (Math.abs(m.x) + Math.abs(m.y) > 0.05 || m.tx || m.ty) m.el.style.translate = `${m.x.toFixed(1)}px ${m.y.toFixed(1)}px`;
        else m.el.style.translate = '';
      }
    });
  }

  /* ------------------------------------------------------------------
     FAQ (acordeón)
     ------------------------------------------------------------------ */
  $$('.acc__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      $$('.acc__btn').forEach((b) => {
        b.setAttribute('aria-expanded', 'false');
        b.closest('.acc__item').classList.remove('is-open');
      });
      if (!open) {
        btn.setAttribute('aria-expanded', 'true');
        btn.closest('.acc__item').classList.add('is-open');
      }
    });
  });

  /* ------------------------------------------------------------------
     FORMULARIO → WHATSAPP
     ------------------------------------------------------------------ */
  const form = $('#wa-form');
  if (form) {
    const note = $('[data-form-note]', form);
    const submit = $('[data-submit]', form);
    const submitTxt = $('.btn__txt', submit);
    const noteDefault = note.textContent;
    const setErr = (field, msg) => {
      const wrap = field.closest('.field');
      const err = $('.field__err', wrap);
      wrap.classList.toggle('has-error', Boolean(msg));
      if (err) err.textContent = msg || '';
    };

    const build = (fd) => {
      const nombre = String(fd.get('nombre') || '').trim();
      const empresa = String(fd.get('empresa') || '').trim();
      const zona = String(fd.get('zona') || '').trim();
      const notas = String(fd.get('notas') || '').trim();
      const residuos = fd.getAll('residuos').join(', ');
      return [
        `Hola Grupo Arcons, soy ${nombre}${empresa ? ` de ${empresa}` : ''}.`,
        `Necesito el servicio de recolección para: ${fd.get('tipo')}.`,
        `Residuos que genero: ${residuos}.`,
        `Frecuencia deseada: ${fd.get('frecuencia')}.`,
        zona ? `Zona: ${zona}, Querétaro.` : '',
        notas ? `Comentarios: ${notas}` : '',
        'Quedo atento a su cotización. ¡Gracias!'
      ].filter(Boolean).join('\n');
    };

    form.addEventListener('input', (e) => {
      const f = e.target.closest('.field');
      if (f && f.classList.contains('has-error')) setErr(e.target, '');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const nameEl = form.elements.nombre;
      const wasteBoxes = $$('input[name="residuos"]', form);
      let firstBad = null;

      if (String(fd.get('nombre') || '').trim().length < 2) {
        setErr(nameEl, 'Escribe tu nombre para que sepamos cómo llamarte.');
        nameEl.setAttribute('aria-invalid', 'true');
        firstBad = firstBad || nameEl;
      } else {
        setErr(nameEl, ''); nameEl.removeAttribute('aria-invalid');
      }
      if (!fd.getAll('residuos').length) {
        setErr(wasteBoxes[0], 'Elige al menos un tipo de residuo.');
        firstBad = firstBad || wasteBoxes[0];
      } else {
        setErr(wasteBoxes[0], '');
      }
      if (firstBad) { firstBad.focus({ preventScroll: false }); return; }

      const url = waUrl(build(fd));
      submit.disabled = true;
      submitTxt.textContent = 'Abriendo WhatsApp...';
      const w = window.open(url, '_blank');
      if (!w) window.location.href = url;
      note.innerHTML = `Listo. Si WhatsApp no se abrió, <a href="${url}" target="_blank" rel="noopener">haz clic aquí</a>.`;
      setTimeout(() => {
        submit.disabled = false;
        submitTxt.textContent = 'Enviar mi solicitud por WhatsApp';
        note.textContent = noteDefault;
      }, 9000);
    });
  }

  /* ------------------------------------------------------------------
     BOTÓN FLOTANTE
     ------------------------------------------------------------------ */
  const fab = $('[data-fab]');
  function showFab() {
    if (!fab) return;
    setTimeout(() => fab.classList.add('is-on'), 600);
    setTimeout(() => fab.classList.add('show-tip'), 5200);
    setTimeout(() => fab.classList.remove('show-tip'), 10500);
  }

  /* ------------------------------------------------------------------
     RESIZE
     ------------------------------------------------------------------ */
  let rzTimer = 0;
  const relayout = () => {
    readViewport();
    if (matsSetup) matsSetup();
    measureAll();
    measureParallax();
  };
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => {
      const wChanged = window.innerWidth !== S.vw;
      const hChanged = Math.abs((probe.offsetHeight || window.innerHeight) - S.vh) > 100;
      if (wChanged || hChanged) {
        if (S.vw >= 1024) setMenu(false);
        relayout();
      }
    }, 160);
  });
  new ResizeObserver(() => { clearTimeout(rzTimer); rzTimer = setTimeout(() => { measureAll(); measureParallax(); }, 120); }).observe(document.body);

  /* ------------------------------------------------------------------
     ARRANQUE
     ------------------------------------------------------------------ */
  function onReady() {
    root.classList.remove('is-loading');
    root.classList.add('is-ready');
    if (lenis) lenis.start();
    clearTimeout(window.__arconsFailsafe);
    relayout();
    showFab();
  }

  function init() {
    root.classList.add('is-loading');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash) window.scrollTo(0, 0);
    initLenis();
    relayout();
    requestAnimationFrame(frame);
    runLoader().then(onReady);
    // Segunda medición cuando todo el contenido terminó de cargar
    windowLoaded().then(() => relayout());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => relayout());
  }

  init();
})();
