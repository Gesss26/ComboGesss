/* ComboGesss — Generatore di schedine con quota target + storico con esito automatico */
(function () {
  "use strict";

  const LS_KEY = "combogesss_schedine";
  const ST = {
    target: 3, tol: 0.15, minLegs: 2, maxLegs: 4,
    mode: "sicura", source: "media", scope: "7d", minPct: 60, includeFair: true,
    locked: {}, all: [], page: 0, tab: "gen", saved: {}
  };

  const OPTS = {
    tol: [[0.1, "± 0,10"], [0.15, "± 0,15"], [0.25, "± 0,25"], [0.4, "± 0,40"]],
    min: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
    max: [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]],
    mode: [["sicura", "🛡️ Sicura (più probabile)"], ["value", "💎 Value (quote reali)"], ["random", "🎲 Sorprendi"]],
    source: [["media", "Media Reali + Dixon-Cole"], ["real", "Solo Reali"], ["dixon", "Solo Dixon-Cole"]],
    scope: [["1d", "Solo oggi"], ["3d", "Prossimi 3 giorni"], ["7d", "Prossimi 7 giorni"], ["league", "Campionato selezionato"]],
    pct: [[50, "50%"], [60, "60%"], [70, "70%"], [80, "80%"]]
  };
  const DEF_KEY = "combogesss_schedina_defaults";
  const DEF_FIELDS = ["target", "tol", "minLegs", "maxLegs", "mode", "source", "scope", "minPct", "includeFair"];
  const DEF_FACTORY = { target: 3, tol: 0.15, minLegs: 2, maxLegs: 4, mode: "sicura", source: "media", scope: "7d", minPct: 60, includeFair: true };
  try {
    const d = JSON.parse(localStorage.getItem(DEF_KEY) || "null");
    if (d) DEF_FIELDS.forEach(k => { if (d[k] !== undefined) ST[k] = d[k]; });
  } catch (_) {}
  function getDefaults() { const o = {}; DEF_FIELDS.forEach(k => o[k] = ST[k]); return o; }
  function setDefaults(d) {
    DEF_FIELDS.forEach(k => { if (d && d[k] !== undefined) ST[k] = d[k]; });
    try { localStorage.setItem(DEF_KEY, JSON.stringify(getDefaults())); } catch (_) {}
  }
  function resetDefaults() { try { localStorage.removeItem(DEF_KEY); } catch (_) {} DEF_FIELDS.forEach(k => ST[k] = DEF_FACTORY[k]); }

  /* ---------- Filtri: campionati e famiglie di giocate ----------
     Si memorizzano le voci DISATTIVATE: così un campionato o una famiglia nuova
     risulta attiva di default. */
  const FLT_KEY = "combogesss_schedina_filters";
  ST.offLeagues = {}; ST.offFamilies = {}; ST.families = [];
  try {
    const f = JSON.parse(localStorage.getItem(FLT_KEY) || "null");
    if (f) { ST.offLeagues = f.offLeagues || {}; ST.offFamilies = f.offFamilies || {}; }
  } catch (_) {}
  function saveFilters() {
    try { localStorage.setItem(FLT_KEY, JSON.stringify({ offLeagues: ST.offLeagues, offFamilies: ST.offFamilies })); } catch (_) {}
  }
  function allLeagues() {
    const out = [];
    if (typeof NATIONS !== "undefined") for (const n of NATIONS) for (const l of n.leagues) out.push({ code: l.code, name: l.name, flag: n.emojiFlag, country: n.name });
    return out;
  }
  /* Le famiglie si leggono dai dati reali (qualche partita per campionato). */
  function discoverFamilies() {
    try {
      if (typeof window.computeMatchCandidates !== "function" || typeof state === "undefined") return;
      const seen = new Set(ST.families.concat(Object.keys(ST.offFamilies)));
      const rbl = state.roundsByLeague || {};
      for (const code of Object.keys(rbl)) {
        let n = 0;
        for (const round of rbl[code] || []) {
          for (const m of round.matches) {
            if (m.ftResult) continue;
            const c = window.computeMatchCandidates(m, code, state.resultsRows);
            (c.real || []).concat(c.dixon || []).forEach(x => { if (x.family) seen.add(x.family); });
            if (++n >= 3) break;
          }
          if (n >= 3) break;
        }
      }
      ST.families = Array.from(seen);
    } catch (_) {}
  }
  function settle(legs) {
    const sts = (legs || []).map(legStatus);
    if (sts.includes(false)) return "lost";
    if (sts.length && sts.every(x => x === true)) return "won";
    return "open";
  }

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const f2 = n => Number(n).toFixed(2);
  const pctCls = p => p >= 90 ? "pct-gold" : p >= 66.67 ? "pct-green" : p >= 33.34 ? "pct-white" : "pct-red";
  const pctTxt = p => `<span class="${pctCls(p)} font-extrabold">${p.toFixed(0)}%</span>`;

  function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") || []; } catch (_) { return []; } }
  function storeSaved(a) { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (_) {} }

  function parseDmy(s) {
    const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null;
  }
  function todayUtc() { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }

  /* ---------- Valutazione esito di una giocata ---------- */
  function evalPart(p, h, a) {
    p = String(p).replace(/\s+/g, "").replace(/,/g, ".").toLowerCase();
    const tot = h + a;
    if (p === "1") return h > a;
    if (p === "x") return h === a;
    if (p === "2") return a > h;
    if (p === "1x") return h >= a;
    if (p === "x2") return a >= h;
    if (p === "12") return h !== a;
    if (p === "gg") return h > 0 && a > 0;
    if (p === "ng") return !(h > 0 && a > 0);
    let m = p.match(/^(over|under)(\d+(?:\.\d+)?)$/);
    if (m) return m[1] === "over" ? tot > +m[2] : tot < +m[2];
    m = p.match(/^(?:multigol)?(\d+)-(\d+)$/);
    if (m) return tot >= +m[1] && tot <= +m[2];
    return null;
  }
  function evalLabel(label, h, a) {
    for (const part of String(label).split("+")) {
      const r = evalPart(part, h, a);
      if (r === null) return null;
      if (!r) return false;
    }
    return true;
  }
  function findScore(leg) {
    const rounds = ((typeof state !== "undefined" && state.roundsByLeague) || {})[leg.code] || [];
    for (const r of rounds) for (const m of r.matches) {
      if (m.home === leg.home && m.away === leg.away && m.date === leg.date && m.ftResult) {
        const x = String(m.ftResult).match(/(\d+)\s*-\s*(\d+)/);
        if (x) return [+x[1], +x[2]];
      }
    }
    return null;
  }
  function legStatus(leg) {
    const sc = findScore(leg);
    if (!sc) return null;
    return evalLabel(leg.label, sc[0], sc[1]);
  }

  /* ---------- Raccolta partite e giocate candidate ---------- */
  function gatherMatches() {
    const out = [];
    const rbl = state.roundsByLeague || {};
    const codes = ST.scope === "league" ? [state.selectedLeagueCode] : Object.keys(rbl).filter(c => !ST.offLeagues[c]);
    const days = { "1d": 1, "3d": 3, "7d": 7 }[ST.scope] || 0;
    const today = todayUtc();
    for (const code of codes) for (const round of rbl[code] || []) for (const m of round.matches) {
      if (m.ftResult) continue;
      const t = parseDmy(m.date);
      if (t !== null && t < today) continue;
      if (days) {
        if (t === null) continue;
        if ((t - today) / 864e5 >= days) continue;
      }
      out.push({ m, code });
    }
    return out;
  }

  function legsFor(m, code) {
    const c = window.computeMatchCandidates(m, code, state.resultsRows);
    let list;
    if (ST.source === "real") list = c.real;
    else if (ST.source === "dixon") list = c.dixon;
    else {
      const mp = new Map(c.dixon.map(x => [x.label, x]));
      list = [];
      for (const r of c.real) {
        const d = mp.get(r.label);
        if (!d) continue;
        const pct = (r.pct + d.pct) / 2;
        const realOdd = r.oddType === "Quota" ? r : (d.oddType === "Quota" ? d : null);
        const odd = realOdd ? realOdd.odd : Math.min(99.99, Math.max(1.01, 100 / pct));
        list.push({ label: r.label, family: r.family, pct, odd, oddType: realOdd ? "Quota" : "Equa" });
      }
    }
    return list
      .filter(x => !ST.offFamilies[x.family] && x.pct >= ST.minPct && x.odd >= 1.12 && (ST.includeFair || x.oddType === "Quota"))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6)
      .map(x => Object.assign({}, x, {
        key: `${code}|${m.id}|${x.label}`, matchId: m.id, code,
        home: m.home, away: m.away, date: m.date || "", time: m.time || ""
      }));
  }

  /* ---------- Ricerca delle combinazioni ---------- */
  function search(pool) {
    const lo = ST.target - ST.tol, hi = ST.target + ST.tol;
    const res = [];
    let nodes = 0;
    (function rec(i, chosen, prod) {
      if (res.length > 30000 || nodes > 3e6) return;
      if (chosen.length >= ST.minLegs && prod >= lo && prod <= hi) res.push(chosen.slice());
      if (chosen.length >= ST.maxLegs) return;
      for (let j = i; j < pool.length; j++) for (const leg of pool[j]) {
        nodes++;
        const np = prod * leg.odd;
        if (np > hi) continue;
        chosen.push(leg);
        rec(j + 1, chosen, np);
        chosen.pop();
      }
    })(0, [], 1);
    return res;
  }

  function buildCombo(legs) {
    const odd = legs.reduce((a, l) => a * l.odd, 1);
    const prob = legs.reduce((a, l) => a * l.pct / 100, 1);
    // EV calcolato solo sulle quote reali: con quote equa il valore è neutro per costruzione
    const vf = legs.reduce((a, l) => a * (l.oddType === "Quota" ? l.pct / 100 * l.odd : 1), 1);
    return { legs, odd, prob, ev: vf - 1, hasFair: legs.some(l => l.oddType !== "Quota"), nReal: legs.filter(l => l.oddType === "Quota").length };
  }

  function diversify(sorted, max) {
    const out = [];
    for (const c of sorted) {
      const ok = out.every(o => c.legs.filter(l => o.legs.some(x => x.key === l.key)).length < c.legs.length / 2);
      if (ok) out.push(c);
      if (out.length >= max) break;
    }
    return out;
  }

  function run() {
    const box = $("#sk-results");
    if (typeof window.computeMatchCandidates !== "function" || typeof state === "undefined") {
      box.innerHTML = `<div class="sk-msg">Dati non ancora pronti. Riprova tra un momento.</div>`; return;
    }
    const ms = gatherMatches();
    const perMatch = ms.map(({ m, code }) => legsFor(m, code)).filter(a => a.length)
      .sort((a, b) => b[0].pct - a[0].pct);
    const pool = perMatch.slice(0, 28);
    for (const arr of perMatch.slice(28)) if (arr.some(l => ST.locked[l.key])) pool.push(arr);

    const lockedKeys = Object.keys(ST.locked);
    let combos = search(pool).map(buildCombo);
    if (lockedKeys.length) combos = combos.filter(c => lockedKeys.every(k => c.legs.some(l => l.key === k)));

    if (ST.mode === "sicura") combos.sort((a, b) => b.prob - a.prob);
    else if (ST.mode === "value") combos.sort((a, b) => (b.ev - a.ev) || (b.prob - a.prob));
    else {
      combos.sort((a, b) => b.prob - a.prob);
      combos = combos.slice(0, 80).sort(() => Math.random() - 0.5);
    }
    ST.all = diversify(combos, 15);
    ST.page = 0;
    ST.info = { matches: ms.length, withPicks: perMatch.length };
    renderResults();
  }

  function generate() {
    discoverFamilies(); renderFilters();
    $("#sk-results").innerHTML = `<div class="sk-msg">Calcolo in corso…</div>`;
    setTimeout(() => {
      try { run(); } catch (e) {
        console.error(e);
        $("#sk-results").innerHTML = `<div class="sk-msg">Errore nel calcolo: ${esc(e.message)}</div>`;
      }
    }, 30);
  }

  /* ---------- Rendering ---------- */
  function legRow(l, opts) {
    opts = opts || {};
    const st = opts.status;
    const icon = st === true ? "✅" : st === false ? "❌" : (opts.hist ? "⏳" : "");
    const lock = opts.lock ? `<button class="sk-lock ${ST.locked[l.key] ? "on" : ""}" data-act="lock" data-key="${esc(l.key)}" title="Blocca questo evento">${ST.locked[l.key] ? "🔒" : "🔓"}</button>` : "";
    return `
      <div class="sk-leg">
        <div class="sk-leg-main">
          <div class="sk-teams">${esc(l.home)} <span class="sk-dim">vs</span> ${esc(l.away)}</div>
          <div class="sk-dim sk-small">${esc([l.date, l.time].filter(Boolean).join(" • "))}</div>
        </div>
        <div class="sk-pick"><b>${esc(l.label)}</b> ${pctTxt(l.pct)}</div>
        <div class="sk-odd">@${f2(l.odd)} <span class="sk-tag ${l.oddType === "Quota" ? "real" : "fair"}">${l.oddType === "Quota" ? "Quota" : "Equa"}</span></div>
        <div class="sk-ico">${icon}${lock}</div>
      </div>`;
  }

  function evBadge(c) {
    if (!c.nReal) return `<span class="sk-dim sk-small">EV n/d (solo quote equa)</span>`;
    const v = c.ev * 100;
    return `<span class="sk-small ${v >= 0 ? "pct-green" : "pct-red"}">EV ${v >= 0 ? "+" : ""}${v.toFixed(1)}% <span class="sk-dim">(${c.nReal} quote reali)</span></span>`;
  }

  function cardHtml(c, idx) {
    return `
      <div class="sk-card">
        <div class="sk-card-h">
          <div><span class="sk-big">@${f2(c.odd)}</span> <span class="sk-dim sk-small">${c.legs.length} eventi</span></div>
          <div class="sk-right">Prob. stimata ${pctTxt(c.prob * 100)}<br>${evBadge(c)}</div>
        </div>
        ${c.legs.map(l => legRow(l, { lock: true })).join("")}
        ${c.hasFair ? `<div class="sk-note">⚠️ Contiene quote “Equa” (calcolate da 100/%, senza margine del bookmaker): sul sito la quota reale sarà probabilmente più bassa.</div>` : ""}
        <div class="sk-actions">
          <button class="sk-btn" data-act="save" data-idx="${idx}">${ST.saved[idx] ? "Salvata ✓" : "💾 Salva"}</button>
          <button class="sk-btn" data-act="copy" data-idx="${idx}">📋 Copia testo</button>
          <button class="sk-btn" data-act="conto" data-idx="${idx}">💰 Aggiungi al Conto</button>
        </div>
      </div>`;
  }

  function renderResults() {
    const box = $("#sk-results");
    const per = 3;
    const pages = Math.max(1, Math.ceil(ST.all.length / per));
    const slice = ST.all.slice(ST.page * per, ST.page * per + per);
    const info = ST.info || {};
    if (!ST.all.length) {
      box.innerHTML = `<div class="sk-msg">Nessuna schedina trovata (${info.matches || 0} partite, ${info.withPicks || 0} con giocate valide).<br>
        Controlla anche i filtri su campionati e famiglie. Prova ad allargare la tolleranza, abbassare la probabilità minima, ampliare l’ambito o aumentare il numero di eventi.${Object.keys(ST.locked).length ? "<br>Hai eventi bloccati: prova a sbloccarne qualcuno." : ""}</div>`;
      return;
    }
    ST.saved = ST.saved || {};
    box.innerHTML = `
      <div class="sk-dim sk-small" style="margin-bottom:8px">${info.matches} partite analizzate • ${info.withPicks} con giocate valide • proposte ${ST.page + 1}/${pages}</div>
      ${slice.map((c, i) => cardHtml(c, ST.page * per + i)).join("")}
      ${pages > 1 ? `<button class="sk-btn sk-wide" data-act="more">🔄 Altre proposte</button>` : ""}`;
  }

  function renderHistory() {
    const saved = loadSaved();
    const box = $("#sk-history");
    if (!saved.length) { box.innerHTML = `<div class="sk-msg">Nessuna schedina salvata. Generane una e premi “Salva”: l’esito verrà calcolato in automatico quando arrivano i risultati.</div>`; return; }

    let closed = 0, won = 0, units = 0, legN = 0, legHit = 0, legPct = 0;
    const cards = saved.map((s, i) => {
      const sts = s.legs.map(legStatus);
      for (let k = 0; k < sts.length; k++) if (sts[k] !== null) { legN++; legPct += s.legs[k].pct; if (sts[k]) legHit++; }
      const status = sts.includes(false) ? "lost" : sts.every(x => x === true) ? "won" : "open";
      if (status !== "open") { closed++; if (status === "won") { won++; units += s.odd - 1; } else units -= 1; }
      const badge = status === "won" ? `<span class="sk-tag real">VINTA</span>` : status === "lost" ? `<span class="sk-tag lost">PERSA</span>` : `<span class="sk-tag fair">IN CORSO</span>`;
      return `
        <div class="sk-card">
          <div class="sk-card-h">
            <div><span class="sk-big">@${f2(s.odd)}</span> ${badge}<div class="sk-dim sk-small">${esc(new Date(s.createdAt).toLocaleString("it-IT"))}</div></div>
            <div class="sk-right">Prob. stimata ${pctTxt(s.prob * 100)}<br><button class="sk-btn sk-mini" data-act="conto-h" data-i="${i}">💰 Conto</button> <button class="sk-btn sk-mini" data-act="del" data-i="${i}">🗑️</button></div>
          </div>
          ${s.legs.map((l, k) => legRow(l, { hist: true, status: sts[k] })).join("")}
        </div>`;
    }).join("");

    const hr = closed ? (won / closed * 100) : null;
    const calib = legN ? `Eventi chiusi: <b>${legN}</b> • stimati in media <b>${(legPct / legN).toFixed(0)}%</b> • usciti davvero <b>${(legHit / legN * 100).toFixed(0)}%</b>` : "Nessun evento ancora concluso.";
    box.innerHTML = `
      <div class="sk-card sk-stats">
        <div>Schedine chiuse: <b>${closed}</b> • vinte: <b>${won}</b>${hr !== null ? ` (${hr.toFixed(0)}%)` : ""}</div>
        <div>Saldo a 1 unità di puntata: <b class="${units >= 0 ? "pct-green" : "pct-red"}">${units >= 0 ? "+" : ""}${units.toFixed(2)}</b> <span class="sk-dim sk-small">(con le quote mostrate, anche quelle equa)</span></div>
        <div>${calib}</div>
        <div class="sk-dim sk-small">Se la % stimata è molto più alta di quella reale, il modello è troppo ottimista.</div>
      </div>${cards}`;
  }

  /* ---------- Azioni ---------- */
  function comboText(c) {
    const lines = [`SCHEDINA @${f2(c.odd)} — ComboGesss`];
    c.legs.forEach((l, i) => lines.push(`${i + 1}) ${l.home} - ${l.away} (${[l.date, l.time].filter(Boolean).join(" ")}): ${l.label} @${f2(l.odd)}${l.oddType === "Quota" ? "" : " (stimata)"}`));
    lines.push(`Probabilità stimata: ${(c.prob * 100).toFixed(0)}%`);
    return lines.join("\n");
  }
  function copyText(t, btn) {
    const done = () => { if (btn) { const o = btn.textContent; btn.textContent = "Copiato ✓"; setTimeout(() => btn.textContent = o, 1400); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
    else fallbackCopy(t, done);
  }
  function fallbackCopy(t, done) {
    const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (_) {} ta.remove();
  }

  function onClick(e) {
    const t = e.target.closest("[data-act]");
    if (e.target.id === "sk-overlay") return close();
    if (!t) return;
    const act = t.dataset.act;
    if (act === "close") close();
    else if (act === "tab") { ST.tab = t.dataset.tab; showTab(); }
    else if (act === "gen") generate();
    else if (act === "more") { ST.page = (ST.page + 1) % Math.max(1, Math.ceil(ST.all.length / 3)); renderResults(); }
    else if (act === "lock") { const k = t.dataset.key; if (ST.locked[k]) delete ST.locked[k]; else ST.locked[k] = true; renderResults(); }
    else if (act === "copy") copyText(comboText(ST.all[+t.dataset.idx]), t);
    else if (act === "save") {
      const c = ST.all[+t.dataset.idx]; if (!c || ST.saved[t.dataset.idx]) return;
      const a = loadSaved();
      a.unshift({ createdAt: Date.now(), odd: c.odd, prob: c.prob, legs: c.legs.map(l => ({ code: l.code, home: l.home, away: l.away, date: l.date, time: l.time, label: l.label, pct: l.pct, odd: l.odd, oddType: l.oddType })) });
      storeSaved(a); ST.saved[t.dataset.idx] = true; t.textContent = "Salvata ✓";
    }
    else if (act === "conto") { if (window.CGConto) window.CGConto.addFromSchedina(ST.all[+t.dataset.idx], t); }
    else if (act === "conto-h") { const s = loadSaved()[+t.dataset.i]; if (s && window.CGConto) window.CGConto.addFromSchedina(s, t); }
    else if (act === "del") { const a = loadSaved(); a.splice(+t.dataset.i, 1); storeSaved(a); renderHistory(); }
    else if (act === "lg") { const c = t.dataset.code; if (ST.offLeagues[c]) delete ST.offLeagues[c]; else ST.offLeagues[c] = true; saveFilters(); renderFilters(); }
    else if (act === "lg-all") { ST.offLeagues = {}; saveFilters(); renderFilters(); }
    else if (act === "lg-none") { allLeagues().forEach(l => ST.offLeagues[l.code] = true); saveFilters(); renderFilters(); }
    else if (act === "fam") { const f = t.dataset.fam; if (ST.offFamilies[f]) delete ST.offFamilies[f]; else ST.offFamilies[f] = true; saveFilters(); renderFilters(); }
    else if (act === "fam-all") { ST.offFamilies = {}; saveFilters(); renderFilters(); }
    else if (act === "fam-none") { ST.families.forEach(f => ST.offFamilies[f] = true); saveFilters(); renderFilters(); }
    else if (act === "chip") { $("#sk-target").value = t.dataset.v; ST.target = +t.dataset.v; }
  }

  function onChange(e) {
    const id = e.target.id, v = e.target.value;
    if (id === "sk-target") ST.target = Math.max(1.2, parseFloat(String(v).replace(",", ".")) || 3);
    else if (id === "sk-tol") ST.tol = +v;
    else if (id === "sk-min") { ST.minLegs = +v; if (ST.maxLegs < ST.minLegs) { ST.maxLegs = ST.minLegs; $("#sk-max").value = v; } }
    else if (id === "sk-max") { ST.maxLegs = +v; if (ST.minLegs > ST.maxLegs) { ST.minLegs = ST.maxLegs; $("#sk-min").value = v; } }
    else if (id === "sk-mode") ST.mode = v;
    else if (id === "sk-source") ST.source = v;
    else if (id === "sk-scope") ST.scope = v;
    else if (id === "sk-pct") ST.minPct = +v;
    else if (id === "sk-fair") ST.includeFair = e.target.checked;
  }

  function renderFilters() {
    const lgs = allLeagues();
    const lb = $("#sk-lg-box"), fb = $("#sk-fam-box");
    if (lb) {
      const on = lgs.filter(l => !ST.offLeagues[l.code]).length;
      lb.innerHTML = `
        <div class="sk-fh">
          <b>🏆 Campionati <span class="sk-dim sk-small">${on}/${lgs.length} attivi</span></b>
          <span><button class="sk-btn sk-mini" data-act="lg-all">Tutti</button> <button class="sk-btn sk-mini" data-act="lg-none">Nessuno</button></span>
        </div>
        <div class="sk-grid">${lgs.map(l => `<button type="button" class="sk-tile ${ST.offLeagues[l.code] ? "off" : "on"}" data-act="lg" data-code="${esc(l.code)}" title="${esc(l.country)}"><span class="sk-tile-f">${l.flag || ""}</span><span>${esc(l.name)}</span></button>`).join("")}</div>
        <div class="sk-dim sk-small sk-hint">Con ambito “Campionato selezionato” questa griglia viene ignorata.</div>`;
    }
    if (fb) {
      const fams = ST.families;
      const on = fams.filter(f => !ST.offFamilies[f]).length;
      fb.innerHTML = `
        <div class="sk-fh">
          <b>🎯 Famiglie di giocate <span class="sk-dim sk-small">${fams.length ? `${on}/${fams.length} attive` : ""}</span></b>
          <span><button class="sk-btn sk-mini" data-act="fam-all">Tutte</button> <button class="sk-btn sk-mini" data-act="fam-none">Nessuna</button></span>
        </div>
        ${fams.length
          ? `<div class="sk-grid sk-grid-f">${fams.map(f => `<button type="button" class="sk-tile ${ST.offFamilies[f] ? "off" : "on"}" data-act="fam" data-fam="${esc(f)}"><span>${esc(f)}</span></button>`).join("")}</div>`
          : `<div class="sk-dim sk-small">Le famiglie compaiono appena i dati sono caricati (si aggiornano anche premendo “Genera”).</div>`}`;
    }
  }

  function showTab() {
    $("#sk-gen").style.display = ST.tab === "gen" ? "" : "none";
    $("#sk-history").style.display = ST.tab === "hist" ? "" : "none";
    document.querySelectorAll("#sk-overlay .sk-tab").forEach(b => b.classList.toggle("on", b.dataset.tab === ST.tab));
    if (ST.tab === "hist") renderHistory();
  }

  const opt = (arr, cur) => arr.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`).join("");

  function open() {
    if ($("#sk-overlay")) return;
    const ov = document.createElement("div");
    ov.id = "sk-overlay";
    ov.innerHTML = `
      <div class="sk-panel">
        <div class="sk-top">
          <h3>🎟️ Generatore schedine</h3>
          <button class="sk-x" data-act="close" aria-label="Chiudi">✕</button>
        </div>
        <div class="sk-tabs">
          <button class="sk-tab on" data-act="tab" data-tab="gen">Genera</button>
          <button class="sk-tab" data-act="tab" data-tab="hist">Storico</button>
        </div>
        <div id="sk-gen">
          <div class="sk-form">
            <label>Quota target
              <input id="sk-target" type="number" step="0.1" min="1.2" value="${ST.target}">
              <span class="sk-chips">${[2, 3, 5, 10].map(v => `<button class="sk-chip" data-act="chip" data-v="${v}">${v}</button>`).join("")}</span>
            </label>
            <label>Tolleranza<select id="sk-tol">${opt(OPTS.tol, ST.tol)}</select></label>
            <label>Eventi min<select id="sk-min">${opt(OPTS.min, ST.minLegs)}</select></label>
            <label>Eventi max<select id="sk-max">${opt(OPTS.max, ST.maxLegs)}</select></label>
            <label>Modalità<select id="sk-mode">${opt(OPTS.mode, ST.mode)}</select></label>
            <label>Fonte stime<select id="sk-source">${opt(OPTS.source, ST.source)}</select></label>
            <label>Ambito<select id="sk-scope">${opt(OPTS.scope, ST.scope)}</select></label>
            <label>Prob. minima evento<select id="sk-pct">${opt(OPTS.pct, ST.minPct)}</select></label>
            <label class="sk-check"><input id="sk-fair" type="checkbox" ${ST.includeFair ? "checked" : ""}> Includi quote equa (stimate)</label>
          </div>
          <div class="sk-card sk-fcard" id="sk-lg-box"></div>
          <div class="sk-card sk-fcard" id="sk-fam-box"></div>
          <button class="sk-btn sk-primary sk-wide" data-act="gen">⚡ Genera schedine</button>
          <div id="sk-results"><div class="sk-msg">Imposta i parametri e premi “Genera”. Puoi bloccare 🔒 un evento e rigenerare per tenerlo fisso.</div></div>
        </div>
        <div id="sk-history" style="display:none"></div>
      </div>`;
    document.body.appendChild(ov);
    discoverFamilies(); renderFilters();
    ov.addEventListener("click", onClick);
    ov.addEventListener("change", onChange);
    ov.addEventListener("input", e => { if (e.target.id === "sk-target") onChange(e); });
    document.addEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") close(); }
  function close() { const o = $("#sk-overlay"); if (o) o.remove(); document.removeEventListener("keydown", escClose); }

  /* ---------- Stili e pulsante ---------- */
  function injectStyle() {
    const s = document.createElement("style");
    s.textContent = `
      #sk-overlay{position:fixed;inset:0;z-index:60;background:rgba(2,8,23,.82);backdrop-filter:blur(6px);display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:16px;font-family:"Exo 2",system-ui,sans-serif;color:#e6f4ff}
      #sk-overlay .sk-panel{width:100%;max-width:880px;background:linear-gradient(160deg,#061634,#031b30);border:1px solid rgba(56,189,248,.3);border-radius:16px;padding:16px;box-shadow:0 0 30px rgba(14,165,233,.2)}
      #sk-overlay .sk-top{display:flex;justify-content:space-between;align-items:center}
      #sk-overlay h3{font-family:Orbitron,sans-serif;font-size:calc(16px * var(--cg-fs,1));letter-spacing:.05em;text-shadow:0 0 10px rgba(34,211,238,.45);margin:0}
      #sk-overlay .sk-x{background:none;border:0;color:#86b3d8;font-size:calc(20px * var(--cg-fs,1));cursor:pointer}
      #sk-overlay .sk-tabs{display:flex;gap:6px;margin:12px 0}
      #sk-overlay .sk-tab{padding:6px 14px;border-radius:999px;border:1px solid rgba(56,189,248,.3);background:transparent;color:#b4d6f2;font-weight:700;font-size:calc(12px * var(--cg-fs,1));cursor:pointer}
      #sk-overlay .sk-tab.on{background:linear-gradient(135deg,#0891b2,#2563eb);color:#fff}
      #sk-overlay .sk-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
      #sk-overlay .sk-form label{display:flex;flex-direction:column;gap:4px;font-size:calc(10px * var(--cg-fs,1));text-transform:uppercase;letter-spacing:.06em;color:#86b3d8}
      #sk-overlay .sk-form input[type=number],#sk-overlay .sk-form select{background:rgba(2,12,30,.8);color:#e6f4ff;border:1px solid rgba(56,189,248,.3);border-radius:8px;padding:7px 8px;font-size:calc(13px * var(--cg-fs,1));text-transform:none;letter-spacing:0}
      #sk-overlay .sk-check{flex-direction:row!important;align-items:center;text-transform:none!important;font-size:calc(12px * var(--cg-fs,1))!important;color:#b4d6f2!important}
      #sk-overlay .sk-chips{display:flex;gap:4px}
      #sk-overlay .sk-chip{padding:2px 9px;border-radius:999px;border:1px solid rgba(56,189,248,.35);background:rgba(7,26,54,.7);color:#a5f3fc;font-size:calc(11px * var(--cg-fs,1));cursor:pointer}
      #sk-overlay .sk-btn{padding:7px 12px;border-radius:10px;border:1px solid rgba(56,189,248,.35);background:rgba(10,38,74,.8);color:#e6f4ff;font-size:calc(12px * var(--cg-fs,1));font-weight:700;cursor:pointer}
      #sk-overlay .sk-btn:hover{border-color:#22d3ee}
      #sk-overlay .sk-primary{background:linear-gradient(135deg,#0891b2,#2563eb);color:#fff;box-shadow:0 0 18px rgba(34,211,238,.35)}
      #sk-overlay .sk-wide{width:100%;margin:6px 0}
      #sk-overlay .sk-mini{padding:2px 8px;font-size:calc(11px * var(--cg-fs,1));margin-top:4px}
      #sk-overlay .sk-card{background:rgba(7,26,54,.72);border:1px solid rgba(56,189,248,.24);border-radius:14px;padding:12px;margin:10px 0}
      #sk-overlay .sk-card-h{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;align-items:flex-start}
      #sk-overlay .sk-big{font-family:Orbitron,sans-serif;font-size:calc(22px * var(--cg-fs,1));font-weight:900;color:#67e8f9}
      #sk-overlay .sk-right{text-align:right;font-size:calc(12px * var(--cg-fs,1));line-height:1.5}
      #sk-overlay .sk-leg{display:grid;grid-template-columns:1fr auto auto 56px;gap:8px;align-items:center;padding:7px 0;border-top:1px solid rgba(56,189,248,.14)}
      #sk-overlay .sk-teams{font-weight:700;font-size:calc(13px * var(--cg-fs,1))}
      #sk-overlay .sk-pick{font-size:calc(13px * var(--cg-fs,1));white-space:nowrap}
      #sk-overlay .sk-odd{font-size:calc(13px * var(--cg-fs,1));white-space:nowrap;font-weight:700}
      #sk-overlay .sk-ico{text-align:right;white-space:nowrap}
      #sk-overlay .sk-lock{background:none;border:0;cursor:pointer;font-size:calc(15px * var(--cg-fs,1));opacity:.55}
      #sk-overlay .sk-lock.on{opacity:1}
      #sk-overlay .sk-dim{color:#86b3d8}
      #sk-overlay .sk-small{font-size:calc(11px * var(--cg-fs,1))}
      #sk-overlay .sk-tag{font-size:calc(9px * var(--cg-fs,1));font-weight:800;padding:1px 6px;border-radius:999px;border:1px solid;text-transform:uppercase}
      #sk-overlay .sk-tag.real{color:#6ee7b7;border-color:rgba(16,185,129,.5);background:rgba(16,185,129,.15)}
      #sk-overlay .sk-tag.fair{color:#fcd34d;border-color:rgba(245,158,11,.5);background:rgba(245,158,11,.12)}
      #sk-overlay .sk-tag.lost{color:#fca5a5;border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.15)}
      #sk-overlay .sk-note{font-size:calc(11px * var(--cg-fs,1));color:#fcd34d;margin-top:6px}
      #sk-overlay .sk-actions{display:flex;gap:8px;margin-top:10px}
      #sk-overlay .sk-msg{padding:22px;text-align:center;color:#b4d6f2;font-size:calc(13px * var(--cg-fs,1))}
      #sk-overlay .sk-stats{font-size:calc(13px * var(--cg-fs,1));line-height:1.7}
      #sk-overlay .sk-fcard{margin:8px 0}
      #sk-overlay .sk-fh{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;font-size:calc(13px * var(--cg-fs,1))}
      #sk-overlay .sk-fh .sk-mini{margin-top:0}
      #sk-overlay .sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:6px}
      #sk-overlay .sk-grid-f{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
      #sk-overlay .sk-tile{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 6px;border-radius:10px;border:1px solid rgba(34,211,238,.55);background:linear-gradient(135deg,rgba(8,145,178,.35),rgba(37,99,235,.35));color:#e6f4ff;font-weight:700;font-size:calc(12px * var(--cg-fs,1));cursor:pointer;transition:filter .15s,border-color .15s,box-shadow .15s}
      #sk-overlay .sk-tile.on{box-shadow:0 0 10px rgba(34,211,238,.25)}
      #sk-overlay .sk-tile.off{filter:brightness(.5);border-color:rgba(56,189,248,.18);box-shadow:none}
      #sk-overlay .sk-tile:hover{border-color:#22d3ee}
      #sk-overlay .sk-hint{margin-top:6px}
      @media(max-width:560px){#sk-overlay .sk-leg{grid-template-columns:1fr auto;} #sk-overlay .sk-ico{grid-column:2}}
    `;
    document.head.appendChild(s);
  }

  function mount() {
    injectStyle();
    const rb = document.getElementById("reloadDataBtn");
    if (!rb || document.getElementById("skOpenBtn")) return;
    const b = document.createElement("button");
    b.id = "skOpenBtn"; b.type = "button"; b.className = rb.className;
    b.textContent = "🎟️ Schedina";
    b.addEventListener("click", open);
    rb.parentElement.insertBefore(b, rb);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  window.CGSchedina = { open, close, settle, getDefaults, setDefaults, resetDefaults, OPTS };
})();
