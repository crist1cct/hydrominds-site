(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const MOBILE = 720;

  /* ---------- Mobile menu ---------- */
  const burger = document.querySelector(".burger");
  const menu = document.getElementById("mobile-menu");
  const overlay = document.querySelector(".menu-overlay");

  function setMenu(open) {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Închide meniul" : "Deschide meniul");
    menu.hidden = !open;
    overlay.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  }

  burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
  overlay.addEventListener("click", () => setMenu(false));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      setMenu(false);
      burger.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > MOBILE && !menu.hidden) setMenu(false);
  });

  /* ---------- Count-up ---------- */
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function countUp(el, delay, duration) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || "";
    if (reduceMotion) {
      el.textContent = target + suffix;
      return;
    }
    setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(target * easeOutCubic(t)) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
  }

  // Hero stats: start offset 480 + i*90 ms, duration 1500 + i*80 ms
  const statValues = Array.from(document.querySelectorAll(".stat-value"));
  const statIO = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const i = statValues.indexOf(entry.target);
        countUp(entry.target, 480 + i * 90, 1500 + i * 80);
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.25 }
  );
  statValues.forEach((el) => statIO.observe(el));

  /* ---------- 3D scroll reveal ---------- */
  const revealIO = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("is-in");
        el.querySelectorAll("[data-target]").forEach((n) => countUp(n, 250, 1400));
        obs.unobserve(el);
      });
    },
    { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
  );

  // Stagger siblings that reveal together
  document.querySelectorAll(".reveal").forEach((el) => {
    const siblings = Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal"));
    const i = siblings.indexOf(el);
    if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", Math.min(i, 6) * 0.07 + "s");
    revealIO.observe(el);
  });

  /* ---------- Active nav link per section ---------- */
  const links = Array.from(document.querySelectorAll(".nav-link, .m-link"));
  const groups = {
    acasa: ["acasa"],
    despre: ["despre", "realizari"],
    proiecte: ["proiecte", "ftc", "obiective", "resurse", "schimb"],
    echipa: ["echipa", "impact", "sponsori"],
    contact: ["contact"],
  };
  const navIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const key = Object.keys(groups).find((k) => groups[k].includes(entry.target.id));
        if (!key) return;
        links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + key));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  document.querySelectorAll("section[id]").forEach((s) => navIO.observe(s));

  /* ---------- Scroll: progress bar + darken the 3D scene ---------- */
  const progress = document.querySelector(".scroll-progress");
  const shade = document.querySelector(".scene-shade");
  let scrollY = window.scrollY;

  function onScroll() {
    scrollY = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty("--sp", max > 0 ? (scrollY / max).toFixed(4) : 0);
    const k = Math.min(scrollY / (window.innerHeight * 0.75), 1);
    shade.style.setProperty("--shade", (k * 0.6).toFixed(3));
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Team filter ---------- */
  const members = document.querySelectorAll(".member");
  document.querySelectorAll(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach((b) => b.classList.toggle("is-active", b === btn));
      const f = btn.dataset.filter;
      members.forEach((m) => m.classList.toggle("is-dim", f !== "all" && !m.dataset.tags.split(" ").includes(f)));
    });
  });

  /* ---------- 3D tilt on photos and cards ---------- */
  if (!reduceMotion && finePointer) {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      const max = parseFloat(el.dataset.tilt || "8");
      let frame = 0;
      el.addEventListener("pointermove", (e) => {
        if (!el.classList.contains("is-in") || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          el.classList.add("is-tilting");
          el.style.transform = `perspective(1000px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(10px)`;
        });
      });
      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
        setTimeout(() => el.classList.remove("is-tilting"), 250);
      });
    });
  }

  /* ---------- three.js: particle water drop with the logo inside ---------- */
  const canvas = document.querySelector(".scene");
  if (!window.THREE || !canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (err) {
    return;
  }

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x071233, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 7);

  const dropVertex = `
    attribute vec3 aStart;
    attribute float aSize;
    attribute float aBright;
    uniform float uTime;
    uniform float uIntro;
    uniform float uPixel;
    varying float vBright;
    varying float vDepth;
    void main() {
      vec3 p = mix(aStart, position, uIntro);
      // Gentle water shimmer along the surface
      p += normal * sin(p.y * 7.0 + uTime * 1.6 + p.x * 3.0) * 0.025;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixel * (6.0 / -mv.z);
      vBright = aBright;
      vDepth = clamp((-mv.z - 6.0) / 2.5, 0.0, 1.0);
    }
  `;

  const dropFragment = `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uOpacity;
    varying float vBright;
    varying float vDepth;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.1, d);
      vec3 col = mix(uColorA, uColorB, vBright);
      gl_FragColor = vec4(col, a * uOpacity * mix(1.0, 0.3, vDepth) * (0.45 + vBright * 0.55));
    }
  `;

  function makeMaterial(colorA, colorB, opacity) {
    return new THREE.ShaderMaterial({
      vertexShader: dropVertex,
      fragmentShader: dropFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntro: { value: reduceMotion ? 1 : 0 },
        uPixel: { value: DPR },
        uOpacity: { value: opacity },
        uColorA: { value: new THREE.Color(colorA) },
        uColorB: { value: new THREE.Color(colorB) },
      },
    });
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  function points(attrs, material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(attrs.pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(attrs.nor, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(attrs.start, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(attrs.size, 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(attrs.bright, 1));
    return new THREE.Points(g, material);
  }

  function alloc(n) {
    return {
      pos: new Float32Array(n * 3),
      nor: new Float32Array(n * 3),
      start: new Float32Array(n * 3),
      size: new Float32Array(n),
      bright: new Float32Array(n),
    };
  }

  // Drop surface: teardrop with the tip up. r(u) = k·sin(u)·(1 − cos(u)), y = cos(u)
  function buildDrop() {
    const N = 5200;
    const shell = alloc(N);
    const k = 0.62;
    for (let i = 0; i < N; i++) {
      const u = Math.acos(1 - 2 * Math.random());
      const v = Math.random() * Math.PI * 2;
      const r = k * Math.sin(u) * (1 - Math.cos(u));
      const x = r * Math.cos(v);
      const z = r * Math.sin(v);
      shell.pos.set([x, Math.cos(u) * 1.05, z], i * 3);
      const len = Math.hypot(x, z) || 1;
      shell.nor.set([x / len, 0, z / len], i * 3);
      shell.start.set([rand(-6, 6), rand(-4, 4), rand(-6, 3)], i * 3);
      shell.size[i] = rand(1.2, 2.4);
      shell.bright[i] = Math.random() * 0.6;
    }

    // Logo (tree + water) inside, as a thin plane of points
    const L = window.HM_LOGO_POINTS || [];
    const M = L.length / 2;
    const logo = alloc(M);
    for (let i = 0; i < M; i++) {
      logo.pos.set([L[i * 2] * 0.98, L[i * 2 + 1] * 1.05, rand(-0.04, 0.04)], i * 3);
      logo.nor.set([0, 0, 1], i * 3);
      logo.start.set([rand(-6, 6), rand(-4, 4), rand(-6, 3)], i * 3);
      logo.size[i] = rand(1.6, 2.6);
      logo.bright[i] = rand(0.7, 1);
    }

    const shellMat = makeMaterial(0x1f4fe0, 0x9db8ff, 0.4);
    const logoMat = makeMaterial(0x5d86ff, 0xeaf0ff, 1.0);
    const group = new THREE.Group();
    group.add(points(shell, shellMat));
    group.add(points(logo, logoMat));
    return { group, mats: [shellMat, logoMat] };
  }

  // Wave field under the drop
  function buildWaves() {
    const cols = 150;
    const rows = 70;
    const w = alloc(cols * rows);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c / (cols - 1) - 0.5) * 26;
        const z = -14 + (r / (rows - 1)) * 18;
        w.pos.set([x, 0, z], i * 3);
        w.nor.set([0, 1, 0], i * 3);
        w.start.set([x, -3, z], i * 3);
        w.size[i] = 1.8;
        i++;
      }
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 aStart;
        attribute float aSize;
        uniform float uTime;
        uniform float uIntro;
        uniform float uPixel;
        uniform vec3 uRipple;
        varying float vH;
        varying float vDepth;
        void main() {
          vec3 p = mix(aStart, position, uIntro);
          float h = sin(p.x * 0.45 + uTime * 0.9) * 0.22
                  + cos(p.z * 0.6 - uTime * 1.1) * 0.18
                  + sin((p.x + p.z) * 0.3 + uTime * 0.5) * 0.12;
          float age = uTime - uRipple.z;
          if (age > 0.0 && age < 5.0) {
            float d = distance(p.xz, uRipple.xy);
            h += sin(d * 3.0 - age * 6.0) * 0.35 * exp(-age * 0.8) * exp(-abs(d - age * 2.4) * 0.9);
          }
          p.y += h;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixel * (6.0 / -mv.z);
          vH = h;
          vDepth = clamp((-mv.z - 3.0) / 14.0, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vH;
        varying float vDepth;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          if (length(c) > 0.5) discard;
          vec3 col = mix(vec3(0.12, 0.28, 0.85), vec3(0.62, 0.74, 1.0), clamp(vH * 1.6 + 0.4, 0.0, 1.0));
          gl_FragColor = vec4(col, uOpacity * (1.0 - vDepth));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntro: { value: reduceMotion ? 1 : 0 },
        uPixel: { value: DPR },
        uOpacity: { value: 0.7 },
        uRipple: { value: new THREE.Vector3(0, 0, -10) },
      },
    });
    const field = points(w, mat);
    field.position.y = -1.9;
    return { field, mat };
  }

  const drop = buildDrop();
  const waves = buildWaves();
  scene.add(drop.group);
  scene.add(waves.field);

  // Layout: drop on the right on desktop, above the copy on mobile
  let baseY = 0.2;
  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (w <= MOBILE) {
      baseY = 1.35;
      drop.group.position.x = 0;
      drop.group.scale.setScalar(0.8);
    } else if (w <= 980) {
      baseY = 0.25;
      drop.group.position.x = 1.6;
      drop.group.scale.setScalar(1);
    } else {
      baseY = 0.2;
      drop.group.position.x = 2.15;
      drop.group.scale.setScalar(1.15);
    }
    drop.group.position.y = baseY;
  }

  window.addEventListener("resize", layout);
  layout();

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const clock = new THREE.Clock();
  window.addEventListener("pointerdown", (e) => {
    if (scrollY > window.innerHeight) return;
    const x = ((e.clientX / window.innerWidth) * 2 - 1) * 7;
    waves.mat.uniforms.uRipple.value.set(x, -1, clock.getElapsedTime());
  });

  let visible = true;
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible) requestAnimationFrame(render);
  });

  function render() {
    const t = clock.getElapsedTime();
    const intro = reduceMotion ? 1 : easeOutCubic(Math.min(t / 2.6, 1));

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    drop.mats.forEach((m) => {
      m.uniforms.uTime.value = t;
      m.uniforms.uIntro.value = intro;
    });
    waves.mat.uniforms.uTime.value = t;
    waves.mat.uniforms.uIntro.value = intro;

    // Slow sway, the pointer steers it, scroll turns it further and lifts the camera
    const s = Math.min(scrollY / window.innerHeight, 3);
    drop.group.rotation.y = Math.sin(t * 0.35) * 0.6 + mouse.x * 0.5 + s * 1.2;
    drop.group.rotation.x = mouse.y * 0.18;
    drop.group.position.y = baseY + Math.sin(t * 0.8) * 0.06;
    camera.position.x = mouse.x * 0.25;
    camera.position.y = 0.2 + s * 0.6;
    camera.lookAt(0, s * 0.2, 0);

    renderer.render(scene, camera);
    if (visible && !reduceMotion) requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
