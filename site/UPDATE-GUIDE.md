# Updating Horizon Europe in New Zealand

## National Contact Points

1. Open `Horizon-Europe-NZ-data-maintenance.xlsx`.
2. Edit the `National Contact Points` sheet.
3. Keep every `NCP_ID` unique and stable.
4. Set `Active` to `FALSE` instead of deleting a former contact.
5. Update `Last Verified` for every contact checked.
6. Update `NCP data verified` in the `Site Metadata` sheet.
7. Provide the updated workbook when the website is refreshed.

## Project data

Project pages are generated from a complete ZIP of CORDIS XML records. The updater rebuilds the project database from the archive rather than appending records to the previous version. This means that projects added to the ZIP appear on the site and projects removed from the ZIP disappear at the next update.

On macOS:

1. Double-click `update-site.command` in the repository folder.
2. Drag the complete current XML ZIP into the Terminal window and press Return.
3. Confirm the publication date.
4. Review the totals and the list of project IDs added or removed.
5. Open `site/index.html` and check the refreshed site locally.
6. Publish only after the local review is satisfactory.

The refresh process will:

- validate every XML record before changing the site;
- deduplicate every Project–Country pair;
- preserve the six cluster colours;
- rebuild all filters and project totals;
- preserve verified organisation coordinates and use CORDIS coordinates for new organisations;
- rebuild the organisation network map and its project connections;
- refresh the data-file version markers so browsers do not retain the previous portfolio;
- update the site-wide project-data date;
- preserve the National Contact Points maintained in the workbook.

A successful update creates an ignored local backup in `.update-backups`. If validation fails, the website files are not changed. Full instructions are available in `XML-UPDATE-README.md` at repository level.

## Organisation network map

The map uses each organisation's reported head-office city. When a project refresh introduces a new organisation or city, regenerate `assets/organisation-locations.js` before publishing. GeoNames provides city coordinates; records without a reported city use a country reference point. The map boundaries are supplied by Natural Earth.

## Download repository

Repository materials are managed independently from the project database:

1. Copy the new presentation or document into `repository/files`.
2. Add one row to `repository/catalog.csv` in Excel or Numbers.
3. Double-click `repository/update_repository.command` to validate the entries and rebuild the public catalogue.
4. Open `repository.html` and test the download before publishing.

Full field guidance is available in `repository/README.md`.

## Update dates

Two dates are intentionally kept separate:

- **Project data updated** — the date of the latest CORDIS project information.
- **NCP data verified** — the date the contact directory was last checked.

The public site uses one consistent footer label: **Last update**. Set it to the date of the latest published site refresh; the two source dates remain available in the maintenance data for audit purposes.

## Planned enhancement

Add a site-wide EUR / NZD switch. The selected currency should persist across pages, while the EUR–NZD rate, its source and its reference date should be captured during each data refresh rather than requested live by visitors.
