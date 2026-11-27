from datetime import datetime, timedelta, timezone
import json
import os
import re
from urllib.parse import urljoin
import pandas as pd
import requests

BASE_URL = "https://football-data.co.uk"
OPENFOOTBALL_BASE = "https://githubusercontent.com"
SEASON = "2627"
OUTPUT_DIR = "data"
EURO_EXCEL_NAME = "all-euro-data-2026-2027.xlsx"

# Codice -> (Nazione, Bandiera, Nome Campionato, File OpenFootball opzionale)
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

# Normalizzazione nomi squadra: OpenFootball -> Football-Data.co.uk
TEAM_MAP = {
    # Italia
    "FC Internazionale Milano": "Inter",
    "Internazionale": "Inter",
    "AC Milan": "Milan",
    "AS Roma": "Roma",
    "SS Lazio": "Lazio",
    "SSC Napoli": "Napoli",
    "Juventus FC": "Juventus",
    "Atalanta BC": "Atalanta",
    "ACF Fiorentina": "Fiorentina",
    "Bologna FC 1909": "Bologna",
    "Torino FC": "Torino",
    "Udinese Calcio": "Udinese",
    "Genoa CFC": "Genoa",
    "Cagliari Calcio": "Cagliari",
    "Hellas Verona FC": "Verona",
    "Hellas Verona": "Verona",
    "US Lecce": "Lecce",
    "Parma Calcio 1913": "Parma",
    "Como 1907": "Como",
    "AC Monza": "Monza",
    "Venezia FC": "Venezia",
    "Empoli FC": "Empoli",
    "US Sassuolo Calcio": "Sassuolo",
    "Frosinone Calcio": "Frosinone",
    # Inghilterra
    "Manchester United FC": "Man United",
    "Manchester United": "Man United",
    "Manchester City FC": "Man City",
    "Manchester City": "Man City",
    "Newcastle United FC": "Newcastle",
    "Newcastle United": "Newcastle",
    "Nottingham Forest FC": "Nott'm Forest",
    "Nottingham Forest": "Nott'm Forest",
    "Wolverhampton Wanderers FC": "Wolves",
    "Wolverhampton Wanderers": "Wolves",
    "West Ham United FC": "West Ham",
    "West Ham United": "West Ham",
    "Tottenham Hotspur FC": "Tottenham",
    "Tottenham Hotspur": "Tottenham",
    "Brighton & Hove Albion FC": "Brighton",
    "Brighton & Hove Albion": "Brighton",
    "Leicester City FC": "Leicester",
    "Ipswich Town FC": "Ipswich",
    "Arsenal FC": "Arsenal",
    "Chelsea FC": "Chelsea",
    "Liverpool FC": "Liverpool",
    "Everton FC": "Everton",
    "Fulham FC": "Fulham",
    "Brentford FC": "Brentford",
    "Crystal Palace FC": "Crystal Palace",
    "AFC Bournemouth": "Bournemouth",
    "Aston Villa FC": "Aston Villa",
    "Southampton FC": "Southampton",
    # Spagna
    "FC Barcelona": "Barcelona",
    "Real Madrid CF": "Real Madrid",
    "Club Atlético de Madrid": "Ath Madrid",
    "Atlético Madrid": "Ath Madrid",
    "Athletic Club": "Ath Bilbao",
    "Real Sociedad de Fútbol": "Sociedad",
    "Real Betis Balompié": "Betis",
    "Villarreal CF": "Villarreal",
    "Sevilla FC": "Sevilla",
    "Valencia CF": "Valencia",
    "RC Celta de Vigo": "Celta",
    "Celta Vigo": "Celta",
    "CA Osasuna": "Osasuna",
    "Getafe CF": "Getafe",
    "Rayo Vallecano de Madrid": "Vallecano",
    "Rayo Vallecano": "Vallecano",
    "RCD Mallorca": "Mallorca",
    "Deportivo Alavés": "Alaves",
    "UD Las Palmas": "Las Palmas",
    "Girona FC": "Girona",
    "RCD Espanyol de Barcelona": "Espanol",
    "RCD Espanyol": "Espanol",
    "Real Valladolid CF": "Valladolid",
    "CD Leganés": "Leganes",
    # Germania
    "FC Bayern München": "Bayern Munich",
    "Bayern München": "Bayern Munich",
    "Borussia Dortmund": "Dortmund",
    "Bayer 04 Leverkusen": "Leverkusen",
    "RB Leipzig": "RB Leipzig",
    "Eintracht Frankfurt": "Ein Frankfurt",
    "VfB Stuttgart": "Stuttgart",
    "Borussia Mönchengladbach": "M'gladbach",
    "VfL Wolfsburg": "Wolfsburg",
    "SC Freiburg": "Freiburg",
    "TSG 1899 Hoffenheim": "Hoffenheim",
    "1. FSV Mainz 05": "Mainz",
    "FC Augsburg": "Augsburg",
    "SV Werder Bremen": "Werder Bremen",
    "1. FC Union Berlin": "Union Berlin",
    "VfL Bochum 1848": "Bochum",
    "1. FC Heidenheim 1846": "Heidenheim",
    "FC St. Pauli 1910": "St Pauli",
    "Holstein Kiel": "Holstein Kiel",
    # Francia
    "Paris Saint-Germain FC": "Paris SG",
    "Paris Saint-Germain": "Paris SG",
    "Olympique de Marseille": "Marseille",
    "AS Monaco FC": "Monaco",
    "AS Monaco": "Monaco",
    "Olympique Lyonnais": "Lyon",
    "LOSC Lille": "Lille",
    "OGC Nice": "Nice",
    "RC Lens": "Lens",
    "Stade Rennais FC 1901": "Rennes",
    "Stade Brestois 29": "Brest",
    "RC Strasbourg Alsace": "Strasbourg",
    "FC Nantes": "Nantes",
    "Toulouse FC": "Toulouse",
    "Montpellier HSC": "Montpellier",
    "Stade de Reims": "Reims",
    "AJ Auxerre": "Auxerre",
    "Angers SCO": "Angers",
    "AS Saint-Étienne": "St Etienne",
    "Le Havre AC": "Le Havre",
}

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ComboGesssUpdater/2.0)"}


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def clean_team_name(raw_name: str, known_teams: set[str]) -> str:
    name = str(raw_name or "").strip()
    if name in TEAM_MAP:
        return TEAM_MAP[name]
    if name in known_teams:
        return name
    # Rimuove suffissi comuni (FC, CF, AC, AS, 1909, ecc.) per trovare corrispondenze
    stripped = re.sub(r"\b(FC|CF|AC|AS|SC|SV|VfL|VfB|US|SS|SSC|ACF|UD|CD|RC|RCD|CA|OGC|LOSC|AJ|1\.)\b", "", name).strip()
    stripped = re.sub(r"\b\d{4}\b", "", stripped).strip()
    stripped = re.sub(r"\s+", " ", stripped)
    if stripped in TEAM_MAP:
        return TEAM_MAP[stripped]
    for kt in known_teams:
        if kt.lower() == stripped.lower() or kt.lower() in stripped.lower() or stripped.lower() in kt.lower():
            return kt
    return stripped or name


