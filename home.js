${pin ? <button class="cg-btn cg-danger" data-set="del-pin">🔓 Rimuovi password</button> : ""}
${pin ? "Password attiva sul Conto." : "Nessuna password impostata."}
🧭 Generale
Schermata avvio${sel("st-start", [["home", "🏠 Home"], ["palinsesto", "📅 Palinsesto"]], S.startView || "home")}
Valuta{sel("st-cur", [["€", "€ Euro"], ["", "$ Dollaro"], ["£", "£ Sterlina"], ["CHF", "CHF Franco"]], S.currency || "€")}
${window.cgAppearance ? window.cgAppearance.html() : ""}
💾 Backup e App
⬇️ Esporta JSON
⬆️ Importa JSON
🔄 Aggiorna app (svuota cache)

`;
if (window.cgAppearance) window.cgAppearance.bind($("#cg-imp-body"));
}
function onSettingsChange(ev) {
const id = ev.target.id || "";
if (id.startsWith("st-")) {
const S = loadSet();
if (id === "st-start") S.startView = ev.target.value;
else if (id === "st-cur") S.currency = ev.target.value;
else if (id === "st-file") {
const f = ev.target.files.item(0); if (!f) return;
const r = new FileReader();
r.onload = () => { try { const o = JSON.parse(r.result); KEYS.forEach(k => { if (o.data[k] !== undefined) localStorage.setItem(k, JSON.stringify(o.data[k])); }); location.reload(); } catch (_) { alert("File non valido"); } };
r.readAsText(f); return;
}
saveSet(S);
}
}
function onSettingsClick(ev) {
const t = ev.target.closest("[data-set]"); if (!t) return;
const a = t.dataset.set;
if (a === "save-pin") {
const p1 = ($("#sec-pin").value || "").trim(), p2 = ($("#sec-pin2").value || "").trim();
if (!p1 || p1 !== p2) { alert("Inserisci due password uguali."); return; }
const S = loadSet(); S.contoPin = p1; saveSet(S); contoUnlocked = false; alert("Password salvata!"); renderSettings();
} else if (a === "del-pin") {
if (prompt("Password attuale:") !== getPin()) { alert("Password errata."); return; }
const S = loadSet(); delete S.contoPin; saveSet(S); contoUnlocked = false; alert("Password rimossa."); renderSettings();
} else if (a === "export") {
const data = {}; KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) data[k] = JSON.parse(v); } catch (_) {} });
const u = URL.createObjectURL(new Blob([JSON.stringify({ app: "combogesss", version: 1, data }, null, 2)], { type: "application/json" }));
const el = document.createElement("a"); el.href = u; el.download = "combogesss-backup.json"; el.click();
} else if (a === "import") $("#st-file").click();
else if (a === "refresh") {
Promise.resolve()
.then(() => navigator.serviceWorker && navigator.serviceWorker.getRegistrations ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))) : null)
.then(() => window.caches ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : null)
.then(() => location.reload(), () => location.reload());
}
}
function mountHeaderBtn() {
if (document.getElementById("cgHomeBtn")) return;
const rb = document.getElementById("reloadDataBtn") || document.getElementById("checkBtn") || document.querySelector("header button");
if (!rb || !rb.parentElement) return;
const b = document.createElement("button");
b.id = "cgHomeBtn"; b.type = "button"; b.className = rb.className; b.textContent = "🏠 Home";
b.addEventListener("click", () => nav("home"));
rb.parentElement.insertBefore(b, rb.parentElement.firstChild);
}
function autoRound() {
if (typeof state === "undefined" || !state.roundsByLeague) return;
const code = state.selectedLeagueCode, rounds = state.roundsByLeague[code] || [];
if (!code || !rounds.length) return;
const key = code + "_" + rounds.length;
if (key === lastAutoKey) return;
const next = rounds.find(r => (r.matches || []).some(m => !m.ftResult));
lastAutoKey = key;
if (next && state.selectedRound !== next.roundNumber) {
state.selectedRound = next.roundNumber;
const selEl = document.getElementById("roundSelect") || document.querySelector("select[id*='round' i]");
if (selEl) selEl.value = String(next.roundNumber);
if (typeof renderMatches === "function") renderMatches();
}
}
function init() {
build(); mountHeaderBtn();
$("#cg-imp-body").addEventListener("change", onSettingsChange);
$("#cg-imp-body").addEventListener("click", onSettingsClick);
window.addEventListener("hashchange", () => { go(location.hash.slice(1)); mountHeaderBtn(); });
let v = location.hash.slice(1);
if (!VIEWS.includes(v)) v = loadSet().startView || "home";
go(v);
setInterval(() => { if (current === "home") refreshHome(); else if (current === "palinsesto") mountHeaderBtn(); }, 1000);
setInterval(autoRound, 350);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
window.CGHome = { nav, go };
})();
