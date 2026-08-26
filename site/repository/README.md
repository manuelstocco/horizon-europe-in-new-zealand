# Updating the repository

The public Repository page is generated from `catalog.csv`. You do not need to edit the HTML page.

1. Copy the new `.pptx`, `.pdf` or other downloadable file into the `files` folder.
2. Open `catalog.csv` in Excel or Numbers and add one row for the new file.
3. Keep `id` unique and use a relative file path beginning with `repository/files/`.
4. Write dates as `YYYY-MM-DD` and use the two-letter country code in `country_code`.
5. Save the CSV, then double-click `update_repository.command`.
6. Open `repository.html` and verify the new card and download.
7. Commit and push the changed files to GitHub when the update is ready to publish.

The update tool checks that every listed file exists and regenerates `assets/repository-data.js`, including the download size.
