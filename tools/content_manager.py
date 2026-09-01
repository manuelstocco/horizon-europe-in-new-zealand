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
PROJECT_RESULT_STAGES = {"signed", "ongoing", "outputs", "completed"}
PROJECT_OUTPUT_TYPES = {"deliverable", "paper", "pilot", "demonstrator", "policy-report", "dataset", "report", "website", "other"}
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
    return {"metadata": {"updated": date.today().isoformat(), "schemaVersion": 2}, "projects": []}


def _normalise_result_stage(value: object, allow_empty: bool = False) -> str:
    stage = str(value or "").strip().lower()
    if stage == "planned":  # migrate the original Site Manager vocabulary
        stage = "signed"
    if allow_empty and not stage:
        return ""
    return stage or "ongoing"


def _clean_project_output(output: dict, label: str, index: int, errors: list[str], source: str) -> dict:
    output_type = str(output.get("type", "other")).strip()
    title = str(output.get("title", "")).strip()
    url = str(output.get("url", "")).strip()
    published = str(output.get("published", "")).strip()
    published_year = str(output.get("publishedYear", "")).strip()
    doi = str(output.get("doi", "")).strip()
    if not url and doi:
        url = f"https://doi.org/{doi}"
    if output_type not in PROJECT_OUTPUT_TYPES:
        errors.append(f"{label}, output {index}: choose a valid output type.")
    if not title:
        errors.append(f"{label}, output {index}: title is required.")
    if not valid_url(url, allow_relative=False):
        errors.append(f"{label}, output {index}: enter a valid public http or https link.")
    if published:
        try:
            date.fromisoformat(published)
        except ValueError:
            errors.append(f"{label}, output {index}: the date must use YYYY-MM-DD.")
    if published_year and not re.fullmatch(r"\d{4}", published_year):
        errors.append(f"{label}, output {index}: the publication year must use YYYY.")
    authors = output.get("authors", [])
    if isinstance(authors, str):
        authors = [item.strip() for item in authors.split(";") if item.strip()]
    elif isinstance(authors, list):
        authors = [str(item).strip() for item in authors if str(item).strip()]
    else:
        authors = []
    return {
        "id": str(output.get("id", "")).strip(),
        "type": output_type,
        "subtype": str(output.get("subtype", "")).strip(),
        "title": title,
        "description": str(output.get("description", "")).strip(),
        "url": url,
        "published": published,
        "publishedYear": published_year,
        "doi": doi,
        "authors": authors,
        "journal": str(output.get("journal", "")).strip(),
        "publisher": str(output.get("publisher", "")).strip(),
        "source": source,
        "sourceUpdated": str(output.get("sourceUpdated", "")).strip()[:10],
    }


def _output_identity(output: dict) -> str:
    if output.get("id"):
        return f"id:{output['id'].casefold()}"
    if output.get("doi"):
        return f"doi:{output['doi'].casefold()}"
    if output.get("url"):
        return f"url:{output['url'].casefold()}"
    title = re.sub(r"\W+", "", output.get("title", "").casefold())
    return f"title:{output.get('type', 'other')}:{title}"


def _merge_project_outputs(cordis_outputs: list[dict], manual_outputs: list[dict]) -> list[dict]:
    merged = {_output_identity(output): output for output in cordis_outputs}
    for output in manual_outputs:
        merged[_output_identity(output)] = output
    return sorted(
        merged.values(),
        key=lambda output: (
            output.get("published", "") or output.get("publishedYear", "") or output.get("sourceUpdated", ""),
            output.get("title", "").casefold(),
        ),
        reverse=True,
    )


