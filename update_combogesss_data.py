import json, os, re, time
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
import pandas as pd
import requests

FD_URL = "https://" + "www.football-data.co.uk/"
SV_URL = "https://" + "giochi.softvision.it/Campionati-Calcio/Calendario/"
SEASON = "2627"
OUT = "data"
EURO_XLSX = "all-euro-data-2026-2027.xlsx"
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

# Codice -> (Nazione, Bandiera, Nome Campionato, Slug Softvision)
LEAGUES = {
    "I1": ("Italia", "🇮🇹", "Serie A", "Italia/Serie-A"),
    "I2": ("Italia", "🇮🇹", "Serie B", "Italia/Serie-B"),
    "E0": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Premier League", "Inghilterra/Premiere-League"),
    "E1": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Championship", "Inghilterra/Championship"),
    "E2": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League One", "Inghilterra/League-One"),
    "E3": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League Two", "Inghilterra/League-Two"),
    "EC": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "National League", "Inghilterra/Conference"),
    "SC0": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Premiership", "Scozia/Premier-League"),
    "SC1": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Championship", "Scozia/First-Division"),
    "SC2": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "League One", "Scozia/Second-Division"),
    "SC3": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "League Two", "Scozia/Third-Division"),
    "SP1": ("Spagna", "🇪🇸", "La Liga", "Spagna/Spagna-Liga-1"),
    "SP2": ("Spagna", "🇪🇸", "Segunda Division", "Spagna/Spagna-Liga-2"),
    "D1": ("Germania", "🇩🇪", "Bundesliga", "Germania/Bundesliga-1"),
    "D2": ("Germania", "🇩🇪", "2. Bundesliga", "Germania/Bundesliga-2"),
    "F1": ("Francia", "🇫🇷", "Ligue 1", "Francia/Le-Championnat"),
    "F2": ("Francia", "🇫🇷", "Ligue 2", "Francia/Ligue-2"),
    "N1": ("Paesi Bassi", "🇳🇱", "Eredivisie", "Olanda/Eredivisie"),
    "B1": ("Belgio", "🇧🇪", "Pro League", "Belgio/Jupiler-League"),
    "P1": ("Portogallo", "🇵🇹", "Liga Portugal", "Portogallo/Superliga"),
    "T1": ("Turchia", "🇹🇷", "Super Lig", "Turchia/Super-Lig"),
    "G1": ("Grecia", "🇬🇷", "Super League", "Grecia/Ethniki-Katigoria"),
}

ALIASES = {
    "man utd": "Man United", "manchester utd": "Man United", "manchester united": "Man United",
    "man city": "Man City", "manchester city": "Man City",
    "nottm forest": "Nott'm Forest", "nottingham forest": "Nott'm Forest", "nottingham": "Nott'm Forest",
    "wolverhampton": "Wolves", "west ham": "West Ham", "tottenham": "Tottenham",
    "brighton": "Brighton", "leicester": "Leicester", "newcastle": "Newcastle",
    "sheffield utd": "Sheffield United", "sheffield wed": "Sheffield Weds",
    "atletico madrid": "Ath Madrid", "atl. madrid": "Ath Madrid",
    "athletic bilbao": "Ath Bilbao", "ath. bilbao": "Ath Bilbao",
    "real sociedad": "Sociedad", "real betis": "Betis", "celta vigo": "Celta",
    "rayo vallecano": "Vallecano", "espanyol": "Espanol", "alaves": "Alaves", "leganes": "Leganes",
    "bayern monaco": "Bayern Munich", "bayern": "Bayern Munich",
    "borussia dortmund": "Dortmund", "bayer leverkusen": "Leverkusen",
    "eintracht francoforte": "Ein Frankfurt", "monchengladbach": "M'gladbach", "b. monchengladbach": "M'gladbach",
    "st. pauli": "St Pauli", "psg": "Paris SG", "paris saint germain": "Paris SG",
    "st. etienne": "St Etienne", "saint etienne": "St Etienne",
}

