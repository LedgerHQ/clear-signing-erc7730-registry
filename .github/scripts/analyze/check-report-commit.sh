#!/usr/bin/env bash
set -e

if [ "$ANY_CHANGED" != "true" ]; then
  echo "is_report_commit=true" >> "$GITHUB_OUTPUT"
  CRITICALS_FILE=$(find output -maxdepth 1 -name 'CRITICALS_*.md' -print -quit)
  if [ -n "$CRITICALS_FILE" ] && [ -f "$CRITICALS_FILE" ]; then
    if grep -q '| 🔴' "$CRITICALS_FILE"; then
      echo "has_criticals=true" >> "$GITHUB_OUTPUT"
      echo "Report commit contains critical issues"
    else
      echo "has_criticals=false" >> "$GITHUB_OUTPUT"
      echo "Report commit has no critical issues"
    fi
  else
    echo "has_criticals=false" >> "$GITHUB_OUTPUT"
  fi
else
  echo "is_report_commit=false" >> "$GITHUB_OUTPUT"
fi
