(function () {
  const OVERLAY_ID = "combogesssMatchStatsOverlay";

  function toPct(val) {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    const fixed = num.toFixed(1);
    return `${fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed.replace(".", ",")}%`;
  }

  function formatMatchDate(val) {
    if (val === null || val === undefined || val === "") return "Data N/D";
    if (typeof val === "number" && Number.isFinite(val)) {
      const serialDays = Math.floor(val);
      const utcMs = Date.UTC(1899, 11, 30) + serialDays * 86400000;
      const d = new Date(utcMs);
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    }
    const str = String(val).trim();
    if (/^\d+(\.\d+)?$/.test(str)) return formatMatchDate(parseFloat(str));
    return str;
  }

  function formatMatchTime(val) {
    if (val === null || val === undefined || val === "") return "";
    if (typeof val === "number" && Number.isFinite(val)) {
      const dayFraction = val % 1;
      const totalMinutes = Math.round(dayFraction * 24 * 60) % (24 * 60);
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const mm = String(totalMinutes % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    const str = String(val).trim();
    if (/^\d+(\.\d+)?$/.test(str)) return formatMatchTime(parseFloat(str));
    return str.slice(0, 5);
  }

  function renderFormPills(arr) {
    return (arr || []).slice(-5).map(res => {
      const label = res === "W" ? "V" : res === "D" ? "P" : "S";
      const cls = res === "W"
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        : res === "D"
        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
        : "bg-rose-500/20 text-rose-300 border-rose-500/40";
      return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-extrabold border ${cls}">${label}</span>`;
    }).join("");
  }

  function collectTeamHistoricalMatches(teamName, leagueCode, resultsRows) {
    const target = String(teamName || "").trim().toLowerCase();
    const divTarget = String(leagueCode || "").trim().toUpperCase();
    const rows = Array.isArray(resultsRows) ? resultsRows : [];

    return rows
      .filter(r => {
        const div = String(r.Div || r.DivCode || "").trim().toUpperCase();
        if (divTarget && div && div !== divTarget) return false;
        const h = String(r.HomeTeam || r.Home || "").trim().toLowerCase();
        const a = String(r.AwayTeam || r.Away || "").trim().toLowerCase();
        const hg = Number(r.FTHG);
        const ag = Number(r.FTAG);
        return (h === target || a === target) && Number.isFinite(hg) && Number.isFinite(ag);
      })
      .map(r => {
        const h = String(r.HomeTeam || r.Home || "").trim().toLowerCase();
        const isHome = h === target;
        const hg = Number(r.FTHG);
        const ag = Number(r.FTAG);
        const gf = isHome ? hg : ag;
        const ga = isHome ? ag : hg;
        const totalGoals = hg + ag;
        const ftr = String(r.FTR || "").trim().toUpperCase() || (hg > ag ? "H" : hg < ag ? "A" : "D");
        const outcome = ftr === "D" ? "D" : ((isHome && ftr === "H") || (!isHome && ftr === "A") ? "W" : "L");

        return {
          isHome,
          gf,
          ga,
          totalGoals,
          btts: hg > 0 && ag > 0,
          outcome,
          ftr
        };
      });
  }

  function computeMatchMarkets(match, leagueCode, resultsRows) {
    const homeHist = collectTeamHistoricalMatches(match.home, leagueCode, resultsRows);
    const awayHist = collectTeamHistoricalMatches(match.away, leagueCode, resultsRows);

    const homeN = homeHist.length || 1;
    const awayN = awayHist.length || 1;

    const rate = (arr, pred, fallbackPct) => {
      if (!arr.length) return fallbackPct;
      const hits = arr.filter(pred).length;
      return (hits / arr.length) * 100;
    };

    // Probabilità base 1, X, 2 combinando casa e trasferta
    const hWin = rate(homeHist.filter(x => x.isHome).length ? homeHist.filter(x => x.isHome) : homeHist, x => x.outcome === "W", 44);
    const hDraw = rate(homeHist.filter(x => x.isHome).length ? homeHist.filter(x => x.isHome) : homeHist, x => x.outcome === "D", 27);
    const hLoss = rate(homeHist.filter(x => x.isHome).length ? homeHist.filter(x => x.isHome) : homeHist, x => x.outcome === "L", 29);

    const aWin = rate(awayHist.filter(x => !x.isHome).length ? awayHist.filter(x => !x.isHome) : awayHist, x => x.outcome === "W", 30);
    const aDraw = rate(awayHist.filter(x => !x.isHome).length ? awayHist.filter(x => !x.isHome) : awayHist, x => x.outcome === "D", 28);
    const aLoss = rate(awayHist.filter(x => !x.isHome).length ? awayHist.filter(x => !x.isHome) : awayHist, x => x.outcome === "L", 42);

    const p1Raw = (hWin + aLoss) / 2;
    const pxRaw = (hDraw + aDraw) / 2;
    const p2Raw = (hLoss + aWin) / 2;
    const sum1X2 = Math.max(1, p1Raw + pxRaw + p2Raw);

    const p1 = (p1Raw / sum1X2) * 100;
    const px = (pxRaw / sum1X2) * 100;
    const p2 = (p2Raw / sum1X2) * 100;

    const p1X = Math.min(99, p1 + px);
    const pX2 = Math.min(99, px + p2);
    const p12 = Math.min(99, p1 + p2);

    // Over / Under su media combinata delle due squadre
    const combined = [...homeHist.slice(-10), ...awayHist.slice(-10)];
    const avgCombined = (arr, pred, fallback) => {
      if (!arr.length) return fallback;
      return (arr.filter(pred).length / arr.length) * 100;
    };

    const ov15 = avgCombined(combined, x => x.totalGoals > 1.5, 76);
    const ov25 = avgCombined(combined, x => x.totalGoals > 2.5, 54);
    const ov35 = avgCombined(combined, x => x.totalGoals > 3.5, 29);
    const ov45 = avgCombined(combined, x => x.totalGoals > 4.5, 13);

    const un15 = Math.max(1, 100 - ov15);
    const un25 = Math.max(1, 100 - ov25);
    const un35 = Math.max(1, 100 - ov35);
    const un45 = Math.max(1, 100 - ov45);

    const gg = avgCombined(combined, x => x.btts, 55);
    const ng = Math.max(1, 100 - gg);

    const mg14 = avgCombined(combined, x => x.totalGoals >= 1 && x.totalGoals <= 4, 78);
    const mg25 = avgCombined(combined, x => x.totalGoals >= 2 && x.totalGoals <= 5, 68);

    // Helper per combo congiunte (stima con leggero fattore di correlazione positiva)
    const joint = (aPct, bPct, boost = 1.06) => Math.min(98, Math.max(1, ((aPct / 100) * (bPct / 100)) * 100 * boost));

    return {
      sampleInfo: `${homeN} gare ${match.home} • ${awayN} gare ${match.away}`,
      families: [
        {
          title: "Esiti 1X2 & Doppia Chance",
          items: [
            { label: "1", pct: p1 },
            { label: "X", pct: px },
            { label: "2", pct: p2 },
            { label: "1X", pct: p1X },
            { label: "X2", pct: pX2 },
            { label: "12", pct: p12 }
          ]
        },
        {
          title: "Over / Under Totali",
          items: [
            { label: "Over 1,5", pct: ov15 },
            { label: "Over 2,5", pct: ov25 },
            { label: "Over 3,5", pct: ov35 },
            { label: "Over 4,5", pct: ov45 },
            { label: "Under 1,5", pct: un15 },
            { label: "Under 2,5", pct: un25 },
            { label: "Under 3,5", pct: un35 },
            { label: "Under 4,5", pct: un45 }
          ]
        },
        {
          title: "Gol / No Gol & Multigol Totali",
          items: [
            { label: "GG", pct: gg },
            { label: "NG", pct: ng },
            { label: "Multigol 1-4 Totali", pct: mg14 },
            { label: "Multigol 2-5 Totali", pct: mg25 }
          ]
        },
        {
          title: "Combo Fisse (1, X, 2)",
          items: [
            { label: "1 + Over 1,5", pct: joint(p1, ov15, 1.12) },
            { label: "1 + Over 2,5", pct: joint(p1, ov25, 1.08) },
            { label: "1 + Under 3,5", pct: joint(p1, un35, 1.08) },
            { label: "1 + GG", pct: joint(p1, gg, 1.02) },
            { label: "X + Under 2,5", pct: joint(px, un25, 1.15) },
            { label: "X + GG", pct: joint(px, gg, 1.10) },
            { label: "2 + Over 1,5", pct: joint(p2, ov15, 1.12) },
            { label: "2 + Over 2,5", pct: joint(p2, ov25, 1.08) },
            { label: "2 + Under 3,5", pct: joint(p2, un35, 1.08) },
            { label: "2 + GG", pct: joint(p2, gg, 1.02) }
          ]
        },
        {
          title: "Combo Doppia Chance + Over / Under",
          items: [
            { label: "1X + Over 1,5", pct: joint(p1X, ov15, 1.08) },
            { label: "1X + Over 2,5", pct: joint(p1X, ov25, 1.05) },
            { label: "1X + Under 2,5", pct: joint(p1X, un25, 1.06) },
            { label: "1X + Under 3,5", pct: joint(p1X, un35, 1.08) },
            { label: "X2 + Over 1,5", pct: joint(pX2, ov15, 1.08) },
            { label: "X2 + Over 2,5", pct: joint(pX2, ov25, 1.05) },
            { label: "X2 + Under 2,5", pct: joint(pX2, un25, 1.06) },
            { label: "X2 + Under 3,5", pct: joint(pX2, un35, 1.08) },
            { label: "12 + Over 1,5", pct: joint(p12, ov15, 1.10) },
            { label: "12 + Over 2,5", pct: joint(p12, ov25, 1.08) },
            { label: "12 + Under 3,5", pct: joint(p12, un35, 1.04) }
          ]
        },
        {
          title: "Combo Doppia Chance + Multigol Totali",
          items: [
            { label: "1X + Multigol 1-4 Totali", pct: joint(p1X, mg14, 1.07) },
            { label: "1X + Multigol 2-5 Totali", pct: joint(p1X, mg25, 1.06) },
            { label: "X2 + Multigol 1-4 Totali", pct: joint(pX2, mg14, 1.07) },
            { label: "X2 + Multigol 2-5 Totali", pct: joint(pX2, mg25, 1.06) },
            { label: "12 + Multigol 1-4 Totali", pct: joint(p12, mg14, 1.07) },
            { label: "12 + Multigol 2-5 Totali", pct: joint(p12, mg25, 1.06) }
          ]
        }
      ]
    };
  }

  function ensureOverlayElement() {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.className = "fixed inset-0 z-50 hidden overflow-y-auto bg-slate-950/95 backdrop-blur-md text-slate-100";
    el.innerHTML = `
      <!-- Pulsante sempre in vista in alto a sinistra -->
      <button
        id="backToMatchesBtn"
        type="button"
        class="fixed top-4 left-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-extrabold shadow-xl shadow-emerald-950/60 border border-emerald-300/30 transition cursor-pointer"
      >
        <span>←</span>
        <span>Torna alle partite</span>
      </button>

      <div id="matchStatsScreenContent" class="max-w-6xl mx-auto px-4 pt-20 pb-14 space-y-6"></div>
    `;

    document.body.appendChild(el);

    document.getElementById("backToMatchesBtn").addEventListener("click", () => {
      window.closeMatchStatsScreen();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.classList.contains("hidden")) {
        window.closeMatchStatsScreen();
      }
    });

    return el;
  }

  window.openMatchStatsScreen = function (options) {
    const { match, roundNumber, roundLabel, leagueCode, leagueName, countryName, flagHtml, resultsRows } = options || {};
    if (!match) return;

    const overlay = ensureOverlayElement();
    const content = document.getElementById("matchStatsScreenContent");

    const dateStr = formatMatchDate(match.date);
    const timeStr = formatMatchTime(match.time);
    const dateTimeLabel = [dateStr, timeStr].filter(Boolean).join(" • ");
    const giornataLabel = roundLabel || (roundNumber ? `Giornata ${roundNumber}` : "Giornata");

    const homeFormPct = toPct(match.homeForm ?? 0);
    const awayFormPct = toPct(match.awayForm ?? 0);
    const diffFormPct = toPct(match.diffForm ?? Math.abs((match.homeForm || 0) - (match.awayForm || 0)));

    const computed = computeMatchMarkets(match, leagueCode, resultsRows);

    const familiesHtml = computed.families.map(fam => `
      <section class="rounded-2xl bg-slate-900/85 border border-slate-800 p-4 sm:p-5 space-y-3">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 class="text-sm sm:text-base font-extrabold text-emerald-300 tracking-wide">${fam.title}</h3>
          <span class="text-[11px] text-slate-400">${fam.items.length} mercati</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          ${fam.items.map(item => `
            <div class="rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 px-3 py-2.5 flex items-center justify-between gap-2 transition">
              <span class="text-xs font-bold text-slate-200 leading-tight">${item.label}</span>
              <span class="text-xs sm:text-sm font-extrabold text-emerald-400 shrink-0">${toPct(item.pct)}</span>
            </div>
          `).join("")}
        </div>
      </section>
    `).join("");

    content.innerHTML = `
      <!-- Header Partita -->
      <div class="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-700/70 p-5 sm:p-6 shadow-2xl">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 mb-4">
          <div class="flex items-center gap-2 font-semibold">
            ${flagHtml || ""}
            <span>${leagueName || leagueCode || ""}</span>
            ${countryName ? `<span class="text-slate-500">•</span><span>${countryName}</span>` : ""}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
              ${giornataLabel}
            </span>
            <span class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-semibold">
              ${dateTimeLabel}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 items-center gap-4 text-center">
          <!-- Squadra Casa -->
          <div class="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2.5">
            <div class="text-lg sm:text-xl font-extrabold text-white">${match.home}</div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Stato di forma (ult. 5)</div>
            <div class="flex items-center justify-center gap-1.5">
              ${renderFormPills(match.homeFormArr)}
            </div>
            <div class="text-sm font-extrabold text-emerald-400">${homeFormPct}</div>
          </div>

          <!-- Centro Partita -->
          <div class="space-y-2">
            <div class="text-xs uppercase tracking-widest text-slate-400 font-bold">Partita</div>
            <div class="text-2xl font-black text-white">VS</div>
            ${match.ftResult ? `<div class="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Finale: ${match.ftResult}</div>` : ""}
            <div class="pt-1">
              <div class="text-[11px] text-slate-400">Differenza Forma (Positiva)</div>
              <div class="text-base font-extrabold text-amber-300">${diffFormPct}</div>
            </div>
            <div class="text-[11px] text-slate-500">${computed.sampleInfo}</div>
          </div>

          <!-- Squadra Trasferta -->
          <div class="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2.5">
            <div class="text-lg sm:text-xl font-extrabold text-white">${match.away}</div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Stato di forma (ult. 5)</div>
            <div class="flex items-center justify-center gap-1.5">
              ${renderFormPills(match.awayFormArr)}
            </div>
            <div class="text-sm font-extrabold text-sky-400">${awayFormPct}</div>
          </div>
        </div>
      </div>

      <!-- Famiglie di Giocata -->
      <div class="space-y-5">
        ${familiesHtml}
      </div>
    `;

    overlay.classList.remove("hidden");
    overlay.scrollTop = 0;
  };

  window.closeMatchStatsScreen = function () {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.add("hidden");
    }
  };
})();