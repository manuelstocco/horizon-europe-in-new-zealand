# Local Site Manager

The Site Manager is the local control centre for the Horizon Europe in New Zealand website. It runs only on this Mac and does not publish or upload content automatically.

## Open the manager

1. Double-click `site-manager.command` in Finder.
2. Keep the Terminal window open while using the manager.
3. The control panel opens automatically in the browser.

## What it manages

- **Updates & events** — create, edit, feature, publish or archive public content. Every save also refreshes the public RSS feed.
- **Project results** — assign an implementation stage, add a concise verified summary and link public deliverables, papers, pilots, demonstrators, policy reports or datasets.
- **Country status** — maintain associated countries, low- and middle-income eligibility, source links and the date on which the reference was checked.
- **Portfolio XML** — maintain the project register, download fresh XML records directly from the official CORDIS links, validate the complete portfolio and update the website. A complete ZIP remains available as a fallback.
- **Resource Library** — upload public documents with their title, description, country, language, date and version; preview the current catalogue; and remove obsolete items. Removed files are retained locally in `content/resource-library-trash/` for recovery.
- **Exchange rate** — check an official monthly EUR–NZD InforEuro rate and apply it only after manual approval.
- **Prepare update** — confirm that the generated website files are ready for review in GitHub Desktop.

## Publication workflow

1. Save changes in the Site Manager.
2. Open the public preview links in **Prepare update**.
3. Run **Regenerate & check files**. This rebuilds public event and country data and refreshes the web addresses of changed assets, preventing an older browser copy from masking the update.
4. Review the changed files with GitHub Desktop.
5. Commit and push only when the local website is correct.
6. Wait for the newest GitHub Pages deployment to complete before checking the public site. A newly pushed update supersedes any older deployment still in progress.

The editable source files are stored in `content/`, including `portfolio-projects.json` and `exchange-rate.json`. The Site Manager generates the JavaScript files read by the static website, so these generated files should be committed together with their source files.

## Updates and events workflow

1. Create an item and choose its status. **Draft** is saved locally but not shown publicly; **Published** is included in Updates & Events and the RSS feed; **Archived** is hidden publicly but remains recoverable.
2. Events and deadlines need a start date to appear in the public calendar.
3. Use **Remove from public calendar** to change a published event to Archived, then save. Use **Restore as draft** to bring an archived item back for editing.
4. Use **Delete permanently** only when the item should also disappear from the local manager. A confirmation is always required.

After every successful save, the editor shows the save time and the item’s publication state. Changes become visible on the online website only after the normal GitHub publication workflow.

## RSS feed

The public feed is generated as `site/feed.xml`. It contains published items only and uses the same Updates & Events content as the website. Draft and archived items never appear. Browsers and feed readers can discover it automatically from every public page. Visitors use **Subscribe** on the Updates & Events page to copy the address or open it in a compatible reader; the raw XML remains available as a technical option.

## Project-results workflow

1. Open **Project results** and choose a project from the list.
2. Review the read-only CORDIS evidence. Deliverables, publications, reports, DOI metadata and public links are imported automatically with every portfolio update.
3. Leave **Stage override** on automatic unless a verified source justifies a correction. The automatic stages are Signed, Ongoing, Outputs available and Completed.
4. Add only information not supplied by CORDIS: a concise implementation summary or additional verified public outputs with their source links.
5. Save locally, then check **Project Results** and the project’s own Project Explorer view.
6. Use the normal **Prepare update** and GitHub Desktop workflow to publish the changes.

The unified result registry is stored in `content/project-results.json`. It keeps the current CORDIS snapshot and manual additions separately, presents their merged result to the website, and preserves manual additions when the XML portfolio is refreshed.

## Portfolio workflow

1. Paste one or more CORDIS project IDs or project-page links into **Portfolio XML**.
2. Save the list. Projects can be temporarily excluded with their checkbox or removed from the register.
3. Run **Download & validate**. The manager downloads one fresh XML record for every included project and checks the full portfolio without changing the website.
4. If the report is correct, run **Update website**. The same operation refreshes the project database, organisations, public outputs and implementation stages as one consistent snapshot.

During either operation, the progress panel shows the number of CORDIS records processed, the current phase and the elapsed time. The final website-building phase can continue briefly after every project has been downloaded.

The project update preserves the currently approved exchange rate. Currency changes are handled separately in **Exchange rate**.

## Resource Library workflow

1. Open **Resource Library** and choose the document to add.
2. Complete the public title and useful catalogue information. The document date is required; the format is inferred from the filename when left blank.
3. Use **Add to Resource Library** and preview the public library from the link at the top of the page.
4. Use **Remove** only after checking the selected item. The document disappears from the public catalogue, but a recoverable local copy is moved to `content/resource-library-trash/`.
5. Run **Prepare update** before publishing through GitHub Desktop so the catalogue and its refreshed web address are included together.

## Exchange-rate workflow

1. Select the InforEuro accounting month.
2. Run **Check official rate**. This does not change the website.
3. Review the returned EUR–NZD value.
4. Use **Apply this rate to the website** only when you want the site and its exports to use it.
