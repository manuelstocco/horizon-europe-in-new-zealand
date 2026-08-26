# Horizon Europe in New Zealand

Interactive website presenting New Zealand participation in Horizon Europe.

This publication contains the validated 38-project portfolio current on
22 August 2026. The deployed website is built from the static files in `site/`.

## Publication

Every update pushed to the `main` branch is published automatically through
GitHub Pages. The deployment workflow validates and uploads the `site/`
directory without changing the source dataset.

## Data

Project, organisation, country, funding, signature and start-date records are
derived from the European Commission's CORDIS project records. Measurement
rules and source notes are available on the website's **About the data** page.

## Updating from CORDIS XML

The repository includes a local updater that rebuilds the website database from
one complete ZIP of CORDIS XML records. On macOS, double-click
`update-site.command`, drag the ZIP into the Terminal window and confirm the
publication date. Review the local site before committing the generated changes
with GitHub Desktop.

Detailed instructions and safety checks are documented in
`XML-UPDATE-README.md`.
