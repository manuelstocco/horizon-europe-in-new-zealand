#!/usr/bin/env python3
"""Local, dependency-free control panel for the Horizon Europe website."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import webbrowser
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
WEB = Path(__file__).resolve().parent / "web"
SITE = ROOT / "site"
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

from content_manager import (  # noqa: E402
    default_country_overrides,
    default_event_store,
    ensure_content,
    read_json,
    refresh_asset_references,
    validate_country_overrides,
    validate_event_store,
    write_country_outputs,
    write_event_outputs,
)
from portfolio_manager import (  # noqa: E402
    apply_exchange_rate,
    current_exchange_store,
    download_portfolio,
    ensure_project_store,
    fetch_infoeuro_rate,
    write_project_store,
)


MAX_JSON_BYTES = 3 * 1024 * 1024
MAX_ZIP_BYTES = 180 * 1024 * 1024


def load_assignment(path: Path, prefix: str) -> dict:
    raw = path.read_text(encoding="utf-8").strip()
    if not raw.startswith(prefix):
        return {}
    payload = raw[len(prefix):].strip()
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


def country_reference() -> list[dict]:
    rows: dict[str, str] = {}
    world = load_assignment(SITE / "assets" / "world-map.js", "window.HE_WORLD=")
    for feature in world.get("features", []):
        properties = feature.get("properties", {})
        code = str(properties.get("code", ""))
        name = str(properties.get("name", code))
        if re.fullmatch(r"[A-Z]{2}", code):
            rows[code] = name
    data = load_assignment(SITE / "assets" / "data.js", "window.HE_DATA = ")
    for country in data.get("countries", []):
        rows[country["code"]] = country["name"]
    overrides = read_json(ROOT / "content" / "country-status-overrides.json", default_country_overrides(ROOT))
    for code in overrides.get("associated", []) + overrides.get("lowMiddleIncome", []):
        rows.setdefault(code, code)
    return [{"code": code, "name": name} for code, name in sorted(rows.items(), key=lambda row: row[1])]


def portfolio_summary() -> dict:
    data = load_assignment(SITE / "assets" / "data.js", "window.HE_DATA = ")
    projects = data.get("projects", [])
    organisations = {
        f"{org.get('countryCode')}|{org.get('name')}"
        for project in projects
        for org in project.get("organisations", [])
    }
    return {
        "projects": len(projects),
        "organisations": len(organisations),
        "countries": len({code for project in projects for code in project.get("countryCodes", [])}),
        "updated": data.get("metadata", {}).get("projectDataUpdated", ""),
        "exchangeRate": data.get("metadata", {}).get("exchangeRate", {}),
    }


class ManagerServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    server_version = "HorizonSiteManager/1.0"

    def log_message(self, format_string: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format_string % args}")

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed = urlparse(origin)
        return parsed.hostname in {"127.0.0.1", "localhost"} and parsed.port == self.server.server_port

    def _json(self, payload: dict | list, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, message: str, status: int = 400, details: list[str] | None = None) -> None:
        self._json({"ok": False, "message": message, "details": details or []}, status)

    def _read_json(self) -> dict:
        size = int(self.headers.get("Content-Length", "0"))
        if size <= 0 or size > MAX_JSON_BYTES:
            raise ValueError("The request is empty or too large.")
        return json.loads(self.rfile.read(size).decode("utf-8"))

    def _serve_file(self, path: Path) -> None:
        try:
            resolved = path.resolve(strict=True)
        except FileNotFoundError:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        allowed = (WEB.resolve(), SITE.resolve())
        if not any(resolved == base or base in resolved.parents for base in allowed):
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        content = resolved.read_bytes()
        media_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", media_type + ("; charset=utf-8" if media_type.startswith("text/") else ""))
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:  # noqa: N802
        route = unquote(urlparse(self.path).path)
        if route == "/api/state":
            events, countries = ensure_content(ROOT)
            project_store = ensure_project_store(ROOT)
            exchange_store = current_exchange_store(ROOT)
            self._json({
                "ok": True,
                "events": events,
                "countryStatus": countries,
                "countryReference": country_reference(),
                "portfolio": portfolio_summary(),
                "projectStore": project_store,
                "exchangeStore": exchange_store,
                "today": date.today().isoformat(),
            })
            return
        if route == "/api/exchange-rate/check":
            period = parse_qs(urlparse(self.path).query).get("period", [date.today().strftime("%Y-%m")])[0]
            try:
                self._json({"ok": True, "message": f"Official InforEuro rate found for {period}.", "rate": fetch_infoeuro_rate(period)})
            except Exception as exc:
                self._error(f"The official rate could not be checked: {exc}", 400)
            return
        if route == "/api/health":
            self._json({"ok": True})
            return
        if route.startswith("/site/"):
            relative = route[len("/site/"):] or "index.html"
            self._serve_file(SITE / relative)
            return
        if route in {"", "/"}:
            self._serve_file(WEB / "index.html")
            return
        self._serve_file(WEB / route.lstrip("/"))

    def do_POST(self) -> None:  # noqa: N802
        if not self._origin_allowed():
            self._error("This local request was refused.", 403)
            return
        route = urlparse(self.path).path
        try:
            if route == "/api/events":
                payload = self._read_json()
                cleaned, errors = validate_event_store(payload)
                if errors:
                    self._error("Some content needs attention.", details=errors)
                    return
                saved = write_event_outputs(ROOT, cleaned)
                self._json({"ok": True, "message": "Updates and events saved.", "events": saved})
                return
            if route == "/api/country-status":
                payload = self._read_json()
                cleaned, errors = validate_country_overrides(payload)
                if errors:
                    self._error("The country-status list needs attention.", details=errors)
                    return
                saved = write_country_outputs(ROOT, cleaned)
                self._json({"ok": True, "message": "Country status saved.", "countryStatus": saved})
                return
            if route == "/api/portfolio-list":
                payload = self._read_json()
                saved = write_project_store(ROOT, payload)
                self._json({"ok": True, "message": "Project list saved locally.", "projectStore": saved})
                return
            if route == "/api/portfolio-sync":
                self._run_portfolio_sync()
                return
            if route == "/api/exchange-rate/apply":
                period = parse_qs(urlparse(self.path).query).get("period", [""])[0]
                rate = fetch_infoeuro_rate(period)
                exchange_store = apply_exchange_rate(ROOT, rate)
                self._json({"ok": True, "message": f"EUR 1 = NZD {rate['value']:.4f} is now used across the website.", "rate": rate, "exchangeStore": exchange_store, "portfolio": portfolio_summary()})
                return
            if route == "/api/prepare":
                events = read_json(ROOT / "content" / "updates-events.json", default_event_store())
                countries = read_json(ROOT / "content" / "country-status-overrides.json", default_country_overrides(ROOT))
                cleaned_events, event_errors = validate_event_store(events)
                cleaned_countries, country_errors = validate_country_overrides(countries)
                errors = event_errors + country_errors
                project_store = ensure_project_store(ROOT)
                portfolio = portfolio_summary()
                enabled_projects = sum(row.get("enabled", True) for row in project_store.get("projects", []))
                if enabled_projects != portfolio["projects"]:
                    errors.append(
                        f"The project register contains {enabled_projects} included projects, but the public website contains "
                        f"{portfolio['projects']}. Run ‘Update website’ in Portfolio XML before publishing."
                    )
                if not errors:
                    write_event_outputs(ROOT, cleaned_events)
                    write_country_outputs(ROOT, cleaned_countries)
                    refresh_asset_references(ROOT)
                required = [SITE / "updates.html", SITE / "feed.xml", SITE / "assets" / "updates-events-data.js", SITE / "assets" / "country-status-overrides.js", ROOT / "content" / "portfolio-projects.json", ROOT / "content" / "exchange-rate.json"]
                missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
                if errors or missing:
                    self._error("The publication package is not ready.", details=errors + [f"Missing: {name}" for name in missing])
                    return
                status = subprocess.run(
                    ["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True, timeout=20
                )
                changed_files = []
                if status.returncode == 0:
                    changed_files = sorted({line[3:].strip() for line in status.stdout.splitlines() if len(line) > 3})
                if not changed_files:
                    changed_files = [
                        "content/updates-events.json",
                        "content/country-status-overrides.json",
                        "content/portfolio-projects.json",
                        "content/exchange-rate.json",
                        "site/assets/updates-events-data.js",
                        "site/assets/country-status-overrides.js",
                        "site/feed.xml",
                        "site/updates.html",
                    ]
                self._json({
                    "ok": True,
                    "message": f"The public files were regenerated and {len(changed_files)} changed file{'s are' if len(changed_files) != 1 else ' is'} ready for GitHub Desktop.",
                    "files": changed_files,
                })
                return
            if route == "/api/xml-update":
                self._run_xml_update()
                return
        except (ValueError, json.JSONDecodeError) as exc:
            self._error(str(exc))
            return
        except Exception as exc:  # keep the local manager responsive and report a concise failure
            self._error(f"The operation could not be completed: {exc}", 500)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def _run_xml_update(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        published = query.get("date", [date.today().isoformat()])[0]
        dry_run = query.get("dryRun", ["true"])[0].lower() != "false"
        try:
            date.fromisoformat(published)
        except ValueError:
            self._error("The publication date must use YYYY-MM-DD.")
            return
        size = int(self.headers.get("Content-Length", "0"))
        if size <= 0 or size > MAX_ZIP_BYTES:
            self._error("The ZIP is empty or larger than 180 MB.")
            return
        data = self.rfile.read(size)
        if not data.startswith(b"PK"):
            self._error("The selected file is not a ZIP archive.")
            return
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as handle:
            handle.write(data)
            archive_path = Path(handle.name)
        command = [sys.executable, str(TOOLS / "update_from_xml.py"), str(archive_path), "--site-dir", str(SITE), "--date", published]
        command.append("--keep-exchange-rate")
        if dry_run:
            command.append("--dry-run")
        try:
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=300)
        finally:
            archive_path.unlink(missing_ok=True)
        output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
        self._json({
            "ok": result.returncode == 0,
            "message": "XML validation completed." if dry_run and result.returncode == 0 else "Portfolio update completed." if result.returncode == 0 else "The XML update stopped before completion.",
            "output": output,
            "portfolio": portfolio_summary(),
        }, 200 if result.returncode == 0 else 400)

    def _run_portfolio_sync(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        published = query.get("date", [date.today().isoformat()])[0]
        dry_run = query.get("dryRun", ["true"])[0].lower() != "false"
        try:
            date.fromisoformat(published)
        except ValueError:
            self._error("The publication date must use YYYY-MM-DD.")
            return
        archive_path = None
        try:
            archive_path, project_store, download_errors = download_portfolio(ROOT)
            if download_errors or archive_path is None:
                self._json({"ok": False, "message": "Some CORDIS records could not be downloaded.", "details": download_errors, "projectStore": project_store}, 400)
                return
            command = [sys.executable, str(TOOLS / "update_from_xml.py"), str(archive_path), "--site-dir", str(SITE), "--date", published, "--keep-exchange-rate"]
            if dry_run:
                command.append("--dry-run")
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=420)
            output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
            self._json({
                "ok": result.returncode == 0,
                "message": "CORDIS list validated." if dry_run and result.returncode == 0 else "Portfolio updated from the CORDIS list." if result.returncode == 0 else "The portfolio update stopped before completion.",
                "output": output,
                "portfolio": portfolio_summary(),
                "projectStore": ensure_project_store(ROOT),
            }, 200 if result.returncode == 0 else 400)
        except Exception as exc:
            self._error(f"The CORDIS list could not be processed: {exc}", 500)
        finally:
            if archive_path:
                archive_path.unlink(missing_ok=True)


def find_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main() -> int:
    ensure_content(ROOT)
    port = int(os.environ.get("HE_SITE_MANAGER_PORT", "0")) or find_port()
    server = ManagerServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print("Horizon Europe in New Zealand — Site Manager")
    print(f"Open: {url}")
    print("Keep this window open while using the manager. Press Control-C to stop it.")
    if os.environ.get("HE_SITE_MANAGER_NO_BROWSER") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSite Manager stopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
