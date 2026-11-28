/* ComboGesss — Formazioni e assenze (fonte: fantacalcio.it, solo Serie A).
   Legge DUE file dalla cartella ./Formazioni/ :
     1) la pagina "Probabili formazioni Serie A" salvata come HTML
     2) l'Excel "Statistiche Fantacalcio Stagione ..."
   e li incrocia tramite l'ID del giocatore (lo stesso nell'HTML e nell'Excel).
   Espone:
     cgFormazioniFill(root)      → riempie i segnaposto .cg-fz nelle card partita
     cgFormazioniPanel(match)    → HTML della scheda "Formazioni" (schermata statistiche)
     cgFormazioniReady()         → Promise risolta a caricamento finito
     cgFormazioni.reload()       → ricarica i file                                        */
(function () {
  "use strict";

  /* Nomi file provati in ordine (la cartella è ./Formazioni/ nella radice del sito). */
  var FILES = {
    html: ["./Formazioni/Probabili_formazioni_Serie_A.html", "./Formazioni/probabili-formazioni-serie-a.html",
           "./Formazioni/Probabili formazioni Serie A.html"],
    xlsx: ["./Formazioni/Statistiche_Fantacalcio_Stagione_2026_27.xlsx", "./Formazioni/Statistiche_Fantacalcio.xlsx"]
  };
  var LEAGUES = { I1: true };                       // le formazioni esistono solo per la Serie A
  var ALIAS = { internazionale: "inter", acmilan: "milan", hellasverona: "verona" };

  var store = empty();
  var readyP = Promise.resolve();

  function empty() { return { matches: {}, players: {}, teams: {}, htmlOk: false, xlsxOk: false }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function norm(s) {
    var n = String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    return ALIAS[n] || n;
  }
  function key(h, a) { return norm(h) + "|" + norm(a); }
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; }
  function txt(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  function idFromHref(href) { var m = String(href || "").match(/\/(\d+)\/?$/); return m ? m[1] : null; }

  /* ---------- caricamento ---------- */
  function fetchFirst(list, kind) {
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(null);
      var url = list[i++] + (list[i - 1].indexOf("?") < 0 ? "?t=" + Date.now() : "");
      return fetch(url, { cache: "no-store" }).then(function (r) {
        if (!r.ok) return next();
        return kind === "text" ? r.text() : r.arrayBuffer();
      }).catch(next);
    }
    return next();
  }

  function parseXlsx(buf) {
    if (typeof XLSX === "undefined") return;
    var wb = XLSX.read(buf, { type: "array" });
    var ws = wb.Sheets["Tutti"] || wb.Sheets[wb.SheetNames[0]];
    // riga 1 = titolo del file, riga 2 = intestazioni
    var rows = XLSX.utils.sheet_to_json(ws, { range: 1, defval: "" });
    rows.forEach(function (r) {
      if (r.Id === "" || r.Id == null) return;
      var p = {
        id: String(r.Id), role: r.R, mantra: r.Rm, name: r.Nome, team: r.Squadra,
        pv: num(r.Pv), mv: num(r.Mv), fm: num(r.Fm), gf: num(r.Gf), gs: num(r.Gs),
        rp: num(r.Rp), rc: num(r.Rc), rPlus: num(r["R+"]), rMinus: num(r["R-"]),
        ass: num(r.Ass), amm: num(r.Amm), esp: num(r.Esp), au: num(r.Au)
      };
      store.players[p.id] = p;
      var t = store.teams[norm(p.team)] || (store.teams[norm(p.team)] = { ga: 0, gf: 0, pen: null });
      t.ga += p.gf + p.ass; t.gf += p.gf;
      if (p.rc > 0 && (!t.pen || p.rc > t.pen.rc)) t.pen = p;
    });
    store.xlsxOk = Object.keys(store.players).length > 0;
  }

  function playerItem(li) {
    var a = li.querySelector("a.player-link");
    var bar = li.querySelector(".progress-bar");
    var role = li.querySelector(".role");
    return {
      id: a ? idFromHref(a.getAttribute("href")) : null,
      name: txt(a && a.querySelector("span") || a),
      role: role ? role.getAttribute("data-value") : "",
      pct: bar ? num(bar.getAttribute("aria-valuenow")) : num(txt(li.querySelector(".progress-value"))),
      status: li.getAttribute("data-status") || ""
    };
  }
  function linkItem(li) {
    var a = li.querySelector("a.player-link");
    var d = li.querySelector(".description");
    return { id: a ? idFromHref(a.getAttribute("href")) : null, name: txt(a), note: txt(d) };
  }
  function sideContents(li, cls) {
    var sec = li.querySelector("section." + cls);
    return sec ? Array.prototype.filter.call(sec.children, function (c) { return c.classList.contains("content"); }) : [];
  }

  function parseHtml(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var n = 0;
    doc.querySelectorAll('li[id^="match-"]').forEach(function (li) {
      var hm = li.querySelector(".match-pill label.team-home meta[itemprop='name']");
      var am = li.querySelector(".match-pill label.team-away meta[itemprop='name']");
      var home = hm ? hm.getAttribute("content") : txt(li.querySelector(".match-pill label.team-home"));
      var away = am ? am.getAttribute("content") : txt(li.querySelector(".match-pill label.team-away"));
      if (!home || !away) return;
      var cards = li.querySelectorAll(".team-card");
      var comments = li.querySelectorAll("section.match-comment .col");
      var info = li.querySelector(".match-info");
      var m = {
        home: home, away: away,
        kickoff: txt(info && info.querySelector(".match-date")),
        stadium: txt(info && info.querySelector(".match-stadium")),
        updated: txt(li.querySelector(".last-update .date")),
        sides: []
      };
      var secs = { ballots: sideContents(li, "ballots"), susp: sideContents(li, "suspendeds"),
                   caut: sideContents(li, "cautioneds"), inj: sideContents(li, "injureds"), dub: sideContents(li, "dubts") };
      for (var i = 0; i < 2; i++) {
        var c = cards[i];
        var side = {
          team: i === 0 ? home : away,
          formation: txt(c && c.querySelector(".team-formation")),
          starters: c ? Array.prototype.map.call(c.querySelectorAll("ul.starters > li.player-item"), playerItem) : [],
          reserves: c ? Array.prototype.map.call(c.querySelectorAll("ul.reserves > li.player-item"), playerItem) : [],
          ballots: [], suspended: [], cautioned: [], injured: [], doubts: [],
          comment: txt(comments[i] && comments[i].querySelector(".comment"))
        };
        var b = secs.ballots[i];
        if (b) b.querySelectorAll(".ballot").forEach(function (bl) {
          var opts = Array.prototype.map.call(bl.querySelectorAll("li.dot"), function (o) {
            var a = o.querySelector("a.player-link");
            return { id: a ? idFromHref(a.getAttribute("href")) : null, name: txt(a), pct: num(txt(o.querySelector(".percentage"))) };
          });
          side.ballots.push({ options: opts, note: txt(bl.querySelector("li.comment")) });
        });
        function list(sec, sel) { return sec ? Array.prototype.map.call(sec.querySelectorAll(sel), linkItem) : []; }
        side.suspended = list(secs.susp[i], "li");
        side.cautioned = list(secs.caut[i], "li");
        side.injured = list(secs.inj[i], "li");
        side.doubts = list(secs.dub[i], "li");
        m.sides.push(side);
      }
      store.matches[key(home, away)] = m; n++;
    });
    store.htmlOk = n > 0;
  }

  function load() {
    store = empty();
    readyP = Promise.all([fetchFirst(FILES.xlsx, "buf"), fetchFirst(FILES.html, "text")]).then(function (r) {
      try { if (r[0]) parseXlsx(r[0]); } catch (e) { console.warn("Formazioni: Excel non letto", e); }
      try { if (r[1]) parseHtml(r[1]); } catch (e) { console.warn("Formazioni: HTML non letto", e); }
      if (!store.htmlOk) console.info("Formazioni: file non trovati in ./Formazioni/ (sezione nascosta).");
    });
    return readyP;
  }

  /* ---------- analisi ---------- */
  function stat(id) { return id && store.players[id] ? store.players[id] : null; }
  function ga(p) { return p ? p.gf + p.ass : 0; }

  function analyze(side) {
    var t = store.teams[norm(side.team)];
    var totalGA = t ? t.ga : 0;
    // "da valutare" = dubbio; tutti gli altri infortunati = fuori
    var out = [], doubt = side.doubts.slice();
    side.injured.forEach(function (x) { (/da valutare/i.test(x.note) ? doubt : out).push(x); });
    side.suspended.forEach(function (x) { out.push({ id: x.id, name: x.name, note: "squalificato" }); });
    function share(arr) {
      if (!totalGA) return 0;
      var s = 0; arr.forEach(function (x) { s += ga(stat(x.id)); });
      return Math.min(100, s / totalGA * 100);
    }
    function top(arr) {
      return arr.map(function (x) { return { x: x, p: stat(x.id) }; })
        .filter(function (o) { return o.p && ga(o.p) > 0; })
        .sort(function (a, b) { return ga(b.p) - ga(a.p); }).slice(0, 3);
    }
    var avg = side.starters.length ? side.starters.reduce(function (s, p) { return s + p.pct; }, 0) / side.starters.length : 0;
    var official = side.starters.length === 11 && side.starters.every(function (p) { return p.pct >= 100; });
    var pen = null;
    if (t && t.pen) {
      var pid = t.pen.id, inXI = side.starters.some(function (p) { return p.id === pid; }),
          isOut = out.some(function (x) { return x.id === pid; }),
          isDoubt = doubt.some(function (x) { return x.id === pid; });
      pen = { p: t.pen, state: isOut ? "out" : isDoubt ? "doubt" : inXI ? "xi" : "bench" };
    }
    return { out: out, doubt: doubt, offOut: share(out), offDoubt: share(doubt), topOut: top(out), topDoubt: top(doubt),
             avg: avg, official: official, pen: pen };
  }

  function findMatch(home, away) { return store.matches[key(home, away)] || null; }

  /* ---------- rendering ---------- */
  var C = { cy: "#67e8f9", am: "#fcd34d", ro: "#fca5a5", em: "#6ee7b7", mu: "#86b3d8", tx: "#d7ecff", bd: "rgba(56,189,248,.22)", bg: "rgba(2,12,30,.55)" };
  var ROLE = { p: ["P", "#fcd34d"], d: ["D", "#6ee7b7"], c: ["C", "#7dd3fc"], a: ["A", "#fca5a5"] };
  function lvl(share) { return share >= 20 ? C.ro : share >= 10 ? C.am : C.em; }
  function pctColor(p) { return p >= 80 ? C.em : p >= 55 ? C.tx : p >= 40 ? C.am : C.ro; }
  function sep() { return '<span style="color:#3f6c92">|</span>'; }
  function ga2(p) { return p.gf + "G " + p.ass + "A"; }

  function cardLine(m) {
    var a = [analyze(m.sides[0]), analyze(m.sides[1])];
    function chip(i) {
      var s = m.sides[i], x = a[i];
      var abs = x.offOut >= 1 ? ' <span style="color:' + lvl(x.offOut) + '" title="Quota di gol+assist stagionali dei giocatori fuori">−' + Math.round(x.offOut) + '% att.</span>' : "";
      var dub = x.offDoubt >= 5 ? ' <span style="color:' + C.am + '" title="Quota di gol+assist dei giocatori in dubbio">?' + Math.round(x.offDoubt) + '%</span>' : "";
      return '<span style="font-size:11px;color:' + C.tx + '"><b>' + esc(s.formation || "n/d") + '</b> <span style="color:' + C.mu + '" title="Titolarità media dell\'undici">tit. ' + Math.round(x.avg) + '%</span>' + abs + dub + '</span>';
    }
    function who(i) {
      var x = a[i], names = x.topOut.map(function (o) { return esc(o.x.name) + " (" + ga2(o.p) + ")"; });
      return names.length ? '<div style="font-size:11px;color:' + C.mu + ';margin-top:2px"><span style="color:' + C.ro + '">Fuori ' + esc(m.sides[i].team) + ':</span> ' + names.join(", ") + '</div>' : "";
    }
    return '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:' + C.mu + ';margin-top:6px">Formazioni' +
      (a[0].official && a[1].official ? ' <span style="color:' + C.em + '">• ufficiali</span>' : '') + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:2px">' + chip(0) + sep() + chip(1) + '</div>' + who(0) + who(1);
  }

  function row(p, role) {
    var s = stat(p.id), r = ROLE[p.role] || ["", C.mu];
    return '<div style="display:grid;grid-template-columns:20px 1fr 78px 34px 34px 40px;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid rgba(56,189,248,.08);font-size:12px">' +
      '<span style="color:' + r[1] + ';font-weight:800;font-size:11px">' + r[0] + '</span>' +
      '<span style="color:' + C.tx + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span>' +
      '<span style="display:flex;align-items:center;gap:4px"><span style="flex:1;height:5px;border-radius:3px;background:rgba(148,163,184,.18);overflow:hidden"><span style="display:block;height:100%;width:' + Math.min(100, p.pct) + '%;background:' + pctColor(p.pct) + '"></span></span><b style="color:' + pctColor(p.pct) + ';font-size:11px;min-width:30px;text-align:right">' + Math.round(p.pct) + '%</b></span>' +
      '<span style="color:' + C.mu + ';text-align:center" title="Media voto">' + (s ? s.mv.toFixed(2) : "–") + '</span>' +
      '<span style="color:' + C.am + ';text-align:center" title="Fantamedia">' + (s ? s.fm.toFixed(2) : "–") + '</span>' +
      '<span style="color:' + C.cy + ';text-align:center" title="' + (p.role === "p" ? "Gol subiti" : "Gol + assist") + '">' + (s ? (p.role === "p" ? "−" + s.gs : s.gf + "+" + s.ass) : "–") + '</span></div>';
  }

  function block(title, color, items, extra) {
    if (!items.length) return "";
    return '<div style="margin-top:10px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:' + color + '">' + title + ' (' + items.length + ')</div>' +
      items.map(function (x) {
        var s = stat(x.id);
        return '<div style="font-size:12px;color:' + C.tx + ';padding:2px 0"><b>' + esc(x.name) + '</b>' +
          (s ? ' <span style="color:' + C.mu + '">' + esc(s.role) + ' • ' + ga2(s) + ' • Fm ' + s.fm.toFixed(2) + '</span>' : '') +
          (x.note ? '<div style="color:' + C.mu + ';font-size:11px">' + esc(x.note) + '</div>' : '') + '</div>';
      }).join("") + '</div>';
  }

  function sidePanel(s, x) {
    var h = '<div style="border:1px solid ' + C.bd + ';background:' + C.bg + ';border-radius:14px;padding:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><b style="font-size:15px;color:' + C.am + '">' + esc(s.team) + '</b>' +
      '<span style="font-size:12px;color:' + C.tx + '"><b>' + esc(s.formation || "n/d") + '</b> • tit. media <b style="color:' + pctColor(x.avg) + '">' + Math.round(x.avg) + '%</b></span></div>';
    h += '<div style="font-size:11px;color:' + C.mu + ';margin-top:4px">Gol+assist fuori: <b style="color:' + lvl(x.offOut) + '">' + Math.round(x.offOut) + '%</b>' +
      (x.offDoubt >= 1 ? ' • in dubbio: <b style="color:' + C.am + '">' + Math.round(x.offDoubt) + '%</b>' : '') + ' <span style="opacity:.8">(quota stagionale della squadra)</span></div>';
    if (x.pen) {
      var st = { xi: ["in campo", C.em], bench: ["non nell'undici", C.am], doubt: ["in dubbio", C.am], out: ["assente", C.ro] }[x.pen.state];
      h += '<div style="font-size:11px;color:' + C.mu + ';margin-top:2px">Rigorista: <b style="color:' + C.tx + '">' + esc(x.pen.p.name) + '</b> (' + x.pen.p.rPlus + '/' + x.pen.p.rc + ') — <b style="color:' + st[1] + '">' + st[0] + '</b></div>';
    }
    h += '<div style="display:grid;grid-template-columns:20px 1fr 78px 34px 34px 40px;gap:6px;font-size:10px;color:' + C.mu + ';margin:10px 0 2px;text-transform:uppercase"><span></span><span>Undici</span><span>Titolare</span><span style="text-align:center">Mv</span><span style="text-align:center">Fm</span><span style="text-align:center">G+A</span></div>';
    h += s.starters.map(row).join("");
    if (s.reserves.length) {
      h += '<div style="margin-top:10px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:' + C.mu + '">Panchina</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' +
        s.reserves.slice().sort(function (a, b) { return b.pct - a.pct; }).map(function (p) {
          return '<span style="font-size:11px;padding:2px 7px;border-radius:999px;border:1px solid ' + C.bd + ';color:' + C.tx + '">' + esc(p.name) + ' <b style="color:' + pctColor(p.pct) + '">' + Math.round(p.pct) + '%</b></span>';
        }).join("") + '</div>';
    }
    if (s.ballots.length) {
      h += '<div style="margin-top:10px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:' + C.cy + '">Ballottaggi</div>' +
        s.ballots.map(function (b) {
          return '<div style="font-size:12px;color:' + C.tx + ';padding:2px 0">' + b.options.map(function (o) { return esc(o.name) + ' <b style="color:' + pctColor(o.pct) + '">' + Math.round(o.pct) + '%</b>'; }).join(' <span style="color:#3f6c92">vs</span> ') +
            (b.note ? '<div style="color:' + C.mu + ';font-size:11px">' + esc(b.note) + '</div>' : '') + '</div>';
        }).join("") + '</div>';
    }
    h += block("Fuori", C.ro, x.out, true) + block("In dubbio", C.am, x.doubt, true) + block("Diffidati", C.am, s.cautioned);
    if (s.comment) h += '<div style="margin-top:10px;font-size:12px;line-height:1.45;color:' + C.mu + '">' + esc(s.comment) + '</div>';
    return h + '</div>';
  }

  function panel(match) {
    var m = findMatch(match.home, match.away);
    if (!m) return '<div style="padding:14px;border:1px solid ' + C.bd + ';border-radius:12px;color:' + C.mu + ';font-size:13px">Formazioni non disponibili per questa partita: la pagina salvata in <b>Formazioni/</b> contiene solo la giornata in corso.</div>';
    var a = [analyze(m.sides[0]), analyze(m.sides[1])];
    return '<div style="font-size:11px;color:' + C.mu + ';margin-bottom:8px">Probabili formazioni da fantacalcio.it' + (m.updated ? ' • aggiornate al <b>' + esc(m.updated) + '</b>' : '') +
      (a[0].official && a[1].official ? ' • <b style="color:' + C.em + '">formazioni ufficiali</b>' : '') + (m.kickoff ? ' • ' + esc(m.kickoff) : '') + (m.stadium ? ' • ' + esc(m.stadium) : '') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">' + sidePanel(m.sides[0], a[0]) + sidePanel(m.sides[1], a[1]) + '</div>' +
      (store.xlsxOk ? '' : '<div style="margin-top:8px;font-size:11px;color:' + C.am + '">Excel statistiche non trovato: mancano medie voto, gol e assist.</div>');
  }

  /* ---------- API ---------- */
  window.cgFormazioniFill = function (root) {
    var nodes = (root || document).querySelectorAll(".cg-fz:not([data-done])");
    if (!nodes.length) return;
    nodes.forEach(function (el) { el.setAttribute("data-done", "1"); });
    readyP.then(function () {
      nodes.forEach(function (el) {
        if (!el.isConnected) return;
        var m = findMatch(el.getAttribute("data-home"), el.getAttribute("data-away"));
        if (m) el.innerHTML = cardLine(m);
      });
    });
  };
  window.cgFormazioniEnabled = function (leagueCode) { return !!LEAGUES[leagueCode]; };
  window.cgFormazioniPanel = panel;
  window.cgFormazioniReady = function () { return readyP; };
  window.cgFormazioni = { reload: function () { return load().then(function () {
    document.querySelectorAll(".cg-fz[data-done]").forEach(function (e) { e.removeAttribute("data-done"); });
    window.cgFormazioniFill(document); }); }, store: function () { return store; } };

  // "Aggiorna dati" ricarica anche le formazioni
  if (typeof window.autoLoadComboGesssData === "function") {
    var orig = window.autoLoadComboGesssData;
    window.autoLoadComboGesssData = function (force) {
      var r = orig.apply(this, arguments);
      if (force) window.cgFormazioni.reload();
      return r;
    };
  }

  load().then(function () { window.cgFormazioniFill(document); });
})();
