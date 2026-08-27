# Updating the website from CORDIS XML

The XML updater rebuilds the project database from one complete ZIP archive. It does not append records to the previous database. This means that adding a project to the ZIP adds it to the website, while removing it from the ZIP removes it from the website at the next update.

## Standard update on macOS

1. Keep the complete current CORDIS XML collection in one ZIP file.
2. Double-click `update-site.command`.
3. Drag the ZIP into the Terminal window and press Return.
4. Confirm the publication date, or press Return to use today's date.
5. Read the summary showing project, organisation and country totals, the InforEuro EUR–NZD rate, and the IDs of projects added or removed.
6. Open `site/index.html` and review the website locally.
7. If the result is correct, commit and push the changes using GitHub Desktop.

The updater changes only the generated data and the page references that prevent visitors from seeing an old cached copy:

- `site/assets/data.js`
- `site/assets/organisation-locations.js`
- the version marker on those files in the website's HTML pages

The project update also retrieves the latest monthly EUR–NZD accounting rate available from the European Commission's InforEuro service. The verified rate and its reference month are stored in `site/assets/data.js`; visitors do not make live exchange-rate requests. If InforEuro is temporarily unavailable, the updater preserves the last verified official rate and displays a warning in its summary.

It preserves the site's design, colour palettes, repository files and all other pages. PowerPoint and PDF exports remain generated from the active website data, selected filters and selected currency, so they automatically reflect the refreshed portfolio.

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
python3 tools/update_from_xml.py /path/to/archive.zip --site-dir site --dry-run
```

## Update with an explicit date

```sh
python3 tools/update_from_xml.py /path/to/archive.zip --site-dir site --date 2026-08-27
```
