#!/usr/bin/env bash
set -euo pipefail

# Guard critical runtime/build files against known forbidden Microsoft domains.
forbidden_regex='(vscode-cdn\.net|code\.visualstudio\.com|dc\.services\.visualstudio\.com|vortex\.data\.microsoft\.com|mobile\.events\.data\.microsoft\.com|browser\.events\.data\.microsoft\.com)'

files=(
  "product.json"
  "src/vs/workbench/contrib/webview/common/webview.ts"
  "src/vs/workbench/services/environment/browser/environmentService.ts"
  "src/vs/server/node/webClientServer.ts"
  "build/gulpfile.vscode.ts"
  "build/gulpfile.vscode.web.ts"
  "build/gulpfile.extensions.ts"
)

hits=0
for file in "${files[@]}"; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  if grep -nE "$forbidden_regex" "$file" >/tmp/shadowcode_forbidden_hits.txt; then
    echo "Forbidden domain reference found in $file:"
    cat /tmp/shadowcode_forbidden_hits.txt
    echo
    hits=$((hits + 1))
  fi
done

rm -f /tmp/shadowcode_forbidden_hits.txt

if [[ "$hits" -gt 0 ]]; then
  echo "Forbidden domain check failed with $hits file(s) containing blocked domains."
  exit 1
fi

echo "Forbidden domain check passed."