def validate_project_results(store: dict) -> tuple[dict, list[str]]:
    metadata = dict(store.get("metadata", {}))
    metadata.update({"updated": str(metadata.get("updated") or date.today().isoformat()), "schemaVersion": 2})
    cleaned = {"metadata": metadata, "projects": []}
    errors: list[str] = []
    seen: set[str] = set()
    for index, raw in enumerate(store.get("projects", []), start=1):
        project_id = str(raw.get("projectId", "")).strip()
        label = project_id or f"Project result row {index}"
        if not re.fullmatch(r"\d{6,12}", project_id):
            errors.append(f"{label}: enter a valid CORDIS project ID.")
        elif project_id in seen:
            errors.append(f"{label}: the project appears more than once.")
        seen.add(project_id)

        cordis_raw = raw.get("cordis") if isinstance(raw.get("cordis"), dict) else {}
        manual_raw = raw.get("manual") if isinstance(raw.get("manual"), dict) else None
        if manual_raw is None:  # migrate schema version 1 records as manual additions
            manual_raw = {
                "stage": raw.get("stage", "") if not cordis_raw else "",
                "reviewed": raw.get("reviewed", "") if not cordis_raw else "",
                "summary": raw.get("summary", "") if not cordis_raw else "",
                "outputs": raw.get("outputs", []) if not cordis_raw else [],
            }

        cordis_stage = _normalise_result_stage(cordis_raw.get("stage", raw.get("stage", "ongoing")))
        if cordis_stage not in PROJECT_RESULT_STAGES:
            errors.append(f"{label}: the automatic CORDIS stage is invalid.")
            cordis_stage = "ongoing"
        manual_stage = _normalise_result_stage(manual_raw.get("stage"), allow_empty=True)
        if manual_stage and manual_stage not in PROJECT_RESULT_STAGES:
            errors.append(f"{label}: choose a valid implementation-stage override.")
        reviewed = str(manual_raw.get("reviewed", "")).strip()
        if reviewed:
            try:
                date.fromisoformat(reviewed)
            except ValueError:
                errors.append(f"{label}: the review date must use YYYY-MM-DD.")

        cordis_outputs = [
            _clean_project_output(output, label, output_index, errors, "CORDIS")
            for output_index, output in enumerate(cordis_raw.get("outputs", []), start=1)
        ]
        manual_outputs = [
            _clean_project_output(output, label, output_index, errors, "Manual")
            for output_index, output in enumerate(manual_raw.get("outputs", []), start=1)
        ]
        outputs = _merge_project_outputs(cordis_outputs, manual_outputs)
        stage = manual_stage or cordis_stage
        cordis_source_updated = str(cordis_raw.get("sourceUpdated", "")).strip()[:10]
        manual = {
            "stage": manual_stage,
            "reviewed": reviewed,
            "summary": str(manual_raw.get("summary", "")).strip(),
            "outputs": manual_outputs,
        }
        cordis = {
            "status": str(cordis_raw.get("status", "")).strip(),
            "stage": cordis_stage,
            "sourceUpdated": cordis_source_updated,
            "outputs": cordis_outputs,
        }
        cleaned["projects"].append({
            "projectId": project_id,
            "stage": stage,
            "stageSource": "manual" if manual_stage else "CORDIS results" if cordis_outputs else "project dates",
            "reviewed": reviewed or cordis_source_updated,
            "summary": manual["summary"],
            "outputs": outputs,
            "cordis": cordis,
            "manual": manual,
        })
    cleaned["projects"].sort(key=lambda row: row["projectId"])
    cleaned["metadata"].update({
        "projectCount": len(cleaned["projects"]),
        "projectsWithOutputs": sum(bool(row["outputs"]) for row in cleaned["projects"]),
        "outputCount": sum(len(row["outputs"]) for row in cleaned["projects"]),
        "cordisOutputCount": sum(len(row["cordis"]["outputs"]) for row in cleaned["projects"]),
        "manualOutputCount": sum(len(row["manual"]["outputs"]) for row in cleaned["projects"]),
    })
    return cleaned, errors


def _infer_project_result_stage(project: dict, published_date: str) -> str:
    status = str(project.get("status", "")).strip().upper()
    end = str(project.get("end", ""))[:10]
    start = str(project.get("start", ""))[:10]
    if status in {"CLOSED", "COMPLETED", "FINISHED"} or (end and end < published_date):
        return "completed"
    if start and start > published_date:
        return "signed"
    if project.get("results"):
        return "outputs"
    return "ongoing"


def build_project_results_store(projects: list[dict], existing: dict, published_date: str) -> dict:
    existing_cleaned, _ = validate_project_results(existing)
    manual_by_id = {row["projectId"]: row["manual"] for row in existing_cleaned["projects"]}
    records = []
    for project in projects:
        result_dates = [str(output.get("sourceUpdated", ""))[:10] for output in project.get("results", []) if output.get("sourceUpdated")]
        records.append({
            "projectId": str(project.get("id", "")),
            "cordis": {
                "status": str(project.get("status", "")),
                "stage": _infer_project_result_stage(project, published_date),
                "sourceUpdated": max(result_dates, default=published_date),
                "outputs": project.get("results", []),
            },
            "manual": manual_by_id.get(str(project.get("id", "")), {"stage": "", "reviewed": "", "summary": "", "outputs": []}),
        })
    store = {
        "metadata": {
            "updated": published_date,
            "sourceUpdated": published_date,
            "source": "CORDIS — European Commission, with Site Manager additions",
            "schemaVersion": 2,
        },
        "projects": records,
    }
    cleaned, errors = validate_project_results(store)
    if errors:
        raise ValueError("\n".join(errors))
    return cleaned


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
    existing = read_json(path, default_project_results())
    data_path = root / "site" / "assets" / "data.js"
    if data_path.is_file():
        raw = data_path.read_text(encoding="utf-8").strip()
        prefix = "window.HE_DATA = "
        if raw.startswith(prefix):
            payload = raw[len(prefix):]
            if payload.endswith(";"):
                payload = payload[:-1]
            portfolio = json.loads(payload)
            projects = portfolio.get("projects", [])
            if projects:
                published_date = str(portfolio.get("metadata", {}).get("projectDataUpdated") or date.today().isoformat())
                existing = build_project_results_store(projects, existing, published_date)
    return write_project_result_outputs(root, existing)


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
