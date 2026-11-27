import json, os, re
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
import pandas as pd
import requests

FD_URL = "https://" + "www.football-data.co.uk/"
OF_URL = "https://" + "://githubusercontent.com"
SEASON = "2627"
OUT = "data"
EURO_XLSX = "all-euro-data-2026-2027.xlsx"
HDR = {"User-Agent": "Mozilla/5.0"}

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

def ndate(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return ""
    if isinstance(v, (pd.Timestamp, datetime)): return v.strftime("%d/%m/%Y")
    if isinstance(v, (int, float)): return (datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=int(float(v)))).strftime("%d/%m/%Y")
    s = str(v).strip()
    p = re.split(r"[\sT]+", s)[0]
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
    st = re.sub(r"\s+", " ", re.sub(r"\b(fc|cf|ac|as|ss|ssc|us|uc|ud|cd|rc|rcd|sc|vfb|vfl|tsg|sv|fsv|1\.)\b", "", low)).strip()
    if st in known: return known[st]
    for k, orig in known.items():
        if k in st or st in k: return orig
    return c

def dl(url, dest):
    try:
        r = requests.get(url, headers=HDR, timeout=25)
        if r.status_code != 200:
            print(f"[HTTP {r.status_code}] {url}")
            return False
        with open(dest, "wb") as f: f.write(r.content)
        print(f"[OK] {os.path.basename(dest)}")
        return True
    except Exception as e:
        print(f"[ERR] {url}: {e}")
        return False

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
    for code, (country, flag, name, of_file) in LEAGUES.items():
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

        if of_file:
            try:
                res = requests.get(urljoin(OF_URL, of_file), headers=HDR, timeout=20)
                if res.status_code == 200:
                    for m in res.json().get("matches", []):
                        if m.get("score", {}).get("ft"): continue
                        d_str = ndate(m.get("date", ""))
                        h, a = nteam(m.get("team1", ""), known), nteam(m.get("team2", ""), known)
                        if d_str and (h.lower(), a.lower()) not in played:
                            t_raw = str(m.get("time", "")).strip()
                            extra.append({"Div": code, "Date": d_str, "Time": t_raw[:5] if re.match(r"^\d{1,2}:\d{2}", t_raw) else "15:00", "HomeTeam": h, "AwayTeam": a})
            except Exception as e:
                print(f"[OF ERR] {code}: {e}")

    if frames:
        all_df = pd.concat(frames, ignore_index=True)
        all_df.to_csv(os.path.join(OUT, "all_leagues.csv"), index=False, encoding="utf-8")
        if not os.path.exists(euro_path):
            with pd.ExcelWriter(euro_path, engine="openpyxl") as w:
                for c_code, grp in all_df.groupby("DivCode"): grp.to_excel(w, sheet_name=str(c_code), index=False)

    of_df = pd.DataFrame(extra) if extra else pd.DataFrame(columns=["Div", "Date", "Time", "HomeTeam", "AwayTeam"])
    if not fd_fix.empty and {"Div", "HomeTeam", "AwayTeam"}.issubset(fd_fix.columns):
        ex = set(zip(fd_fix["Div"].astype(str).str.upper(), fd_fix["HomeTeam"].astype(str).str.lower(), fd_fix["AwayTeam"].astype(str).str.lower()))
        of_df = of_df[~of_df.apply(lambda r: (r["Div"].upper(), r["HomeTeam"].lower(), r["AwayTeam"].lower()) in ex, axis=1)]
        final_fix = pd.concat([fd_fix, of_df], ignore_index=True)
    else:
        final_fix = of_df
    final_fix.to_excel(fix_path, index=False, engine="openpyxl")
    print(f"=== Completato: {len(frames)} leghe, {len(final_fix)} partite future ===")

if __name__ == "__main__":
    main()