def normalize_date_dd_mm_yyyy(val) -> str:
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
    date_part = re.split(r"[\sT]+", s)[0]
    m_dmy = re.fullmatch(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})", date_part)
    if m_dmy:
        y = int(m_dmy.group(3))
        if y < 100:
            y += 1900 if y >= 70 else 2000
        return f"{int(m_dmy.group(1)):02d}/{int(m_dmy.group(2)):02d}/{y:04d}"
    m_ymd = re.fullmatch(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", date_part)
    if m_ymd:
        return f"{int(m_ymd.group(3)):02d}/{int(m_ymd.group(2)):02d}/{int(m_ymd.group(1)):04d}"
    return s


def normalize_df_dates(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return df
    for col in df.columns:
        if str(col).strip().lower() in {"date", "matchdate", "data"}:
            df[col] = df[col].apply(normalize_date_dd_mm_yyyy)
    return df


def export_countries_catalog(out_dir: str) -> None:
    grouped = {}
    for code, (country, flag, league_name, _) in LEAGUES.items():
        if country not in grouped:
            grouped[country] = {"country": country, "flag": flag, "leagues": []}
        grouped[country]["leagues"].append({"code": code, "name": league_name})
    out_path = os.path.join(out_dir, "countries_leagues.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(list(grouped.values()), f, ensure_ascii=False, indent=2)
    print(f"[OK] Creato catalogo nazioni/campionati: {out_path}")


def download_file(url: str, dest_path: str) -> bool:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(resp.content)
        print(f"[OK] Scaricato: {url}")
        return True
    except Exception as exc:
        print(f"[AVVISO] Impossibile scaricare {url}: {exc}")
        return False


def sync_euro_excel(out_dir: str) -> None:
    local_excel = os.path.join(out_dir, EURO_EXCEL_NAME)
    candidate_url = urljoin(BASE_URL, f"mmz4281/{SEASON}/{EURO_EXCEL_NAME}")
    download_file(candidate_url, local_excel)
    if os.path.exists(local_excel):
        try:
            xl = pd.ExcelFile(local_excel)
            frames = {sheet: normalize_df_dates(xl.parse(sheet)) for sheet in xl.sheet_names}
            with pd.ExcelWriter(local_excel, engine="openpyxl") as writer:
                for sheet, df in frames.items():
                    df.to_excel(writer, sheet_name=sheet, index=False)
            print(f"[OK] Normalizzato {local_excel}")
        except Exception as exc:
            print(f"[AVVISO] Normalizzazione {local_excel}: {exc}")


