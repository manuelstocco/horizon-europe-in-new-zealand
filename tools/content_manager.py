#!/usr/bin/env python3
"""Shared content helpers for the local Site Manager and XML updater."""

from __future__ import annotations

import ast
import hashlib
import json
import re
import tempfile
from datetime import date, datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
from xml.sax.saxutils import escape


EVENT_TYPES = {"event", "deadline", "news", "site-update"}
CONTENT_STATUSES = {"draft", "published", "archived"}
PROJECT_RESULT_STAGES = {"planned", "ongoing", "outputs", "completed"}
PROJECT_OUTPUT_TYPES = {"deliverable", "paper", "pilot", "demonstrator", "policy-report", "dataset", "other"}
DEFAULT_ASSOCIATION_SOURCE = "https://research-and-innovation.ec.europa.eu/strategy/strategy-research-and-innovation/europe-world/international-cooperation/association-horizon-europe_en"
DEFAULT_ELIGIBILITY_SOURCE = "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/wp-call/2026-2027/wp-15-general-annexes_horizon-2026-2027_en.pdf"
PUBLIC_SITE_URL = "https://manuelstocco.github.io/horizon-europe-in-new-zealand/"
RSS_TITLE = "Horizon Europe in New Zealand — Updates & Events"
RSS_DESCRIPTION = "News, events, deadlines and portfolio updates for Horizon Europe cooperation with New Zealand."


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.replace(path)


def read_json(path: Path, default: dict) -> dict:
    if not path.is_file():
        return json.loads(json.dumps(default))
    return json.loads(path.read_text(encoding="utf-8"))


def refresh_asset_references(root: Path, assets: set[str] | None = None) -> list[Path]:
    """Give local JS/CSS references a content-derived version marker.

    GitHub Pages and browsers may retain an asset when its URL does not change.
    A hash of the file content makes every real update immediately addressable,
    while leaving references unchanged when the file itself is unchanged.
    """
    site = root / "site"
    pattern = re.compile(
        r'(?P<prefix>(?:src|href)=["\'])(?P<asset>assets/[A-Za-z0-9_./-]+\.(?:js|css))'
        r'(?:\?v=[^"\']+)?(?P<suffix>["\'])'
    )
    changed: list[Path] = []
    tokens: dict[str, str] = {}

    def replace(match: re.Match[str]) -> str:
        asset = match.group("asset")
        if assets is not None and asset not in assets:
            return match.group(0)
        asset_path = site / asset
        if not asset_path.is_file():
            return match.group(0)
        token = tokens.setdefault(asset, hashlib.sha256(asset_path.read_bytes()).hexdigest()[:12])
        return f'{match.group("prefix")}{asset}?v={token}{match.group("suffix")}'

    for page in site.glob("*.html"):
        original = page.read_text(encoding="utf-8")
        updated = pattern.sub(replace, original)
        if updated != original:
            atomic_write(page, updated)
            changed.append(page)
    return changed


def valid_url(value: str, allow_relative: bool = True) -> bool:
    if not value:
        return True
    if allow_relative and not urlparse(value).scheme:
        return not value.startswith("//")
    return urlparse(value).scheme in {"http", "https"}


def default_event_store() -> dict:
    return {
        "metadata": {"updated": "2026-08-31", "schemaVersion": 1},
        "items": [{
            "id": "portfolio-update-2026-08-22",
            "type": "site-update",
            "status": "published",
            "title": "Portfolio updated to 38 signed projects",
            "summary": "The current CORDIS dataset records 38 signed Horizon Europe projects involving New Zealand organisations.",
            "published": "2026-08-22",
            "start": "",
            "end": "",
            "timezone": "Pacific/Auckland",
            "location": "",
            "url": "overview.html",
            "source": "CORDIS project records",
            "clusters": [],
            "countries": [],
            "featured": True,
        }],
    }


def clean_item(item: dict) -> dict:
    return {
        "id": str(item.get("id", "")).strip(),
        "type": str(item.get("type", "news")).strip(),
        "status": str(item.get("status", "draft")).strip(),
        "title": str(item.get("title", "")).strip(),
        "summary": str(item.get("summary", "")).strip(),
        "published": str(item.get("published", "")).strip(),
        "start": str(item.get("start", "")).strip(),
        "end": str(item.get("end", "")).strip(),
        "timezone": str(item.get("timezone", "Pacific/Auckland")).strip() or "Pacific/Auckland",
        "location": str(item.get("location", "")).strip(),
        "url": str(item.get("url", "")).strip(),
        "source": str(item.get("source", "")).strip(),
        "clusters": sorted({str(value).strip() for value in item.get("clusters", []) if str(value).strip()}),
        "countries": sorted({str(value).strip().upper() for value in item.get("countries", []) if str(value).strip()}),
        "featured": bool(item.get("featured", False)),
    }


