import os
import re
from urllib.parse import urljoin
import requests
import pandas as pd

BASE_URL = "https://www.football-data.co.uk/"
SEASON = "2627"  # Stagione 2026/2027 (aggiornabile ogni estate)
OUTPUT_DIR = "data"

# Codici top 5 campionati europei + seconde divisioni su football-data.co.uk
LEAGUES = {
    "I1": ("Italia", "Serie A"),
    "I2": ("Italia", "Serie B"),
    "E0": ("Inghilterra", "Premier League"),
    "E1": ("Inghilterra", "Championship"),
    "SP1": ("Spagna", "La Liga"),
    "SP2": ("Spagna", "Segunda Division"),
    "D1": ("Germania", "Bundesliga"),
    "D2": ("Germania", "2. Bundesliga"),
    "F1": ("Francia", "Ligue 1"),
    "F2": ("Francia", "Ligue 2"),
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ComboGesssUpdater/1.0)"
}


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def download_file(url: str, dest_path: str) -> bool:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(resp.content)
        print(f"[OK] Scaricato: {url} -> {dest_path}")
        return True
    except Exception as exc:
        print(f"[ERRORE] Impossibile scaricare {url}: {exc}")
        return False


def download_fixtures_excel(dest_path: str) -> None:
    """Scarica il file Excel delle partite future da matches.php / fixtures.xlsx."""
    direct_fixtures_url = urljoin(BASE_URL, "fixtures.xlsx")
    if download_file(direct_fixtures_url, dest_path):
        return

    # Fallback: cerca il link al file .xlsx o .csv dentro matches.php
    try:
        matches_page = urljoin(BASE_URL, "matches.php")
        resp = requests.get(matches_page, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        links = re.findall(r'href=["\']([^"\']*\.(?:xlsx|xls|csv))["\']', resp.text, re.I)
        for href in links:
            if "fix" in href.lower() or "match" in href.lower():
                target_url = urljoin(matches_page, href)
                if download_file(target_url, dest_path):
                    return
    except Exception as exc:
        print(f"[ERRORE] Fallback matches.php fallito: {exc}")


def download_leagues_data(season: str, out_dir: str) -> None:
    """Scarica i CSV di tutti i campionati configurati e crea un file combinato."""
    all_frames = []
    for code, (country, league_name) in LEAGUES.items():
        url = f"{BASE_URL}mmz4281/{season}/{code}.csv"
        csv_path = os.path.join(out_dir, f"{code}.csv")
        if download_file(url, csv_path):
            try:
                df = pd.read_csv(csv_path, encoding="utf-8-sig", on_bad_lines="skip")
                df["Country"] = country
                df["LeagueName"] = league_name
                df["DivCode"] = code
                all_frames.append(df)
            except Exception as exc:
                print(f"[AVVISO] Lettura CSV {code} parziale: {exc}")

    if all_frames:
        combined_df = pd.concat(all_frames, ignore_index=True)
        combined_csv = os.path.join(out_dir, "all_leagues.csv")
        combined_df.to_csv(combined_csv, index=False, encoding="utf-8")
        print(f"[OK] Creato archivio unificato: {combined_csv} ({len(combined_df)} righe)")


def main() -> None:
    ensure_dir(OUTPUT_DIR)
    print("=== Aggiornamento dati ComboGesss ===")
    download_fixtures_excel(os.path.join(OUTPUT_DIR, "fixtures.xlsx"))
    download_leagues_data(SEASON, OUTPUT_DIR)
    print("=== Completato ===")


if __name__ == "__main__":
    main()