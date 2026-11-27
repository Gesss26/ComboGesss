from datetime import datetime, timedelta, timezone
import json
import os
import re
from urllib.parse import urljoin
import pandas as pd
import requests

BASE_FD = "https://" + "www.football-data.co.uk/"
BASE_OF = "https://" + "://githubusercontent.com"
SEASON = "2627"
OUTPUT_DIR = "data"
EURO_EXCEL = "all-euro-data-2026-2027.xlsx"

LEAGUES = {
    "I1": ("Italia", "🇮🇹", "Serie A", "it.1.json"),
    "I2": ("Italia", "🇮🇹", "Serie B", "it.2.json"),
    "E0": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Premier League", "en.1.json"),
    "E1": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Championship", "en.2.json"),
    "E2": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League One", "en.3.json"),
    "E3": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League Two", "en.4.json"),
    "EC": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "National League", None),
    "SC0": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Premiership", "sco.1.json"),
    "SC1": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Championship", None),
    "SC2": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "League One", None),
    "SC3": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "League Two", None),
    "SP1": ("Spagna", "🇪🇸", "La Liga", "es.1.json"),
    "SP2": ("Spagna", "🇪🇸", "Segunda Division", "es.2.json"),
    "D1": ("Germania", "🇩🇪", "Bundesliga", "de.1.json"),
    "D2": ("Germania", "🇩🇪", "2. Bundesliga", "de.2.json"),
    "F1": ("Francia", "🇫🇷", "Ligue 1", "fr.1.json"),
    "F2": ("Francia", "🇫🇷", "Ligue 2", "fr.2.json"),
    "N1": ("Paesi Bassi", "🇳🇱", "Eredivisie", "nl.1.json"),
    "B1": ("Belgio", "🇧🇪", "Pro League", "be.1.json"),
    "P1": ("Portogallo", "🇵🇹", "Liga Portugal", "pt.1.json"),
    "T1": ("Turchia", "🇹🇷", "Super Lig", "tr.1.json"),
    "G1": ("Grecia", "🇬🇷", "Super League", "gr.1.json"),
}

