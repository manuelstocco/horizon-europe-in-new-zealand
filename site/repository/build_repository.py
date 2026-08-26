#!/usr/bin/env python3
"""Build the public repository catalogue from repository/catalog.csv."""
from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path

REQUIRED = {
    "id", "country", "country_code", "title", "description", "file",
    "format", "language", "updated", "version", "featured",
}


def main() -> None:
    repository_dir = Path(__file__).resolve().parent
    site_root = repository_dir.parent
    catalogue_path = repository_dir / "catalog.csv"
    output_path = site_root / "assets" / "repository-data.js"

    with catalogue_path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        missing = REQUIRED.difference(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"Missing catalogue columns: {', '.join(sorted(missing))}")
        rows = list(reader)

    items = []
    seen_ids = set()
    for line_number, row in enumerate(rows, start=2):
        item_id = row["id"].strip()
        if not item_id:
            raise SystemExit(f"Row {line_number}: id is required")
        if item_id in seen_ids:
            raise SystemExit(f"Row {line_number}: duplicate id '{item_id}'")
        seen_ids.add(item_id)

        relative_file = row["file"].strip()
        file_path = site_root / relative_file
        if not file_path.is_file():
            raise SystemExit(f"Row {line_number}: file not found: {relative_file}")

        updated = row["updated"].strip()
        try:
            date.fromisoformat(updated)
        except ValueError as error:
            raise SystemExit(f"Row {line_number}: updated must be YYYY-MM-DD") from error

        items.append({
            "id": item_id,
            "country": row["country"].strip(),
            "countryCode": row["country_code"].strip().upper(),
            "title": row["title"].strip(),
            "description": row["description"].strip(),
            "file": relative_file,
            "format": row["format"].strip(),
            "language": row["language"].strip(),
            "updated": updated,
            "version": row["version"].strip(),
            "featured": row["featured"].strip().lower() in {"true", "yes", "1"},
            "sizeBytes": file_path.stat().st_size,
        })

    catalogue_updated = max((item["updated"] for item in items), default=date.today().isoformat())
    payload = {"updated": catalogue_updated, "items": items}
    output_path.write_text(
        "window.HE_REPOSITORY = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Repository updated: {len(items)} item(s).")


if __name__ == "__main__":
    main()
