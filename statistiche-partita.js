(function () {
  const OVERLAY_ID = "combogesssMatchStatsOverlay";
  const STYLE_ID = "combogesssPctColorStyles";

  function ensureColorStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pct-red {
        color: #f87171 !important;
      }
      .pct-white {
        color: #f8fafc !important;
      }
      .pct-green {
        color: #34d399 !important;
      }
      .pct-gold {
        color: #facc15 !important;
      }
      @keyframes cgGoldPulse {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.45), 0 0 14px rgba(250, 204, 21, 0.28);
          transform: scale(1);
        }
        50% {
          box-shadow: 0 0 0 5px rgba(250, 204, 21, 0.12), 0 0 22px rgba(250, 204, 21, 0.55);
          transform: scale(1.02);
        }
      }
      @keyframes cgBombBounce {
        0%, 100% {
          transform: translateY(0) rotate(-6deg) scale(1);
        }
        50% {
          transform: translateY(-2px) rotate(8deg) scale(1.14);
        }
      }
      .flag-bomb {
        color: #facc15 !important;
        border-color: rgba(250, 204, 21, 0.75) !important;
        background: linear-gradient(135deg, rgba(250, 204, 21, 0.22), rgba(245, 158, 11, 0.12)) !important;
        animation: cgGoldPulse 1.6s infinite ease-in-out;
      }
      .flag-bomb .bomb-icon {
        display: inline-block;
        animation: cgBombBounce 1.1s infinite ease-in-out;
      }
      .standings-team-gold {
        background: linear-gradient(90deg, rgba(250, 204, 21, 0.22), rgba(245, 158, 11, 0.08)) !important;
        border-color: rgba(250, 204, 21, 0.75) !important;
        box-shadow: 0 0 16px rgba(250, 204, 21, 0.2);
      }
      .hist-win {
        background: rgba(16, 185, 129, 0.16);
        border-color: rgba(16, 185, 129, 0.55);
      }
      .hist-draw {
        background: rgba(234, 179, 8, 0.16);
        border-color: rgba(234, 179, 8, 0.55);
      }
      .hist-loss {
        background: rgba(239, 68, 68, 0.16);
        border-color: rgba(239, 68, 68, 0.55);
      }

      /* ===== Tema futuristico (overlay statistiche) ===== */
      #combogesssMatchStatsOverlay {
        font-family: "Exo 2", Inter, system-ui, sans-serif;
        background-color: #020817 !important;
        background-image:
          linear-gradient(rgba(103, 232, 249, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(103, 232, 249, 0.05) 1px, transparent 1px),
          radial-gradient(1000px 620px at 8% -8%, rgba(34, 211, 238, 0.24), transparent 60%),
          radial-gradient(900px 640px at 96% 8%, rgba(59, 130, 246, 0.26), transparent 60%),
          radial-gradient(900px 700px at 55% 112%, rgba(14, 165, 233, 0.20), transparent 62%),
          linear-gradient(160deg, #020617 0%, #061634 45%, #031b30 100%) !important;
        background-size: 48px 48px, 48px 48px, auto, auto, auto, auto !important;
        background-attachment: fixed !important;
      }
      #combogesssMatchStatsOverlay h3 {
        font-family: Orbitron, "Exo 2", sans-serif;
        letter-spacing: 0.05em;
        text-shadow: 0 0 10px rgba(34, 211, 238, 0.45);
      }
      #combogesssMatchStatsOverlay [class*="rounded-2xl"][class*="border"],
      #combogesssMatchStatsOverlay [class*="rounded-xl"][class*="border"] {
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        box-shadow: inset 0 1px 0 rgba(165, 243, 252, 0.07), 0 0 20px rgba(14, 165, 233, 0.07);
      }
      #combogesssMatchStatsOverlay [class^="bg-slate-950"], #combogesssMatchStatsOverlay [class*=" bg-slate-950"] { background-color: rgba(2, 12, 30, 0.78) !important; }
      #combogesssMatchStatsOverlay [class^="bg-slate-900"], #combogesssMatchStatsOverlay [class*=" bg-slate-900"] { background-color: rgba(7, 26, 54, 0.72) !important; }
      #combogesssMatchStatsOverlay [class^="bg-slate-800"], #combogesssMatchStatsOverlay [class*=" bg-slate-800"] { background-color: rgba(10, 38, 74, 0.80) !important; }
      #combogesssMatchStatsOverlay [class*=" border-slate-"], #combogesssMatchStatsOverlay [class^="border-slate-"] { border-color: rgba(56, 189, 248, 0.24) !important; }
      #combogesssMatchStatsOverlay .bg-cyan-600 {
        background-image: linear-gradient(135deg, #0891b2, #2563eb) !important;
        box-shadow: 0 0 18px rgba(34, 211, 238, 0.35);
      }
      #combogesssMatchStatsOverlay .text-slate-300 { color: #b4d6f2 !important; }
      #combogesssMatchStatsOverlay .text-slate-400 { color: #86b3d8 !important; }
      #combogesssMatchStatsOverlay .text-slate-500 { color: #5f8db3 !important; }
    `;
    document.head.appendChild(style);
  }

  function clampPct(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function toPct(val) {
    const num = clampPct(val);
    const fixed = num.toFixed(1);
    return `${fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed.replace(".", ",")}%`;
  }

  function formatOdd(val) {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 1) return "—";
    return n.toFixed(2);
  }

  function fairOddFromPct(pct) {
    const p = clampPct(pct);
    if (p <= 0.5) return "—";
    const raw = 100 / p;
    return Math.min(99.99, Math.max(1.01, raw)).toFixed(2);
  }

  function getPctColorClass(val) {
    const p = clampPct(val);
    if (p >= 90) return "pct-gold";
    if (p >= 66.67) return "pct-green";
    if (p >= 33.34) return "pct-white";
    return "pct-red";
  }

  function renderPctBadge(val, extraClasses = "") {
    const p = clampPct(val);
    const isBomb = p >= 90;
    const colorClass = getPctColorClass(p);
    const bombClass = isBomb ? "flag-bomb" : "";
    return `
      <span class="inline-flex items-center gap-1 font-extrabold ${colorClass} ${bombClass} ${extraClasses}">
        ${isBomb ? `<span class="bomb-icon" aria-hidden="true">💣</span>` : ""}
        <span>${toPct(p)}</span>
      </span>
    `;
  }

  // Parsing rigoroso DD/MM/AAAA (senza mai usare Date.parse su stringhe ambigue)
  function parseDateTimestamp(val) {
    if (val === null || val === undefined || val === "") return null;

    if (val instanceof Date && Number.isFinite(val.getTime())) {
      return Date.UTC(val.getFullYear(), val.getMonth(), val.getDate());
    }

    if (typeof val === "number" && Number.isFinite(val)) {
      const serialDays = Math.floor(val);
      return Date.UTC(1899, 11, 30) + serialDays * 86400000;
    }

    const str = String(val).trim();
    if (!str) return null;

    if (/^\d+(\.\d+)?$/.test(str)) {
      return parseDateTimestamp(parseFloat(str));
    }

    // Estrae la parte data se c'è anche un orario (es. "12/10/2026 15:00")
    const datePart = str.split(/[\sT]+/)[0];

    // DD/MM/AAAA o DD/MM/AA (giorno sempre per primo, mese sempre per secondo)
    const dmy = datePart.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += year >= 70 ? 1900 : 2000;
      if (month < 0 || month > 11 || day < 1 || day > 31) return null;
      const d = new Date(Date.UTC(year, month, day));
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
        return null;
      }
      return d.getTime();
    }

    return null;
  }

  function getEndOfTodayUtc() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999);
  }

  function formatMatchDate(val) {
    if (val === null || val === undefined || val === "") return "Data N/D";
    const ts = parseDateTimestamp(val);
    if (ts !== null) {
      const d = new Date(ts);
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return String(val).trim();
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

  function computeFormScoreFromOutcomes(outcomes) {
    const last5 = (outcomes || []).slice(-5);
    let score = 0;
    for (const r of last5) {
      if (r === "W") score += 20;
      else if (r === "D") score += 7.5;
    }
    return Number(score.toFixed(1));
  }

  function isValidCompletedResult(r) {
    if (r.FTHG === "" || r.FTHG === null || r.FTHG === undefined) return false;
    if (r.FTAG === "" || r.FTAG === null || r.FTAG === undefined) return false;
    const hg = Number(r.FTHG);
    const ag = Number(r.FTAG);
    return Number.isFinite(hg) && Number.isFinite(ag);
  }

  function collectTeamHistoricalMatches(teamName, leagueCode, resultsRows) {
    const target = String(teamName || "").trim().toLowerCase();
    const divTarget = String(leagueCode || "").trim().toUpperCase();
    const rows = Array.isArray(resultsRows) ? resultsRows : [];
    const endOfToday = getEndOfTodayUtc();

    return rows
      .map((r, rowIndex) => {
        const div = String(r.Div || r.DivCode || "").trim().toUpperCase();
        if (divTarget && div && div !== divTarget) return null;

        const rawHome = String(r.HomeTeam || r.Home || "").trim();
        const rawAway = String(r.AwayTeam || r.Away || "").trim();
        const h = rawHome.toLowerCase();
        const a = rawAway.toLowerCase();
        if (h !== target && a !== target) return null;

        if (!isValidCompletedResult(r)) return null;

        const dateTs = parseDateTimestamp(r.Date);
        if (dateTs !== null && dateTs > endOfToday) return null;

        const hg = Number(r.FTHG);
        const ag = Number(r.FTAG);
        const isHome = h === target;
        const gf = isHome ? hg : ag;
        const ga = isHome ? ag : hg;
        const totalGoals = hg + ag;
        const ftr = String(r.FTR || "").trim().toUpperCase() || (hg > ag ? "H" : hg < ag ? "A" : "D");
        const outcome = ftr === "D" ? "D" : ((isHome && ftr === "H") || (!isHome && ftr === "A") ? "W" : "L");

        const homeXG = parseFloat(r.HomeXG ?? r.xG_H ?? r.H_xG);
        const awayXG = parseFloat(r.AwayXG ?? r.xG_A ?? r.A_xG);
        const xgf = isHome ? homeXG : awayXG;

        return {
          rowIndex,
          dateTs: dateTs ?? 0,
          isHome,
          opponent: isHome ? rawAway : rawHome,
          homeName: rawHome,
          awayName: rawAway,
          hg,
          ag,
          gf,
          ga,
          date: formatMatchDate(r.Date),
          totalGoals,
          btts: hg > 0 && ag > 0,
          outcome,
          xgf: Number.isFinite(xgf) ? xgf : null
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.dateTs !== b.dateTs) return a.dateTs - b.dateTs;
        return a.rowIndex - b.rowIndex;
      });
  }

  function computeTeamMetrics(hist, fallbackScored, fallbackConceded) {
    if (!hist.length) {
      const avgScored = fallbackScored;
      const avgConceded = fallbackConceded;
      const xg = Number(((avgScored * 0.65) + (avgConceded * 0.35)).toFixed(2));
      return { avgScored, avgConceded, xg };
    }

    const totalScored = hist.reduce((s, x) => s + x.gf, 0);
    const totalConceded = hist.reduce((s, x) => s + x.ga, 0);
    const avgScored = Number((totalScored / hist.length).toFixed(2));
    const avgConceded = Number((totalConceded / hist.length).toFixed(2));

    const xgRows = hist.filter(x => x.xgf !== null);
    const xg = xgRows.length
      ? Number((xgRows.reduce((s, x) => s + x.xgf, 0) / xgRows.length).toFixed(2))
      : Number(((avgScored * 0.62) + (avgConceded * 0.38)).toFixed(2));

    return { avgScored, avgConceded, xg };
  }

  function poissonPmf(k, lambda) {
    const l = Math.max(0.01, lambda);
    let logP = -l + k * Math.log(l);
    for (let i = 2; i <= k; i++) {
      logP -= Math.log(i);
    }
    return Math.exp(logP);
  }

  function dixonColesTau(x, y, lambdaHome, lambdaAway, rho = -0.06) {
    if (x === 0 && y === 0) return Math.max(0.01, 1 - lambdaHome * lambdaAway * rho);
    if (x === 0 && y === 1) return Math.max(0.01, 1 + lambdaHome * rho);
    if (x === 1 && y === 0) return Math.max(0.01, 1 + lambdaAway * rho);
    if (x === 1 && y === 1) return Math.max(0.01, 1 - rho);
    return 1;
  }

  function buildFamiliesFromRates(match, rates, jointBoost = 1.06) {
    const {
      p1, px, p2,
      p1X, pX2, p12,
      ov15, ov25, ov35, ov45,
      un15, un25, un35, un45,
      gg, ng,
      mg14, mg25
    } = rates;

    const joint = (aPct, bPct, boost = jointBoost) =>
      Math.min(98, Math.max(1, ((aPct / 100) * (bPct / 100)) * 100 * boost));

    const bookOdds = match.bookOdds || {};

    const mkItem = (label, pct, realOddKey) => {
      const hasReal = realOddKey && bookOdds[realOddKey] !== undefined && bookOdds[realOddKey] !== null && bookOdds[realOddKey] !== "";
      const odd = hasReal ? formatOdd(bookOdds[realOddKey]) : fairOddFromPct(pct);
      return {
        label,
        pct,
        odd,
        oddType: hasReal ? "Quota" : "Equa"
      };
    };

    return [
      {
        title: "Fisse",
        layout: "grid-3",
        items: [
          mkItem("1", p1, "1"),
          mkItem("X", px, "X"),
          mkItem("2", p2, "2")
        ]
      },
      {
        title: "DC",
        layout: "grid-3",
        items: [
          mkItem("1X", p1X),
          mkItem("X2", pX2),
          mkItem("12", p12)
        ]
      },
      {
        title: "Over/Under",
        layout: "over-under-rows",
        overItems: [
          mkItem("Over 1,5", ov15),
          mkItem("Over 2,5", ov25, "Ov25"),
          mkItem("Over 3,5", ov35),
          mkItem("Over 4,5", ov45)
        ],
        underItems: [
          mkItem("Under 1,5", un15),
          mkItem("Under 2,5", un25, "Un25"),
          mkItem("Under 3,5", un35),
          mkItem("Under 4,5", un45)
        ]
      },
      {
        title: "Goal",
        layout: "grid-2",
        items: [
          mkItem("GG", gg),
          mkItem("NG", ng)
        ]
      },
      {
        title: "Multigol Totali",
        layout: "grid-2",
        items: [
          mkItem("1-4", mg14),
          mkItem("2-5", mg25)
        ]
      },
      {
        title: "Combo DC+Over",
        layout: "grid-3",
        items: [
          mkItem("1X + Over 1,5", joint(p1X, ov15, 1.08)),
          mkItem("X2 + Over 1,5", joint(pX2, ov15, 1.08)),
          mkItem("12 + Over 1,5", joint(p12, ov15, 1.10))
        ]
      },
      {
        title: "Combo DC+Under",
        layout: "grid-3",
        items: [
          mkItem("1X + Under 4,5", joint(p1X, un45, 1.07)),
          mkItem("X2 + Under 4,5", joint(pX2, un45, 1.07)),
          mkItem("12 + Under 4,5", joint(p12, un45, 1.06))
        ]
      },
      {
        title: "Combo DC+Multigol Totali",
        layout: "grid-3",
        items: [
          mkItem("1X + Multigol 1-4", joint(p1X, mg14, 1.07)),
          mkItem("1X + Multigol 2-5", joint(p1X, mg25, 1.06)),
          mkItem("X2 + Multigol 1-4", joint(pX2, mg14, 1.07)),
          mkItem("X2 + Multigol 2-5", joint(pX2, mg25, 1.06)),
          mkItem("12 + Multigol 1-4", joint(p12, mg14, 1.07)),
          mkItem("12 + Multigol 2-5", joint(p12, mg25, 1.06))
        ]
      }
    ];
  }

  function computeRealFamilies(match, homeHist, awayHist) {
    const rate = (arr, pred, fallbackPct) => {
      if (!arr.length) return fallbackPct;
      const hits = arr.filter(pred).length;
      return (hits / arr.length) * 100;
    };

    const hHome = homeHist.filter(x => x.isHome);
    const aAway = awayHist.filter(x => !x.isHome);

    const hWin = rate(hHome.length ? hHome : homeHist, x => x.outcome === "W", 44);
    const hDraw = rate(hHome.length ? hHome : homeHist, x => x.outcome === "D", 27);
    const hLoss = rate(hHome.length ? hHome : homeHist, x => x.outcome === "L", 29);

    const aWin = rate(aAway.length ? aAway : awayHist, x => x.outcome === "W", 30);
    const aDraw = rate(aAway.length ? aAway : awayHist, x => x.outcome === "D", 28);
    const aLoss = rate(aAway.length ? aAway : awayHist, x => x.outcome === "L", 42);

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

    const combined = [...homeHist.slice(-10), ...awayHist.slice(-10)];

    const ov15 = rate(combined, x => x.totalGoals > 1.5, 76);
    const ov25 = rate(combined, x => x.totalGoals > 2.5, 54);
    const ov35 = rate(combined, x => x.totalGoals > 3.5, 29);
    const ov45 = rate(combined, x => x.totalGoals > 4.5, 13);

    const un15 = Math.max(1, 100 - ov15);
    const un25 = Math.max(1, 100 - ov25);
    const un35 = Math.max(1, 100 - ov35);
    const un45 = Math.max(1, 100 - ov45);

    const gg = rate(combined, x => x.btts, 55);
    const ng = Math.max(1, 100 - gg);

    const mg14 = rate(combined, x => x.totalGoals >= 1 && x.totalGoals <= 4, 78);
    const mg25 = rate(combined, x => x.totalGoals >= 2 && x.totalGoals <= 5, 68);

    return buildFamiliesFromRates(match, {
      p1, px, p2,
      p1X, pX2, p12,
      ov15, ov25, ov35, ov45,
      un15, un25, un35, un45,
      gg, ng,
      mg14, mg25
    }, 1.06);
  }

  function computeDixonColeFamilies(match, leagueCode, resultsRows, homeMetrics, awayMetrics) {
    const divTarget = String(leagueCode || "").trim().toUpperCase();
    const endOfToday = getEndOfTodayUtc();

    const leagueRows = (Array.isArray(resultsRows) ? resultsRows : []).filter(r => {
      const div = String(r.Div || r.DivCode || "").trim().toUpperCase();
      if (divTarget && div && div !== divTarget) return false;
      if (!isValidCompletedResult(r)) return false;
      const dateTs = parseDateTimestamp(r.Date);
      if (dateTs !== null && dateTs > endOfToday) return false;
      return true;
    });

    let leagueAvgHome = 1.48;
    let leagueAvgAway = 1.18;

    if (leagueRows.length >= 10) {
      leagueAvgHome = Math.max(0.6, leagueRows.reduce((s, r) => s + Number(r.FTHG), 0) / leagueRows.length);
      leagueAvgAway = Math.max(0.5, leagueRows.reduce((s, r) => s + Number(r.FTAG), 0) / leagueRows.length);
    }

    const baseAvg = Math.max(0.5, (leagueAvgHome + leagueAvgAway) / 2);
    const homeAtt = Math.max(0.45, Math.min(2.2, homeMetrics.avgScored / baseAvg));
    const awayDef = Math.max(0.45, Math.min(2.2, awayMetrics.avgConceded / baseAvg));

    const awayAtt = Math.max(0.45, Math.min(2.2, awayMetrics.avgScored / baseAvg));
    const homeDef = Math.max(0.45, Math.min(2.2, homeMetrics.avgConceded / baseAvg));

    const lambdaHome = Math.max(0.25, Math.min(4.5, leagueAvgHome * homeAtt * awayDef));
    const lambdaAway = Math.max(0.25, Math.min(4.5, leagueAvgAway * awayAtt * homeDef));

    const maxGoals = 7;
    const matrix = [];
    let totalProb = 0;

    for (let h = 0; h <= maxGoals; h++) {
      matrix[h] = [];
      for (let a = 0; a <= maxGoals; a++) {
        const rawP = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway) * dixonColesTau(h, a, lambdaHome, lambdaAway, -0.06);
        matrix[h][a] = rawP;
        totalProb += rawP;
      }
    }

    let p1 = 0, px = 0, p2 = 0;
    let ov15 = 0, ov25 = 0, ov35 = 0, ov45 = 0;
    let gg = 0, mg14 = 0, mg25 = 0;

    const norm = totalProb > 0 ? totalProb : 1;

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const p = (matrix[h][a] / norm) * 100;
        const tot = h + a;

        if (h > a) p1 += p;
        else if (h === a) px += p;
        else p2 += p;

        if (tot > 1.5) ov15 += p;
        if (tot > 2.5) ov25 += p;
        if (tot > 3.5) ov35 += p;
        if (tot > 4.5) ov45 += p;

        if (h > 0 && a > 0) gg += p;
        if (tot >= 1 && tot <= 4) mg14 += p;
        if (tot >= 2 && tot <= 5) mg25 += p;
      }
    }

    const p1X = Math.min(99, p1 + px);
    const pX2 = Math.min(99, px + p2);
    const p12 = Math.min(99, p1 + p2);

    const un15 = Math.max(1, 100 - ov15);
    const un25 = Math.max(1, 100 - ov25);
    const un35 = Math.max(1, 100 - ov35);
    const un45 = Math.max(1, 100 - ov45);
    const ng = Math.max(1, 100 - gg);

    return {
      dcXG: Number((lambdaHome + lambdaAway).toFixed(2)),
      families: buildFamiliesFromRates(match, {
        p1, px, p2,
        p1X, pX2, p12,
        ov15, ov25, ov35, ov45,
        un15, un25, un35, un45,
        gg, ng,
        mg14, mg25
      }, 1.04)
    };
  }

  // ---- Migliori giocate (una per famiglia: DC, Over/Under, Multigol Totali) ----
  const TOP_PICK_FAMILIES = {
    "DC": "DC",
    "Over/Under": "O/U",
    "Multigol Totali": "MG"
  };
  const topPicksCache = new WeakMap();

  // Per ogni famiglia (DC, Over/Under, Multigol Totali) la giocata con % più alta, più la fissa 12+Under 4,5
  function pickBestFromFamilies(families) {
    const out = [];
    for (const title of Object.keys(TOP_PICK_FAMILIES)) {
      const fam = (families || []).find(f => f.title === title);
      if (!fam) continue;
      const items = fam.items ? fam.items : [...(fam.overItems || []), ...(fam.underItems || [])];
      let best = null;
      for (const it of items) {
        if (!best || it.pct > best.pct) {
          best = { label: it.label, pct: it.pct, family: TOP_PICK_FAMILIES[title] };
        }
      }
      if (best) out.push(best);
    }

    // 4ª giocata fissa: 12 + Under 4,5 (dalla famiglia Combo DC+Under)
    const comboFam = (families || []).find(f => f.title === "Combo DC+Under");
    const combo = comboFam && (comboFam.items || []).find(it => String(it.label).replace(/\s+/g, "") === "12+Under4,5");
    if (combo) {
      out.push({ label: "12+Under 4,5", pct: combo.pct, family: "CMB" });
    }
    return out;
  }

  // Usata dalla home: restituisce { real, dixon } per una partita
  window.computeMatchTopPicks = function (match, leagueCode, resultsRows) {
    if (!match) return { real: [], dixon: [] };

    const canCache = Array.isArray(resultsRows);
    let cache = null;
    if (canCache) {
      cache = topPicksCache.get(resultsRows);
      if (!cache) {
        cache = new Map();
        topPicksCache.set(resultsRows, cache);
      }
      const hit = cache.get(`${leagueCode}|${match.id}`);
      if (hit) return hit;
    }

    const homeHist = collectTeamHistoricalMatches(match.home, leagueCode, resultsRows);
    const awayHist = collectTeamHistoricalMatches(match.away, leagueCode, resultsRows);
    const hm = computeTeamMetrics(homeHist, 1.45, 1.05);
    const am = computeTeamMetrics(awayHist, 1.25, 1.25);

    const realFamilies = computeRealFamilies(match, homeHist, awayHist);
    const dcData = computeDixonColeFamilies(match, leagueCode, resultsRows, hm, am);

    const result = {
      real: pickBestFromFamilies(realFamilies),
      dixon: pickBestFromFamilies(dcData.families)
    };

    if (cache) cache.set(`${leagueCode}|${match.id}`, result);
    return result;
  };

  function computeLeagueStandings(match, leagueCode, resultsRows, fixturesRows) {
    const divTarget = String(leagueCode || "").trim().toUpperCase();
    const endOfToday = getEndOfTodayUtc();
    const table = new Map();

    const ensureTeam = (rawName) => {
      const cleanName = String(rawName || "").trim();
      if (!cleanName) return null;
      const key = cleanName.toLowerCase();
      if (!table.has(key)) {
        table.set(key, {
          name: cleanName,
          key,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          avgGoals: 0,
          xgSum: 0,
          xgCount: 0,
          xg: 0,
          points: 0
        });
      }
      return table.get(key);
    };

    const rows = Array.isArray(resultsRows) ? resultsRows : [];
    for (const r of rows) {
      const div = String(r.Div || r.DivCode || "").trim().toUpperCase();
      if (divTarget && div && div !== divTarget) continue;
      if (!isValidCompletedResult(r)) continue;

      const dateTs = parseDateTimestamp(r.Date);
      if (dateTs !== null && dateTs > endOfToday) continue;

      const homeTeam = ensureTeam(r.HomeTeam || r.Home);
      const awayTeam = ensureTeam(r.AwayTeam || r.Away);
      const hg = Number(r.FTHG);
      const ag = Number(r.FTAG);
      if (!homeTeam || !awayTeam) continue;

      homeTeam.played += 1;
      awayTeam.played += 1;
      homeTeam.gf += hg;
      homeTeam.ga += ag;
      awayTeam.gf += ag;
      awayTeam.ga += hg;

      const hXG = parseFloat(r.HomeXG ?? r.xG_H ?? r.H_xG);
      const aXG = parseFloat(r.AwayXG ?? r.xG_A ?? r.A_xG);
      if (Number.isFinite(hXG)) {
        homeTeam.xgSum += hXG;
        homeTeam.xgCount += 1;
      }
      if (Number.isFinite(aXG)) {
        awayTeam.xgSum += aXG;
        awayTeam.xgCount += 1;
      }

      if (hg > ag) {
        homeTeam.won += 1;
        homeTeam.points += 3;
        awayTeam.lost += 1;
      } else if (hg < ag) {
        awayTeam.won += 1;
        awayTeam.points += 3;
        homeTeam.lost += 1;
      } else {
        homeTeam.drawn += 1;
        awayTeam.drawn += 1;
        homeTeam.points += 1;
        awayTeam.points += 1;
      }
    }

    const extraFixtures = Array.isArray(fixturesRows) ? fixturesRows : [];
    for (const f of extraFixtures) {
      const div = String(f.Div || f.DivCode || "").trim().toUpperCase();
      if (divTarget && div && div !== divTarget) continue;
      ensureTeam(f.HomeTeam || f.Home);
      ensureTeam(f.AwayTeam || f.Away);
    }
    ensureTeam(match.home);
    ensureTeam(match.away);

    const list = Array.from(table.values()).map(item => {
      const gd = item.gf - item.ga;
      const avgGoals = item.played > 0 ? Number(((item.gf + item.ga) / item.played).toFixed(2)) : 0;
      const avgScored = item.played > 0 ? item.gf / item.played : 1.25;
      const avgConceded = item.played > 0 ? item.ga / item.played : 1.15;
      const xg = item.xgCount > 0
        ? Number((item.xgSum / item.xgCount).toFixed(2))
        : Number(((avgScored * 0.62) + (avgConceded * 0.38)).toFixed(2));

      return {
        ...item,
        gd,
        avgGoals,
        xg
      };
    });

    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name, "it");
    });

    return list;
  }

  function renderStandingsCard(standings, homeName, awayName, leagueName) {
    const homeKey = String(homeName || "").trim().toLowerCase();
    const awayKey = String(awayName || "").trim().toLowerCase();

    if (!standings.length) {
      return `
        <aside class="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 space-y-3">
          <div class="border-b border-slate-800 pb-2.5">
            <h3 class="text-sm sm:text-base font-extrabold text-amber-300 tracking-wide">Classifica ${leagueName || ""}</h3>
          </div>
          <div class="text-xs text-slate-400">Nessun dato classifica disponibile.</div>
        </aside>
      `;
    }

    const rowsHtml = standings.map((row, idx) => {
      const pos = idx + 1;
      const isHighlighted = row.key === homeKey || row.key === awayKey;
      const badgeRole = row.key === homeKey ? "CASA" : row.key === awayKey ? "TRASF." : "";

      return `
        <tr class="border-b border-slate-800/70 last:border-b-0 transition ${
          isHighlighted ? "standings-team-gold text-amber-200 font-bold" : "hover:bg-slate-800/40 text-slate-200"
        }">
          <td class="py-2 pl-2 pr-1 text-[11px] ${isHighlighted ? "text-amber-300 font-extrabold" : "text-slate-400"}">${pos}</td>
          <td class="py-2 px-1.5 text-xs">
            <div class="flex items-center justify-between gap-1">
              <span class="truncate ${isHighlighted ? "text-amber-200 font-extrabold" : "text-white font-semibold"}">${row.name}</span>
              ${badgeRole ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/50 font-extrabold shrink-0">${badgeRole}</span>` : ""}
            </div>
          </td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-cyan-300" : "text-slate-300"}">${row.won}</td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-yellow-300" : "text-slate-300"}">${row.drawn}</td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-rose-300" : "text-slate-300"}">${row.lost}</td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-cyan-300" : "text-slate-300"}">${row.gf}</td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-rose-300" : "text-slate-300"}">${row.ga}</td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-amber-200" : "text-slate-300"}">${row.gd > 0 ? `+${row.gd}` : row.gd}</td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-amber-200" : "text-slate-300"}">${row.avgGoals.toFixed(2)}</td>
          <td class="py-2 px-1 text-center text-[11px] ${isHighlighted ? "text-amber-300" : "text-sky-300"}">${row.xg.toFixed(2)}</td>
          <td class="py-2 pl-1 pr-2 text-right text-xs font-extrabold ${isHighlighted ? "text-amber-300" : "text-cyan-400"}">${row.points}</td>
        </tr>
      `;
    }).join("");

    return `
      <aside class="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 space-y-3 lg:sticky lg:top-6">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div>
            <h3 class="text-sm sm:text-base font-extrabold text-amber-300 tracking-wide">Classifica Campionato</h3>
            <p class="text-[11px] text-slate-400">${homeName} e ${awayName} in evidenza oro</p>
          </div>
          <span class="text-[11px] text-amber-300/90 font-semibold">${standings.length} sq.</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-700/80 text-[10px] uppercase tracking-wider text-slate-400">
                <th class="py-1.5 pl-2 pr-1">#</th>
                <th class="py-1.5 px-1.5">Squadra</th>
                <th class="py-1.5 px-1 text-center" title="Vittorie">V</th>
                <th class="py-1.5 px-1 text-center" title="Pareggi">P</th>
                <th class="py-1.5 px-1 text-center" title="Sconfitte">S</th>
                <th class="py-1.5 px-1 text-center" title="Gol Fatti">GF</th>
                <th class="py-1.5 px-1 text-center" title="Gol Subiti">GS</th>
                <th class="py-1.5 px-1 text-center" title="Differenza Reti">DR</th>
                <th class="py-1.5 px-1 text-center" title="Media Gol partita">Media</th>
                <th class="py-1.5 px-1 text-center" title="xG medio squadra">xG</th>
                <th class="py-1.5 pl-1 pr-2 text-right" title="Punti">Pt</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </aside>
    `;
  }

  function renderStatChip(item) {
    const isBomb = clampPct(item.pct) >= 90;
    return `
      <div class="rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-cyan-500/40 px-3 py-2.5 flex items-center justify-between gap-2 transition ${isBomb ? "flag-bomb" : ""}">
        <span class="text-xs font-bold text-slate-200 leading-tight">${item.label}</span>
        <div class="text-right shrink-0">
          <div>${renderPctBadge(item.pct, "text-xs sm:text-sm")}</div>
          <div class="text-[11px] font-semibold text-amber-300/90 mt-0.5">
            @${item.odd} <span class="text-[10px] text-slate-400 font-normal">(${item.oddType})</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderFamilySection(fam) {
    let bodyHtml = "";

    if (fam.layout === "over-under-rows") {
      bodyHtml = `
        <div class="space-y-2.5">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            ${fam.overItems.map(renderStatChip).join("")}
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            ${fam.underItems.map(renderStatChip).join("")}
          </div>
        </div>
      `;
    } else if (fam.layout === "grid-2") {
      bodyHtml = `
        <div class="grid grid-cols-2 gap-2.5">
          ${fam.items.map(renderStatChip).join("")}
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          ${fam.items.map(renderStatChip).join("")}
        </div>
      `;
    }

    const totalCount = fam.layout === "over-under-rows"
      ? fam.overItems.length + fam.underItems.length
      : fam.items.length;

    return `
      <section class="rounded-2xl bg-slate-900/85 border border-slate-800 p-4 sm:p-5 space-y-3">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 class="text-sm sm:text-base font-extrabold text-cyan-300 tracking-wide">${fam.title}</h3>
          <span class="text-[11px] text-slate-400">${totalCount} mercati</span>
        </div>
        ${bodyHtml}
      </section>
    `;
  }

  function renderHistoryColumn(teamName, histList, accentClass) {
    if (!histList.length) {
      return `
        <div class="rounded-2xl bg-slate-900/85 border border-slate-800 p-4 space-y-2.5">
          <div class="border-b border-slate-800 pb-2">
            <h4 class="text-sm font-extrabold ${accentClass}">${teamName}</h4>
            <p class="text-[11px] text-slate-400">0 partite in archivio</p>
          </div>
          <div class="text-xs text-slate-400 py-4 text-center">Nessuna gara passata disponibile.</div>
        </div>
      `;
    }

    const newestFirst = [...histList].reverse();

    const itemsHtml = newestFirst.map(g => {
      const rowCls = g.outcome === "W"
        ? "hist-win text-emerald-100"
        : g.outcome === "D"
        ? "hist-draw text-yellow-100"
        : "hist-loss text-rose-100";

      const badgeCls = g.outcome === "W"
        ? "bg-emerald-500 text-slate-950"
        : g.outcome === "D"
        ? "bg-yellow-400 text-slate-950"
        : "bg-red-500 text-white";

      const label = g.outcome === "W" ? "V" : g.outcome === "D" ? "P" : "S";

      return `
        <div class="rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${rowCls}">
          <div class="min-w-0">
            <div class="text-[11px] font-semibold opacity-85">${g.date || "Data N/D"} • ${g.isHome ? "Casa" : "Trasf."}</div>
            <div class="text-xs font-bold truncate">${g.homeName} - ${g.awayName}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-950/60 border border-white/10">
              ${g.hg} - ${g.ag}
            </span>
            <span class="w-6 h-6 rounded-md text-xs font-black inline-flex items-center justify-center ${badgeCls}">
              ${label}
            </span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="rounded-2xl bg-slate-900/85 border border-slate-800 p-4 space-y-2.5">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <h4 class="text-sm font-extrabold ${accentClass}">${teamName}</h4>
            <p class="text-[11px] text-slate-400">Dalla più recente alla meno recente</p>
          </div>
          <span class="text-[11px] font-bold text-slate-300">${newestFirst.length} gare</span>
        </div>
        <div class="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  // Tab "Frequenza Gol": quante volte la squadra ha segnato N gol (in casa e fuori)
  const GOAL_BUCKETS = [
    { label: "0 Gol", test: g => g === 0 },
    { label: "1 Gol", test: g => g === 1 },
    { label: "2 Gol", test: g => g === 2 },
    { label: "3 Gol", test: g => g === 3 },
    { label: "4 Gol", test: g => g === 4 },
    { label: "5 Gol", test: g => g === 5 },
    { label: "+5 Gol", test: g => g > 5 }
  ];

  function renderGoalFreqColumn(teamName, histList, accentClass, barClass, sideLabel) {
    const homeGames = histList.filter(g => g.isHome);
    const awayGames = histList.filter(g => !g.isHome);
    // Nei totali sotto il nome squadra le gare chiuse a 0 gol non vengono contate
    const homeScoring = homeGames.filter(g => g.gf > 0).length;
    const awayScoring = awayGames.filter(g => g.gf > 0).length;

    const rows = GOAL_BUCKETS.map(b => {
      const h = homeGames.filter(g => b.test(g.gf)).length;
      const a = awayGames.filter(g => b.test(g.gf)).length;
      return { label: b.label, h, a };
    });

    const cell = (count, total) => {
      const pct = total ? (count / total) * 100 : 0;
      return `
        <div class="space-y-1">
          <div class="flex items-baseline justify-between gap-1">
            <span class="text-base sm:text-lg font-black text-white">${count}</span>
            <span class="text-[10px] text-slate-400">${total ? toPct(pct) : "—"}</span>
          </div>
          <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full ${barClass}" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>
      `;
    };

    return `
      <div class="rounded-2xl bg-slate-900/85 border border-slate-800 p-3 sm:p-4 space-y-3 min-w-0">
        <div class="border-b border-slate-800 pb-2">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">${sideLabel}</div>
          <h4 class="text-sm font-extrabold truncate ${accentClass}">${teamName}</h4>
          <p class="text-[11px] text-slate-400">${homeScoring} in casa • ${awayScoring} fuori • ${homeScoring + awayScoring} totali</p>
        </div>

        <div class="grid grid-cols-[auto_1fr_1fr] gap-x-2 sm:gap-x-3 gap-y-2.5 items-center">
          <div></div>
          <div class="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-300 text-center">🏠 In casa</div>
          <div class="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-300 text-center">✈️ Fuori</div>
          ${rows.map(r => `
            <div class="text-xs font-extrabold text-amber-300 whitespace-nowrap">${r.label}</div>
            ${cell(r.h, homeGames.length)}
            ${cell(r.a, awayGames.length)}
          `).join("")}
        </div>
      </div>
    `;
  }

  function ensureOverlayElement() {
    ensureColorStyles();
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.className = "fixed inset-0 z-50 hidden overflow-y-auto bg-slate-950/95 backdrop-blur-md text-slate-100";
    el.innerHTML = `
      <button
        id="backToMatchesBtn"
        type="button"
        class="fixed top-4 left-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-extrabold shadow-xl shadow-cyan-950/60 border border-cyan-300/30 transition cursor-pointer"
      >
        <span>←</span>
        <span>Torna alle partite</span>
      </button>

      <div id="matchStatsScreenContent" class="max-w-7xl mx-auto px-4 pt-20 pb-14"></div>
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

  window.switchMatchStatsTab = function (tabId) {
    const panels = document.querySelectorAll("[data-cg-tab-panel]");
    const tabs = document.querySelectorAll("[data-cg-tab-btn]");

    panels.forEach(p => {
      p.classList.toggle("hidden", p.getAttribute("data-cg-tab-panel") !== tabId);
    });

    tabs.forEach(btn => {
      const active = btn.getAttribute("data-cg-tab-btn") === tabId;
      btn.className = active
        ? "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 transition cursor-pointer"
        : "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-600 transition cursor-pointer";
    });
  };

  window.openMatchStatsScreen = function (options) {
    const { match, roundNumber, roundLabel, leagueCode, leagueName, countryName, flagHtml, resultsRows, fixturesRows } = options || {};
    if (!match) return;

    const overlay = ensureOverlayElement();
    const content = document.getElementById("matchStatsScreenContent");

    const dateStr = formatMatchDate(match.date);
    const timeStr = formatMatchTime(match.time);
    const dateTimeLabel = [dateStr, timeStr].filter(Boolean).join(" • ");
    const giornataLabel = roundLabel || (roundNumber ? `Giornata ${roundNumber}` : "Giornata");

    const homeHist = collectTeamHistoricalMatches(match.home, leagueCode, resultsRows);
    const awayHist = collectTeamHistoricalMatches(match.away, leagueCode, resultsRows);

    const homeLast5Outcomes = homeHist.length
      ? homeHist.slice(-5).map(g => g.outcome)
      : (match.homeFormArr || []).slice(-5);
    const awayLast5Outcomes = awayHist.length
      ? awayHist.slice(-5).map(g => g.outcome)
      : (match.awayFormArr || []).slice(-5);

    const homeFormVal = homeHist.length ? computeFormScoreFromOutcomes(homeLast5Outcomes) : (match.homeForm ?? 0);
    const awayFormVal = awayHist.length ? computeFormScoreFromOutcomes(awayLast5Outcomes) : (match.awayForm ?? 0);
    const diffFormVal = Math.abs(homeFormVal - awayFormVal);

    const hm = computeTeamMetrics(homeHist, 1.45, 1.05);
    const am = computeTeamMetrics(awayHist, 1.25, 1.25);
    const matchXG = Number(((hm.xg + am.xg) / 1.05).toFixed(2));

    const realFamilies = computeRealFamilies(match, homeHist, awayHist);
    const dcData = computeDixonColeFamilies(match, leagueCode, resultsRows, hm, am);
    const standings = computeLeagueStandings(match, leagueCode, resultsRows, fixturesRows);

    const sampleInfo = `${homeHist.length} gare ${match.home} • ${awayHist.length} gare ${match.away}`;

    content.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Colonna Sinistra: Partita + 4 Tab -->
        <div class="lg:col-span-7 space-y-5">
          <!-- Header Partita -->
          <div class="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border border-slate-700/70 p-5 sm:p-6 shadow-2xl">
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 mb-4">
              <div class="flex items-center gap-2 font-semibold">
                ${flagHtml || ""}
                <span>${leagueName || leagueCode || ""}</span>
                ${countryName ? `<span class="text-slate-500">•</span><span>${countryName}</span>` : ""}
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
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
                <div class="text-lg sm:text-xl font-extrabold text-amber-300">${match.home}</div>
                <div class="text-[11px] uppercase tracking-wider text-slate-400">Stato di forma (ult. 5)</div>
                <div class="flex items-center justify-center gap-1.5">
                  ${renderFormPills(homeLast5Outcomes)}
                </div>
                <div class="text-sm">${renderPctBadge(homeFormVal, "px-2.5 py-0.5 rounded-lg")}</div>
                <div class="pt-1 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div>
                    Media Gol: <strong class="text-cyan-300">${hm.avgScored.toFixed(2)}</strong>
                    <span class="text-slate-500">/</span>
                    <strong class="text-rose-300">${hm.avgConceded.toFixed(2)}</strong>
                    <span class="text-[10px] text-slate-400">(F/S)</span>
                  </div>
                  <div>
                    xG Squadra: <strong class="text-amber-300">${hm.xg.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <!-- Centro Partita -->
              <div class="space-y-2">
                <div class="text-xs uppercase tracking-widest text-slate-400 font-bold">Partita</div>
                <div class="text-2xl font-black text-white">VS</div>
                ${match.ftResult ? `<div class="inline-block px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Finale: ${match.ftResult}</div>` : ""}
                <div class="pt-1">
                  <div class="text-[11px] text-slate-400">Differenza Forma (Positiva)</div>
                  <div class="text-base mt-0.5">${renderPctBadge(diffFormVal, "px-2.5 py-0.5 rounded-lg")}</div>
                </div>
                <div class="rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 inline-block">
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">xG Partita Stimato</div>
                  <div class="text-sm font-extrabold text-amber-300">${matchXG.toFixed(2)}</div>
                </div>
                <div class="text-[11px] text-slate-500">${sampleInfo}</div>
              </div>

              <!-- Squadra Trasferta -->
              <div class="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2.5">
                <div class="text-lg sm:text-xl font-extrabold text-amber-300">${match.away}</div>
                <div class="text-[11px] uppercase tracking-wider text-slate-400">Stato di forma (ult. 5)</div>
                <div class="flex items-center justify-center gap-1.5">
                  ${renderFormPills(awayLast5Outcomes)}
                </div>
                <div class="text-sm">${renderPctBadge(awayFormVal, "px-2.5 py-0.5 rounded-lg")}</div>
                <div class="pt-1 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div>
                    Media Gol: <strong class="text-sky-300">${am.avgScored.toFixed(2)}</strong>
                    <span class="text-slate-500">/</span>
                    <strong class="text-rose-300">${am.avgConceded.toFixed(2)}</strong>
                    <span class="text-[10px] text-slate-400">(F/S)</span>
                  </div>
                  <div>
                    xG Squadra: <strong class="text-amber-300">${am.xg.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Barra 4 Tab -->
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-cg-tab-btn="reali" onclick="switchMatchStatsTab('reali')" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 transition cursor-pointer">
              📊 Statistiche Reali
            </button>
            <button type="button" data-cg-tab-btn="dixon" onclick="switchMatchStatsTab('dixon')" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-600 transition cursor-pointer">
              🧮 Dixon-Cole
            </button>
            <button type="button" data-cg-tab-btn="storico" onclick="switchMatchStatsTab('storico')" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-600 transition cursor-pointer">
              🕒 Storico Partite
            </button>
            <button type="button" data-cg-tab-btn="frequenza" onclick="switchMatchStatsTab('frequenza')" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-600 transition cursor-pointer">
              ⚽ Frequenza Gol
            </button>
          </div>

          <!-- Tab 1: Statistiche Reali -->
          <div data-cg-tab-panel="reali" class="space-y-5">
            ${realFamilies.map(renderFamilySection).join("")}
          </div>

          <!-- Tab 2: Dixon-Cole -->
          <div data-cg-tab-panel="dixon" class="hidden space-y-5">
            <div class="rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-300">
              <span>Modello Poisson + correzione Dixon-Coles (score bassi)</span>
              <span class="font-extrabold text-amber-300">xG Modello: ${dcData.dcXG.toFixed(2)}</span>
            </div>
            ${dcData.families.map(renderFamilySection).join("")}
          </div>

          <!-- Tab 3: Storico Partite diviso in 2 colonne -->
          <div data-cg-tab-panel="storico" class="hidden">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${renderHistoryColumn(match.home, homeHist, "text-cyan-300")}
              ${renderHistoryColumn(match.away, awayHist, "text-sky-300")}
            </div>
          </div>

          <!-- Tab 4: Frequenza Gol (schermo diviso in 2: casa a sinistra, trasferta a destra) -->
          <div data-cg-tab-panel="frequenza" class="hidden">
            <div class="grid grid-cols-2 gap-2 sm:gap-4">
              ${renderGoalFreqColumn(match.home, homeHist, "text-cyan-300", "bg-cyan-400", "Squadra di casa")}
              ${renderGoalFreqColumn(match.away, awayHist, "text-sky-300", "bg-sky-400", "Squadra in trasferta")}
            </div>
          </div>
        </div>

        <!-- Colonna Destra: Classifica Campionato con le 2 squadre in oro -->
        <div class="lg:col-span-5">
          ${renderStandingsCard(standings, match.home, match.away, leagueName || leagueCode)}
        </div>
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