from datetime import datetime, timedelta, timezone
from io import StringIO
import json
import os
import re
import time
import cloudscraper
import pandas as pd

OUTPUT_DIR = "data"
EURO_EXCEL_NAME = "all-euro-data-2026-2027.xlsx"

# Mappa completa: Codice -> (Nazione, Bandiera, Nome Campionato, URL FBref)
LEAGUES = {
    # Italia
    "I1": ("Italia", "🇮🇹", "Serie A", "https://fbref.com"),
    "I2": ("Italia", "🇮🇹", "Serie B", "https://fbref.com"),
    # Inghilterra
    "E0": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Premier League", "https://fbref.com"),
    "E1": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Championship", "https://fbref.com"),
    "E2": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League One", "https://fbref.com"),
    "E3": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League Two", "https://fbref.com"),
    "EC": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "National League", "https://fbref.com"),
    # Scozia
    "SC0": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Premiership", "https://fbref.com"),
    "SC1": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Championship", "https://fbref.com"),
    # Spagna
    "SP1": ("Spagna", "🇪🇸", "La Liga", "https://fbref.com"),
    "SP2": ("Spagna", "🇪🇸", "Segunda Division", "https://fbref.com"),
    # Germania
    "D1": ("Germania", "🇩🇪", "Bundesliga", "https://fbref.com"),
    "D2": ("Germania", "🇩🇪", "2. Bundesliga", "https://fbref.com"),
    # Francia
    "F1": ("Francia", "🇫🇷", "Ligue 1", "https://fbref.com"),
    "F2": ("Francia", "🇫🇷", "Ligue 2", "https://fbref.com"),
    # Paesi Bassi
    "N1": ("Paesi Bassi", "🇳🇱", "Eredivisie", "https://fbref.com"),
    # Belgio
    "B1": ("Belgio", "🇧🇪", "Pro League", "https://fbref.com"),
    # Portogallo
    "P1": ("Portogallo", "🇵🇹", "Liga Portugal", "https://fbref.com"),
    # Turchia
    "T1": ("Turchia", "🇹🇷", "Super Lig", "https://fbref.com"),
    # Grecia
    "G1": ("Grecia", "🇬🇷", "Super League", "https://fbref.com"),
}


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def normalize_date_dd_mm_yyyy(val) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    s = str(val).strip()
    if not s or s.lower() in {"nan", "nat", "none", "date"}:
        return ""
    date_part = re.split(r"[\sT]+", s)[0]
    m_ymd = re.fullmatch(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", date_part)
    if m_ymd:
        return f"{int(m_ymd.group(3)):02d}/{int(m_ymd.group(2)):02d}/{int(m_ymd.group(1)):04d}"
    m_dmy = re.fullmatch(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})", date_part)
    if m_dmy:
        y = int(m_dmy.group(3))
        if y < 100:
            y += 2000
        return f"{int(m_dmy.group(1)):02d}/{int(m_dmy.group(2)):02d}/{y:04d}"
    return s


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


