from datetime import datetime, timedelta, timezone
import json
import os
import re
from urllib.parse import urljoin
import requests
import pandas as pd

BASE_URL = "https://www.football-data.co.uk/"
SEASON = "2627"  # Stagione 2026/2027
OUTPUT_DIR = "data"
EURO_EXCEL_NAME = "all-euro-data-2026-2027.xlsx"

# Mappa completa: Codice -> (Nazione, Bandiera, Nome Campionato)
LEAGUES = {
    # Italia
    "I1": ("Italia", "🇮🇹", "Serie A"),
    "I2": ("Italia", "🇮🇹", "Serie B"),
    # Inghilterra
    "E0": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Premier League"),
    "E1": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Championship"),
    "E2": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League One"),
    "E3": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "League Two"),
    "EC": ("Inghilterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "National League"),
    # Scozia
    "SC0": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Premiership"),
    "SC1": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Championship"),
    "SC2": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "League One"),
    "SC3": ("Scozia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "League Two"),
    # Spagna
    "SP1": ("Spagna", "🇪🇸", "La Liga"),
    "SP2": ("Spagna", "🇪🇸", "Segunda Division"),
    # Germania
    "D1": ("Germania", "🇩🇪", "Bundesliga"),
    "D2": ("Germania", "🇩🇪", "2. Bundesliga"),
    # Francia
    "F1": ("Francia", "🇫🇷", "Ligue 1"),
    "F2": ("Francia", "🇫🇷", "Ligue 2"),
    # Paesi Bassi
    "N1": ("Paesi Bassi", "🇳🇱", "Eredivisie"),
    # Belgio
    "B1": ("Belgio", "🇧🇪", "Pro League"),
    # Portogallo
    "P1": ("Portogallo", "🇵🇹", "Liga Portugal"),
    # Turchia
    "T1": ("Turchia", "🇹🇷", "Super Lig"),
    # Grecia
    "G1": ("Grecia", "🇬🇷", "Super League"),
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ComboGesssUpdater/1.0)"
}


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def normalize_date_dd_mm_yyyy(val) -> str:
    """Converte qualsiasi data (DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, seriale Excel, Date) in DD/MM/AAAA."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""

    if isinstance(val, pd.Timestamp):
        if pd.isna(val):
            return ""
        return val.strftime("%d/%m/%Y")

    if isinstance(val, datetime):
        return val.strftime("%d/%m/%Y")

    if isinstance(val, (int, float)):
        try:
            serial_days = int(float(val))
            dt = datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=serial_days)
            return dt.strftime("%d/%m/%Y")
        except Exception:
            return str(val).strip()

    s = str(val).strip()
    if not s or s.lower() in {"nan", "nat", "none"}:
        return ""

    if re.fullmatch(r"\d+(\.\d+)?", s):
        return normalize_date_dd_mm_yyyy(float(s))

    date_part = re.split(r"[\sT]+", s)[0]

    # DD/MM/AAAA oppure DD/MM/AA (con / o -)
    m_dmy = re.fullmatch(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})", date_part)
    if m_dmy:
        day = int(m_dmy.group(1))
        month = int(m_dmy.group(2))
        year = int(m_dmy.group(3))
        if year < 100:
            year += 1900 if year >= 70 else 2000
        try:
            dt = datetime(year, month, day)
            return dt.strftime("%d/%m/%Y")
        except ValueError:
            return f"{day:02d}/{month:02d}/{year:04d}"

    # AAAA-MM-GG oppure AAAA/MM/GG
    m_ymd = re.fullmatch(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", date_part)
    if m_ymd:
        year = int(m_ymd.group(1))
        month = int(m_ymd.group(2))
        day = int(m_ymd.group(3))
        try:
            dt = datetime(year, month, day)
            return dt.strftime("%d/%m/%Y")
        except ValueError:
            return f"{day:02d}/{month:02d}/{year:04d}"

    return s


def normalize_df_dates(df: pd.DataFrame) -> pd.DataFrame:
    """Normalizza tutte le colonne data di un DataFrame nel formato DD/MM/AAAA."""
    if df is None or df.empty:
        return df
    for col in df.columns:
        if str(col).strip().lower() in {"date", "matchdate", "data"}:
            df[col] = df[col].apply(normalize_date_dd_mm_yyyy)
    return df


def build_countries_catalog() -> list[dict]:
    """Raggruppa i campionati per nazione includendo bandiera e codici."""
    grouped: dict[str, dict] = {}
    for code, (country, flag, league_name) in LEAGUES.items():
        if country not in grouped:
            grouped[country] = {
                "country": country,
                "flag": flag,
                "leagues": [],
            }
        grouped[country]["leagues"].append({
            "code": code,
            "name": league_name,
        })
    return list(grouped.values())


def export_countries_catalog(out_dir: str) -> list[dict]:
    """Salva data/countries_leagues.json nella cartella data."""
    catalog = build_countries_catalog()
    out_path = os.path.join(out_dir, "countries_leagues.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"[OK] Creato catalogo nazioni/campionati: {out_path}")
    return catalog


def download_file(url: str, dest_path: str) -> bool:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(resp.content)
        print(f"[OK] Scaricato: {url} -> {dest_path}")
        return True
    except Exception as exc:
        print(f"[AVVISO] Impossibile scaricare {url}: {exc}")
        return False


def normalize_excel_file_in_place(excel_path: str) -> None:
    """Riscrive tutti i fogli del file Excel normalizzando le date in DD/MM/AAAA."""
    if not os.path.exists(excel_path):
        return
    try:
        xl = pd.ExcelFile(excel_path)
        frames = {}
        for sheet in xl.sheet_names:
            df = xl.parse(sheet)
            frames[sheet] = normalize_df_dates(df)
        with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
            for sheet, df in frames.items():
                df.to_excel(writer, sheet_name=sheet, index=False)
        print(f"[OK] Date normalizzate in DD/MM/AAAA per tutti i fogli di {excel_path}")
    except Exception as exc:
        print(f"[AVVISO] Normalizzazione Excel {excel_path}: {exc}")


def download_fixtures_excel(dest_path: str) -> None:
    """Scarica il file Excel delle partite future da matches.php / fixtures.xlsx."""
    direct_fixtures_url = urljoin(BASE_URL, "fixtures.xlsx")
    if not download_file(direct_fixtures_url, dest_path):
        try:
            matches_page = urljoin(BASE_URL, "matches.php")
            resp = requests.get(matches_page, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            links = re.findall(r'href=["\']([^"\']*\.(?:xlsx|xls|csv))["\']', resp.text, re.I)
            for href in links:
                if "fix" in href.lower() or "match" in href.lower():
                    target_url = urljoin(matches_page, href)
                    if download_file(target_url, dest_path):
                        break
        except Exception as exc:
            print(f"[AVVISO] Fallback matches.php non riuscito: {exc}")

    normalize_excel_file_in_place(dest_path)


def sync_euro_excel(out_dir: str) -> None:
    """Scarica (ogni volta) all-euro-data-2026-2027.xlsx dentro data/ e normalizza le date."""
    local_excel = os.path.join(out_dir, EURO_EXCEL_NAME)
    # Riscarica sempre il file (così ogni esecuzione giornaliera lo aggiorna);
    # se il download fallisce, resta la copia precedente.
    candidate_url = urljoin(BASE_URL, f"mmz4281/{SEASON}/{EURO_EXCEL_NAME}")
    download_file(candidate_url, local_excel)

    if os.path.exists(local_excel):
        try:
            xl = pd.ExcelFile(local_excel)
            print(f"[INFO] Fogli trovati in {local_excel}: {xl.sheet_names}")
            for sheet in xl.sheet_names:
                code = sheet.strip().upper()
                if code not in LEAGUES:
                    print(f"[AVVISO] Foglio/codice non mappato in LEAGUES: '{sheet}'")
            normalize_excel_file_in_place(local_excel)
        except Exception as exc:
            print(f"[AVVISO] Impossibile leggere {local_excel}: {exc}")


def download_leagues_data(season: str, out_dir: str) -> None:
    """Scarica i CSV di tutti i campionati configurati, normalizza le date in DD/MM/AAAA e crea data/all_leagues.csv."""
    all_frames = []
    for code, (country, flag, league_name) in LEAGUES.items():
        url = f"{BASE_URL}mmz4281/{season}/{code}.csv"
        csv_path = os.path.join(out_dir, f"{code}.csv")
        if download_file(url, csv_path):
            try:
                df = pd.read_csv(csv_path, encoding="utf-8-sig", on_bad_lines="skip")
                df = normalize_df_dates(df)
                df["Country"] = country
                df["Flag"] = flag
                df["LeagueName"] = league_name
                df["DivCode"] = code
                df.to_csv(csv_path, index=False, encoding="utf-8")
                all_frames.append(df)
            except Exception as exc:
                print(f"[AVVISO] Lettura CSV {code} parziale: {exc}")

    if all_frames:
        combined_df = pd.concat(all_frames, ignore_index=True)
        combined_df = normalize_df_dates(combined_df)
        combined_csv = os.path.join(out_dir, "all_leagues.csv")
        combined_df.to_csv(combined_csv, index=False, encoding="utf-8")
        print(f"[OK] Creato archivio unificato: {combined_csv} ({len(combined_df)} righe, date in DD/MM/AAAA)")


def main() -> None:
    ensure_dir(OUTPUT_DIR)
    print("=== Aggiornamento dati ComboGesss (Formato data DD/MM/AAAA) ===")
    export_countries_catalog(OUTPUT_DIR)
    download_fixtures_excel(os.path.join(OUTPUT_DIR, "fixtures.xlsx"))
    sync_euro_excel(OUTPUT_DIR)
    download_leagues_data(SEASON, OUTPUT_DIR)
    print("=== Completato ===")


if __name__ == "__main__":
    main()