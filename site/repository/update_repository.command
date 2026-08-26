#!/bin/zsh
SCRIPT_DIR=${0:A:h}
python3 "$SCRIPT_DIR/build_repository.py"
STATUS=$?
echo
if [[ $STATUS -eq 0 ]]; then
  echo "The repository catalogue is ready."
else
  echo "The repository was not updated. Read the message above and correct the catalogue."
fi
echo "Press any key to close."
read -k 1
exit $STATUS
