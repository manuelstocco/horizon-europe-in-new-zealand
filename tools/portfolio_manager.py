#!/usr/bin/env python3
"""Project-list downloads and exchange-rate updates for the local Site Manager."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from pathlib import Path
from xml.etree import ElementTree as ET

from content_manager import atomic_write, read_json, refresh_asset_references


DATA_PREFIX = "window.HE_DATA = "
CORDIS_HOST = "cordis.europa.eu"
CORDIS_PROJECT = "https://cordis.europa.eu/project/id/{project_id}"
INFOEURO_API = "https://ec.europa.eu/budg/inforeuro/api/public/monthly-rates"
INFOEURO_SOURCE = "https://commission.europa.eu/funding-and-tenders/procedures-guidelines-tenders/information-contractors-and-beneficiaries/exchange-rate-inforeuro_en"
USER_AGENT = "Horizon-Europe-NZ-site-manager/2.0"


def load_assignment(path: Path, prefix: str = DATA_PREFIX) -> dict:
    raw = path.read_text(encoding="utf-8").strip()
    if not raw.startswith(prefix):
        raise ValueError(f"Unexpected JavaScript data format in {path}")
    payload = raw[len(prefix):]
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


def project_id_from_reference(value: str) -> str:
    value = str(value or "").strip()
    if re.fullmatch(r"\d{6,12}", value):
        return value
    match = re.search(r"cordis\.europa\.eu/project/id/(\d{6,12})(?:[/#?]|$)", value, re.I)
    return match.group(1) if match else ""


def cordis_urls(project_id: str) -> tuple[str, str]:
    page = CORDIS_PROJECT.format(project_id=project_id)
    return page, f"{page}?format=xml"


def default_project_store(root: Path) -> dict:
    data = load_assignment(root / "site" / "assets" / "data.js")
    rows = []
    for project in data.get("projects", []):
        project_id = str(project.get("id", ""))
        page, xml = cordis_urls(project_id)
        rows.append({
            "id": project_id,
            "acronym": str(project.get("acronym", "")).strip(),
            "title": str(project.get("title", "")).strip(),
            "cordisUrl": page,
            "xmlUrl": xml,
            "enabled": True,
            "lastFetched": "",
            "lastStatus": "Not checked",
        })
    return {"metadata": {"updated": date.today().isoformat(), "schemaVersion": 1}, "projects": rows}


def clean_project_store(store: dict) -> tuple[dict, list[str]]:
    cleaned = {"metadata": {"updated": date.today().isoformat(), "schemaVersion": 1}, "projects": []}
    errors: list[str] = []
    seen: set[str] = set()
    for index, row in enumerate(store.get("projects", []), start=1):
        project_id = project_id_from_reference(row.get("id") or row.get("cordisUrl") or row.get("xmlUrl"))
        if not project_id:
            errors.append(f"Row {index}: enter a valid CORDIS project ID or project link.")
            continue
        if project_id in seen:
            errors.append(f"Project {project_id} is listed more than once.")
            continue
        seen.add(project_id)
        page, xml = cordis_urls(project_id)
        cleaned["projects"].append({
            "id": project_id,
            "acronym": str(row.get("acronym", "")).strip(),
            "title": str(row.get("title", "")).strip(),
            "cordisUrl": page,
            "xmlUrl": xml,
            "enabled": bool(row.get("enabled", True)),
            "lastFetched": str(row.get("lastFetched", "")).strip(),
            "lastStatus": str(row.get("lastStatus", "Not checked")).strip() or "Not checked",
        })
    return cleaned, errors


def ensure_project_store(root: Path) -> dict:
    path = root / "content" / "portfolio-projects.json"
    store = read_json(path, default_project_store(root))
    cleaned, errors = clean_project_store(store)
    if errors:
        raise ValueError("\n".join(errors))
    if not path.is_file():
        atomic_write(path, json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n")
    return cleaned


def write_project_store(root: Path, store: dict) -> dict:
    cleaned, errors = clean_project_store(store)
    if errors:
        raise ValueError("\n".join(errors))
    cleaned["metadata"]["updated"] = date.today().isoformat()
    atomic_write(root / "content" / "portfolio-projects.json", json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n")
    return cleaned


def download_bytes(url: str, timeout: int = 45) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.1"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except (OSError, urllib.error.URLError) as urllib_error:
        curl = shutil.which("curl")
        if not curl:
            raise urllib_error
        result = subprocess.run([curl, "-fsSL", "--max-time", str(timeout), "-A", USER_AGENT, url], check=True, capture_output=True)
        return result.stdout


def validate_project_xml(content: bytes, expected_id: str) -> tuple[str, str]:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError(f"CORDIS did not return valid XML: {exc}") from exc
    namespace = {"c": "http://cordis.europa.eu"}
    project_id = (root.findtext("c:id", default="", namespaces=namespace) or "").strip()
    acronym = (root.findtext("c:acronym", default="", namespaces=namespace) or "").strip()
    title = (root.findtext("c:title", default="", namespaces=namespace) or "").strip()
    if project_id != expected_id:
        raise ValueError(f"downloaded record identifies project {project_id or 'unknown'}, not {expected_id}")
    return acronym, title


def _download_record(row: dict) -> tuple[str, bytes, str, str]:
    project_id = row["id"]
    content = download_bytes(row["xmlUrl"])
    acronym, title = validate_project_xml(content, project_id)
    return project_id, content, acronym, title


def download_portfolio(root: Path) -> tuple[Path | None, dict, list[str]]:
    store = ensure_project_store(root)
    active = [row for row in store["projects"] if row.get("enabled", True)]
    if not active:
        return None, store, ["The project list contains no included projects."]
    fetched: dict[str, tuple[bytes, str, str]] = {}
    errors: list[str] = []
    today = date.today().isoformat()
    with ThreadPoolExecutor(max_workers=min(6, len(active))) as executor:
        futures = {executor.submit(_download_record, row): row for row in active}
        for future in as_completed(futures):
            row = futures[future]
            try:
                project_id, content, acronym, title = future.result()
                fetched[project_id] = (content, acronym, title)
                row.update({"acronym": acronym or row["acronym"], "title": title or row["title"], "lastFetched": today, "lastStatus": "Downloaded"})
            except Exception as exc:
                row.update({"lastFetched": today, "lastStatus": "Error"})
                errors.append(f"{row['id']} {row.get('acronym') or ''}: {exc}".strip())
    write_project_store(root, store)
    if errors:
        return None, store, errors
    handle = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    handle.close()
    archive_path = Path(handle.name)
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for row in active:
            content, acronym, _ = fetched[row["id"]]
            safe_acronym = re.sub(r"[^A-Za-z0-9._-]+", "_", acronym or "project").strip("_") or "project"
            archive.writestr(f"xml/{row['id']}_{safe_acronym}.xml", content)
    return archive_path, store, []


def current_exchange_store(root: Path) -> dict:
    path = root / "content" / "exchange-rate.json"
    data = load_assignment(root / "site" / "assets" / "data.js")
    current = dict(data.get("metadata", {}).get("exchangeRate", {}))
    default = {"metadata": {"updated": current.get("retrieved") or date.today().isoformat(), "schemaVersion": 1}, "current": current, "history": [current] if current else []}
    store = read_json(path, default)
    if not path.is_file():
        atomic_write(path, json.dumps(store, ensure_ascii=False, indent=2) + "\n")
    return store


def _download_json(url: str) -> object:
    return json.loads(download_bytes(url, timeout=25).decode("utf-8"))


def fetch_infoeuro_rate(period: str) -> dict:
    if not re.fullmatch(r"\d{4}-\d{2}", period):
        raise ValueError("The exchange-rate period must use YYYY-MM.")
    year, month = map(int, period.split("-"))
    if not 1 <= month <= 12:
        raise ValueError("The exchange-rate month is invalid.")
    query = urllib.parse.urlencode({"year": year, "month": month, "lang": "en"})
    rates = _download_json(f"{INFOEURO_API}?{query}")
    row = next((item for item in rates if item.get("isoA3Code") == "NZD"), None)
    try:
        value = float(row.get("value") if row else 0)
    except (TypeError, ValueError):
        value = 0
    if value <= 0:
        raise ValueError(f"InforEuro does not currently provide an NZD rate for {period}.")
    return {"base": "EUR", "quote": "NZD", "value": value, "period": period, "retrieved": date.today().isoformat(), "source": "European Commission InforEuro", "sourceUrl": INFOEURO_SOURCE}


def apply_exchange_rate(root: Path, rate: dict) -> dict:
    data_path = root / "site" / "assets" / "data.js"
    data = load_assignment(data_path)
    previous = dict(data.get("metadata", {}).get("exchangeRate", {}))
    data.setdefault("metadata", {})["exchangeRate"] = rate
    backup_dir = root / ".update-backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup_dir.mkdir(parents=True, exist_ok=False)
    shutil.copy2(data_path, backup_dir / "data.js")
    atomic_write(data_path, f"{DATA_PREFIX}{json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n")

    refresh_asset_references(root, {"assets/data.js"})

    store = current_exchange_store(root)
    history = [row for row in store.get("history", []) if row.get("period") != rate["period"]]
    if previous and previous.get("period") != rate["period"] and all(row.get("period") != previous.get("period") for row in history):
        history.append(previous)
    history.append(rate)
    history.sort(key=lambda row: row.get("period", ""), reverse=True)
    store = {"metadata": {"updated": date.today().isoformat(), "schemaVersion": 1}, "current": rate, "history": history[:36]}
    atomic_write(root / "content" / "exchange-rate.json", json.dumps(store, ensure_ascii=False, indent=2) + "\n")
    return store
