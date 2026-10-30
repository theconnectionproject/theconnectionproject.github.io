/* Explore Connection — small interactive diagrams.
   Nothing here is stored or sent anywhere: every choice lives only in the open page. */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const curveThrough = (pts) => {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1.map((n) => n.toFixed(1))} ${c2.map((n) => n.toFixed(1))} ${p2.map((n) => n.toFixed(1))}`;
    }
    return d;
  };
  const onResize = (el, fn) => {
    let frame;
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fn); };
    if ("ResizeObserver" in window) new ResizeObserver(run).observe(el);
    window.addEventListener("resize", run);
    document.fonts?.ready.then(run);
  };

  /* ---------- 01 Recognising patterns: a line through your responses ---------- */
  const pmap = document.querySelector("[data-pattern-map]");
  if (pmap) {
    const LEVELS = ["Least familiar", "Less familiar", "Somewhere in between", "More familiar", "Most familiar"];
    const ranges = [...pmap.querySelectorAll(".pmap__range")];
    const line = pmap.querySelector("[data-pmap-line]");
    const summary = pmap.querySelector("[data-pmap-summary]");
    const defaultSummary = summary.textContent;
    const THUMB = 13; // half the thumb size in css/explore.css

    const draw = () => {
      const box = pmap.getBoundingClientRect();
      const pts = ranges.map((r) => {
        const rect = r.getBoundingClientRect();
        const t = (r.value - r.min) / (r.max - r.min);
        return [rect.left - box.left + THUMB + (rect.width - THUMB * 2) * t, rect.top - box.top + rect.height / 2];
      });
      line.setAttribute("d", curveThrough(pts));
      // gradient in drawing units, so it still paints when the line is perfectly straight
      pmap.querySelector("[data-pmap-grad]").setAttribute("y2", box.height);
    };

    const update = () => {
      ranges.forEach((r) => {
        r.dataset.level = r.value;
        r.setAttribute("aria-valuetext", LEVELS[r.value]);
      });
      const familiar = ranges.filter((r) => r.value >= 3).map((r) => r.id.replace("pm-", "0"));
      summary.textContent = familiar.length
        ? `You’ve placed ${familiar.length === 1 ? "response " + familiar[0] : "responses " + familiar.slice(0, -1).join(", ") + " and " + familiar.slice(-1)} towards “more familiar”. When do these responses usually appear?`
        : defaultSummary;
      draw();
    };
    ranges.forEach((r) => r.addEventListener("input", update));
    onResize(pmap, draw);
    update();
  }

  /* ---------- 02 Beneath the reaction: layers as tabs ---------- */
  const layersEl = document.querySelector("[data-layers]");
  if (layersEl) {
    const tabs = [...layersEl.querySelectorAll("[data-layer-tab]")];
    const panels = [...layersEl.querySelectorAll("[data-layer-panel]")];
    const shapes = [...layersEl.querySelectorAll(".layer")];
    const node = layersEl.querySelector("[data-layers-node]");
    const next = layersEl.querySelector("[data-layers-next]");
    const DEPTHS = [110, 205, 292, 368];   // centre of each layer in the SVG
    let current = 0;

    const select = (i, focus = false) => {
      current = i;
      tabs.forEach((t, j) => {
        t.setAttribute("aria-selected", String(j === i));
        t.tabIndex = j === i ? 0 : -1;
      });
      panels.forEach((p, j) => p.classList.toggle("is-inactive", j !== i));
      shapes.forEach((s, j) => {
        s.classList.toggle("is-active", j === i);
        s.classList.toggle("is-above", j < i);
      });
      node.style.transform = `translateY(${DEPTHS[i] - DEPTHS[0]}px)`;
      next.textContent = i === tabs.length - 1 ? "Back to the surface" : "Look a layer deeper";
      if (focus) tabs[i].focus();
    };

    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (e.key in map) { e.preventDefault(); select((current + map[e.key] + tabs.length) % tabs.length, true); }
        if (e.key === "Home") { e.preventDefault(); select(0, true); }
        if (e.key === "End") { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });
    next.addEventListener("click", () => select((current + 1) % tabs.length));
    select(0);
  }

  /* ---------- 03 Closeness & space: two circles you can bring together ---------- */
  const venn = document.querySelector("[data-venn]");
  if (venn) {
    const range = venn.querySelector("[data-venn-range]");
    const q = (s) => venn.querySelector(s);
    const a = q("[data-venn-a]"), b = q("[data-venn-b]"), clip = q("[data-venn-clip]"), overlap = q("[data-venn-overlap]");
    const la = [q("[data-venn-la]"), q("[data-venn-la2]")], lb = [q("[data-venn-lb]"), q("[data-venn-lb2]")];
    const both = q("[data-venn-both]");
    const caption = q("[data-venn-caption]");

    const update = () => {
      const v = Number(range.value);
      const d = 390 - v * 2.7;                      // distance between centres: 390 (apart) → 120 (overlapping)
      const ax = 320 - d / 2, bx = 320 + d / 2;
      a.setAttribute("cx", ax); clip.setAttribute("cx", ax);
      b.setAttribute("cx", bx); overlap.setAttribute("cx", bx);
      const push = 20 + v * 0.55;                   // labels move outward as the circles overlap…
      const gap = 16;                               // …and never enter the coral overlap
      const halfA = la[0].getComputedTextLength() / 2, halfB = lb[0].getComputedTextLength() / 2;
      const xa = Math.min(ax - push, bx - 150 - gap - halfA);
      const xb = Math.max(bx + push, ax + 150 + gap + halfB);
      la.forEach((t) => t.setAttribute("x", xa));
      lb.forEach((t) => t.setAttribute("x", xb));
      both.style.opacity = Math.max(0, Math.min(1, (v - 45) / 25));
      const text = v < 15 ? "Two separate things." : v < 60 ? "Starting to meet." : "Both can exist at the same time.";
      if (caption.textContent !== text) caption.textContent = text;
      venn.classList.toggle("is-both", v >= 60);
      range.setAttribute("aria-valuetext", text);
    };
    range.addEventListener("input", update);
    update();
  }

  /* ---------- 04 Communicating needs: a line from Me to the need you choose ---------- */
  const needsEl = document.querySelector("[data-needs]");
  if (needsEl) {
    const me = needsEl.querySelector("[data-needs-me]");
    const linesG = needsEl.querySelector("[data-needs-lines]");
    const buttons = [...needsEl.querySelectorAll("[data-need]")];
    const meaning = needsEl.querySelector("[data-needs-meaning]");
    const say = needsEl.querySelector("[data-needs-say]");
    const NS = "http://www.w3.org/2000/svg";
    let paths = [];

    const draw = () => {
      const box = needsEl.getBoundingClientRect();
      const m = me.getBoundingClientRect();
      const mx = m.left + m.width / 2 - box.left, my = m.top + m.height / 2 - box.top;
      linesG.replaceChildren();
      paths = buttons.map((btn) => {
        const r = btn.querySelector("[data-need-dot]").getBoundingClientRect();
        const nx = r.left + r.width / 2 - box.left, ny = r.top + r.height / 2 - box.top;
        const vertical = Math.abs(ny - my) > Math.abs(nx - mx);
        const d = vertical
          ? `M${mx},${my} C${mx},${my + (ny - my) * 0.55} ${nx},${ny - (ny - my) * 0.45} ${nx},${ny}`
          : `M${mx},${my} C${mx + (nx - mx) * 0.55},${my} ${nx - (nx - mx) * 0.45},${ny} ${nx},${ny}`;
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", d);
        p.setAttribute("class", "needs__line");
        linesG.appendChild(p);
        return p;
      });
      paint(false);
    };

    const paint = (animate) => {
      buttons.forEach((btn, i) => {
        const on = btn.getAttribute("aria-pressed") === "true";
        const p = paths[i];
        if (!p) return;
        p.classList.toggle("is-active", on);
        if (on) {
          const len = p.getTotalLength();
          p.style.strokeDasharray = `${len} ${len}`;
          if (animate && !reduceMotion) {
            p.style.transition = "none";
            p.style.strokeDashoffset = String(len);
            p.getBoundingClientRect();
            p.style.transition = "";
          }
          p.style.strokeDashoffset = "0";
          linesG.appendChild(p);   // draw the chosen line on top
        } else {
          p.style.strokeDasharray = "";
          p.style.strokeDashoffset = "";
        }
      });
    };

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        meaning.textContent = btn.dataset.meaning;
        say.textContent = `“${btn.dataset.say}”`;
        paint(true);
      });
    });
    onResize(needsEl, draw);
    draw();
  }
})();
