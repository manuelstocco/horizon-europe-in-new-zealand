#!/bin/zsh

set -u

ROOT_DIR="${0:A:h}"
cd "$ROOT_DIR" || exit 1

echo "Horizon Europe in New Zealand — XML update"
echo

ZIP_PATH="${1:-}"
if [[ -z "$ZIP_PATH" ]]; then
  echo "Drag the complete CORDIS XML ZIP into this window, then press Return:"
  read -r ZIP_PATH
fi

ZIP_PATH="${ZIP_PATH#\'}"
ZIP_PATH="${ZIP_PATH%\'}"
ZIP_PATH="${ZIP_PATH#\"}"
ZIP_PATH="${ZIP_PATH%\"}"

DEFAULT_DATE="$(date +%Y-%m-%d)"
echo
echo "Publication date [$DEFAULT_DATE]:"
read -r UPDATE_DATE
UPDATE_DATE="${UPDATE_DATE:-$DEFAULT_DATE}"

echo
python3 tools/update_from_xml.py "$ZIP_PATH" --site-dir site --date "$UPDATE_DATE"
STATUS=$?

echo
if [[ $STATUS -eq 0 ]]; then
  echo "Update completed. Open site/index.html to review it."
  echo "When satisfied, publish the changes with GitHub Desktop."
else
  echo "The update stopped before changing the site. Review the error above."
fi

echo
echo "Press any key to close this window."
read -k 1
exit $STATUS
