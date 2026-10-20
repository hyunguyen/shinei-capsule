(() => {
  "use strict";

  const CFG = window.CONFIG;
  const COL = CFG.columns;
  const PLACEHOLDER = "assets/cap-placeholder.png";
  const LIST_LIMIT = 7;      // list filter: show all if <= 7 options
  const LIST_COLLAPSED = 5;  // ...otherwise show the first 5
  const CHIP_LIMIT = 12;     // chip filter: show the first 12
  const SEARCH_DELAY = 300;  // ms

  const FILTERS = [
    { key: "product", title: "Product type", label: "Product", kind: "chips" },
    { key: "brand", title: "Brand", label: "Brand", kind: "list", placeholder: "Input brand name" },
    { key: "country", title: "Country", label: "Country", kind: "list", placeholder: "Input country name", flags: true },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid);
    return node;
  };
  const icon = (id, size = 24) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + id);
    svg.append(use);
    return svg;
  };

  // Lowercase + strip diacritics so "dao" matches "Đào", "danh" matches "Đảnh".
  const fold = (s) => String(s || "").toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const byAlpha = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------
  const state = {
    caps: [],
    countryCodes: {},
    q: "",
    filters: { product: "", brand: "", country: "" },
    shown: CFG.pageSize,
  };

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function sheetUrl(sheet) {
    return `https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheet)}`;
  }

  // Turn a Drive share link into a direct image URL; leave other URLs alone.
  function imageUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const m = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    return m ? `https://lh3.googleusercontent.com/d/${m[1]}=w600` : s;
  }

  function rowsToCaps(rows) {
    const headerIdx = rows.findIndex((r) => r.some((c) => c.trim() === COL.id));
    if (headerIdx < 0) throw new Error(`Header "${COL.id}" not found`);
    const header = rows[headerIdx].map((c) => c.trim());
    const idx = {};
    for (const [key, name] of Object.entries(COL)) idx[key] = header.indexOf(name);
    const get = (r, key) => (idx[key] >= 0 ? String(r[idx[key]] ?? "").trim() : "");

    return rows.slice(headerIdx + 1)
      .map((r) => {
        const cap = {};
        for (const key of Object.keys(COL)) cap[key] = get(r, key);
        return cap;
      })
      .filter((c) => c.id || c.brand || c.product)
      .map((c) => ({
        ...c,
        image: imageUrl(c.image),
        _search: fold([c.id, c.product, c.brand, c.country, c.visual, c.text, c.note].join(" ")),
      }))
      .sort((a, b) => (parseFloat(a.id) || 0) - (parseFloat(b.id) || 0));
  }

  function rowsToCountryCodes(rows) {
    const map = {};
    for (const r of rows) {
      for (let i = 1; i < r.length; i++) {
        const code = r[i].trim(), name = r[i - 1].trim();
        if (/^[A-Z]{2}$/.test(code) && name) { map[name] = code; break; }
      }
    }
    return map;
  }

  async function fetchCSV(sheet) {
    const res = await fetch(sheetUrl(sheet));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseCSV(await res.text());
  }

  async function loadData() {
    try {
      const [capRows, countryRows] = await Promise.all([
        fetchCSV(CFG.capSheet),
        fetchCSV(CFG.countrySheet).catch(() => []),
      ]);
      state.caps = rowsToCaps(capRows);
      state.countryCodes = rowsToCountryCodes(countryRows);
    } catch (err) {
      console.warn("Could not load Google Sheet, using snapshot instead.", err);
      const snap = window.SNAPSHOT;
      if (!snap) throw err;
      state.caps = rowsToCaps([snap.header, ...snap.rows]);
      state.countryCodes = { ...snap.countryCodes };
    }
    if (window.SNAPSHOT) {
      for (const [k, v] of Object.entries(window.SNAPSHOT.countryCodes)) state.countryCodes[k] ??= v;
    }
  }

  // ------------------------------------------------------------------
  // Filtering
  // ------------------------------------------------------------------
  function matches(cap, q, filters) {
    for (const f of FILTERS) {
      if (filters[f.key] && cap[f.key] !== filters[f.key]) return false;
    }
    if (!q) return true;
    return fold(q).split(/\s+/).filter(Boolean).every((w) => cap._search.includes(w));
  }
  const results = (q = state.q, filters = state.filters) => state.caps.filter((c) => matches(c, q, filters));
  const hasFilter = (filters) => FILTERS.some((f) => filters[f.key]);

  // Options for one filter, sorted by number of caps then alphabet.
  function optionsFor(key) {
    const counts = new Map();
    for (const c of state.caps) if (c[key]) counts.set(c[key], (counts.get(c[key]) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || byAlpha(a[0], b[0])).map(([v]) => v);
  }

  // ------------------------------------------------------------------
  // URL state (so a filtered view can be shared)
  // ------------------------------------------------------------------
  function readURL() {
    const p = new URLSearchParams(location.search);
    state.q = p.get("q") || "";
    for (const f of FILTERS) state.filters[f.key] = p.get(f.key) || "";
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    for (const f of FILTERS) if (state.filters[f.key]) p.set(f.key, state.filters[f.key]);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  // ------------------------------------------------------------------
  // Rendering — listing
  // ------------------------------------------------------------------
  const grid = $("#results");
  const moreBtn = $("#more");
  const endNote = $("#end-note");

  function tagInfo(cap) {
    return el("div", { class: "cap__info" },
      el("div", { class: "tag-head" },
        el("div", { class: "tag-head__label", text: cap.product || "Unknown" }),
        el("div", { class: "tag-head__edge" })),
      el("div", { class: "tag-body" },
        el("div", { class: "tag-row" },
          el("div", { class: "tag-row__k", text: "BRAND" }),
          el("div", { class: "tag-row__v", text: cap.brand || "—" })),
        el("div", { class: "tag-row" },
          el("div", { class: "tag-row__k", text: "COUNTRY" }),
          el("div", { class: "tag-row__v", text: cap.country || "—" }))));
  }

  function capImg(cap, alt) {
    const img = el("img", { src: cap.image || PLACEHOLDER, alt, loading: "lazy", decoding: "async" });
    img.addEventListener("error", () => { if (!img.src.endsWith(PLACEHOLDER)) img.src = PLACEHOLDER; }, { once: true });
    return img;
  }

  function capCard(cap) {
    const label = [cap.brand, cap.product, cap.country].filter(Boolean).join(", ");
    return el("button", { class: "cap", type: "button", "aria-label": `Cap ${cap.id}: ${label}`, onclick: () => openDetail(cap) },
      el("div", { class: "cap__img" }, capImg(cap, "")),
      tagInfo(cap));
  }

  function skeleton(n) {
    grid.classList.remove("is-empty");
    grid.replaceChildren(el("div", { class: "results__grid" }, Array.from({ length: n }, () =>
      el("div", { class: "cap cap--loading", "aria-hidden": "true" },
        el("div", { class: "cap__img" }, el("div")),
        el("div", { class: "cap__info" },
          el("div", { class: "tag-head" }, el("div", { class: "tag-head__label" }), el("div", { class: "tag-head__edge" })),
          el("div", { class: "tag-body" }, el("div", { class: "skeleton-line" }), el("div", { class: "skeleton-line" })))))));
  }

  function renderList() {
    const list = results();
    const visible = list.slice(0, state.shown);

    if (!list.length) {
      grid.classList.add("is-empty");
      grid.replaceChildren(el("div", { class: "empty" },
        el("img", { src: "assets/cap-not-found.png", alt: "" }),
        el("p", { class: "empty__title", text: "No cap found" }),
        el("p", { class: "empty__text", text: "Try different keyword or remove some of your filter selection (if any)" })));
    } else {
      grid.classList.remove("is-empty");
      grid.replaceChildren(el("div", { class: "results__grid" }, visible.map(capCard)));
    }
    moreBtn.hidden = visible.length >= list.length;
    endNote.hidden = !list.length || visible.length < list.length || list.length <= CFG.pageSize;
  }

  function renderApplied() {
    const box = $("#applied");
    const chips = FILTERS.filter((f) => state.filters[f.key]).map((f) =>
      el("button", {
        class: "input-chip", type: "button", "aria-label": `Remove ${f.label} filter`,
        onclick: () => { state.filters[f.key] = ""; update(); },
      }, el("span", { text: `${f.label}: ${state.filters[f.key]}` }), icon("i-x")));
    box.replaceChildren(...chips);
    box.hidden = !chips.length;
    $("#filter-open").classList.toggle("is-active", chips.length > 0);
  }

  function update({ resetPage = true } = {}) {
    if (resetPage) state.shown = CFG.pageSize;
    renderApplied();
    renderList();
    writeURL();
  }

  function renderStats() {
    const fmt = (n) => n.toLocaleString("de-DE");
    const since = new Date(CFG.collectingSince);
    const days = Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000));
    const countries = new Set(state.caps.map((c) => c.country).filter((c) => c && !/^multiple/i.test(c)));
    $("#stat-days").textContent = isNaN(days) ? "–" : fmt(days);
    $("#stat-caps").textContent = fmt(state.caps.length);
    $("#stat-countries").textContent = fmt(countries.size);
  }

  // ------------------------------------------------------------------
  // Modals
  // ------------------------------------------------------------------
  // Overlays animate in via the .is-open class and stay rendered until the
  // exit transition has finished; keep CLOSE_MS in sync with styles.css.
  const CLOSE_MS = 220;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const m = $("#" + id);
    clearTimeout(m._hideTimer);
    m.hidden = false;
    void m.offsetWidth;  // commit the closed state so the transition runs
    m.classList.add("is-open");
    document.body.classList.add("is-locked");
    const focusable = m.querySelector("[data-close], button, input");
    focusable && focusable.focus({ preventScroll: true });
  }
  function closeModal(id) {
    const m = $("#" + id);
    if (!m.classList.contains("is-open")) return;
    m.classList.remove("is-open");
    m._hideTimer = setTimeout(() => { m.hidden = true; }, reducedMotion.matches ? 0 : CLOSE_MS);
    if (!document.querySelector(".overlay.is-open")) document.body.classList.remove("is-locked");
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  document.querySelectorAll(".overlay").forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-close]")) closeModal(ov.id);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = [...document.querySelectorAll(".overlay.is-open")].pop();
    if (open) closeModal(open.id);
  });

  // Cap detail
  function openDetail(cap) {
    const rows = [["ID", cap.id], ["PRODUCT", cap.product], ["BRAND", cap.brand], ["COUNTRY", cap.country],
      ["TEXT", cap.text], ["VISUAL", cap.visual], ["NOTE", cap.note]];
    $("#detail-card").replaceChildren(el("div", { class: "dtable" },
      el("div", { class: "dtable__head" },
        el("h2", { class: "dtable__title", id: "detail-title", text: "Cap detail" }),
        el("div", { class: "dtable__logo" }, el("img", { src: "assets/logo.png", alt: "" }))),
      el("div", { class: "dtable__body" },
        el("div", { class: "dtable__img" }, capImg(cap, `Cap ${cap.id}`)),
        el("div", { class: "dtable__rows" }, rows.map(([k, v]) =>
          el("div", { class: "drow" },
            el("div", { class: "drow__k", text: k }),
            el("div", { class: "drow__v", text: v || "—" })))))));
    openModal("detail");
    $("#detail .detail").scrollTop = 0;
  }

  // ------------------------------------------------------------------
  // Filter sheet
  // ------------------------------------------------------------------
  const sheet = {
    draft: {},
    expanded: {},
    query: {},
  };

  function flagStyle(country) {
    const code = state.countryCodes[country];
    return code ? `background-image:url("https://flagcdn.com/w80/${code.toLowerCase()}.png")` : null;
  }

  function moreLink(key, open) {
    return el("button", {
      class: "more-link" + (open ? " is-open" : ""), type: "button", "aria-expanded": String(open),
      onclick: () => { sheet.expanded[key] = !open; renderSection(key); },
    }, el("span", { text: open ? "View less" : "View more" }), icon("i-chevron"));
  }

  function toggleDraft(key, value) {
    sheet.draft[key] = sheet.draft[key] === value ? "" : value;  // single selection; tap again to unselect
    renderSection(key);
    renderApplyButton();
  }

  function sectionContent(f) {
    const all = optionsFor(f.key);
    const selected = sheet.draft[f.key];
    const open = !!sheet.expanded[f.key];

    if (f.kind === "chips") {
      const items = all.length > CHIP_LIMIT && !open ? all.slice(0, CHIP_LIMIT) : all;
      const chips = el("div", { class: "chips" }, items.map((v) =>
        el("button", { class: "chip", type: "button", "aria-pressed": String(v === selected), onclick: () => toggleDraft(f.key, v) },
          v === selected ? icon("i-check") : null, el("span", { text: v }))));
      return [chips, all.length > CHIP_LIMIT ? moreLink(f.key, open) : null];
    }

    const q = sheet.query[f.key] || "";
    let items, showMore = false;
    if (q) {
      const fq = fold(q);
      items = all.filter((v) => fold(v).includes(fq)).sort(byAlpha);
    } else if (all.length > LIST_LIMIT) {
      items = open ? all : all.slice(0, LIST_COLLAPSED);
      showMore = true;
    } else items = all;
    // keep the selected option visible even when collapsed
    if (selected && !q && !items.includes(selected)) items = [selected, ...items];

    const opts = el("div", { class: "opts", role: "radiogroup", "aria-label": f.title },
      items.length ? items.map((v) =>
        el("button", { class: "opt", type: "button", role: "radio", "aria-checked": String(v === selected), onclick: () => toggleDraft(f.key, v) },
          f.flags ? el("span", { class: "opt__flag", style: flagStyle(v), "aria-hidden": "true" }) : null,
          el("span", { class: "opt__label", text: v }),
          el("span", { class: "radio", "aria-hidden": "true" })))
        : el("div", { class: "opt__empty", text: "No option found" }));
    return [opts, showMore ? moreLink(f.key, open) : null];
  }

  function searchField(f) {
    const input = el("input", { type: "search", placeholder: f.placeholder, autocomplete: "off", "aria-label": f.placeholder, value: sheet.query[f.key] || "" });
    const clear = el("button", { class: "field__clear", type: "button", "aria-label": "Clear", hidden: !sheet.query[f.key] }, icon("i-x"));
    let timer;
    const apply = () => { sheet.query[f.key] = input.value.trim(); renderSection(f.key); clear.hidden = !input.value; };
    input.addEventListener("input", () => { clear.hidden = !input.value; clearTimeout(timer); timer = setTimeout(apply, SEARCH_DELAY); });
    // Leaving the input returns the initial list (per spec). Delay so a click on a result still lands.
    input.addEventListener("blur", () => setTimeout(() => {
      if (document.activeElement === input) return;
      clearTimeout(timer);
      if (sheet.query[f.key] || input.value) { input.value = ""; sheet.query[f.key] = ""; clear.hidden = true; renderSection(f.key); }
    }, 200));
    clear.addEventListener("mousedown", (e) => e.preventDefault());
    clear.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
    return el("label", { class: "field" }, (() => { const s = icon("i-search"); s.classList.add("field__icon"); return s; })(), input, clear);
  }

  function renderSection(key) {
    const f = FILTERS.find((x) => x.key === key);
    const content = $(`#fsec-${key} .fsec__content`);
    // Keep the search field node in place: detaching it would blur the input.
    for (const child of [...content.children]) if (!child.classList.contains("field")) child.remove();
    content.append(...sectionContent(f).filter(Boolean));
  }

  function renderSheet() {
    $("#filter-body").replaceChildren(...FILTERS.map((f) =>
      el("section", { class: "fsec", id: `fsec-${f.key}` },
        el("h3", { class: "fsec__title", text: f.title }),
        el("div", { class: "fsec__content" }, f.kind === "list" ? searchField(f) : null, sectionContent(f)))));
    renderApplyButton();
  }

  function renderApplyButton() {
    const btn = $("#filter-apply");
    if (!hasFilter(sheet.draft)) { btn.textContent = "View result"; btn.disabled = false; return; }
    const n = results(state.q, sheet.draft).length;
    btn.textContent = n ? `View ${n.toLocaleString("de-DE")} result${n > 1 ? "s" : ""}` : "No result";
    btn.disabled = n === 0;
  }

  $("#filter-open").addEventListener("click", () => {
    sheet.draft = { ...state.filters };
    sheet.expanded = {};
    sheet.query = {};
    renderSheet();
    openModal("filter");
    $("#filter-body").scrollTop = 0;
  });
  $("#filter-reset").addEventListener("click", () => {
    for (const f of FILTERS) sheet.draft[f.key] = "";
    sheet.query = {};
    renderSheet();
  });
  $("#filter-apply").addEventListener("click", () => {
    state.filters = { ...sheet.draft };
    closeModal("filter");
    update();
  });

  // ------------------------------------------------------------------
  // Search bar, nav, footer
  // ------------------------------------------------------------------
  const qInput = $("#q");
  const qClear = $("#q-clear");
  let qTimer;
  qInput.addEventListener("input", () => {
    qClear.hidden = !qInput.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = qInput.value.trim(); update(); }, SEARCH_DELAY);
  });
  qInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { clearTimeout(qTimer); state.q = qInput.value.trim(); update(); qInput.blur(); }
  });
  qClear.addEventListener("click", () => {
    qInput.value = ""; qClear.hidden = true; state.q = ""; update(); qInput.focus();
  });

  moreBtn.addEventListener("click", () => {
    state.shown += CFG.pageSize;
    renderList();
  });

  $("#menu-open").addEventListener("click", () => openModal("menu"));
  $("#menu").addEventListener("click", (e) => { if (e.target.closest("a")) closeModal("menu"); });

  for (const id of ["nav-story", "menu-story"]) $("#" + id).href = CFG.nav.myStory;
  for (const id of ["nav-contact", "menu-contact"]) $("#" + id).href = CFG.nav.contact;
  const email = $("#c-email");
  email.href = `mailto:${CFG.contact.email}`;
  email.textContent = CFG.contact.email;
  $("#c-linkedin").href = CFG.contact.linkedin;
  $("#c-behance").href = CFG.contact.behance;
  $("#footer-text").textContent = CFG.footerText;

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  // iOS Safari only applies :active while touching if a touch listener exists.
  document.addEventListener("touchstart", () => {}, { passive: true });

  readURL();
  qInput.value = state.q;
  qClear.hidden = !state.q;
  skeleton(CFG.pageSize);
  loadData()
    .then(() => {
      // drop filter values from the URL that no longer exist in the data
      for (const f of FILTERS) if (state.filters[f.key] && !state.caps.some((c) => c[f.key] === state.filters[f.key])) state.filters[f.key] = "";
      renderStats();
      update();
    })
    .catch((err) => {
      console.error(err);
      grid.classList.add("is-empty");
      grid.replaceChildren(el("div", { class: "empty" },
        el("img", { src: "assets/cap-not-found.png", alt: "" }),
        el("p", { class: "empty__title", text: "Could not load the collection" }),
        el("p", { class: "empty__text", text: "Please refresh the page in a moment." })));
    });
})();