def validate_event_store(store: dict) -> tuple[dict, list[str]]:
    cleaned = {
        "metadata": {
            "updated": str(store.get("metadata", {}).get("updated") or date.today().isoformat()),
            "schemaVersion": 1,
        },
        "items": [clean_item(item) for item in store.get("items", [])],
    }
    errors: list[str] = []
    identifiers: set[str] = set()
    for index, item in enumerate(cleaned["items"], start=1):
        label = item["title"] or f"item {index}"
        if not item["id"] or not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,80}", item["id"]):
            errors.append(f"{label}: the identifier must use lowercase letters, numbers and hyphens.")
        elif item["id"] in identifiers:
            errors.append(f"{label}: duplicate identifier {item['id']}.")
        identifiers.add(item["id"])
        if item["type"] not in EVENT_TYPES:
            errors.append(f"{label}: unsupported content type.")
        if item["status"] not in CONTENT_STATUSES:
            errors.append(f"{label}: unsupported publication status.")
        if not item["title"]:
            errors.append(f"Item {index}: title is required.")
        if not item["summary"]:
            errors.append(f"{label}: summary is required.")
        for field in ("published",):
            try:
                date.fromisoformat(item[field])
            except ValueError:
                errors.append(f"{label}: {field} must use YYYY-MM-DD.")
        if item["type"] in {"event", "deadline"} and not item["start"]:
            errors.append(f"{label}: an event date is required.")
        for field in ("start", "end"):
            if item[field]:
                try:
                    date.fromisoformat(item[field][:10])
                except ValueError:
                    errors.append(f"{label}: {field} contains an invalid date.")
        if item["end"] and item["start"] and item["end"] < item["start"]:
            errors.append(f"{label}: the end cannot precede the start.")
        if not valid_url(item["url"]):
            errors.append(f"{label}: the link is not valid.")
    cleaned["items"].sort(key=lambda item: (item["published"], item["start"], item["title"]), reverse=True)
    return cleaned, errors


