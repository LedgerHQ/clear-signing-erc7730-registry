#!/usr/bin/env bash
set -e

EXIT_CODE=0
mapfile -t changed_files <<< "$CHANGED_FILES"

for file in "${changed_files[@]}"; do
  [ -n "$file" ] || continue
  echo "========================================="
  echo "Analyzing: $file"
  echo "========================================="

  python erc7730-analyzer/analyze_7730.py \
    --erc7730_file "$file" \
    --api-key "$ETHERSCAN_API_KEY" \
    --coredao-api-key "$COREDAO_API_KEY" || true

  if [ -d "output" ] && [ "$(ls -A output 2>/dev/null)" ]; then
    echo "✅ Reports generated for $file"

    if find output -name 'CRITICALS_*.md' -exec grep -q '| 🔴' {} \; 2>/dev/null; then
      echo "⚠️  Critical issues found in $file"
      EXIT_CODE=1
    fi
  else
    echo "❌ ERROR: Script failed to generate reports for $file"
    EXIT_CODE=1
  fi
  echo ""
done

if [ "$EXIT_CODE" -eq 1 ]; then
  echo "has_criticals=true" >> "$GITHUB_OUTPUT"
  exit 1
else
  echo "has_criticals=false" >> "$GITHUB_OUTPUT"
fi
