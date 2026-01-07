#!/usr/bin/env bash
set -e

CRITICALS_FILE=$(find output -maxdepth 1 -name 'CRITICALS_*.md' -print -quit)

if [ -n "$CRITICALS_FILE" ] && [ -f "$CRITICALS_FILE" ]; then
  CONTRACT_NAME=$(basename "$CRITICALS_FILE" | sed 's/CRITICALS_\(.*\)_[0-9]*.md/\1/')

  CALLDATA_FILE=$(find . -name "calldata-${CONTRACT_NAME}.json" -print -quit)
  if [ -z "$CALLDATA_FILE" ]; then
    CALLDATA_FILE=$(find registry -name 'calldata-*.json' -print -quit)
  fi

  while IFS='|' read -r col1 col2 _ col4 _; do
    if [[ "$col4" == *"🔴"* ]]; then
      FUNCTION=$(echo "$col1" | sed 's/`//g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      SELECTOR=$(echo "$col2" | sed 's/`//g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      ISSUE=$(echo "$col4" | sed 's/🔴 Critical//g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

      if [ -n "$FUNCTION" ] && [ "$FUNCTION" != "Function" ]; then
        if [ -n "$CALLDATA_FILE" ]; then
          echo "::error file=${CALLDATA_FILE},title=🔴 Critical Issue in ${FUNCTION} (${SELECTOR})::${ISSUE} - View full report: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
        else
          echo "::error title=🔴 Critical Issue in ${FUNCTION} (${SELECTOR})::${ISSUE} - View full report: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
        fi
      fi
    fi
  done < "$CRITICALS_FILE"

  echo "::notice title=📊 ERC-7730 Analysis Complete::Critical issues detected. View full report at ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
else
  echo "::notice title=📊 ERC-7730 Analysis Complete::No critical issues detected. View full report at ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
fi