def ndate(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return ""
    if isinstance(v, (pd.Timestamp, datetime)): return v.strftime("%d/%m/%Y")
    if isinstance(v, (int, float)): return (datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=int(float(v)))).strftime("%d/%m/%Y")
    s = str(v).strip()
    p = re.split(r"[\sT]+", s)
    m = re.fullmatch(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})", p)
    if m: return f"{int(m.group(1)):02d}/{int(m.group(2)):02d}/{int(m.group(3)) + (2000 if int(m.group(3)) < 100 else 0):04d}"
    m = re.fullmatch(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", p)
    if m: return f"{int(m.group(3)):02d}/{int(m.group(2)):02d}/{int(m.group(1)):04d}"
    return s

def nteam(raw, known):
    c = str(raw or "").strip()
    low = c.lower()
    if low in ALIASES: return ALIASES[low]
    if low in known: return known[low]
    for k, orig in known.items():
        if k in low or low in k: return orig
    return c

def dl(url, dest):
    try:
        r = requests.get(url, headers=HDR, timeout=25)
        if r.status_code != 200: return False
        with open(dest, "wb") as f: f.write(r.content)
        return True
    except Exception:
        return False

def fetch_softvision(slug, code, known, played):
    if not slug: return []
    url = urljoin(SV_URL, slug)
    try:
        r = requests.get(url, headers=HDR, timeout=25)
        if r.status_code != 200:
            print(f"[SV HTTP {r.status_code}] {url}")
            return []
        tables = pd.read_html(r.text)
        out = []
        for t in tables:
            if t.shape[1] < 3: continue
            for _, row in t.iterrows():
                c0 = str(row.iloc).strip()
                c1 = str(row.iloc).strip()
                c2 = str(row.iloc).strip() if pd.notna(row.iloc) else ""
                if re.fullmatch(r"\d{2}/\d{2}/\d{4}", c0) and " - " in c1:
                    # Se c2 non contiene un risultato (es. "2 - 1"), è una partita futura
                    if not re.search(r"\d+\s*-\s*\d+", c2):
                        parts = c1.split(" - ", 1)
                        h = nteam(parts, known)
                        a = nteam(parts, known)
                        if (h.lower(), a.lower()) not in played:
                            out.append({"Div": code, "Date": c0, "Time": "15:00", "HomeTeam": h, "AwayTeam": a})
        print(f"[SV OK] {code}: +{len(out)} partite future")
        return out
    except Exception as e:
        print(f"[SV ERR] {code}: {e}")
        return []

def main():
    os.makedirs(OUT, exist_ok=True)
    grouped = {}
    for code, (country, flag, name, _) in LEAGUES.items():
        grouped.setdefault(country, {"country": country, "flag": flag, "leagues": []})["leagues"].append({"code": code, "name": name})
    with open(os.path.join(OUT, "countries_leagues.json"), "w", encoding="utf-8") as f:
        json.dump(list(grouped.values()), f, ensure_ascii=False, indent=2)

    euro_path = os.path.join(OUT, EURO_XLSX)
    dl(urljoin(FD_URL, f"mmz4281/{SEASON}/{EURO_XLSX}"), euro_path)

    fix_path = os.path.join(OUT, "fixtures.xlsx")
    fd_fix = pd.DataFrame()
    if dl(urljoin(FD_URL, "fixtures.xlsx"), fix_path):
        fd_fix = pd.read_excel(fix_path)
        if "Date" in fd_fix.columns: fd_fix["Date"] = fd_fix["Date"].apply(ndate)

    frames, extra = [], []
    for code, (country, flag, name, sv_slug) in LEAGUES.items():
        csv_path = os.path.join(OUT, f"{code}.csv")
        known, played = {}, set()
        if dl(f"{FD_URL}mmz4281/{SEASON}/{code}.csv", csv_path):
            df = pd.read_csv(csv_path, encoding="utf-8-sig", on_bad_lines="skip")
            if "Date" in df.columns: df["Date"] = df["Date"].apply(ndate)
            df["Country"], df["Flag"], df["LeagueName"], df["DivCode"] = country, flag, name, code
            df.to_csv(csv_path, index=False, encoding="utf-8")
            frames.append(df)
            for _, r in df.iterrows():
                h, a = str(r.get("HomeTeam", "")).strip(), str(r.get("AwayTeam", "")).strip()
                if h: known[h.lower()] = h
                if a: known[a.lower()] = a
                if pd.notna(r.get("FTHG")) and pd.notna(r.get("FTAG")): played.add((h.lower(), a.lower()))

        extra.extend(fetch_softvision(sv_slug, code, known, played))
        time.sleep(0.5)

    if frames:
        all_df = pd.concat(frames, ignore_index=True)
        all_df.to_csv(os.path.join(OUT, "all_leagues.csv"), index=False, encoding="utf-8")

    sv_df = pd.DataFrame(extra) if extra else pd.DataFrame(columns=["Div", "Date", "Time", "HomeTeam", "AwayTeam"])
    if not fd_fix.empty and {"Div", "HomeTeam", "AwayTeam"}.issubset(fd_fix.columns):
        ex = set(zip(fd_fix["Div"].astype(str).str.upper(), fd_fix["HomeTeam"].astype(str).str.lower(), fd_fix["AwayTeam"].astype(str).str.lower()))
        sv_df = sv_df[~sv_df.apply(lambda r: (r["Div"].upper(), r["HomeTeam"].lower(), r["AwayTeam"].lower()) in ex, axis=1)]
        final_fix = pd.concat([fd_fix, sv_df], ignore_index=True)
    else:
        final_fix = sv_df
    final_fix.to_excel(fix_path, index=False, engine="openpyxl")
    print(f"=== Completato: {len(frames)} leghe, {len(final_fix)} partite future ===")

if __name__ == "__main__":
    main()