ALIASES = {
    "fc internazionale milano": "Inter", "internazionale": "Inter", "ac milan": "Milan",
    "juventus fc": "Juventus", "ssc napoli": "Napoli", "as roma": "Roma", "ss lazio": "Lazio",
    "atalanta bc": "Atalanta", "acf fiorentina": "Fiorentina", "bologna fc 1909": "Bologna",
    "torino fc": "Torino", "udinese calcio": "Udinese", "genoa cfc": "Genoa",
    "cagliari calcio": "Cagliari", "hellas verona fc": "Verona", "us lecce": "Lecce",
    "parma calcio 1913": "Parma", "como 1907": "Como", "ac monza": "Monza", "venezia fc": "Venezia",
    "empoli fc": "Empoli", "us sassuolo calcio": "Sassuolo", "frosinone calcio": "Frosinone",
    "manchester united fc": "Man United", "manchester city fc": "Man City",
    "tottenham hotspur fc": "Tottenham", "newcastle united fc": "Newcastle",
    "west ham united fc": "West Ham", "wolverhampton wanderers fc": "Wolves",
    "nottingham forest fc": "Nott'm Forest", "brighton & hove albion fc": "Brighton",
    "leicester city fc": "Leicester", "ipswich town fc": "Ipswich", "afc bournemouth": "Bournemouth",
    "crystal palace fc": "Crystal Palace", "aston villa fc": "Aston Villa", "arsenal fc": "Arsenal",
    "chelsea fc": "Chelsea", "liverpool fc": "Liverpool", "everton fc": "Everton",
    "fulham fc": "Fulham", "brentford fc": "Brentford", "southampton fc": "Southampton",
    "real madrid cf": "Real Madrid", "fc barcelona": "Barcelona", "club atlético de madrid": "Ath Madrid",
    "athletic club": "Ath Bilbao", "real sociedad de fútbol": "Sociedad", "real betis balompié": "Betis",
    "villarreal cf": "Villarreal", "sevilla fc": "Sevilla", "valencia cf": "Valencia",
    "rc celta de vigo": "Celta", "fc bayern münchen": "Bayern Munich", "borussia dortmund": "Dortmund",
    "bayer 04 leverkusen": "Leverkusen", "rb leipzig": "RB Leipzig", "eintracht frankfurt": "Ein Frankfurt",
    "vfb stuttgart": "Stuttgart", "borussia mönchengladbach": "M'gladbach",
    "paris saint-germain fc": "Paris SG", "olympique de marseille": "Marseille",
    "olympique lyonnais": "Lyon", "as monaco fc": "Monaco", "lille osc": "Lille", "ogc nice": "Nice",
}

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def norm_date(val) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.strftime("%d/%m/%Y")
    if isinstance(val, (int, float)):
        dt = datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=int(float(val)))
        return dt.strftime("%d/%m/%Y")
    s = str(val).strip()
    if not s or s.lower() in {"nan", "nat", "none"}:
        return ""
    p = re.split(r"[\sT]+", s)
    m1 = re.fullmatch(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})", p)
    if m1:
        y = int(m1.group(3)) + (2000 if int(m1.group(3)) < 100 else 0)
        return f"{int(m1.group(1)):02d}/{int(m1.group(2)):02d}/{y:04d}"
    m2 = re.fullmatch(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", p)
    if m2:
        return f"{int(m2.group(3)):02d}/{int(m2.group(2)):02d}/{int(m2.group(1)):04d}"
    return s


def norm_team(raw: str, known: dict) -> str:
    c = str(raw or "").strip()
    low = c.lower()
    if low in ALIASES:
        return ALIASES[low]
    if low in known:
        return known[low]
    st = re.sub(r"\b(fc|cf|ac|as|ss|ssc|us|uc|ud|cd|rc|rcd|sc|vfb|vfl|tsg|sv|fsv|1\.)\b", "", low).strip()
    st = re.sub(r"\s+", " ", st)
    if st in known:
        return known[st]
    for k, orig in known.items():
        if k in st or st in k:
            return orig
    return c


def download_file(url: str, dest: str) -> bool:
    try:
        r = requests.get(url, headers=HEADERS, timeout=25)
        if r.status_code != 200:
            print(f"[AVVISO] HTTP {r.status_code} su {url}")
            return False
        with open(dest, "wb") as f:
            f.write(r.content)
        print(f"[OK] Scaricato {os.path.basename(dest)}")
        return True
    except Exception as e:
        print(f"[ERR] {url}: {e}")
        return False


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("=== Avvio aggiornamento ComboGesss ===")

    # 1. Esporta catalogo nazioni e campionati
    grouped = {}
    for code, (country, flag, name, _) in LEAGUES.items():
        grouped.setdefault(country, {"country": country, "flag": flag, "leagues": []})["leagues"].append(
            {"code": code, "name": name}
        )
    with open(os.path.join(OUTPUT_DIR, "countries_leagues.json"), "w", encoding="utf-8") as f:
        json.dump(list(grouped.values()), f, ensure_ascii=False, indent=2)
    print("[OK] Creato countries_leagues.json")

    # 2. Scarica e normalizza Excel europeo generale
    euro_path = os.path.join(OUTPUT_DIR, EURO_EXCEL)
    if download_file(urljoin(BASE_FD, f"mmz4281/{SEASON}/{EURO_EXCEL}"), euro_path):
        try:
            xl = pd.ExcelFile(euro_path)
            sheets = {}
            for s in xl.sheet_names:
                df_s = xl.parse(s)
                if "Date" in df_s.columns:
                    df_s["Date"] = df_s["Date"].apply(norm_date)
                sheets[s] = df_s
            with pd.ExcelWriter(euro_path, engine="openpyxl") as writer:
                for s, df_s in sheets.items():
                    df_s.to_excel(writer, sheet_name=s, index=False)
            print(f"[OK] Normalizzato {EURO_EXCEL}")
        except Exception as e:
            print(f"[AVVISO] Normalizzazione {EURO_EXCEL}: {e}")

    # 3. Scarica fixtures.xlsx (con fallback su matches.php)
    fix_path = os.path.join(OUTPUT_DIR, "fixtures.xlsx")
    fd_fix = pd.DataFrame()
    if not download_file(urljoin(BASE_FD, "fixtures.xlsx"), fix_path):
        try:
            mp = urljoin(BASE_FD, "matches.php")
            resp = requests.get(mp, headers=HEADERS, timeout=25)
            links = re.findall(r'href=["\']([^"\']*\.(?:xlsx|xls|csv))["\']', resp.text, re.I)
            for href in links:
                if "fix" in href.lower() or "match" in href.lower():
                    if download_file(urljoin(mp, href), fix_path):
                        break
        except Exception as e:
            print(f"[AVVISO] Fallback matches.php: {e}")

    if os.path.exists(fix_path):
        try:
            fd_fix = pd.read_excel(fix_path)
            if "Date" in fd_fix.columns:
                fd_fix["Date"] = fd_fix["Date"].apply(norm_date)
        except Exception as e:
            print(f"[AVVISO] Lettura fixtures.xlsx: {e}")

    # 4. Scarica CSV per ogni campionato + calendario completo OpenFootball
    frames = []
    extra = []
    for code, (country, flag, name, of_file) in LEAGUES.items():
        csv_path = os.path.join(OUTPUT_DIR, f"{code}.csv")
        known = {}
        played = set()

        if download_file(f"{BASE_FD}mmz4281/{SEASON}/{code}.csv", csv_path):
            try:
                df = pd.read_csv(csv_path, encoding="utf-8-sig", on_bad_lines="skip")
                if "Date" in df.columns:
                    df["Date"] = df["Date"].apply(norm_date)
                df["Country"], df["Flag"], df["LeagueName"], df["DivCode"] = country, flag, name, code
                df.to_csv(csv_path, index=False, encoding="utf-8")
                frames.append(df)

                for _, r in df.iterrows():
                    h, a = str(r.get("HomeTeam", "")).strip(), str(r.get("AwayTeam", "")).strip()
                    if h:
                        known[h.lower()] = h
                    if a:
                        known[a.lower()] = a
                    if pd.notna(r.get("FTHG")) and pd.notna(r.get("FTAG")):
                        played.add((h.lower(), a.lower()))
            except Exception as e:
                print(f"[AVVISO] Elaborazione CSV {code}: {e}")

        if of_file:
            try:
                res = requests.get(urljoin(BASE_OF, of_file), headers=HEADERS, timeout=20)
                if res.status_code == 200:
                    count_of = 0
                    for m in res.json().get("matches", []):
                        if m.get("score", {}).get("ft"):
                            continue
                        d_str = norm_date(m.get("date", ""))
