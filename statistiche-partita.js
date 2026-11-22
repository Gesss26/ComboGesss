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

        const homeXG = parseFloat(r.HomeXG ?? r.xG_H ?? r.H_xG);
        const awayXG = parseFloat(r.AwayXG ?? r.xG_A ?? r.A_xG);
        const xgf = isHome ? homeXG : awayXG;

        return {
          isHome,
          gf,
          ga,
          totalGoals,
          btts: hg > 0 && ag > 0,
          outcome,
          xgf: Number.isFinite(xgf) ? xgf : null
        };
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

  function computeLeagueStandings(match, leagueCode, resultsRows, fixturesRows) {
    const divTarget = String(leagueCode || "").trim().toUpperCase();
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
          points: 0
        });
      }
      return table.get(key);
    };

    const rows = Array.isArray(resultsRows) ? resultsRows : [];
    for (const r of rows) {
      const div = String(r.Div || r.DivCode || "").trim().toUpperCase();
      if (divTarget && div && div !== divTarget) continue;

      const homeTeam = ensureTeam(r.HomeTeam || r.Home);
      const awayTeam = ensureTeam(r.AwayTeam || r.Away);
      const hg = Number(r.FTHG);
      const ag = Number(r.FTAG);
      if (!homeTeam || !awayTeam || !Number.isFinite(hg) || !Number.isFinite(ag)) continue;

      homeTeam.played += 1;
      awayTeam.played += 1;
      homeTeam.gf += hg;
      homeTeam.ga += ag;
      awayTeam.gf += ag;
      awayTeam.ga += hg;

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

    // Assicura la presenza anche delle squadre presenti nelle partite future o nella partita corrente
    const extraFixtures = Array.isArray(fixturesRows) ? fixturesRows : [];
    for (const f of extraFixtures) {
      const div = String(f.Div || f.DivCode || "").trim().toUpperCase();
      if (divTarget && div && div !== divTarget) continue;
      ensureTeam(f.HomeTeam || f.Home);
      ensureTeam(f.AwayTeam || f.Away);
    }
    ensureTeam(match.home);
    ensureTeam(match.away);

    const list = Array.from(table.values()).map(item => ({
      ...item,
      gd: item.gf - item.ga
    }));

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
          <td class="py-2 pl-2 pr-1.5 text-xs ${isHighlighted ? "text-amber-300 font-extrabold" : "text-slate-400"}">${pos}</td>
          <td class="py-2 px-1.5 text-xs">
            <div class="flex items-center justify-between gap-1.5">
              <span class="truncate ${isHighlighted ? "text-amber-200 font-extrabold" : "text-white font-semibold"}">${row.name}</span>
              ${badgeRole ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/50 font-extrabold shrink-0">${badgeRole}</span>` : ""}
            </div>
          </td>
          <td class="py-2 px-1 text-center text-xs ${isHighlighted ? "text-amber-200" : "text-slate-400"}">${row.played}</td>
          <td class="py-2 px-1 text-center text-xs ${isHighlighted ? "text-amber-200" : "text-slate-400"}">${row.won}</td>
          <td class="py-2 px-1 text-center text-xs ${isHighlighted ? "text-amber-200" : "text-slate-400"}">${row.drawn}</td>
          <td class="py-2 px-1 text-center text-xs ${isHighlighted ? "text-amber-200" : "text-slate-400"}">${row.lost}</td>
          <td class="py-2 px-1 text-center text-xs ${isHighlighted ? "text-amber-200" : "text-slate-300"}">${row.gd > 0 ? `+${row.gd}` : row.gd}</td>
          <td class="py-2 pl-1 pr-2 text-right text-xs font-extrabold ${isHighlighted ? "text-amber-300" : "text-emerald-400"}">${row.points}</td>
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
                <th class="py-1.5 pl-2 pr-1.5">#</th>
                <th class="py-1.5 px-1.5">Squadra</th>
                <th class="py-1.5 px-1 text-center" title="Partite giocate">G</th>
                <th class="py-1.5 px-1 text-center" title="Vinte">V</th>
                <th class="py-1.5 px-1 text-center" title="Pareggiate">P</th>
                <th class="py-1.5 px-1 text-center" title="Perse">S</th>
                <th class="py-1.5 px-1 text-center" title="Differenza reti">DR</th>
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

  function computeMatchFamilies(match, leagueCode, resultsRows) {
    const homeHist = collectTeamHistoricalMatches(match.home, leagueCode, resultsRows);
    const awayHist = collectTeamHistoricalMatches(match.away, leagueCode, resultsRows);

    const homeMetrics = computeTeamMetrics(homeHist, 1.45, 1.05);
    const awayMetrics = computeTeamMetrics(awayHist, 1.25, 1.25);

    const matchXG = Number(((homeMetrics.xg + awayMetrics.xg) / 1.05).toFixed(2));

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

    const joint = (aPct, bPct, boost = 1.06) =>
      Math.min(98, Math.max(1, ((aPct / 100) * (bPct / 100)) * 100 * boost));

    const bookOdds = match.bookOdds || {};

    const mkItem = (label, pct, realOddKey) => {
      const hasReal = bookOdds[realOddKey] !== undefined && bookOdds[realOddKey] !== null && bookOdds[realOddKey] !== "";
      const odd = hasReal ? formatOdd(bookOdds[realOddKey]) : fairOddFromPct(pct);
      return {
        label,
        pct,
        odd,
        oddType: hasReal ? "Quota" : "Equa"
      };
    };

    return {
      sampleInfo: `${homeHist.length} gare ${match.home} • ${awayHist.length} gare ${match.away}`,
      homeMetrics,
      awayMetrics,
      matchXG,
      families: [
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
      ]
    };
  }

  function renderStatChip(item) {
    const isBomb = clampPct(item.pct) >= 90;
    return `
      <div class="rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 px-3 py-2.5 flex items-center justify-between gap-2 transition ${isBomb ? "flag-bomb" : ""}">
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
          <h3 class="text-sm sm:text-base font-extrabold text-emerald-300 tracking-wide">${fam.title}</h3>
          <span class="text-[11px] text-slate-400">${totalCount} mercati</span>
        </div>
        ${bodyHtml}
      </section>
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
        class="fixed top-4 left-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-extrabold shadow-xl shadow-emerald-950/60 border border-emerald-300/30 transition cursor-pointer"
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

  window.openMatchStatsScreen = function (options) {
    const { match, roundNumber, roundLabel, leagueCode, leagueName, countryName, flagHtml, resultsRows, fixturesRows } = options || {};
    if (!match) return;

    const overlay = ensureOverlayElement();
    const content = document.getElementById("matchStatsScreenContent");

    const dateStr = formatMatchDate(match.date);
    const timeStr = formatMatchTime(match.time);
    const dateTimeLabel = [dateStr, timeStr].filter(Boolean).join(" • ");
    const giornataLabel = roundLabel || (roundNumber ? `Giornata ${roundNumber}` : "Giornata");

    const homeFormVal = match.homeForm ?? 0;
    const awayFormVal = match.awayForm ?? 0;
    const diffFormVal = match.diffForm ?? Math.abs((match.homeForm || 0) - (match.awayForm || 0));

    const computed = computeMatchFamilies(match, leagueCode, resultsRows);
    const standings = computeLeagueStandings(match, leagueCode, resultsRows, fixturesRows);
    const hm = computed.homeMetrics;
    const am = computed.awayMetrics;

    content.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Colonna Sinistra: Statistiche Partita & Famiglie di Giocata -->
        <div class="lg:col-span-7 space-y-5">
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
                <div class="text-lg sm:text-xl font-extrabold text-amber-300">${match.home}</div>
                <div class="text-[11px] uppercase tracking-wider text-slate-400">Stato di forma (ult. 5)</div>
                <div class="flex items-center justify-center gap-1.5">
                  ${renderFormPills(match.homeFormArr)}
                </div>
                <div class="text-sm">${renderPctBadge(homeFormVal, "px-2.5 py-0.5 rounded-lg")}</div>
                <div class="pt-1 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div>
                    Media Gol: <strong class="text-emerald-300">${hm.avgScored.toFixed(2)}</strong>
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
                ${match.ftResult ? `<div class="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Finale: ${match.ftResult}</div>` : ""}
                <div class="pt-1">
                  <div class="text-[11px] text-slate-400">Differenza Forma (Positiva)</div>
                  <div class="text-base mt-0.5">${renderPctBadge(diffFormVal, "px-2.5 py-0.5 rounded-lg")}</div>
                </div>
                <div class="rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 inline-block">
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">xG Partita Stimato</div>
                  <div class="text-sm font-extrabold text-amber-300">${computed.matchXG.toFixed(2)}</div>
                </div>
                <div class="text-[11px] text-slate-500">${computed.sampleInfo}</div>
              </div>

              <!-- Squadra Trasferta -->
              <div class="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2.5">
                <div class="text-lg sm:text-xl font-extrabold text-amber-300">${match.away}</div>
                <div class="text-[11px] uppercase tracking-wider text-slate-400">Stato di forma (ult. 5)</div>
                <div class="flex items-center justify-center gap-1.5">
                  ${renderFormPills(match.awayFormArr)}
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

          <div class="space-y-5">
            ${computed.families.map(renderFamilySection).join("")}
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