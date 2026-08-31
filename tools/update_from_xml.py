#!/usr/bin/env python3
"""Rebuild the Horizon Europe in New Zealand site data from a CORDIS XML ZIP."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from xml.etree import ElementTree as ET

from content_manager import record_portfolio_update


NS = {"c": "http://cordis.europa.eu"}
DATA_PREFIX = "window.HE_DATA = "
GEO_PREFIX = "window.HE_GEO_DATA="
INFOEURO_API = "https://ec.europa.eu/budg/inforeuro/api/public/monthly-rates"
INFOEURO_SOURCE = "https://commission.europa.eu/funding-and-tenders/procedures-guidelines-tenders/information-contractors-and-beneficiaries/exchange-rate-inforeuro_en"

SCHEME_NAMES = {
    "HORIZON-RIA": "Research and Innovation Actions",
    "HORIZON-IA": "Innovation Actions",
    "HORIZON-JU-RIA": "Joint Undertaking Research and Innovation Actions",
    "HORIZON-COFUND": "Programme Co-fund Actions",
    "HORIZON-CSA": "Coordination and Support Actions",
}

COUNTRY_NAMES = {
    "AL": "Albania", "AT": "Austria", "AU": "Australia", "BE": "Belgium",
    "BG": "Bulgaria", "CA": "Canada", "CH": "Switzerland", "CY": "Cyprus",
    "CZ": "Czechia", "DE": "Germany", "DK": "Denmark", "EE": "Estonia",
    "EL": "Greece", "ES": "Spain", "FI": "Finland", "FR": "France",
    "GE": "Georgia", "HR": "Croatia", "HU": "Hungary", "ID": "Indonesia",
    "IE": "Ireland", "IL": "Israel", "IS": "Iceland", "IT": "Italy",
    "KE": "Kenya", "KR": "South Korea", "LT": "Lithuania", "LU": "Luxembourg",
    "LV": "Latvia", "MA": "Morocco", "MD": "Moldova", "MT": "Malta",
    "NL": "Netherlands", "NO": "Norway", "NZ": "New Zealand", "PG": "Papua New Guinea",
    "PL": "Poland", "PT": "Portugal", "RO": "Romania", "RS": "Serbia",
    "SE": "Sweden", "SI": "Slovenia", "SK": "Slovakia", "SB": "Solomon Islands",
    "TL": "Timor-Leste", "TN": "Tunisia", "TR": "Türkiye", "TZ": "Tanzania",
    "UA": "Ukraine", "UG": "Uganda", "UK": "UK", "US": "United States",
    "UY": "Uruguay", "VU": "Vanuatu", "ZA": "South Africa",
}

COUNTRY_CENTROIDS = {
    "AL": (41.1533, 20.1683), "AT": (47.5162, 14.5501), "AU": (-25.2744, 133.7751),
    "BE": (50.5039, 4.4699), "BG": (42.7339, 25.4858), "CA": (56.1304, -106.3468),
    "CH": (46.8182, 8.2275), "CY": (35.1264, 33.4299), "CZ": (49.8175, 15.4730),
    "DE": (51.1657, 10.4515), "DK": (56.2639, 9.5018), "EE": (58.5953, 25.0136),
    "EL": (39.0742, 21.8243), "ES": (40.4637, -3.7492), "FI": (61.9241, 25.7482),
    "FR": (46.2276, 2.2137), "GE": (42.3154, 43.3569), "HR": (45.1000, 15.2000),
    "HU": (47.1625, 19.5033), "ID": (-0.7893, 113.9213), "IE": (53.1424, -7.6921),
    "IL": (31.0461, 34.8516), "IS": (64.9631, -19.0208), "IT": (41.8719, 12.5674),
    "KE": (-0.0236, 37.9062), "KR": (35.9078, 127.7669), "LT": (55.1694, 23.8813),
    "LU": (49.8153, 6.1296), "LV": (56.8796, 24.6032), "MA": (31.7917, -7.0926),
    "MD": (47.4116, 28.3699), "MT": (35.9375, 14.3754), "NL": (52.1326, 5.2913),
    "NO": (60.4720, 8.4689), "NZ": (-40.9006, 174.8860), "PG": (-6.3150, 143.9555),
    "PL": (51.9194, 19.1451), "PT": (39.3999, -8.2245), "RO": (45.9432, 24.9668),
    "RS": (44.0165, 21.0059), "SE": (60.1282, 18.6435), "SI": (46.1512, 14.9955),
    "SK": (48.6690, 19.6990), "SB": (-9.6457, 160.1562), "TL": (-8.8742, 125.7275),
    "TN": (33.8869, 9.5375), "TR": (38.9637, 35.2433), "TZ": (-6.3690, 34.8888),
    "UA": (48.3794, 31.1656), "UG": (1.3733, 32.2903), "UK": (55.3781, -3.4360),
    "US": (37.0902, -95.7129), "UY": (-32.5228, -55.7658), "VU": (-15.3767, 166.9592),
    "ZA": (-30.5595, 22.9375),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rebuild assets/data.js and assets/organisation-locations.js from a CORDIS XML ZIP."
    )
    parser.add_argument("zip_file", type=Path, help="ZIP containing the complete current XML portfolio")
    parser.add_argument("--site-dir", type=Path, default=Path("site"), help="Website directory (default: site)")
    parser.add_argument("--date", default=date.today().isoformat(), help="Published data date, YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without changing files")
    parser.add_argument("--no-backup", action="store_true", help="Do not create a local ignored backup")
    parser.add_argument("--keep-exchange-rate", action="store_true", help="Preserve the currently approved EUR/NZD rate")
    return parser.parse_args()


def load_assignment(path: Path, prefix: str) -> dict:
    raw = path.read_text(encoding="utf-8").strip()
    if not raw.startswith(prefix):
        raise ValueError(f"Unexpected JavaScript data format in {path}")
    payload = raw[len(prefix):]
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


def infoeuro_months(published_date: str, limit: int = 6) -> list[tuple[int, int]]:
    parsed = date.fromisoformat(published_date)
    months = []
    year, month = parsed.year, parsed.month
    for _ in range(limit):
        months.append((year, month))
        month -= 1
        if month == 0:
            year -= 1
            month = 12
    return months


def download_json(endpoint: str) -> object:
    request = urllib.request.Request(endpoint, headers={"User-Agent": "Horizon-Europe-NZ-site-updater/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except (OSError, json.JSONDecodeError, urllib.error.URLError) as urllib_error:
        curl = shutil.which("curl")
        if not curl:
            raise urllib_error
        result = subprocess.run(
            [curl, "-fsSL", "--max-time", "20", endpoint],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)


def fetch_infoeuro_nzd(published_date: str, existing: dict | None = None) -> tuple[dict, bool, list[str]]:
    """Return the latest official NZD rate available at the portfolio update."""
    errors = []
    for year, month in infoeuro_months(published_date):
        query = urllib.parse.urlencode({"year": year, "month": month, "lang": "en"})
        endpoint = f"{INFOEURO_API}?{query}"
        try:
            rates = download_json(endpoint)
            row = next((item for item in rates if item.get("isoA3Code") == "NZD"), None)
            value = number(row.get("value") if row else None)
            if value <= 0:
                raise ValueError("NZD rate is missing")
            return {
                "base": "EUR",
                "quote": "NZD",
                "value": value,
                "period": f"{year:04d}-{month:02d}",
                "retrieved": date.today().isoformat(),
                "source": "European Commission InforEuro",
                "sourceUrl": INFOEURO_SOURCE,
            }, True, errors
        except (OSError, ValueError, json.JSONDecodeError, urllib.error.URLError, subprocess.SubprocessError) as exc:
            errors.append(f"{year:04d}-{month:02d}: {exc}")

    if existing and existing.get("base") == "EUR" and existing.get("quote") == "NZD" and number(existing.get("value")) > 0:
        return dict(existing), False, errors
    raise RuntimeError("InforEuro did not return an NZD rate and no previously verified rate is available")


def node_text(node: ET.Element, path: str, default: str = "") -> str:
    found = node.find(path, NS)
    return (found.text or "").strip() if found is not None and found.text else default


def number(value: str | None) -> float:
    try:
        return float(value or 0)
    except ValueError:
        return 0.0


def boolean(value: str | None) -> bool:
    return str(value or "").lower() == "true"


def split_keywords(value: str) -> list[str]:
    if not value.strip():
        return []
    separator = ";" if ";" in value else ","
    return [item.strip() for item in value.split(separator) if item.strip()][:10]


def project_focus(value: str, limit: int = 760) -> str:
    """Keep the compact focus text used by Project Explorer."""
    normalised = re.sub(r"\s+", " ", value).strip()
    if len(normalised) <= limit:
        return normalised
    window = normalised[: limit + 1]
    sentence_end = max(window.rfind(". "), window.rfind("! "), window.rfind("? "))
    if sentence_end + 1 >= limit * 0.6:
        return window[: sentence_end + 1]
    clipped = normalised[:limit]
    if clipped[-1].isalnum():
        clipped = clipped.rsplit(" ", 1)[0]
    return f"{clipped}…"


def country_name(code: str, node: ET.Element | None, existing_names: dict[str, str]) -> str:
    if code in existing_names:
        return existing_names[code]
    if code in COUNTRY_NAMES:
        return COUNTRY_NAMES[code]
    if node is not None:
        region = node.find("c:relations/c:regions/c:region[@type='relatedRegion']/c:name", NS)
        if region is not None and region.text:
            return region.text.strip()
    return code


def parse_geolocation(raw: str) -> tuple[float, float] | None:
    if not raw or "," not in raw:
        return None
    try:
        lat, lon = (float(part.strip()) for part in raw.split(",", 1))
    except ValueError:
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def parse_organisation(node: ET.Element, existing_names: dict[str, str]) -> tuple[dict, tuple[float, float] | None]:
    role = node.attrib.get("type", "participant")
    code = node_text(node, "c:address/c:country")
    name = node_text(node, "c:legalName") or node_text(node, "c:shortName") or node_text(node, "c:id")
    city = node_text(node, "c:address/c:city")
    contribution = number(node.attrib.get("netEcContribution", node.attrib.get("ecContribution")))
    organisation = {
        "id": node_text(node, "c:id"),
        "name": name,
        "short": node_text(node, "c:shortName"),
        "countryCode": code,
        "country": country_name(code, node, existing_names),
        "city": city,
        "role": role,
        "coordinator": role == "coordinator",
        "sme": boolean(node.attrib.get("sme")),
        "contribution": contribution,
        "totalCost": number(node.attrib.get("totalCost")),
    }
    coordinates = parse_geolocation(node_text(node, "c:address/c:geolocation"))
    return organisation, coordinates


def related(associations: ET.Element, tag: str, relation_type: str) -> ET.Element | None:
    return associations.find(f"c:{tag}[@type='{relation_type}']", NS)


def parse_project(xml_bytes: bytes, existing_names: dict[str, str]) -> tuple[dict, dict[str, tuple[float, float]]]:
    root = ET.fromstring(xml_bytes)
    associations = root.find("c:relations/c:associations", NS)
    if associations is None:
        raise ValueError("Project has no relations/associations section")

    organisations = []
    coordinates: dict[str, tuple[float, float]] = {}
    for node in associations.findall("c:organization", NS):
        organisation, geo = parse_organisation(node, existing_names)
        if not organisation["name"] or not organisation["countryCode"]:
            continue
        organisations.append(organisation)
        if geo:
            coordinates[f"{organisation['countryCode']}|{organisation['name']}"] = geo

    coordinator = next((org for org in organisations if org["coordinator"]), None)
    if coordinator is None:
        raise ValueError("Project has no coordinator")

    cluster_node = None
    legal_bases = associations.findall("c:programme[@type='relatedLegalBasis']", NS)
    legal_bases.sort(key=lambda candidate: candidate.attrib.get("uniqueProgrammePart") != "true")
    for candidate in legal_bases:
        code = node_text(candidate, "c:code")
        if re.fullmatch(r"HORIZON\.2\.[1-6]", code):
            cluster_node = candidate
            break
    if cluster_node is None:
        raise ValueError("Project has no recognised Pillar II cluster")

    topic_node = related(associations, "programme", "relatedTopic")
    call_node = related(associations, "call", "relatedSubCall")
    if call_node is None:
        call_node = related(associations, "call", "relatedMasterCall")
    scheme_node = root.find("c:relations/c:categories/c:category[@classification='projectFundingSchemeCategory']", NS)
    if scheme_node is None:
        raise ValueError("Project has no funding scheme category")

    scheme_code = node_text(scheme_node, "c:code")
    raw_scheme_title = node_text(scheme_node, "c:title")
    scheme_title = SCHEME_NAMES.get(scheme_code, re.sub(r"^HORIZON\s+", "", raw_scheme_title).strip())
    counts = Counter(org["countryCode"] for org in organisations)
    country_codes = sorted(counts)
    project = {
        "id": node_text(root, "c:id"),
        "acronym": node_text(root, "c:acronym"),
        "title": node_text(root, "c:title"),
        "teaser": node_text(root, "c:teaser"),
        "focus": project_focus(node_text(root, "c:objective")),
        "keywords": split_keywords(node_text(root, "c:keywords")),
        "start": node_text(root, "c:startDate"),
        "end": node_text(root, "c:endDate"),
        "duration": int(number(node_text(root, "c:duration"))),
        "signature": node_text(root, "c:ecSignatureDate"),
        "status": node_text(root, "c:status"),
        "totalCost": number(node_text(root, "c:totalCost")),
        "ecContribution": number(node_text(root, "c:ecMaxContribution")),
        "clusterCode": node_text(cluster_node, "c:code"),
        "cluster": node_text(cluster_node, "c:title"),
        "schemeCode": scheme_code,
        "scheme": scheme_title,
        "callCode": node_text(call_node, "c:identifier") if call_node is not None else "",
        "topicCode": node_text(topic_node, "c:code") if topic_node is not None else "",
        "topic": node_text(topic_node, "c:title") if topic_node is not None else "",
        "coordinator": coordinator.copy(),
        "organisations": organisations,
        "organisationCount": len(organisations),
        "countryCount": len(country_codes),
        "countryParticipation": [{"code": code, "organisations": counts[code]} for code in country_codes],
        "countryCodes": country_codes,
        "countries": sorted(country_name(code, None, existing_names) for code in country_codes),
    }
    return project, coordinates


def xml_members(archive: zipfile.ZipFile) -> list[str]:
    return sorted(
        name for name in archive.namelist()
        if name.lower().endswith(".xml") and not name.startswith("__MACOSX/") and "/._" not in name
    )


def normalise_city(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def rebuild_geo(
    projects: list[dict],
    xml_coordinates: dict[str, tuple[float, float]],
    existing_geo: dict,
    published_date: str,
) -> tuple[dict, list[str]]:
    old_rows = existing_geo.get("organisations", {})
    city_index = {}
    for row in old_rows.values():
        city = normalise_city(row.get("city", ""))
        code = row.get("countryCode", "")
        if city and city != normalise_city("Not reported") and row.get("lat") is not None and row.get("lon") is not None:
            city_index.setdefault((code, city), row)

    rows = {}
    missing = []
    for project in projects:
        for organisation in project["organisations"]:
            key = f"{organisation['countryCode']}|{organisation['name']}"
            if key in rows:
                continue
            base = {
                "name": organisation["name"],
                "countryCode": organisation["countryCode"],
                "country": organisation["country"],
                "city": organisation["city"],
            }
            if key in old_rows:
                old = old_rows[key]
                rows[key] = {**base, "lat": old["lat"], "lon": old["lon"], "precision": old.get("precision", "city"), "geocodedName": old.get("geocodedName", organisation["city"])}
                continue
            if key in xml_coordinates:
                lat, lon = xml_coordinates[key]
                rows[key] = {**base, "lat": lat, "lon": lon, "precision": "city", "geocodedName": organisation["city"]}
                continue
            city_key = (organisation["countryCode"], normalise_city(organisation["city"]))
            if city_key in city_index:
                old = city_index[city_key]
                rows[key] = {**base, "lat": old["lat"], "lon": old["lon"], "precision": "city", "geocodedName": old.get("geocodedName", organisation["city"])}
                continue
            fallback = COUNTRY_CENTROIDS.get(organisation["countryCode"])
            if fallback:
                rows[key] = {**base, "lat": fallback[0], "lon": fallback[1], "precision": "country", "geocodedName": organisation["country"]}
            else:
                missing.append(key)

    city_count = sum(row["precision"] == "city" for row in rows.values())
    country_count = sum(row["precision"] == "country" for row in rows.values())
    return {
        "metadata": {
            "generated": published_date,
            "source": "CORDIS organisation geolocation with preserved verified fallbacks",
            "cityPrecision": city_count,
            "countryPrecision": country_count,
            "missing": len(missing),
            "distinctOrganisations": len(rows),
        },
        "organisations": rows,
    }, missing


def validate(projects: list[dict], member_count: int) -> list[str]:
    errors = []
    ids = [project["id"] for project in projects]
    duplicates = sorted(project_id for project_id, count in Counter(ids).items() if count > 1)
    if not projects:
        errors.append("No project XML records were found")
    if len(projects) != member_count:
        errors.append(f"Parsed {len(projects)} projects from {member_count} XML records")
    if duplicates:
        errors.append(f"Duplicate project IDs: {', '.join(duplicates)}")
    for project in projects:
        if not project["id"] or not project["title"]:
            errors.append("A project is missing its ID or title")
        if "NZ" not in project["countryCodes"]:
            errors.append(f"{project['id']} does not contain a New Zealand organisation")
        if project["clusterCode"] not in {f"HORIZON.2.{index}" for index in range(1, 7)}:
            errors.append(f"{project['id']} has an unsupported cluster: {project['clusterCode']}")
    return errors


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    temp_path.replace(path)


def cache_busted_pages(site_dir: Path, published_date: str) -> dict[Path, str]:
    token = published_date.replace("-", "")
    replacements = {
        r"assets/data\.js(?:\?v=[^\"']+)?": f"assets/data.js?v={token}",
        r"assets/organisation-locations\.js(?:\?v=[^\"']+)?": f"assets/organisation-locations.js?v={token}",
    }
    changed = {}
    for path in site_dir.glob("*.html"):
        original = path.read_text(encoding="utf-8")
        updated = original
        for pattern, replacement in replacements.items():
            updated = re.sub(pattern, replacement, updated)
        if updated != original:
            changed[path] = updated
    return changed


def main() -> int:
    args = parse_args()
    try:
        published_date = date.fromisoformat(args.date).isoformat()
    except ValueError:
        print("ERROR: --date must use YYYY-MM-DD.", file=sys.stderr)
        return 2

    zip_path = args.zip_file.expanduser().resolve()
    site_dir = args.site_dir.expanduser().resolve()
    data_path = site_dir / "assets" / "data.js"
    geo_path = site_dir / "assets" / "organisation-locations.js"
    if not zip_path.is_file():
        print(f"ERROR: ZIP not found: {zip_path}", file=sys.stderr)
        return 2
    if not data_path.is_file() or not geo_path.is_file():
        print(f"ERROR: {site_dir} is not a complete site directory.", file=sys.stderr)
        return 2

    current_data = load_assignment(data_path, DATA_PREFIX)
    current_geo = load_assignment(geo_path, GEO_PREFIX)
    if args.keep_exchange_rate:
        exchange_rate = dict(current_data.get("metadata", {}).get("exchangeRate", {}))
        if number(exchange_rate.get("value")) <= 0:
            print("ERROR: No approved EUR/NZD rate is available to preserve.", file=sys.stderr)
            return 1
        rate_refreshed, rate_errors = False, []
    else:
        try:
            exchange_rate, rate_refreshed, rate_errors = fetch_infoeuro_nzd(
                published_date,
                current_data.get("metadata", {}).get("exchangeRate"),
            )
        except RuntimeError as exc:
            print(f"ERROR: {exc}.", file=sys.stderr)
            return 1
        if not rate_refreshed:
            print(
                "WARNING: InforEuro could not be reached; the last verified official rate was preserved.",
                file=sys.stderr,
            )
            if rate_errors:
                print(f"  Latest attempt: {rate_errors[0]}", file=sys.stderr)
    existing_names = {row["code"]: row["name"] for row in current_data.get("countries", [])}
    existing_names.update(COUNTRY_NAMES)
    old_ids = {project["id"] for project in current_data.get("projects", [])}

    projects = []
    xml_coordinates = {}
    parse_errors = []
    with zipfile.ZipFile(zip_path) as archive:
        members = xml_members(archive)
        for member in members:
            try:
                project, coordinates = parse_project(archive.read(member), existing_names)
                projects.append(project)
                xml_coordinates.update(coordinates)
            except Exception as exc:  # report every bad record together
                parse_errors.append(f"{member}: {exc}")

    if parse_errors:
        print("ERROR: Some XML records could not be parsed:", file=sys.stderr)
        for error in parse_errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    existing_order = {project["id"]: index for index, project in enumerate(current_data.get("projects", []))}
    projects.sort(key=lambda project: (
        project["signature"] or "9999-99-99",
        existing_order.get(project["id"], len(existing_order)),
        project["id"],
    ))
    validation_errors = validate(projects, len(members))
    if validation_errors:
        print("ERROR: Validation failed:", file=sys.stderr)
        for error in validation_errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    used_codes = sorted({code for project in projects for code in project["countryCodes"]}, key=lambda code: existing_names.get(code, code))
    metadata = dict(current_data.get("metadata", {}))
    metadata.update({
        "projectDataUpdated": published_date,
        "generated": published_date,
        "projectSource": "CORDIS — European Commission",
        "exchangeRate": exchange_rate,
    })
    rebuilt_data = {
        "metadata": metadata,
        "clusters": current_data["clusters"],
        "countries": [{"code": code, "name": existing_names.get(code, code)} for code in used_codes],
        "projects": projects,
        "ncps": current_data.get("ncps", []),
    }
    rebuilt_geo, missing_geo = rebuild_geo(projects, xml_coordinates, current_geo, published_date)
    page_updates = cache_busted_pages(site_dir, published_date)

    new_ids = {project["id"] for project in projects}
    added = sorted(new_ids - old_ids)
    removed = sorted(old_ids - new_ids)
    organisation_count = len({f"{org['countryCode']}|{org['name']}" for project in projects for org in project["organisations"]})
    print(f"Validated {len(projects)} projects from {zip_path.name}")
    print(f"Distinct organisations: {organisation_count}")
    print(f"Countries represented: {len(used_codes)}")
    print(f"Added projects: {', '.join(added) if added else 'none'}")
    print(f"Removed projects: {', '.join(removed) if removed else 'none'}")
    print(f"Locations using country fallback: {rebuilt_geo['metadata']['countryPrecision']}")
    print(f"Locations missing coordinates: {len(missing_geo)}")
    rate_action = "preserved" if args.keep_exchange_rate else "checked"
    print(f"InforEuro rate {rate_action}: EUR 1 = NZD {exchange_rate['value']:.4f} ({exchange_rate['period']})")
    print(f"Pages receiving fresh data cache markers: {len(page_updates)}")

    if args.dry_run:
        print("Dry run complete: no site files were changed.")
        return 0

    if not args.no_backup:
        backup_dir = site_dir.parent / ".update-backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup_dir.mkdir(parents=True, exist_ok=False)
        shutil.copy2(data_path, backup_dir / "data.js")
        shutil.copy2(geo_path, backup_dir / "organisation-locations.js")
        for page_path in page_updates:
            shutil.copy2(page_path, backup_dir / page_path.name)
        print(f"Backup created: {backup_dir}")

    atomic_write(data_path, f"{DATA_PREFIX}{json.dumps(rebuilt_data, ensure_ascii=False, separators=(',', ':'))};\n")
    atomic_write(geo_path, f"{GEO_PREFIX}{json.dumps(rebuilt_geo, ensure_ascii=False, separators=(',', ':'))};\n")
    for page_path, content in page_updates.items():
        atomic_write(page_path, content)
    try:
        if record_portfolio_update(site_dir.parent, published_date, len(projects), added, removed):
            print("Added a public site-update item for the changed portfolio")
    except Exception as exc:
        print(f"WARNING: The portfolio was updated, but the public update item could not be created: {exc}", file=sys.stderr)
    print(f"Updated: {data_path}")
    print(f"Updated: {geo_path}")
    if page_updates:
        print(f"Updated cache markers in {len(page_updates)} HTML pages")
    print("The website is ready for local review. GitHub has not been changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
