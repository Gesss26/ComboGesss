/* ComboGesss — Conto: schedine giocate, depositi, prelievi, lista e grafico */
(function () {
  "use strict";

  const KEY = "combogesss_conto", SKEY = "combogesss_settings";
  const MON = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  const COL = { won: "#34d399", lost: "#f87171", open: "#fbbf24", deposito: "#22d3ee", prelievo: "#fb923c" };
  const UI = { type: "schedina", filter: "all", period: "all", mode: "saldo" };
  let root = null;

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const r2 = n => Math.round(n * 100) / 100;
  const num = v => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function cur() { try { return (JSON.parse(localStorage.getItem(SKEY) || "{}") || {}).currency || "€"; } catch (_) { return "€"; } }
  function fmt(n, signed) {
    const s = Math.abs(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? "−" : (signed && n > 0 ? "+" : "")) + s + " " + cur();
  }
  function load() { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  function store(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (_) {} }

  /* ---------- Calcoli ---------- */
  function autoSettle(a) {
    if (!window.CGSchedina || !window.CGSchedina.settle) return false;
    let ch = false;
    for (const e of a) {
      if (e.type !== "schedina" || e.result !== "open" || !e.legs || !e.legs.length) continue;
      const s = window.CGSchedina.settle(e.legs);
      if (s === "won") { e.result = "won"; e.payout = r2(e.amount * (e.odd || 0)); e.auto = true; ch = true; }
      else if (s === "lost") { e.result = "lost"; e.payout = 0; e.auto = true; ch = true; }
    }
    return ch;
  }
  const sortKey = e => e.y * 10000 + e.m * 100 + e.d;
  function computed(a) {
    const s = a.slice().sort((p, q) => sortKey(p) - sortKey(q) || p.t - q.t);
    let bal = 0, pl = 0;
    return s.map(e => {
      let eff = 0;
      if (e.type === "deposito") eff = e.amount;
      else if (e.type === "prelievo") eff = -e.amount;
      else {
        eff = -e.amount + (e.result === "won" ? e.payout : 0);
        if (e.result === "won") pl += e.payout - e.amount; else if (e.result === "lost") pl -= e.amount;
      }
      bal += eff;
      return { e, eff, bal: r2(bal), plCum: r2(pl) };
    });
  }
  function summaryOf(a) {
    const rows = computed(a);
    const S = { balance: rows.length ? rows[rows.length - 1].bal : 0, pl: 0, staked: 0, openStake: 0, dep: 0, wd: 0, won: 0, lost: 0, open: 0, closedStake: 0 };
    for (const { e } of rows) {
      if (e.type === "deposito") S.dep += e.amount;
      else if (e.type === "prelievo") S.wd += e.amount;
      else {
        S.staked += e.amount;
        if (e.result === "won") { S.won++; S.pl += e.payout - e.amount; S.closedStake += e.amount; }
        else if (e.result === "lost") { S.lost++; S.pl -= e.amount; S.closedStake += e.amount; }
        else { S.open++; S.openStake += e.amount; }
      }
    }
    S.pl = r2(S.pl);
    S.hit = (S.won + S.lost) ? S.won / (S.won + S.lost) * 100 : null;
    S.roi = S.closedStake ? S.pl / S.closedStake * 100 : null;
    return S;
  }
  function getSummary() {
    const a = load();
    if (autoSettle(a)) store(a);
    return summaryOf(a);
  }

  /* ---------- Rendering ---------- */
  function typeLabel(e) {
    if (e.type === "deposito") return "Deposito";
    if (e.type === "prelievo") return "Prelievo";
    return "Schedina " + (e.result === "won" ? "presa" : e.result === "lost" ? "persa" : "in corso");
  }
  function colorOf(e) { return e.type === "schedina" ? COL[e.result] : COL[e.type]; }

  function kpiHtml(S) {
    const k = (l, v, cls) => `<div class="ct-kpi"><div class="ct-kl">${l}</div><div class="ct-kv ${cls || ""}">${v}</div></div>`;
    return `
      ${k("Saldo disponibile", fmt(S.balance), S.balance >= 0 ? "ct-big" : "ct-big ct-neg")}
      ${k("Utile / Perdita", fmt(S.pl, true), S.pl > 0 ? "ct-pos" : S.pl < 0 ? "ct-neg" : "")}
      ${k("Investito (schedine)", fmt(S.staked))}
      ${k("In gioco", fmt(S.openStake), "ct-amber")}
      ${k("Prese / Perse", `<span class="ct-pos">${S.won}</span> / <span class="ct-neg">${S.lost}</span>` + (S.open ? ` <span class="ct-dim ct-s">(+${S.open} in corso)</span>` : ""))}
      ${k("Hit rate", S.hit === null ? "—" : S.hit.toFixed(0) + "%")}
      ${k("ROI", S.roi === null ? "—" : (S.roi >= 0 ? "+" : "") + S.roi.toFixed(1) + "%", S.roi > 0 ? "ct-pos" : S.roi < 0 ? "ct-neg" : "")}
      ${k("Depositi / Prelievi", `<span class="ct-cy">${fmt(S.dep)}</span> / <span class="ct-or">${fmt(S.wd)}</span>`)}`;
  }

  function filteredRows() {
    let rows = computed(load());
    const now = new Date(), ty = now.getFullYear(), tm = now.getMonth() + 1;
    if (UI.period === "month") rows = rows.filter(r => r.e.y === ty && r.e.m === tm);
    else if (UI.period === "30d") {
      const lim = Date.now() - 30 * 864e5;
      rows = rows.filter(r => new Date(r.e.y, r.e.m - 1, r.e.d).getTime() >= lim);
    }
    return rows;
  }

  function chartHtml(rows) {
    const pts = UI.mode === "saldo"
      ? rows.map(r => ({ r, v: r.bal }))
      : rows.filter(r => r.e.type === "schedina" && r.e.result !== "open").map(r => ({ r, v: r.plCum }));
    if (!pts.length) return `<div class="ct-empty">Nessun dato da mostrare${UI.mode === "pl" ? " (servono schedine chiuse)" : ""}.</div>`;
    const W = 700, H = 250, pl = 58, pr = 14, pt = 14, pb = 28;
    const vals = pts.map(p => p.v);
    let min = Math.min(0, ...vals), max = Math.max(0, ...vals);
    if (min === max) max = min + 1;
    const pad8 = (max - min) * 0.08;
    const lo = min - pad8, hi = max + pad8;
    const X = i => pl + (pts.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (pts.length - 1));
    const Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const area = `${line} L${X(pts.length - 1).toFixed(1)},${Y(0).toFixed(1)} L${X(0).toFixed(1)},${Y(0).toFixed(1)} Z`;
    const ticks = [...new Set([min, 0, max].map(v => +v.toFixed(2)))];
    const grid = ticks.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="rgba(134,179,216,${v === 0 ? .55 : .2})" ${v === 0 ? 'stroke-dasharray="4 4"' : ""}/>
      <text x="${pl - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#86b3d8">${Math.round(v)}</text>`).join("");
    const nx = Math.min(5, pts.length);
    const xl = Array.from({ length: nx }, (_, k) => {
      const i = nx === 1 ? 0 : Math.round(k * (pts.length - 1) / (nx - 1));
      const e = pts[i].r.e;
      return `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#86b3d8">${pad(e.d)}/${pad(e.m)}</text>`;
    }).join("");
    const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="5" fill="${colorOf(p.r.e)}" stroke="#020817" stroke-width="1.5" data-ct="pt" data-i="${i}" style="cursor:pointer"><title>${esc(pad(p.r.e.d) + "/" + pad(p.r.e.m) + " · " + typeLabel(p.r.e) + " · " + fmt(p.v))}</title></circle>`).join("");
    window.__ctPts = pts;
    return `
      <svg viewBox="0 0 ${W} ${H}" class="ct-svg" role="img" aria-label="Andamento del conto">
        <defs><linearGradient id="ctg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
        ${grid}<path d="${area}" fill="url(#ctg)"/><path d="${line}" fill="none" stroke="#67e8f9" stroke-width="2.2" stroke-linejoin="round"/>${dots}${xl}
      </svg>
      <div id="ct-cap" class="ct-dim ct-s">Tocca un punto per i dettagli</div>
      <div class="ct-legend"><i style="background:${COL.won}"></i>Presa <i style="background:${COL.lost}"></i>Persa <i style="background:${COL.open}"></i>In corso <i style="background:${COL.deposito}"></i>Deposito <i style="background:${COL.prelievo}"></i>Prelievo</div>`;
  }

  function rowHtml(r) {
    const e = r.e, c = colorOf(e);
    const yr = e.y !== new Date().getFullYear() ? "/" + e.y : "";
    let chip, main, sub = "";
    if (e.type === "deposito") { chip = `<span class="ct-chip" style="--c:${c}">DEPOSITO</span>`; main = `<span style="color:${c}">${fmt(e.amount, true)}</span>`; }
    else if (e.type === "prelievo") { chip = `<span class="ct-chip" style="--c:${c}">PRELIEVO</span>`; main = `<span style="color:${c}">${fmt(-e.amount)}</span>`; }
    else {
      chip = `<span class="ct-chip" style="--c:${c}">${e.result === "won" ? "PRESA" : e.result === "lost" ? "PERSA" : "IN CORSO"}</span>`;
      const prof = e.result === "won" ? e.payout - e.amount : e.result === "lost" ? -e.amount : null;
      main = prof === null ? `<span style="color:${c}">${fmt(e.amount)}</span>` : `<span style="color:${c}">${fmt(prof, true)}</span>`;
      sub = `puntata ${fmt(e.amount)}${e.odd ? " @" + Number(e.odd).toFixed(2) : ""}${e.result === "won" ? " → incasso " + fmt(e.payout) : ""}${e.auto ? " · esito automatico" : ""}`;
    }
    const legs = (e.legs && e.legs.length) ? `<details class="ct-det"><summary>${e.legs.length} eventi</summary>${e.legs.map(l => `<div>${esc(l.home)} - ${esc(l.away)}: <b>${esc(l.label)}</b> @${Number(l.odd).toFixed(2)}</div>`).join("")}</details>` : "";
    const acts = e.type === "schedina"
      ? (e.result === "open"
        ? `<button class="ct-ab" data-ct="won" data-id="${e.id}" style="--c:${COL.won}">✅ Presa</button><button class="ct-ab" data-ct="lost" data-id="${e.id}" style="--c:${COL.lost}">❌ Persa</button>`
        : `<button class="ct-ab" data-ct="reopen" data-id="${e.id}" style="--c:#86b3d8">↩ Riapri</button>`)
      : "";
    return `
      <div class="ct-row" style="--c:${c}">
        <div class="ct-date">${pad(e.d)}/${pad(e.m)}<span class="ct-dim ct-s">${yr}</span></div>
        <div class="ct-mid">${chip}${e.note ? ` <span class="ct-note">${esc(e.note)}</span>` : ""}
          <div class="ct-dim ct-s">${esc(sub)}</div>${legs}</div>
        <div class="ct-amt">${main}<div class="ct-dim ct-s">saldo ${fmt(r.bal)}</div></div>
        <div class="ct-act">${acts}<button class="ct-ab" data-ct="del" data-id="${e.id}" title="Elimina">🗑️</button></div>
      </div>`;
  }

  function renderKpi() { const k = $("#ct-kpi", root); if (k) k.innerHTML = kpiHtml(summaryOf(load())); }

  function renderDyn() {
    const rows = filteredRows();
    let list = rows.slice().reverse();
    if (UI.filter === "sch") list = list.filter(r => r.e.type === "schedina");
    else if (UI.filter === "mov") list = list.filter(r => r.e.type !== "schedina");
    $("#ct-dyn", root).innerHTML = `
      <div class="cg-card">
        <div class="ct-head"><h3>📈 Andamento</h3>
          <div class="ct-seg">
            <button class="${UI.mode === "saldo" ? "on" : ""}" data-ct="mode" data-v="saldo">Saldo</button>
            <button class="${UI.mode === "pl" ? "on" : ""}" data-ct="mode" data-v="pl">Utile cumulato</button>
          </div>
          <select id="ct-period" class="ct-sel">
            <option value="all" ${UI.period === "all" ? "selected" : ""}>Tutto</option>
            <option value="month" ${UI.period === "month" ? "selected" : ""}>Questo mese</option>
            <option value="30d" ${UI.period === "30d" ? "selected" : ""}>Ultimi 30 giorni</option>
          </select>
        </div>
        ${chartHtml(rows)}
      </div>
      <div class="cg-card">
        <div class="ct-head"><h3>📋 Lista (${list.length})</h3>
          <div class="ct-seg">
            ${[["all", "Tutti"], ["sch", "Schedine"], ["mov", "Depositi/Prelievi"]].map(([v, l]) => `<button class="${UI.filter === v ? "on" : ""}" data-ct="filter" data-v="${v}">${l}</button>`).join("")}
          </div>
          <button class="cg-btn ct-mini" data-ct="export">⬇️ Excel</button>
        </div>
        ${list.length ? list.map(rowHtml).join("") : `<div class="ct-empty">Nessuna voce. Aggiungi la tua prima operazione qui sopra.</div>`}
      </div>`;
  }

  function formHtml() {
    const t = new Date();
    return `
      <div class="cg-card">
        <h3>➕ Nuova operazione</h3>
        <div class="ct-form" id="ct-form" data-type="${UI.type}" data-res="open">
          <div class="ct-seg" style="margin-bottom:10px">
            ${[["schedina", "🎟️ Schedina"], ["deposito", "⬇️ Deposito"], ["prelievo", "⬆️ Prelievo"]].map(([v, l]) => `<button class="${UI.type === v ? "on" : ""}" data-ct="type" data-v="${v}">${l}</button>`).join("")}
          </div>
          <div class="ct-fields">
            <label>Giorno<input id="ct-d" type="number" min="1" max="31" value="${t.getDate()}" inputmode="numeric"></label>
            <label>Mese<select id="ct-m">${MON.map((m, i) => `<option value="${i + 1}" ${i === t.getMonth() ? "selected" : ""}>${m}</option>`).join("")}</select></label>
            <label>Anno<input id="ct-y" type="number" value="${t.getFullYear()}" inputmode="numeric"></label>
            <label><span class="ct-l-sch">Euro investiti</span><span class="ct-l-mov">Importo</span><input id="ct-a" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00"></label>
            <label class="ct-sch">Quota (opzionale)<input id="ct-o" type="number" step="0.01" min="1.01" inputmode="decimal" placeholder="es. 3,00"></label>
            <label class="ct-sch">Esito<select id="ct-r"><option value="open">⏳ In corso</option><option value="won">✅ Presa</option><option value="lost">❌ Persa</option></select></label>
            <label class="ct-sch ct-pay">Vincita totale<input id="ct-p" type="number" step="0.01" min="0" inputmode="decimal" placeholder="auto da quota"></label>
            <label class="ct-wide">Nota (opzionale)<input id="ct-n" type="text" maxlength="80" placeholder="es. multipla sabato"></label>
          </div>
          <div id="ct-err" class="ct-err"></div>
          <button class="cg-btn cg-primary" style="width:100%" data-ct="add">➕ Aggiungi alla lista</button>
        </div>
      </div>`;
  }

  /* ---------- Azioni ---------- */
  function err(msg) { const e = $("#ct-err", root); if (e) e.textContent = msg || ""; }
  function refresh() { renderKpi(); renderDyn(); }

  function addEntry() {
    const f = $("#ct-form", root), type = f.dataset.type;
    const d = +$("#ct-d").value, m = +$("#ct-m").value, y = +$("#ct-y").value;
    const dt = new Date(y, m - 1, d);
    if (!(y >= 2000 && y <= 2100) || dt.getMonth() !== m - 1 || dt.getDate() !== d) return err("Data non valida.");
    const amount = num($("#ct-a").value);
    if (!(amount > 0)) return err("Inserisci un importo maggiore di zero.");
    const e = { id: uid(), t: Date.now(), type, d, m, y, amount: r2(amount), note: $("#ct-n").value.trim() };
    if (type === "schedina") {
      const odd = num($("#ct-o").value);
      if ($("#ct-o").value && !(odd >= 1.01)) return err("Quota non valida.");
      e.odd = Number.isFinite(odd) ? r2(odd) : null;
      e.result = $("#ct-r").value;
      e.payout = 0;
      if (e.result === "won") {
        let p = num($("#ct-p").value);
        if (!(p > 0) && e.odd) p = amount * e.odd;
        if (!(p > 0)) return err("Per una schedina presa inserisci la vincita (o la quota).");
        e.payout = r2(p);
      }
    }
    const a = load(); a.push(e); store(a);
    err("");
    ["#ct-a", "#ct-o", "#ct-p", "#ct-n"].forEach(s => { $(s).value = ""; });
    $("#ct-p").dataset.manual = "";
    $("#ct-r").value = "open"; f.dataset.res = "open";
    refresh();
  }

  function setResult(id, res) {
    const a = load(), e = a.find(x => x.id === id);
    if (!e) return;
    if (res === "won") {
      let p = e.odd ? r2(e.amount * e.odd) : NaN;
      if (!(p > 0)) { p = num(prompt("Quanto hai incassato in totale (vincita)?", "")); if (!(p > 0)) return; }
      e.payout = r2(p);
    } else e.payout = 0;
    e.result = res; e.auto = false;
    store(a); refresh();
  }

  function autoPayout() {
    const p = $("#ct-p");
    if (!p || p.dataset.manual === "1") return;
    const a = num($("#ct-a").value), o = num($("#ct-o").value);
    p.value = (a > 0 && o > 1) ? r2(a * o) : "";
  }

  function download(name, blob) {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1500);
  }
  function exportData() {
    const data = computed(load()).map(({ e, eff, bal }) => ({
      Data: `${pad(e.d)}/${pad(e.m)}/${e.y}`, Tipo: typeLabel(e), Importo: e.amount, Quota: e.odd || "",
      Vincita: e.result === "won" ? e.payout : "", Effetto: eff, Saldo: bal, Nota: e.note || ""
    }));
    if (window.XLSX) {
      const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Conto");
      XLSX.writeFile(wb, "combogesss-conto.xlsx");
    } else {
      const head = Object.keys(data[0] || { Data: 1 });
      const csv = [head.join(";")].concat(data.map(r => head.map(h => String(r[h]).replace(/;/g, ",")).join(";"))).join("\n");
      download("combogesss-conto.csv", new Blob([csv], { type: "text/csv" }));
    }
  }

  function onClick(ev) {
    const t = ev.target.closest("[data-ct]");
    if (!t) return;
    const a = t.dataset.ct;
    if (a === "type") {
      UI.type = t.dataset.v; $("#ct-form", root).dataset.type = UI.type;
      t.parentElement.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === t));
      err("");
    }
    else if (a === "add") addEntry();
    else if (a === "won" || a === "lost") setResult(t.dataset.id, a);
    else if (a === "reopen") setResult(t.dataset.id, "open");
    else if (a === "del") { if (confirm("Eliminare questa voce?")) { store(load().filter(x => x.id !== t.dataset.id)); refresh(); } }
    else if (a === "mode") { UI.mode = t.dataset.v; renderDyn(); }
    else if (a === "filter") { UI.filter = t.dataset.v; renderDyn(); }
    else if (a === "export") exportData();
    else if (a === "pt") {
      const p = (window.__ctPts || [])[+t.dataset.i], cap = $("#ct-cap", root);
      if (p && cap) cap.textContent = `${pad(p.r.e.d)}/${pad(p.r.e.m)} · ${typeLabel(p.r.e)} · ${fmt(p.r.eff, true)} · ${UI.mode === "saldo" ? "saldo" : "utile cumulato"} ${fmt(p.v)}`;
    }
  }

  function onChange(ev) {
    const id = ev.target.id;
    if (id === "ct-period") { UI.period = ev.target.value; renderDyn(); }
    else if (id === "ct-r") { $("#ct-form", root).dataset.res = ev.target.value; autoPayout(); }
    else if (id === "ct-a" || id === "ct-o") autoPayout();
  }

  function render(container) {
    root = container;
    const a = load();
    if (autoSettle(a)) store(a);
    root.innerHTML = `<div id="ct-kpi" class="ct-kpis"></div>${formHtml()}<div id="ct-dyn"></div>`;
    renderKpi(); renderDyn();
    if (!root.dataset.bound) {
      root.dataset.bound = "1";
      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);
      root.addEventListener("input", ev => {
        if (ev.target.id === "ct-p") ev.target.dataset.manual = ev.target.value ? "1" : "";
        else if (ev.target.id === "ct-a" || ev.target.id === "ct-o") autoPayout();
      });
    }
  }

  function addFromSchedina(c, btn) {
    const v = prompt(`Quanti ${cur()} punti su questa schedina (@${Number(c.odd).toFixed(2)})?`, "10");
    if (v === null) return;
    const amt = num(v);
    if (!(amt > 0)) { alert("Importo non valido."); return; }
    const t = new Date(), a = load();
    a.push({
      id: uid(), t: Date.now(), type: "schedina", d: t.getDate(), m: t.getMonth() + 1, y: t.getFullYear(),
      amount: r2(amt), odd: r2(c.odd), result: "open", payout: 0, note: "da generatore",
      legs: c.legs.map(l => ({ code: l.code, home: l.home, away: l.away, date: l.date, time: l.time, label: l.label, pct: l.pct, odd: l.odd, oddType: l.oddType }))
    });
    store(a);
    if (btn) btn.textContent = "Aggiunta al Conto ✓";
  }

  /* ---------- Stili ---------- */
  const st = document.createElement("style");
  st.textContent = `
    .ct-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
    .ct-kpi{background:rgba(7,26,54,.72);border:1px solid rgba(56,189,248,.24);border-radius:14px;padding:10px 12px}
    .ct-kl{font-size:calc(10px * var(--cg-fs,1));text-transform:uppercase;letter-spacing:.07em;color:#86b3d8}
    .ct-kv{font-size:calc(17px * var(--cg-fs,1));font-weight:800;margin-top:3px}
    .ct-big{font-family:Orbitron,sans-serif;font-size:calc(21px * var(--cg-fs,1));color:#67e8f9}
    .ct-pos{color:#34d399}.ct-neg{color:#f87171}.ct-amber{color:#fbbf24}.ct-cy{color:#22d3ee}.ct-or{color:#fb923c}
    .ct-dim{color:#86b3d8}.ct-s{font-size:calc(11px * var(--cg-fs,1));font-weight:400}
    .ct-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
    .ct-head h3,.cg-card h3{margin:0;font-family:Orbitron,sans-serif;font-size:calc(14px * var(--cg-fs,1));letter-spacing:.04em}
    .ct-seg{display:flex;border:1px solid rgba(56,189,248,.3);border-radius:999px;overflow:hidden;flex-wrap:wrap}
    .ct-seg button{background:transparent;border:0;color:#b4d6f2;padding:6px 12px;font-size:calc(12px * var(--cg-fs,1));font-weight:700;cursor:pointer}
    .ct-seg button.on{background:linear-gradient(135deg,#0891b2,#2563eb);color:#fff}
    .ct-sel,.ct-form input,.ct-form select{background:rgba(2,12,30,.8);color:#e6f4ff;border:1px solid rgba(56,189,248,.3);border-radius:8px;padding:7px 8px;font-size:calc(13px * var(--cg-fs,1));font-family:inherit;width:100%}
    .ct-sel{width:auto}
    .ct-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:10px}
    .ct-fields label{display:flex;flex-direction:column;gap:4px;font-size:calc(10px * var(--cg-fs,1));text-transform:uppercase;letter-spacing:.06em;color:#86b3d8}
    .ct-wide{grid-column:1/-1}
    .ct-form[data-type=deposito] .ct-sch,.ct-form[data-type=prelievo] .ct-sch{display:none!important}
    .ct-pay{display:none!important}
    .ct-form[data-type=schedina][data-res=won] .ct-pay{display:flex!important}
    .ct-l-mov{display:none}
    .ct-form:not([data-type=schedina]) .ct-l-mov{display:inline}
    .ct-form:not([data-type=schedina]) .ct-l-sch{display:none}
    .ct-err{color:#f87171;font-size:calc(12px * var(--cg-fs,1));min-height:16px;margin-bottom:6px}
    .ct-svg{width:100%;height:auto;display:block}
    .ct-legend{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:calc(11px * var(--cg-fs,1));color:#b4d6f2;margin-top:6px}
    .ct-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:3px}
    .ct-row{display:grid;grid-template-columns:52px 1fr auto;gap:8px 10px;align-items:start;padding:10px 10px 10px 12px;margin:6px 0;border-radius:12px;background:rgba(7,26,54,.6);border:1px solid color-mix(in srgb,var(--c) 40%,transparent);border-left:4px solid var(--c)}
    .ct-date{font-weight:800;font-size:calc(14px * var(--cg-fs,1));line-height:1.2}
    .ct-chip{font-size:calc(10px * var(--cg-fs,1));font-weight:800;padding:2px 8px;border-radius:999px;color:var(--c);border:1px solid var(--c);background:color-mix(in srgb,var(--c) 16%,transparent)}
    .ct-note{font-size:calc(12px * var(--cg-fs,1));color:#b4d6f2}
    .ct-amt{text-align:right;font-weight:800;font-size:calc(15px * var(--cg-fs,1));white-space:nowrap}
    .ct-act{grid-column:2/-1;display:flex;gap:6px;flex-wrap:wrap}
    .ct-ab{background:transparent;border:1px solid var(--c,rgba(56,189,248,.35));color:#e6f4ff;border-radius:8px;padding:3px 9px;font-size:calc(11px * var(--cg-fs,1));font-weight:700;cursor:pointer}
    .ct-det{font-size:calc(11px * var(--cg-fs,1));color:#b4d6f2;margin-top:3px}.ct-det summary{cursor:pointer;color:#67e8f9}
    .ct-mini{padding:4px 10px!important;font-size:calc(11px * var(--cg-fs,1))!important}
    .ct-empty{text-align:center;color:#86b3d8;font-size:calc(13px * var(--cg-fs,1));padding:22px}
  `;
  document.head.appendChild(st);

  window.CGConto = { render, getSummary, addFromSchedina, fmt };
})();
