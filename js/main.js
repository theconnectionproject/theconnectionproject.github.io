/* The Connection Project — shared interactions
   Everything here is progressive: the site is fully readable without it. */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile navigation ---------- */
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");

  const setMenu = (open) => {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    header.classList.toggle("menu-open", open);
  };
  toggle?.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  nav?.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 821px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  /* ---------- Header background once the page scrolls ---------- */
  const onScrollHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 12);
  onScrollHeader();

  /* ---------- Reveal on scroll (only for content that starts below the fold) ---------- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("reveal-pending");
        entry.target.classList.add("reveal-in");
        revealIO.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });

    const groups = new Map();
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) return;
      const parent = el.parentElement;
      const i = groups.get(parent) || 0;
      groups.set(parent, i + 1);
      el.style.setProperty("--reveal-delay", `${i * 0.09}s`);
      el.classList.add("reveal-pending");
      revealIO.observe(el);
    });
  }

  /* ---------- Draw connection lines when a section comes into view ---------- */
  const drawEls = document.querySelectorAll("[data-draw-on-view]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    drawEls.forEach((el) => el.classList.add("is-drawn"));
  } else {
    const drawIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-drawn");
        drawIO.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    drawEls.forEach((el) => drawIO.observe(el));
  }

  /* ---------- Soft parallax: data-parallax="0.05" (positive = slower than scroll) ---------- */
  const parallaxEls = reduceMotion ? [] : [...document.querySelectorAll("[data-parallax]")];
  const applyParallax = () => {
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const offset = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)${el.classList.contains("journal__deco") ? " scaleX(-1)" : ""}`;
    });
  };

  /* ---------- Connection threads: one continuous line drawn through a section's nodes ----------
     data-thread="edges"  : runs in from the left edge, through each node, out to the right edge
     data-thread="column" : runs from [data-thread-start], down through each node, to [data-thread-end]
     Each [data-thread-item] holds one [data-thread-anchor]; it gets .is-lit once the line reaches it. */
  const curveThrough = (pts) => {
    // Catmull-Rom spline converted to cubic Béziers
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1.map((n) => n.toFixed(1))} ${c2.map((n) => n.toFixed(1))} ${p2.map((n) => n.toFixed(1))}`;
    }
    return d;
  };

  const setupThread = (section) => {
    const mode = section.dataset.thread;
    const path = section.querySelector("[data-thread-path]");
    const pathBg = section.querySelector("[data-thread-bg]");
    const items = [...section.querySelectorAll("[data-thread-item]")];
    let length = 0, nodeLengths = [], samples = [];

    const centre = (el, box) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    };

    const nearestLength = (p) => {
      let best = 0, bestDist = Infinity;
      const step = length / 300;
      for (let l = 0; l <= length; l += step) {
        const q = path.getPointAtLength(l);
        const dist = (q.x - p[0]) ** 2 + (q.y - p[1]) ** 2;
        if (dist < bestDist) { bestDist = dist; best = l; }
      }
      return best;
    };

    const build = () => {
      const box = section.getBoundingClientRect();
      const nodes = items.map((item) => centre(item.querySelector("[data-thread-anchor]"), box));
      let pts;
      if (mode === "column") {
        // run down beside each item's text, then ease across the gap into the next node
        pts = [centre(section.querySelector("[data-thread-start]"), box)];
        items.forEach((item, i) => {
          const r = item.getBoundingClientRect();
          pts.push(nodes[i]);
          pts.push([nodes[i][0], r.bottom - box.top - 24]);
        });
        pts.push(centre(section.querySelector("[data-thread-end]"), box));
      } else {
        const stacked = nodes[1][1] - nodes[0][1] > Math.abs(nodes[1][0] - nodes[0][0]);
        const last = nodes[nodes.length - 1];
        pts = stacked
          ? [[-20, nodes[0][1] - 180], ...nodes, [box.width + 20, last[1] + 220]]
          : [[-20, nodes[0][1] - 60], ...nodes, [box.width + 20, last[1] + 120]];
      }
      const d = curveThrough(pts);
      path.setAttribute("d", d);
      pathBg.setAttribute("d", d);
      length = path.getTotalLength();
      nodeLengths = nodes.map(nearestLength);
      // for column threads: (length, furthest y reached) pairs so the line follows the scroll position
      samples = [];
      let maxY = -Infinity;
      for (let l = 0; l <= length; l += length / 240) {
        maxY = Math.max(maxY, path.getPointAtLength(l).y);
        samples.push([l, maxY]);
      }
      path.style.strokeDasharray = `${length} ${length}`;
      update();
    };

    const update = () => {
      if (!length) return;
      let drawn = length;
      if (!reduceMotion) {
        const r = section.getBoundingClientRect();
        const vh = window.innerHeight;
        if (mode === "column") {
          const headY = vh * 0.72 - r.top;
          drawn = 0;
          for (const [l, y] of samples) { if (y <= headY) drawn = l; else break; }
        } else {
          drawn = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / r.height)) * length;
        }
      }
      path.style.strokeDashoffset = String(length - drawn);
      items.forEach((item, i) => item.classList.toggle("is-lit", drawn >= nodeLengths[i] - 2));
      section.classList.toggle("is-complete", drawn >= length - 2);
    };

    let frame;
    const rebuild = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(build); };
    if ("ResizeObserver" in window) new ResizeObserver(rebuild).observe(section);
    window.addEventListener("resize", rebuild);
    window.addEventListener("load", rebuild);
    document.fonts?.ready.then(rebuild);
    build();
    return update;
  };

  const threadUpdates = [...document.querySelectorAll("[data-thread]")].map(setupThread);
  const updateThreads = () => threadUpdates.forEach((fn) => fn());

  /* ---------- Citation links open the sources panel ---------- */
  const sources = document.getElementById("research-sources");
  if (sources) {
    const openSources = () => { sources.open = true; };
    document.querySelectorAll('a[href="#research-sources"]').forEach((a) => a.addEventListener("click", openSources));
    if (location.hash === "#research-sources") openSources();
  }

  /* ---------- One rAF-throttled scroll handler ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScrollHeader();
      applyParallax();
      updateThreads();
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  applyParallax();
})();
