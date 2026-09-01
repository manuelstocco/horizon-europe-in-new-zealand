# Updating the website from CORDIS XML

The standard workflow now uses the **Portfolio XML** project register in the local Site Manager. It downloads a fresh XML record directly from CORDIS for every included project, then rebuilds the complete database. The ZIP workflow below remains available as a fallback.

## Standard update with the Site Manager

1. Double-click `site-manager.command`.
2. Open **Portfolio XML**.
3. Add or remove CORDIS project IDs or links and save the project list.
4. Run **Download & validate**.
5. If the report is correct, run **Update website**.

The approved EUR–NZD rate is preserved during this process. Check and apply a different official monthly rate only from the separate **Exchange rate** page.

## Fallback update from a ZIP on macOS

1. Keep the complete current CORDIS XML collection in one ZIP file.
2. Double-click `update-site.command`.
3. Drag the ZIP into the Terminal window and press Return.
4. Confirm the publication date, or press Return to use today's date.
5. Read the summary showing project, organisation and country totals, the approved EUR–NZD rate, and the IDs of projects added or removed.
6. Open `site/index.html` and review the website locally.
7. If the result is correct, commit and push the changes using GitHub Desktop.

The updater refreshes the complete project snapshot and the page references that prevent visitors from seeing an old cached copy:

- `site/assets/data.js`
- `site/assets/organisation-locations.js`
- `content/project-results.json`
- `site/assets/project-results-data.js`
- the version marker on those files in the website's HTML pages

CORDIS `<result>` records are imported with their titles, descriptions, result types, public document links, publication metadata and DOI identifiers. Manual additions made in the Site Manager are merged with—not substituted for—the CORDIS records and survive later XML updates.

The Site Manager keeps project data and exchange-rate approval separate. Visitors do not make live exchange-rate requests: the manually approved value and its reference month are stored in `site/assets/data.js`.

It preserves the site's design, colour palettes, repository files and all other pages. PowerPoint and PDF exports remain generated from the active website data, selected filters and selected currency, so they automatically reflect the refreshed portfolio.

When projects are added or removed, the updater also creates a dated public
entry in **Updates & Events**. The entry can be reviewed, edited or archived
later through the local Site Manager.

## Safety checks

Before writing anything, the updater checks that:

- every XML record can be parsed;
- project IDs are unique;
- every project contains at least one New Zealand organisation;
- every project belongs to one of the six Pillar II clusters;
- every project has a coordinator and a funding scheme.

If a check fails, the update stops without changing the website. A successful update creates a local backup in `.update-backups`; this folder is ignored by Git.

## Test without changing the website

From the repository folder:

```sh
python3 tools/update_from_xml.py /path/to/archive.zip --site-dir site --dry-run --keep-exchange-rate
```

## Update with an explicit date

```sh
python3 tools/update_from_xml.py /path/to/archive.zip --site-dir site --date 2026-08-27 --keep-exchange-rate
```
