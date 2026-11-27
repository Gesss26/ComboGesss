/* ComboGesss — Home (Conto con Password, Palinsesto, Schedina, Impostazioni) */
(function () {
  "use strict";

  const VIEWS = ["home", "palinsesto", "conto", "impostazioni"];
  const SKEY = "combogesss_settings";
  const KEYS = ["combogesss_conto", "combogesss_schedine", "combogesss_schedina_defaults", SKEY];
  let current = "home";
  let contoUnlocked = false;

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function loadSet() { try { return JSON.parse(localStorage.getItem(SKEY) || "{}") || {}; } catch (_) { return {}; } }
  function saveSet(o) { try { localStorage.setItem(SKEY, JSON.stringify(o)); } catch (_) {} }
  function savedCount() { try { return (JSON.parse(localStorage.getItem("combogesss_schedine") || "[]") || []).length; } catch (_) { return 0; } }
  const DEFAULT_PIN = "Gesss";
  function getContoPin() { return String(loadSet().contoPin || DEFAULT_PIN).trim(); }

  const css = document.createElement("style");
  css.textContent = `
    body:not(.cg-v-palinsesto) > header, body:not(.cg-v-palinsesto) > main { display: none !important; }
    .cg-page { display: none; position: relative; z-index: 2; width: 100%; min-height: 100vh; padding: 16px; box-sizing: border-box; color: #e6f4ff; font-family: "Exo 2", system-ui, sans-serif; }
    body.cg-v-home #cg-home, body.cg-v-conto #cg-conto, body.cg-v-impostazioni #cg-imp { display: block; }
    .cg-wrap { max-width: 880px; margin: 0 auto; }
    .cg-hero { text-align: center; padding: 18px 0 20px; }
    .cg-hero h1 { font-family: Orbitron, sans-serif; font-size:calc(28px * var(--cg-fs,1)); letter-spacing: .08em; margin: 6px 0 2px; text-shadow: 0 0 14px rgba(34,211,238,.55); }
    .cg-hero p { margin: 0; color: #86b3d8; font-size:calc(13px * var(--cg-fs,1)); }
    #cg-h-status { margin-top: 8px; font-size:calc(11px * var(--cg-fs,1)); color: #67e8f9; min-height: 14px; }
    .cg-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .cg-tile { --c: #22d3ee; position: relative; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end; gap: 4px; min-height: 160px; padding: 16px; text-align: left; cursor: pointer; color: #e6f4ff; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); background: linear-gradient(160deg, color-mix(in srgb, var(--c) 18%, #061634), #031b30 75%); box-shadow: 0 0 22px color-mix(in srgb, var(--c) 18%, transparent); transition: transform .15s, box-shadow .15s; font-family: inherit; }
    .cg-tile:hover { transform: translateY(-3px); box-shadow: 0 0 30px color-mix(in srgb, var(--c) 40%, transparent); }
    .cg-ico { font-size:calc(38px * var(--cg-fs,1)); line-height: 1; margin-bottom: auto; filter: drop-shadow(0 0 8px var(--c)); }
    .cg-t { font-family: Orbitron, sans-serif; font-size:calc(17px * var(--cg-fs,1)); font-weight: 800; letter-spacing: .05em; color: var(--c); }
    .cg-s { font-size:calc(12px * var(--cg-fs,1)); color: #b4d6f2; }
    .cg-foot { text-align: center; margin-top: 22px; font-size:calc(11px * var(--cg-fs,1)); color: #5a7fa3; }
    .cg-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .cg-bar h2 { margin: 0; font-family: Orbitron, sans-serif; font-size:calc(18px * var(--cg-fs,1)); letter-spacing: .05em; text-shadow: 0 0 10px rgba(34,211,238,.4); }
    .cg-btn { padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(56,189,248,.35); background: rgba(10,38,74,.8); color: #e6f4ff; font-size:calc(12px * var(--cg-fs,1)); font-weight: 700; cursor: pointer; font-family: inherit; }
    .cg-btn:hover { border-color: #22d3ee; }
    .cg-primary { background: linear-gradient(135deg, #0891b2, #2563eb); color: #fff; box-shadow: 0 0 16px rgba(34,211,238,.3); }
    .cg-danger { border-color: rgba(239,68,68,.5); color: #fca5a5; }
    .cg-card { background: rgba(7,26,54,.72); border: 1px solid rgba(56,189,248,.24); border-radius: 14px; padding: 14px; margin-bottom: 14px; }
    .cg-set { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 10px; }
    .cg-set label { display: flex; flex-direction: column; gap: 4px; font-size:calc(10px * var(--cg-fs,1)); text-transform: uppercase; letter-spacing: .06em; color: #86b3d8; }
    .cg-set input[type=text], .cg-set input[type=password], .cg-set input[type=number], .cg-set select { background: rgba(2,12,30,.8); color: #e6f4ff; border: 1px solid rgba(56,189,248,.3); border-radius: 8px; padding: 7px 8px; font-size:calc(13px * var(--cg-fs,1)); font-family: inherit; text-transform: none; letter-spacing: 0; }
    .cg-set .cg-chk { flex-direction: row; align-items: center; gap: 8px; text-transform: none; letter-spacing: 0; font-size:calc(13px * var(--cg-fs,1)); color: #e6f4ff; }
    .cg-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .cg-hint { font-size:calc(11px * var(--cg-fs,1)); color: #86b3d8; margin-top: 8px; }
    .cg-lockbox { max-width: 380px; margin: 40px auto; text-align: center; padding: 24px 18px; }
    .cg-lockbox input { width: 100%; box-sizing: border-box; text-align: center; font-size: 18px; letter-spacing: .15em; margin: 12px 0; padding: 10px; border-radius: 10px; border: 1px solid rgba(56,189,248,.4); background: rgba(2,12,30,.9); color: #fff; }
    .cg-lock-err { color: #f87171; font-size: 12px; min-height: 18px; margin-bottom: 8px; }
    body.cg-reduce *, body.cg-reduce *::before, body.cg-reduce *::after { animation: none !important; transition: none !important; }
    body.cg-reduce #techBgLayer { display: none; }
    @media (max-width: 520px) { .cg-tile { min-height: 140px; padding: 13px; } .cg-hero h1 { font-size:calc(22px * var(--cg-fs,1)); } }
  `;
  document.head.appendChild(css);

  const TILES = [
    { go: "conto", ico: "💰", t: "Conto", c: "#34d399", sid: "cg-s-conto" },
    { go: "palinsesto", ico: "📅", t: "Palinsesto", c: "#22d3ee", sid: "cg-s-pal" },
    { go: "schedina", ico: "🎟️", t: "Schedina", c: "#fbbf24", sid: "cg-s-sch" },
    { go: "impostazioni", ico: "⚙️", t: "Impostazioni", c: "#a78bfa", sid: "cg-s-imp" }
  ];

  function build() {
    const mk = (id, html) => { const d = document.createElement("section"); d.id = id; d.className = "cg-page"; d.innerHTML = html; document.body.appendChild(d); return d; };
    mk("cg-home", `<div class="cg-wrap"><div class="cg-hero"><div style="font-size:calc(44px * var(--cg-fs,1))">⚽</div><h1>ComboGesss</h1><p>Statistiche calcio europee 2026/27</p><div id="cg-h-status"></div></div><div class="cg-grid">${TILES.map(x => `<button class="cg-tile" style="--c:${x.c}" data-go="${x.go}"><span class="cg-ico">${x.ico}</span><span class="cg-t">${x.t}</span><span class="cg-s" id="${x.sid}">…</span></button>`).join("")}</div><div class="cg-foot" id="cg-h-foot"></div></div>`);
    mk("cg-conto", `<div class="cg-wrap"><div class="cg-bar"><button class="cg-btn" data-go="home">← Home</button><h2>💰 Conto</h2><button id="cg-lock-now" class="cg-btn" style="margin-left:auto;display:none" type="button">🔒 Blocca</button></div><div id="cg-conto-body"></div></div>`);
    mk("cg-imp", `<div class="cg-wrap"><div class="cg-bar"><button class="cg-btn" data-go="home">← Home</button><h2>⚙️ Impostazioni</h2></div><div id="cg-imp-body"></div></div>`);
    document.addEventListener("click", ev => { const t = ev.target.closest("[data-go]"); if (t) nav(t.dataset.go); });
    $("#cg-lock-now").addEventListener("click", () => { contoUnlocked = false; renderContoProtected(); });
  }

  function renderContoProtected() {
    const pin = getContoPin();
    const lockBtn = $("#cg-lock-now");
    if (lockBtn) lockBtn.style.display = contoUnlocked ? "inline-block" : "none";

    if (contoUnlocked) {
      if (window.CGConto) window.CGConto.render($("#cg-conto-body"));
      return;
    }

    $("#cg-conto-body").innerHTML = `
      <div class="cg-card cg-lockbox">
        <div style="font-size:38px">🔒</div>
        <h3 style="margin:8px 0 4px;font-family:Orbitron,sans-serif">Area Conto Protetta</h3>
        <div class="cg-hint">Inserisci la password per visualizzare saldo e movimenti.</div>
        <input id="cg-pin-in" type="password" placeholder="Password / PIN" autocomplete="current-password">
        <div id="cg-pin-err" class="cg-lock-err"></div>
        <button id="cg-pin-go" class="cg-btn cg-primary" style="width:100%" type="button">🔓 Sblocca Conto</button>
      </div>`;

    const check = () => {
      const val = ($("#cg-pin-in").value || "").trim();
      if (val === pin) {
        contoUnlocked = true;
        renderContoProtected();
      } else {
        $("#cg-pin-err").textContent = "Password errata. Riprova.";
        $("#cg-pin-in").value = "";
        $("#cg-pin-in").focus();
      }
    };
    $("#cg-pin-go").addEventListener("click", check);
    $("#cg-pin-in").addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    setTimeout(() => { const inp = $("#cg-pin-in"); if (inp) inp.focus(); }, 50);
  }
  function go(v) {
    if (v === "schedina") { if (window.CGSchedina) window.CGSchedina.open(); return; }
    if (!VIEWS.includes(v)) v = "home";
    VIEWS.forEach(x => document.body.classList.remove("cg-v-" + x));
    document.body.classList.add("cg-v-" + v);
    current = v;
    if (v === "home") refreshHome();
    else if (v === "palinsesto") mountHeaderButton();
    else if (v === "conto") renderContoProtected();
    else if (v === "impostazioni") renderSettings();
    window.scrollTo(0, 0);
  }
  function nav(v) { if (v === "schedina") return go(v); if (location.hash === "#" + v) go(v); else location.hash = "#" + v; }

  function todayStr() {
    if (typeof getTodayStr === "function") return getTodayStr();
    const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  function refreshHome() {
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
    const pin = getContoPin();
    if (!contoUnlocked) {
      set("cg-s-conto", "🔒 Protetto da password");
    } else if (window.CGConto) {
      const s = window.CGConto.getSummary(), f = window.CGConto.fmt;
      set("cg-s-conto", `Saldo ${f(s.balance)} · P/L ${f(s.pl, true)}`);
    }
    let pal = "Caricamento dati…";
    try {
      const rbl = state.roundsByLeague || {}, keys = Object.keys(rbl);
      if (keys.length) {
        const td = todayStr(); let n = 0;
        keys.forEach(k => (rbl[k] || []).forEach(r => (r.matches || []).forEach(m => { if (m.date === td) n++; })));
        pal = n ? `${n} partite oggi · ${keys.length} campionati` : `Nessuna partita oggi · ${keys.length} campionati`;
      }
    } catch (_) {}
    set("cg-s-pal", pal);
    const d = window.CGSchedina ? window.CGSchedina.getDefaults() : { target: 3 };
    set("cg-s-sch", `Genera a quota ${d.target} · ${savedCount()} salvate`);
    set("cg-s-imp", "Preferenze, sicurezza e dati");
    const st = document.getElementById("dataStatusText"); set("cg-h-status", st ? st.textContent.trim().slice(0, 90) : "");
    const v = document.getElementById("appVersion"); set("cg-h-foot", v ? v.textContent : "");
  }

  function sel(id, opts, cur) { return `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`).join("")}</select>`; }

  function renderSettings() {
    const S = loadSet(), pin = getContoPin();
    const O = window.CGSchedina ? window.CGSchedina.OPTS : null, D = window.CGSchedina ? window.CGSchedina.getDefaults() : null;
    const sched = O ? `<div class="cg-card"><h3>🎟️ Schedina — valori predefiniti</h3><div class="cg-set"><label>Quota target<input id="sd-target" type="number" step="0.1" min="1.2" value="${D.target}"></label><label>Tolleranza${sel("sd-tol", O.tol, D.tol)}</label><label>Eventi min${sel("sd-minLegs", O.min, D.minLegs)}</label><label>Eventi max${sel("sd-maxLegs", O.max, D.maxLegs)}</label><label>Modalità${sel("sd-mode", O.mode, D.mode)}</label><label>Fonte stime${sel("sd-source", O.source, D.source)}</label><label>Ambito${sel("sd-scope", O.scope, D.scope)}</label><label>Prob. minima${sel("sd-minPct", O.pct, D.minPct)}</label><label class="cg-chk"><input id="sd-includeFair" type="checkbox" ${D.includeFair ? "checked" : ""}> Includi quote equa</label></div><div class="cg-row"><button class="cg-btn" data-set="resetdef">↺ Ripristina valori di fabbrica</button></div><div class="cg-hint">Si salvano da soli e vengono usati ogni volta che apri il generatore.</div></div>` : "";

    $("#cg-imp-body").innerHTML = `
      <div class="cg-card"><h3>🔒 Sicurezza Conto</h3>
        <div class="cg-set">
          <label>Nuova password Conto<input id="sec-pin" type="password" placeholder="Inserisci password o PIN"></label>
          <label>Conferma password<input id="sec-pin2" type="password" placeholder="Ripeti password"></label>
        </div>
        <div class="cg-row">
          <button class="cg-btn cg-primary" data-set="save-pin">💾 Salva password</button>
          <button class="cg-btn cg-danger" data-set="del-pin">↺ Ripristina password predefinita</button>
        </div>
        <div class="cg-hint">Password attiva: il Conto richiede lo sblocco all'apertura.</div>
      </div>
      <div class="cg-card"><h3>🧭 Generale</h3><div class="cg-set"><label>Schermata di avvio${sel("st-start", [["home", "🏠 Home"], ["palinsesto", "📅 Palinsesto"]], S.startView || "home")}</label><label>Simbolo valuta${sel("st-cur", [["€", "€ Euro"], ["$", "$ Dollaro"], ["£", "£ Sterlina"], ["CHF", "CHF Franco"]], S.currency || "€")}</label><label class="cg-chk"><input id="st-motion" type="checkbox" ${S.reduceMotion ? "checked" : ""}> Riduci animazioni (telefoni lenti)</label></div></div>
      ${window.cgAppearance ? window.cgAppearance.html() : ""}
      ${sched}
      <div class="cg-card"><h3>💾 Dati e backup</h3><div class="cg-row"><button class="cg-btn cg-primary" data-set="export">⬇️ Esporta backup (JSON)</button><button class="cg-btn" data-set="import">⬆️ Importa backup</button><input id="st-file" type="file" accept="application/json,.json" style="display:none"></div><div class="cg-row"><button class="cg-btn cg-danger" data-set="wipe-conto">🗑️ Cancella Conto</button><button class="cg-btn cg-danger" data-set="wipe-sched">🗑️ Cancella schedine salvate</button><button class="cg-btn cg-danger" data-set="wipe-all">⚠️ Cancella tutto</button></div><div class="cg-hint">I dati restano solo su questo dispositivo (localStorage). Esporta un backup prima di cambiare telefono o browser.</div></div>
      <div class="cg-card"><h3>ℹ️ App</h3><div class="cg-hint" style="margin-top:0">${esc((document.getElementById("appVersion") || {}).textContent || "")} · ${esc(((document.getElementById("dataStatusText") || {}).textContent || "").trim().slice(0, 120))}</div><div class="cg-row"><button class="cg-btn" data-set="refresh">🔄 Aggiorna app (svuota cache)</button></div></div>`;
    if (window.cgAppearance) window.cgAppearance.bind($("#cg-imp-body"));
  }

  function applyGeneral() { document.body.classList.toggle("cg-reduce", !!loadSet().reduceMotion); }

  function onSettingsChange(ev) {
    const id = ev.target.id || "";
    if (id.startsWith("st-")) {
      const S = loadSet();
      if (id === "st-start") S.startView = ev.target.value;
      else if (id === "st-cur") S.currency = ev.target.value;
      else if (id === "st-motion") S.reduceMotion = ev.target.checked;
      else if (id === "st-file") return importFile(ev.target.files.item(0));
      saveSet(S); applyGeneral();
    } else if (id.startsWith("sd-") && window.CGSchedina) {
      const k = id.slice(3), el = ev.target;
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (["target", "tol", "minLegs", "maxLegs", "minPct"].includes(k)) v = parseFloat(String(v).replace(",", "."));
      if (k === "target" && !(v >= 1.2)) return;
      const d = {}; d[k] = v; window.CGSchedina.setDefaults(d);
      if (k === "minLegs" || k === "maxLegs") renderSettings();
    }
  }

  function download(name, text) {
    const u = URL.createObjectURL(new Blob([text], { type: "application/json" })), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1500);
  }
  function importFile(f) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result);
        if (!o || o.app !== "combogesss" || typeof o.data !== "object") throw new Error("File non valido");
        if (!confirm("Importare il backup? I dati attuali verranno sostituiti.")) return;
        KEYS.forEach(k => { if (o.data[k] !== undefined) localStorage.setItem(k, JSON.stringify(o.data[k])); });
        alert("Backup importato. L'app si ricarica."); location.reload();
      } catch (e) { alert("Impossibile importare: " + e.message); }
    };
    r.readAsText(f);
  }

  function onSettingsClick(ev) {
    const t = ev.target.closest("[data-set]");
    if (!t) return;
    const a = t.dataset.set;
    if (a === "save-pin") {
      const p1 = ($("#sec-pin").value || "").trim();
      const p2 = ($("#sec-pin2").value || "").trim();
      if (!p1) { alert("Inserisci una password valida."); return; }
      if (p1 !== p2) { alert("Le due password non coincidono."); return; }
      const S = loadSet(); S.contoPin = p1; saveSet(S);
      contoUnlocked = false;
      alert("Password salvata! Il Conto ora è protetto.");
      renderSettings();
    }
    else if (a === "del-pin") {
      const check = prompt("Inserisci la password attuale per ripristinare quella predefinita:", "");
      if (check !== getContoPin()) { alert("Password errata."); return; }
      const S = loadSet(); delete S.contoPin; saveSet(S);
      contoUnlocked = false;
      alert("Password predefinita ripristinata.");
      renderSettings();
    }
    else if (a === "export") {
      const data = {}; KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) data[k] = JSON.parse(v); } catch (_) {} });
      download(`combogesss-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "combogesss", version: 1, exportedAt: Date.now(), data }, null, 2));
    }
    else if (a === "import") $("#st-file").click();
    else if (a === "resetdef") { if (window.CGSchedina) window.CGSchedina.resetDefaults(); renderSettings(); }
    else if (a === "wipe-conto") { if (confirm("Cancellare TUTTE le voci del Conto?")) { localStorage.removeItem("combogesss_conto"); alert("Conto cancellato."); } }
    else if (a === "wipe-sched") { if (confirm("Cancellare tutte le schedine salvate?")) { localStorage.removeItem("combogesss_schedine"); alert("Schedine cancellate."); } }
    else if (a === "wipe-all") {
      if (confirm("Cancellare TUTTI i dati (Conto, schedine, impostazioni)?")) {
        KEYS.forEach(k => localStorage.removeItem(k));
        alert("Dati cancellati. L'app si ricarica."); location.reload();
      }
    }
    else if (a === "refresh") {
      const done = () => location.reload();
      try {
        const jobs = [];
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) jobs.push(navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))));
        if (window.caches && caches.keys) jobs.push(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))));
        Promise.all(jobs).then(done, done);
      } catch (_) { done(); }
    }
  }

  function mountHeaderButton() {
    if (document.getElementById("cg-home-btn")) return;
    const b = document.createElement("button");
    b.id = "cg-home-btn"; b.type = "button"; b.className = "cg-btn"; b.dataset.go = "home";
    b.textContent = "🏠 Home";
    b.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:50;box-shadow:0 0 14px rgba(34,211,238,.3)";
    document.body.appendChild(b);
  }

  function init() {
    build();
    applyGeneral();
    const imp = $("#cg-imp");
    imp.addEventListener("click", onSettingsClick);
    imp.addEventListener("change", onSettingsChange);
    window.addEventListener("hashchange", () => go(location.hash.replace("#", "")));
    const h = location.hash.replace("#", "");
    go(VIEWS.includes(h) ? h : (loadSet().startView || "home"));
    setInterval(() => { if (current === "home") refreshHome(); }, 2000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
