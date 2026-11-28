/* ComboGesss — Meteo allo stadio della squadra di casa (Open-Meteo, senza chiave API).
   Per ogni card partita mostra: condizioni, temperatura, pioggia, vento e un indicatore "campo pesante". */
(function () {
  "use strict";

  /* Coordinate approssimative degli stadi (lat, lon). Squadre non presenti = meteo n/d. */
  var STADIUM = {
    // Serie A
    "Inter":[45.478,9.124],"Milan":[45.478,9.124],"Juventus":[45.110,7.641],"Napoli":[40.828,14.193],
    "Atalanta":[45.709,9.681],"Lazio":[41.934,12.455],"Roma":[41.934,12.455],"Fiorentina":[43.781,11.282],
    "Bologna":[44.492,11.310],"Torino":[45.042,7.650],"Como":[45.810,9.083],"Udinese":[46.082,13.200],
    "Genoa":[44.416,8.952],"Cagliari":[39.200,9.137],"Parma":[44.795,10.338],"Verona":[45.435,10.969],
    "Empoli":[43.726,10.951],"Lecce":[40.358,18.208],"Monza":[45.583,9.307],"Venezia":[45.427,12.363],
    "Sassuolo":[44.714,10.649],"Cremonese":[45.140,10.020],"Pisa":[43.725,10.400],"Palermo":[38.152,13.343],
    "Sampdoria":[44.416,8.952],"Bari":[41.084,16.840],"Spezia":[44.104,9.815],"Frosinone":[41.630,13.340],
    "Salernitana":[40.617,14.810],"Modena":[44.640,10.930],"Cesena":[44.150,12.260],"Brescia":[45.520,10.210],
    "Catanzaro":[38.900,16.590],"Sudtirol":[46.490,11.340],"Reggiana":[44.710,10.650],"Cosenza":[39.300,16.250],
    "Mantova":[45.160,10.790],"Carrarese":[44.040,10.090],"Juve Stabia":[40.700,14.490],"Cittadella":[45.650,11.780],
    // Premier League
    "Arsenal":[51.555,-0.108],"Liverpool":[53.431,-2.961],"Man City":[53.483,-2.200],"Man United":[53.463,-2.291],
    "Chelsea":[51.482,-0.191],"Newcastle":[54.976,-1.622],"Aston Villa":[52.509,-1.885],"Tottenham":[51.604,-0.066],
    "Brighton":[50.862,-0.084],"Bournemouth":[50.735,-1.838],"Fulham":[51.475,-0.222],"Brentford":[51.491,-0.289],
    "West Ham":[51.539,-0.017],"Crystal Palace":[51.398,-0.086],"Everton":[53.439,-2.966],"Wolves":[52.590,-2.130],
    "Leicester":[52.620,-1.142],"Ipswich":[52.055,1.145],"Southampton":[50.906,-1.391],"Nott'm Forest":[52.940,-1.133],
    "Leeds":[53.778,-1.572],"Burnley":[53.789,-2.230],"Sunderland":[54.915,-1.388],
    // La Liga
    "Real Madrid":[40.453,-3.688],"Barcelona":[41.381,2.123],"Atletico Madrid":[40.436,-3.600],
    "Athletic Bilbao":[43.264,-2.949],"Real Sociedad":[43.301,-1.974],"Villarreal":[39.944,-0.104],
    "Real Betis":[37.357,-5.982],"Girona":[41.961,2.828],"Valencia":[39.475,-0.358],"Osasuna":[42.796,-1.637],
    "Celta Vigo":[42.212,-8.740],"Sevilla":[37.384,-5.971],"Mallorca":[39.590,2.631],"Getafe":[40.325,-3.714],
    "Las Palmas":[28.100,-15.456],"Alaves":[42.837,-2.688],"Rayo Vallecano":[40.392,-3.659],"Espanyol":[41.348,2.075],
    "Valladolid":[41.644,-4.761],"Leganes":[40.340,-3.760],"Elche":[38.267,-0.663],"Levante":[39.495,-0.364],
    "Oviedo":[43.365,-5.870],
    // Bundesliga
    "Bayern Munich":[48.219,11.625],"Leverkusen":[51.038,7.002],"RB Leipzig":[51.346,12.348],"Dortmund":[51.493,7.452],
    "Eintracht Frankfurt":[50.069,8.646],"Stuttgart":[48.792,9.232],"Freiburg":[47.989,7.893],"Mainz":[49.984,8.224],
    "Wolfsburg":[52.432,10.804],"Werder Bremen":[53.067,8.838],"Monchengladbach":[51.175,6.386],
    "Hoffenheim":[49.239,8.888],"Augsburg":[48.323,10.886],"Union Berlin":[52.457,13.568],"St. Pauli":[53.554,9.968],
    "Heidenheim":[48.668,10.139],"Holstein Kiel":[54.349,10.123],"Bochum":[51.490,7.237],
    "Hamburg":[53.587,9.899],"FC Koln":[50.934,6.875],"Hertha Berlin":[52.515,13.240],"Schalke 04":[51.554,7.068],
    // Ligue 1
    "PSG":[48.841,2.253],"Monaco":[43.728,7.416],"Marseille":[43.270,5.396],"Lille":[50.612,3.130],
    "Lyon":[45.765,4.982],"Nice":[43.705,7.193],"Lens":[50.433,2.815],"Auxerre":[47.786,3.589],
    "Strasbourg":[48.560,7.755],"Toulouse":[43.583,1.434],"Rennes":[48.108,-1.713],"Brest":[48.402,-4.462],
    "Reims":[49.246,4.025],"Nantes":[47.256,-1.525],"Angers":[47.461,-0.531],"Le Havre":[49.499,0.169],
    "Saint-Etienne":[45.461,4.390],"Montpellier":[43.622,3.812],"Lorient":[47.748,-3.368],"Metz":[49.110,6.159],
    "Paris FC":[48.824,2.346]
  };

  var cache = {};   // team -> Promise<dati orari>

  function wxLabel(code) {
    if (code === 0) return ["☀️", "Sereno"];
    if (code <= 2) return ["⛅", "Poco nuvoloso"];
    if (code === 3) return ["☁️", "Coperto"];
    if (code === 45 || code === 48) return ["🌫️", "Nebbia"];
    if (code >= 51 && code <= 57) return ["🌦️", "Pioviggine"];
    if (code >= 61 && code <= 67) return ["🌧️", "Pioggia"];
    if (code >= 71 && code <= 77) return ["❄️", "Neve"];
    if (code >= 80 && code <= 82) return ["🌧️", "Rovesci"];
    if (code === 85 || code === 86) return ["❄️", "Rovesci di neve"];
    if (code >= 95) return ["⛈️", "Temporale"];
    return ["🌡️", "Variabile"];
  }

  function load(team) {
    var c = STADIUM[team];
    if (!c) return Promise.resolve(null);
    if (cache[team]) return cache[team];
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c[0] + "&longitude=" + c[1] +
      "&hourly=temperature_2m,precipitation,wind_speed_10m,weather_code&past_days=2&forecast_days=16&timezone=auto";
    cache[team] = fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return cache[team];
  }

  /* date "gg/mm/aaaa", time "HH:MM" → indice orario nel formato Open-Meteo "YYYY-MM-DDTHH:00" */
  function hourKey(date, time) {
    var d = String(date || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!d) return null;
    var t = String(time || "").match(/^(\d{1,2})/);
    var hh = t ? Math.min(23, +t[1]) : 15;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d[3] + "-" + p(+d[2]) + "-" + p(+d[1]) + "T" + p(hh) + ":00";
  }

  function summarize(json, date, time) {
    if (!json || !json.hourly) return null;
    var key = hourKey(date, time);
    if (!key) return null;
    var H = json.hourly, i = H.time.indexOf(key);
    if (i < 0) return null;
    var sum = function (from, to) {
      var s = 0;
      for (var k = Math.max(0, from); k <= Math.min(H.time.length - 1, to); k++) s += H.precipitation[k] || 0;
      return s;
    };
    var during = sum(i - 1, i + 2);      // pioggia attorno alla partita
    var before = sum(i - 24, i - 2);     // pioggia nelle 24 ore precedenti
    var wind = H.wind_speed_10m[i];
    var heavy = during >= 2 || before >= 8 || (during >= 1 && before >= 4);
    var veryHeavy = during >= 5 || before >= 15;
    return { temp: H.temperature_2m[i], code: H.weather_code[i], during: during, before: before,
             wind: wind, level: veryHeavy ? 2 : heavy ? 1 : 0 };
  }

  function render(w) {
    var lab = wxLabel(w.code);
    var pitch = w.level === 2 ? '<span class="text-rose-300 font-semibold">campo molto pesante</span>'
              : w.level === 1 ? '<span class="text-amber-300 font-semibold">campo pesante</span>'
              : '<span class="text-emerald-300">campo regolare</span>';
    var windTxt = w.wind >= 30 ? ' • <span class="text-amber-300">vento forte</span>' : "";
    return '<div class="text-[10px] uppercase tracking-wider text-slate-400 mt-1.5">Meteo stadio (squadra di casa)</div>' +
      '<div class="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5 text-[11px] text-slate-300">' +
      '<span title="' + lab[1] + '">' + lab[0] + " " + lab[1] + "</span>" +
      '<span class="text-slate-600">|</span><span title="Temperatura">🌡️ ' + Math.round(w.temp) + "°C</span>" +
      '<span class="text-slate-600">|</span><span title="Pioggia attorno alla partita (mm)">💧 ' + w.during.toFixed(1) + " mm</span>" +
      '<span class="text-slate-600">|</span><span title="Vento (km/h)">💨 ' + Math.round(w.wind) + " km/h</span>" +
      '<span class="text-slate-600">|</span><span title="Pioggia nelle 24 ore precedenti: ' + w.before.toFixed(1) + ' mm">' + pitch + windTxt + "</span></div>";
  }

  /* Riempie tutti i segnaposto .cg-wx presenti in pagina (chiamata dopo ogni render della lista) */
  window.cgWeatherFill = function (root) {
    var nodes = (root || document).querySelectorAll(".cg-wx[data-home]:not([data-done])");
    nodes.forEach(function (el) {
      el.setAttribute("data-done", "1");
      var home = el.getAttribute("data-home"), date = el.getAttribute("data-date"), time = el.getAttribute("data-time");
      load(home).then(function (json) {
        var w = summarize(json, date, time);
        if (w && el.isConnected) el.innerHTML = render(w);
      });
    });
  };

  /* Disponibile anche per la schermata statistiche-partita.js:
     cgWeatherFor({home, date, time}) → Promise<{temp, code, during, before, wind, level}|null> */
  window.cgWeatherFor = function (m) { return load(m.home).then(function (j) { return summarize(j, m.date, m.time); }); };
  window.cgWeatherHtml = render;
})();
