#!/bin/zsh

set -u

ROOT_DIR="${0:A:h}"
PORT="8765"
URL="http://127.0.0.1:${PORT}/"

cd "$ROOT_DIR" || {
  echo "The Site Manager folder could not be opened."
  echo "Press any key to close this window."
  read -k 1
  exit 1
}

echo "Horizon Europe in New Zealand — Site Manager"
echo

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is not available on this Mac."
  echo "Press any key to close this window."
  read -k 1
  exit 1
fi

if curl --silent --fail --max-time 1 "$URL/api/health" >/dev/null 2>&1; then
  echo "The Site Manager is already running. Opening it now."
  open "$URL"
  exit 0
fi

(
  for attempt in {1..30}; do
    if curl --silent --fail --max-time 1 "$URL/api/health" >/dev/null 2>&1; then
      open "$URL"
      exit 0
    fi
    sleep 0.2
  done
) &

HE_SITE_MANAGER_PORT="$PORT" \
HE_SITE_MANAGER_NO_BROWSER="1" \
PYTHONUNBUFFERED="1" \
python3 site-manager/server.py
STATUS=$?

echo
if [[ $STATUS -ne 0 ]]; then
  echo "The Site Manager could not start."
  echo "If another app is using local port ${PORT}, close it and try again."
  echo "Press any key to close this window."
  read -k 1
fi
exit $STATUS
