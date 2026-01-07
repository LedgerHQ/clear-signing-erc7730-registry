#!/usr/bin/env bash
set -e

{
  echo "## 📊 ERC-7730 Analysis Results"
  echo ""
} >> "$GITHUB_STEP_SUMMARY"

CRITICALS_FILE=$(find output -maxdepth 1 -name 'CRITICALS_*.md' -print -quit)
if [ -n "$CRITICALS_FILE" ] && [ -f "$CRITICALS_FILE" ]; then
  {
    echo "### 🔴 Critical Issues Report"
    echo ""
    cat "$CRITICALS_FILE"
    echo ""
    echo "---"
    echo ""
  } >> "$GITHUB_STEP_SUMMARY"
fi

SUMMARY_FILE=$(find output -maxdepth 1 -name 'FULL_REPORT_*.md' -print -quit)
if [ -n "$SUMMARY_FILE" ] && [ -f "$SUMMARY_FILE" ]; then
  {
    echo "### 📋 Detailed Summary"
    echo ""
    echo "<details>"
    echo "<summary>Click to expand full summary</summary>"
    echo ""
    cat "$SUMMARY_FILE"
    echo ""
    echo "</details>"
  } >> "$GITHUB_STEP_SUMMARY"
fi

{
  echo ""
  echo "📥 [Download all reports as artifacts](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID})"
} >> "$GITHUB_STEP_SUMMARY"
