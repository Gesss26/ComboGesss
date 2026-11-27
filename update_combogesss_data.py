import json, os, re, time
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import pandas as pd
import requests

FD_URL = "https://" + "www.football-data.co.uk/"
SV_URL = "https://" + "giochi.softvision.it/Campionati-Calcio/Calendario/"
SEASON = "2627"
OUT = "data"
EURO_XLSX = "all-euro-data-2026-2027.xlsx"
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

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
    if isinstance(v, (int, float)):
        return (datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=int(float(v)))).strftime("%d/%m/%Y")
    s = str(v).strip()
    if not s or s.lower() in {"nan", "nat", "none"}: return ""
    p = s.replace("T", " ").split().pop(0)
    m = re.fullmatch(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})", p)
    if m:
        y = int(m.group(3)) + (2000 if int(m.group(3)) < 100 else 0)
        return f"{int(m.group(1)):02d}/{int(m.group(2)):02d}/{y:04d}"
    m = re.fullmatch(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", p)
    if m:
        return f"{int(m.group(3)):02d}/{int(m.group(2)):02d}/{int(m.group(1)):04d}"
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
        if r.status_code != 200:
            print(f"[FD HTTP {r.status_code}] {url}")
            return False
        with open(dest, "wb") as f: f.write(r.content)
        return True
    except Exception as e:
        print(f"[FD ERR] {url}: {e}")
        return False

def fetch_softvision(slug, code, known, played):
    if not slug: return []
    url = urljoin(SV_URL, slug)
    try:
        r = requests.get(url, headers=HDR, timeout=25)
        if r.status_code != 200:
            print(f"[SV HTTP {r.status_code}] {url}")
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        out = []
        for tr in soup.find_all("tr"):
            tds = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
            if len(tds) < 2: continue
            m_date = re.search(r"(\d{2}/\d{2}/\d{4})", tds.pop(0))
            if not m_date: continue
            date_str = m_date.group(1)
            match_txt = tds.pop(0) if tds else ""
            res_txt = tds.pop(0) if tds else ""
            if " - " in match_txt and not re.search(r"\d+\s*-\s*\d+", res_txt):
                h_raw, a_raw = match_txt.split(" - ", 1)
                h = nteam(h_raw, known)
                a = nteam(a_raw, known)
                if (h.lower(), a.lower()) not in played:
                    out.append({"Div": code, "Date": date_str, "Time": "15:00", "HomeTeam": h, "AwayTeam": a})
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
    if dl(urljoin(FD_URL, f"mmz4281/{SEASON}/{EURO_XLSX}"), euro_path):
        try:
            xl = pd.ExcelFile(euro_path)
            sheets = {}
            for s in xl.sheet_names:
                df_s = xl.parse(s)
                if "Date" in df_s.columns: df_s["Date"] = df_s["Date"].apply(ndate)
                sheets[s] = df_s
            with pd.ExcelWriter(euro_path, engine="openpyxl") as w:
                for s, df_s in sheets.items(): df_s.to_excel(w, sheet_name=s, index=False)
        except Exception as e:
            print(f"[XLSX ERR] {e}")

    fix_path = os.path.join(OUT, "fixtures.xlsx")
    fd_fix = pd.DataFrame()
    if dl(urljoin(FD_URL, "fixtures.xlsx"), fix_path):
        try:
            fd_fix = pd.read_excel(fix_path)
            if "Date" in fd_fix.columns: fd_fix["Date"] = fd_fix["Date"].apply(ndate)
        except Exception as e:
            print(f"[FIX ERR] {e}")

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
        time.sleep(0.4)

    if frames:
        all_df = pd.concat(frames, ignore_index=True)
        all_df.to_csv(os.path.join(OUT, "all_leagues.csv"), index=False, encoding="utf-8")
        print(f"[OK] Salvato all_leagues.csv ({len(all_df)} righe)")

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