def write_event_outputs(root: Path, store: dict) -> dict:
    cleaned, errors = validate_event_store(store)
    if errors:
        raise ValueError("\n".join(errors))
    cleaned["metadata"]["updated"] = date.today().isoformat()
    content_path = root / "content" / "updates-events.json"
    data_path = root / "site" / "assets" / "updates-events-data.js"
    atomic_write(content_path, json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n")
    payload = json.dumps(cleaned, ensure_ascii=False, separators=(",", ":"))
    atomic_write(data_path, f"window.HE_UPDATES_EVENTS={payload};\n")
    write_rss_feed(root, cleaned)
    ensure_rss_discovery(root)
    refresh_asset_references(root, {"assets/updates-events-data.js"})
    return cleaned


def default_project_results() -> dict:
    return {"metadata": {"updated": date.today().isoformat(), "schemaVersion": 1}, "projects": []}


def validate_project_results(store: dict) -> tuple[dict, list[str]]:
    cleaned = {"metadata": {"updated": date.today().isoformat(), "schemaVersion": 1}, "projects": []}
    errors: list[str] = []
    seen: set[str] = set()
    for index, raw in enumerate(store.get("projects", []), start=1):
        project_id = str(raw.get("projectId", "")).strip()
        stage = str(raw.get("stage", "ongoing")).strip()
        reviewed = str(raw.get("reviewed", "")).strip()
        record = {
            "projectId": project_id,
            "stage": stage,
            "reviewed": reviewed,
            "summary": str(raw.get("summary", "")).strip(),
            "outputs": [],
        }
        label = project_id or f"Project result row {index}"
        if not re.fullmatch(r"\d{6,12}", project_id):
            errors.append(f"{label}: enter a valid CORDIS project ID.")
        elif project_id in seen:
            errors.append(f"{label}: the project appears more than once.")
        seen.add(project_id)
        if stage not in PROJECT_RESULT_STAGES:
            errors.append(f"{label}: choose a valid implementation stage.")
        if reviewed:
            try:
                date.fromisoformat(reviewed)
            except ValueError:
                errors.append(f"{label}: the review date must use YYYY-MM-DD.")
        for output_index, output in enumerate(raw.get("outputs", []), start=1):
            output_type = str(output.get("type", "other")).strip()
            title = str(output.get("title", "")).strip()
            url = str(output.get("url", "")).strip()
            published = str(output.get("published", "")).strip()
            if output_type not in PROJECT_OUTPUT_TYPES:
                errors.append(f"{label}, output {output_index}: choose a valid output type.")
            if not title:
                errors.append(f"{label}, output {output_index}: title is required.")
            if not valid_url(url, allow_relative=False):
                errors.append(f"{label}, output {output_index}: enter a valid public http or https link.")
            if published:
                try:
                    date.fromisoformat(published)
                except ValueError:
                    errors.append(f"{label}, output {output_index}: the date must use YYYY-MM-DD.")
            record["outputs"].append({"type": output_type, "title": title, "url": url, "published": published})
        cleaned["projects"].append(record)
    cleaned["projects"].sort(key=lambda row: row["projectId"])
    return cleaned, errors


def write_project_result_outputs(root: Path, store: dict) -> dict:
    cleaned, errors = validate_project_results(store)
    if errors:
        raise ValueError("\n".join(errors))
    cleaned["metadata"]["updated"] = date.today().isoformat()
    atomic_write(root / "content" / "project-results.json", json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n")
    payload = json.dumps(cleaned, ensure_ascii=False, separators=(",", ":"))
    atomic_write(root / "site" / "assets" / "project-results-data.js", f"window.HE_PROJECT_RESULTS={payload};\n")
    refresh_asset_references(root, {"assets/project-results-data.js"})
    return cleaned


def ensure_project_results(root: Path) -> dict:
    path = root / "content" / "project-results.json"
    return write_project_result_outputs(root, read_json(path, default_project_results()))


def _rss_date(value: str) -> str:
    parsed = datetime.fromisoformat((value or date.today().isoformat())[:10]).replace(tzinfo=timezone.utc)
    return format_datetime(parsed)


def _rss_link(value: str) -> str:
    return urljoin(PUBLIC_SITE_URL, value or "updates.html")


def write_rss_feed(root: Path, store: dict) -> None:
    published = [item for item in store.get("items", []) if item.get("status") == "published"]
    published.sort(key=lambda item: (item.get("published", ""), item.get("start", ""), item.get("title", "")), reverse=True)
    updated = store.get("metadata", {}).get("updated") or date.today().isoformat()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "  <channel>",
        f"    <title>{escape(RSS_TITLE)}</title>",
        f"    <link>{escape(_rss_link('updates.html'))}</link>",
        f"    <description>{escape(RSS_DESCRIPTION)}</description>",
        "    <language>en-NZ</language>",
        f"    <lastBuildDate>{_rss_date(updated)}</lastBuildDate>",
        f'    <atom:link href="{escape(_rss_link("feed.xml"))}" rel="self" type="application/rss+xml" />',
        "    <generator>Horizon Europe in New Zealand Site Manager</generator>",
        "    <ttl>1440</ttl>",
    ]
    for item in published:
        link = _rss_link(item.get("url", ""))
        lines.extend([
            "    <item>",
            f"      <title>{escape(item.get('title', ''))}</title>",
            f"      <link>{escape(link)}</link>",
            f'      <guid isPermaLink="false">horizon-europe-nz:{escape(item.get("id", "item"))}</guid>',
            f"      <pubDate>{_rss_date(item.get('published', ''))}</pubDate>",
            f"      <description>{escape(item.get('summary', ''))}</description>",
            f"      <category>{escape(item.get('type', 'update'))}</category>",
        ])
        lines.append("    </item>")
    lines.extend(["  </channel>", "</rss>", ""])
    atomic_write(root / "site" / "feed.xml", "\n".join(lines))


def ensure_rss_discovery(root: Path) -> None:
    tag = '  <link rel="alternate" type="application/rss+xml" title="Horizon Europe in New Zealand — Updates &amp; Events" href="feed.xml">\n'
    for path in (root / "site").glob("*.html"):
        original = path.read_text(encoding="utf-8")
        head = original.partition("</head>")[0]
        if '<link rel="alternate" type="application/rss+xml"' in head:
            continue
        updated = original.replace("</head>", f"{tag}</head>", 1)
        if updated != original:
            atomic_write(path, updated)


def _array_from_country_script(script: str, variable: str) -> list[str]:
    match = re.search(rf"const\s+{re.escape(variable)}\s*=\s*(\[[^;]+\]);", script)
    if not match:
        return []
    return list(ast.literal_eval(match.group(1)))


def default_country_overrides(root: Path) -> dict:
    script_path = root / "site" / "assets" / "country-status.js"
    script = script_path.read_text(encoding="utf-8") if script_path.is_file() else ""
    return {
        "metadata": {
            "checked": "2026-08-31",
            "programmePeriod": "Horizon Europe 2026–2027 work programme",
            "associationSource": DEFAULT_ASSOCIATION_SOURCE,
            "eligibilitySource": DEFAULT_ELIGIBILITY_SOURCE,
        },
        "associated": _array_from_country_script(script, "associated"),
        "lowMiddleIncome": _array_from_country_script(script, "lowMiddleIncome"),
    }


def validate_country_overrides(store: dict) -> tuple[dict, list[str]]:
    metadata = store.get("metadata", {})
    cleaned = {
        "metadata": {
            "checked": str(metadata.get("checked", "")).strip(),
            "programmePeriod": str(metadata.get("programmePeriod", "")).strip(),
            "associationSource": str(metadata.get("associationSource", "")).strip(),
            "eligibilitySource": str(metadata.get("eligibilitySource", "")).strip(),
        },
        "associated": sorted({str(code).strip().upper() for code in store.get("associated", []) if str(code).strip()}),
        "lowMiddleIncome": sorted({str(code).strip().upper() for code in store.get("lowMiddleIncome", []) if str(code).strip()}),
    }
    errors: list[str] = []
    try:
        date.fromisoformat(cleaned["metadata"]["checked"])
    except ValueError:
        errors.append("The country-status check date must use YYYY-MM-DD.")
    for field in ("associationSource", "eligibilitySource"):
        if not valid_url(cleaned["metadata"][field], allow_relative=False):
            errors.append(f"{field} must be an official http or https link.")
    for group in ("associated", "lowMiddleIncome"):
        invalid = [code for code in cleaned[group] if not re.fullmatch(r"[A-Z]{2}", code)]
        if invalid:
            errors.append(f"Invalid country codes in {group}: {', '.join(invalid)}.")
    return cleaned, errors


def write_country_outputs(root: Path, store: dict) -> dict:
    cleaned, errors = validate_country_overrides(store)
    if errors:
        raise ValueError("\n".join(errors))
    content_path = root / "content" / "country-status-overrides.json"
    data_path = root / "site" / "assets" / "country-status-overrides.js"
    atomic_write(content_path, json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n")
    payload = json.dumps(cleaned, ensure_ascii=False, separators=(",", ":"))
    script = (
        "(()=>{const o=" + payload + ";const s=window.HE_COUNTRY_STATUS;if(!s)return;"
        "s.associated=o.associated;s.lowMiddleIncome=o.lowMiddleIncome;"
        "s.metadata={...s.metadata,...o.metadata,source:{...s.metadata.source,association:o.metadata.associationSource,eligibility:o.metadata.eligibilitySource}};"
        "const sync=()=>{document.querySelectorAll('[data-country-status-checked]').forEach(e=>e.textContent=new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'long',year:'numeric'}).format(new Date(o.metadata.checked+'T00:00:00')));"
        "document.querySelectorAll('[data-country-status-association-source]').forEach(e=>e.href=o.metadata.associationSource);"
        "document.querySelectorAll('[data-country-status-eligibility-source]').forEach(e=>e.href=o.metadata.eligibilitySource);};"
        "document.readyState==='loading'?document.addEventListener('DOMContentLoaded',sync):sync();})();\n"
    )
    atomic_write(data_path, script)
    refresh_asset_references(root, {"assets/country-status-overrides.js"})
    return cleaned


def ensure_content(root: Path) -> tuple[dict, dict]:
    event_path = root / "content" / "updates-events.json"
    country_path = root / "content" / "country-status-overrides.json"
    events = read_json(event_path, default_event_store())
    countries = read_json(country_path, default_country_overrides(root))
    events = write_event_outputs(root, events)
    countries = write_country_outputs(root, countries)
    return events, countries


def record_portfolio_update(root: Path, published: str, total: int, added: list[str], removed: list[str]) -> bool:
    if not added and not removed:
        return False
    path = root / "content" / "updates-events.json"
    store = read_json(path, default_event_store())
    identifier = f"portfolio-update-{published}"
    change_parts = []
    if added:
        change_parts.append(f"{len(added)} project{'s' if len(added) != 1 else ''} added")
    if removed:
        change_parts.append(f"{len(removed)} project{'s' if len(removed) != 1 else ''} removed")
    item = {
        "id": identifier,
        "type": "site-update",
        "status": "published",
        "title": f"Portfolio updated to {total} signed projects",
        "summary": "The CORDIS portfolio was refreshed: " + ", ".join(change_parts) + ".",
        "published": published,
        "start": "",
        "end": "",
        "timezone": "Pacific/Auckland",
        "location": "",
        "url": "overview.html",
        "source": "CORDIS project records",
        "clusters": [],
        "countries": [],
        "featured": True,
    }
    store["items"] = [row for row in store.get("items", []) if row.get("id") != identifier]
    for row in store["items"]:
        if row.get("type") == "site-update":
            row["featured"] = False
    store["items"].append(item)
    write_event_outputs(root, store)
    return True