def parse_fbref_league(scraper, code: str, country: str, flag: str, league_name: str, url: str):
    """Scarica la pagina FBref di un campionato e restituisce (df_giocate, df_future)."""
    try:
        resp = scraper.get(url, timeout=30)
        if resp.status_code == 429:
            print(f"[RATE LIMIT] Attesa extra di 15s su {code}...")
            time.sleep(15)
            resp = scraper.get(url, timeout=30)
        resp.raise_for_status()

        tables = pd.read_html(StringIO(resp.text))
        df = None
        for t in tables:
            if "Home" in t.columns and "Away" in t.columns and "Score" in t.columns:
                df = t.copy()
                break

        if df is None or df.empty:
            print(f"[AVVISO] Nessuna tabella calendario trovata per {code}")
            return pd.DataFrame(), pd.DataFrame()

        # Pulizia righe intestazione ripetute e righe vuote
        df = df[df["Date"].notna()]
        df = df[df["Date"].astype(str).str.strip() != "Date"]
        df = df[df["Home"].notna() & df["Away"].notna()]

        # Gestione colonne xG (alcune serie minori non hanno la colonna xG su FBref)
        xg_cols = [c for c in df.columns if str(c).startswith("xG")]
        has_xg = len(xg_cols) >= 2

        rows_all = []
        rows_future = []

        for _, r in df.iterrows():
            date_str = normalize_date_dd_mm_yyyy(r.get("Date", ""))
            if not date_str:
                continue

            raw_time = str(r.get("Time", "")).strip()
            time_str = raw_time[:5] if re.match(r"^\d{1,2}:\d{2}", raw_time) else "15:00"
            home = str(r["Home"]).strip()
            away = str(r["Away"]).strip()
            score = str(r.get("Score", "")).strip()

            home_xg = pd.to_numeric(r[xg_cols[0]], errors="coerce") if has_xg else None
            away_xg = pd.to_numeric(r[xg_cols[1]], errors="coerce") if has_xg else None

            # Controlla se la partita ha un risultato valido (es. "2–1" o "2-1")
            m_score = re.match(r"^(\d+)\s*[–\-]\s*(\d+)$", score)
            if m_score:
                hg = int(m_score.group(1))
                ag = int(m_score.group(2))
                ftr = "H" if hg > ag else ("A" if hg < ag else "D")
            else:
                hg, ag, ftr = None, None, ""

            base_row = {
                "Div": code,
                "DivCode": code,
                "Country": country,
                "Flag": flag,
                "LeagueName": league_name,
                "Date": date_str,
                "Time": time_str,
                "HomeTeam": home,
                "AwayTeam": away,
                "FTHG": hg if hg is not None else "",
                "FTAG": ag if ag is not None else "",
                "FTR": ftr,
                "HomeXG": round(float(home_xg), 2) if pd.notna(home_xg) else "",
                "AwayXG": round(float(away_xg), 2) if pd.notna(away_xg) else "",
            }
            rows_all.append(base_row)

            if hg is None:
                rows_future.append(base_row)

        df_all = pd.DataFrame(rows_all)
        df_fut = pd.DataFrame(rows_future)
        print(f"[OK] {code} ({league_name}): {len(df_all) - len(df_fut)} giocate, {len(df_fut)} future")
        return df_all, df_fut

    except Exception as exc:
        print(f"[ERRORE] Impossibile elaborare {code} ({url}): {exc}")
        return pd.DataFrame(), pd.DataFrame()


def main() -> None:
    ensure_dir(OUTPUT_DIR)
    print("=== Aggiornamento dati ComboGesss da FBref ===")
    export_countries_catalog(OUTPUT_DIR)

    scraper = cloudscraper.create_scraper()
    all_frames = []
    future_frames = []
    excel_sheets = {}

    for code, (country, flag, league_name, url) in LEAGUES.items():
        df_all, df_fut = parse_fbref_league(scraper, code, country, flag, league_name, url)
        if not df_all.empty:
            csv_path = os.path.join(OUTPUT_DIR, f"{code}.csv")
            df_all.to_csv(csv_path, index=False, encoding="utf-8")
            all_frames.append(df_all)
            excel_sheets[code] = df_all
        if not df_fut.empty:
            future_frames.append(df_fut)

        # Pausa anti-ban obbligatoria tra un campionato e l'altro
        time.sleep(5)

    if all_frames:
        combined_df = pd.concat(all_frames, ignore_index=True)
        combined_csv = os.path.join(OUTPUT_DIR, "all_leagues.csv")
        combined_df.to_csv(combined_csv, index=False, encoding="utf-8")
        print(f"[OK] Creato archivio unificato: {combined_csv} ({len(combined_df)} righe)")

        euro_excel_path = os.path.join(OUTPUT_DIR, EURO_EXCEL_NAME)
        with pd.ExcelWriter(euro_excel_path, engine="openpyxl") as writer:
            for sheet_code, sheet_df in excel_sheets.items():
                sheet_df.to_excel(writer, sheet_name=sheet_code, index=False)
        print(f"[OK] Creato Excel campionati: {euro_excel_path}")

    if future_frames:
        fixtures_df = pd.concat(future_frames, ignore_index=True)
        fixtures_path = os.path.join(OUTPUT_DIR, "fixtures.xlsx")
        fixtures_df.to_excel(fixtures_path, index=False, engine="openpyxl")
        print(f"[OK] Creato file partite future: {fixtures_path} ({len(fixtures_df)} partite)")

    print("=== Completato ===")


if __name__ == "__main__":
    main()
