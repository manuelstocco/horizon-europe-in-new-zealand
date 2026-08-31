# Local Site Manager

The Site Manager is the local control centre for the Horizon Europe in New Zealand website. It runs only on this Mac and does not publish or upload content automatically.

## Open the manager

1. Double-click `site-manager.command` in Finder.
2. Keep the Terminal window open while using the manager.
3. The control panel opens automatically in the browser.

## What it manages

- **Updates & events** — create, edit, feature, publish or archive public content.
- **Country status** — maintain associated countries, low- and middle-income eligibility, source links and the date on which the reference was checked.
- **Portfolio XML** — maintain the project register, download fresh XML records directly from the official CORDIS links, validate the complete portfolio and update the website. A complete ZIP remains available as a fallback.
- **Exchange rate** — check an official monthly EUR–NZD InforEuro rate and apply it only after manual approval.
- **Prepare update** — confirm that the generated website files are ready for review in GitHub Desktop.

## Publication workflow

1. Save changes in the Site Manager.
2. Open the public preview links in **Prepare update**.
3. Run **Check website files**.
4. Review the changed files with GitHub Desktop.
5. Commit and push only when the local website is correct.

The editable source files are stored in `content/`, including `portfolio-projects.json` and `exchange-rate.json`. The Site Manager generates the JavaScript files read by the static website, so these generated files should be committed together with their source files.

## Portfolio workflow

1. Paste one or more CORDIS project IDs or project-page links into **Portfolio XML**.
2. Save the list. Projects can be temporarily excluded with their checkbox or removed from the register.
3. Run **Download & validate**. The manager downloads one fresh XML record for every included project and checks the full portfolio without changing the website.
4. If the report is correct, run **Update website**.

The project update preserves the currently approved exchange rate. Currency changes are handled separately in **Exchange rate**.

## Exchange-rate workflow

1. Select the InforEuro accounting month.
2. Run **Check official rate**. This does not change the website.
3. Review the returned EUR–NZD value.
4. Use **Apply this rate to the website** only when you want the site and its exports to use it.
