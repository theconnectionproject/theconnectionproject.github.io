/* Between Us — online journal reader
   Renders the real journal PDF with PDF.js (js/vendor). Two-page spreads on wide screens,
   single pages on narrow screens. Keyboard: ← → Home End, Esc closes the expanded view. */
(() => {
  const root = document.querySelector("[data-reader]");
  if (!root) return;

  /* ---------- Page titles (from the journal's own page headings) ---------- */
  const PAGE_TITLES = {
    1: "Cover",
    2: "A more intentional you",
    3: "How to use this journal",
    4: "Activity 01 · Recognise",
    5: "Activity 01 · Your patterns",
    6: "Activity 02 · Map the moment",
    7: "Activity 02 · Your map",
    8: "Activity 03 · Looking closer",
    9: "Activity 03 · Going further",
    10: "Activity 04 · Draw the distance",
    11: "Activity 04 · Your map",
    12: "Activity 05 · Beyond the distance",
    13: "Closeness & space",
    14: "Activity 06 · Read between the lines",
    15: "Activity 06 · Your reflection",
    16: "Activity 07 · Understand and choose",
    17: "Activity 07 · Your exploration",
    18: "Final reflection · Connecting the dots",
    19: "Final reflection · Your reflection",
    20: "Connection doesn’t end here",
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel) => root.querySelector(sel);
  const stage = $("[data-reader-stage]");
  const spreadEl = $("[data-reader-spread]");
  const slots = [...root.querySelectorAll("[data-reader-slot]")];
  const msg = $("[data-reader-message]");
  const msgText = $("[data-reader-message-text]");
  const pagesLabel = $("[data-reader-pages]");
  const chapterLabel = $("[data-reader-chapter]");
  const track = $("[data-reader-track]");
  const progress = $("[data-reader-progress]");
  const live = $("[data-reader-live]");
  const prevBtn = $("[data-reader-prev]");
  const nextBtn = $("[data-reader-next]");
  const closeBtn = $("[data-reader-close]");
  const expandBtns = [...document.querySelectorAll("[data-reader-expand]")];
  const src = root.dataset.src;

  let pdf = null;
  let total = 20;
  let pageAspect = 842.25 / 595.5;     // height / width of one page; replaced by the PDF's real size
  let spreadMode = false;
  let views = [];                      // each view is [leftPage|null, rightPage|null] or [page]
  let viewIndex = 0;
  let pageWidth = 0;                   // CSS px
  let expanded = false;
  let lastFocus = null;
  const cache = new Map();             // "page@width" -> rendered canvas
  let renderToken = 0;

  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- Views ---------- */
  const buildViews = () => {
    if (spreadMode) {
      // like a printed book: cover on the right, then 2–3, 4–5 … 18–19, back cover on the left
      views = [[null, 1]];
      for (let p = 2; p < total; p += 2) views.push([p, p + 1 <= total - 1 ? p + 1 : null]);
      if (total % 2 === 0) views.push([total, null]);
    } else {
      views = Array.from({ length: total }, (_, i) => [i + 1]);
    }
  };
  const viewForPage = (page) => Math.max(0, views.findIndex((v) => v.includes(page)));
  const currentPages = () => views[viewIndex].filter(Boolean);

  /* ---------- Layout ---------- */
  const decideMode = () => {
    // spreads only where two pages stay readable; phones (portrait or landscape) get single pages
    const w = stage.clientWidth;
    return w >= 720 && window.innerWidth >= 760 && window.innerHeight >= 520;
  };

  const layout = () => {
    const availW = stage.clientWidth;
    let pw;
    if (expanded) {
      const controlsH = root.querySelector(".reader__controls").offsetHeight;
      const availH = window.innerHeight - controlsH - 120;
      pw = Math.min((spreadMode ? availW / 2 : availW), availH / pageAspect);
    } else if (spreadMode) {
      // fit the spread and its controls on screen below the sticky header
      const headerH = document.querySelector("[data-header]")?.offsetHeight || 84;
      const chrome = root.offsetHeight - spreadEl.offsetHeight;   // stage padding + controls
      const availH = Math.max(360, Math.min(window.innerHeight - headerH - chrome - 24, 900));
      pw = Math.min(availW / 2, availH / pageAspect);
    } else {
      pw = Math.min(availW, 620);
    }
    pageWidth = Math.floor(pw);
    spreadEl.style.width = `${pageWidth * (spreadMode ? 2 : 1)}px`;
    spreadEl.style.height = `${Math.round(pageWidth * pageAspect)}px`;
    spreadEl.classList.toggle("is-spread", spreadMode);
    root.classList.toggle("is-single", !spreadMode);
    slots[1].hidden = !spreadMode;
  };

  /* ---------- Rendering ---------- */
  const renderPage = async (num) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const key = `${num}@${pageWidth}@${dpr}`;
    if (cache.has(key)) return cache.get(key);
    const page = await pdf.getPage(num);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (pageWidth * dpr) / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Page ${num} of ${total}: ${PAGE_TITLES[num] || ""}`);
    await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
    cache.set(key, canvas);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    return canvas;
  };

  const show = async (announce = true) => {
    const token = ++renderToken;
    const view = views[viewIndex];
    const pages = currentPages();
    updateChrome(announce);
    spreadEl.classList.toggle("has-empty", view.includes(null));
    if (!pdf) return;
    try {
      const canvases = await Promise.all(view.map((p) => (p ? renderPage(p) : null)));
      if (token !== renderToken) return;            // a newer page turn has started
      view.forEach((p, i) => {
        const slot = slots[i];
        slot.replaceChildren();
        slot.classList.toggle("is-empty", !p);
        if (canvases[i]) {
          const c = canvases[i];
          c.classList.remove("is-in");
          slot.appendChild(c);
          if (!reduceMotion) requestAnimationFrame(() => c.classList.add("is-in"));
          else c.classList.add("is-in");
        }
      });
      if (!spreadMode) slots[1].replaceChildren();
      // quietly prepare the neighbouring views
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
      idle(() => {
        [viewIndex + 1, viewIndex - 1].forEach((i) => views[i]?.forEach((p) => p && renderPage(p).catch(() => {})));
      });
    } catch (err) {
      if (token === renderToken) fail(err);
    }
    return pages;
  };

  /* ---------- Controls, indicator, track ---------- */
  const buildTrack = () => {
    track.replaceChildren();
    views.forEach((view, i) => {
      const pages = view.filter(Boolean);
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "reader__node";
      const label = pages.length > 1 ? `Pages ${pages[0]} to ${pages[1]}` : `Page ${pages[0]}`;
      b.setAttribute("aria-label", `${label}: ${PAGE_TITLES[pages[0]] || ""}`);
      b.addEventListener("click", () => go(i));
      li.appendChild(b);
      track.appendChild(li);
    });
  };

  const updateChrome = (announce) => {
    const pages = currentPages();
    const text = pages.length > 1 ? `Pages ${pad(pages[0])}–${pad(pages[1])}` : `Page ${pad(pages[0])}`;
    pagesLabel.textContent = text;
    const title = pages.map((p) => PAGE_TITLES[p]).filter(Boolean);
    // on a spread, show the shared activity name once
    const shared = title.length > 1 && title[0].split(" · ")[0] === title[1].split(" · ")[0] ? title[0] : title.join(" / ");
    chapterLabel.textContent = shared;
    // a focused button that becomes disabled would drop keyboard focus to the page, so hand it to the pages
    const atStart = viewIndex === 0, atEnd = viewIndex === views.length - 1;
    if ((atStart && document.activeElement === prevBtn) || (atEnd && document.activeElement === nextBtn)) stage.focus({ preventScroll: true });
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
    prevBtn.setAttribute("aria-label", spreadMode ? "Previous pages" : "Previous page");
    nextBtn.setAttribute("aria-label", spreadMode ? "Next pages" : "Next page");
    [...track.children].forEach((li, i) => {
      const b = li.firstChild;
      b.classList.toggle("is-current", i === viewIndex);
      b.classList.toggle("is-past", i < viewIndex);
      if (i === viewIndex) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    track.style.setProperty("--progress", views.length > 1 ? viewIndex / (views.length - 1) : 0);
    progress.style.width = `${((pages[pages.length - 1]) / total) * 100}%`;
    if (announce) live.textContent = `${text.replace("–", " to ")} of ${total}. ${shared}`;
  };

  const go = (i) => {
    const next = Math.max(0, Math.min(views.length - 1, i));
    if (next === viewIndex && slots[0].childElementCount + slots[1].childElementCount > 0) return;
    const dir = next > viewIndex ? 1 : -1;
    viewIndex = next;
    spreadEl.dataset.dir = dir > 0 ? "next" : "prev";
    show();
  };
  const goToPage = (page) => go(viewForPage(page));

  prevBtn.addEventListener("click", () => go(viewIndex - 1));
  nextBtn.addEventListener("click", () => go(viewIndex + 1));

  // keyboard page turning works anywhere in the reader (pages, buttons or track), not only on the pages
  root.addEventListener("keydown", (e) => {
    const keys = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 };
    if (e.key in keys) { e.preventDefault(); go(viewIndex + keys[e.key]); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(views.length - 1); }
  });

  // swipe to turn pages on touch screens
  let startX = null, startY = null;
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { startX = e.clientX; startY = e.clientY; } });
  stage.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) go(viewIndex + (dx < 0 ? 1 : -1));
    startX = startY = null;
  });
  stage.addEventListener("pointercancel", () => { startX = startY = null; });

  // clicking the left or right page turns back or forward (desktop)
  stage.addEventListener("click", (e) => {
    if (e.target.closest("button, a")) return;
    const r = spreadEl.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    go(viewIndex + (e.clientX < r.left + r.width / 2 ? -1 : 1));
  });

  /* ---------- Contents list → open a page in the reader ---------- */
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      goToPage(parseInt(btn.dataset.goto, 10));
      root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      stage.focus({ preventScroll: true });
    });
  });

  /* ---------- Expanded view (works everywhere, including where fullscreen isn't available) ---------- */
  const setExpanded = (on) => {
    expanded = on;
    root.classList.toggle("is-expanded", on);
    document.documentElement.classList.toggle("reader-open", on);
    closeBtn.hidden = !on;
    expandBtns.forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      const label = b.querySelector("[data-reader-expand-label]");
      if (label) label.textContent = on ? "Close expanded view" : "Expand";
    });
    if (on) {
      lastFocus = document.activeElement;
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", "Between Us journal, expanded view");
      closeBtn.focus();
    } else {
      root.removeAttribute("role");
      root.removeAttribute("aria-modal");
      root.removeAttribute("aria-label");
      lastFocus?.focus?.();
    }
    relayout();
  };
  expandBtns.forEach((b) => b.addEventListener("click", () => setExpanded(!expanded)));
  closeBtn.addEventListener("click", () => setExpanded(false));
  document.addEventListener("keydown", (e) => {
    if (!expanded) return;
    if (e.key === "Escape") { e.preventDefault(); setExpanded(false); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (root.contains(document.activeElement)) return;   // the reader handles its own keys
      e.preventDefault();
      go(viewIndex + (e.key === "ArrowLeft" ? -1 : 1));
    }
    if (e.key === "Tab") {
      // keep focus inside the expanded reader
      const focusables = [...root.querySelectorAll("button:not([disabled]):not([hidden]), [tabindex='0']")].filter((el) => el.offsetParent !== null);
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Resize: switch between spreads and single pages, keeping your place ---------- */
  const relayout = () => {
    const page = views.length ? currentPages()[0] : 1;
    const wantSpread = decideMode();
    if (wantSpread !== spreadMode || !views.length) {
      spreadMode = wantSpread;
      buildViews();
      buildTrack();
      viewIndex = viewForPage(page);
    }
    layout();
    show(false);
  };
  let resizeFrame;
  window.addEventListener("resize", () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(relayout); });

  /* ---------- Load ---------- */
  const fail = (err) => {
    console.error("Journal reader:", err);
    root.classList.add("has-error");
    msg.hidden = false;
    msgText.innerHTML = 'The journal couldn’t be displayed here. <a href="' + src + '" target="_blank" rel="noopener">Open the PDF instead</a>.';
  };

  const start = async () => {
    spreadMode = decideMode();
    buildViews();
    buildTrack();
    layout();
    updateChrome(false);
    if (!window.pdfjsLib) { fail(new Error("PDF.js did not load")); return; }
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdf.worker.min.js";
      pdf = await window.pdfjsLib.getDocument({ url: src }).promise;
      total = pdf.numPages;
      const first = await pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      pageAspect = vp.height / vp.width;
      root.querySelector(".reader__total").textContent = `/ ${pad(total)}`;
      relayout();
      await show(false);
      msg.hidden = true;
      root.classList.add("is-ready");
    } catch (err) {
      fail(err);
    }
  };

  // open at a page from the address, e.g. between-us.html#page-10
  const fromHash = () => {
    const m = location.hash.match(/^#page-(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };

  start().then(() => {
    const p = fromHash();
    if (p) { goToPage(p); root.scrollIntoView(); }
  });
  window.addEventListener("hashchange", () => { const p = fromHash(); if (p) goToPage(p); });
})();
