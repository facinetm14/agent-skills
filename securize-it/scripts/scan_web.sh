#!/usr/bin/env bash
# scan_web.sh — automated SAFE baseline for one authorized web target.
# Runs the passive/baseline tier only: ZAP baseline, nuclei, testssl.
# DRY-RUN by default; pass --go to execute. Active/intrusive scanning is NOT
# here by design — enable it deliberately per your scope file's
# allowed_aggression, not from a convenience script.
#
# Usage: scan_web.sh <url> [--go] [--out DIR]
set -uo pipefail

TARGET="${1:-}"
GO=0
OUT="scan-out"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --go) GO=1 ;;
    --out) shift; OUT="${1:-scan-out}" ;;
  esac
  shift || true
done

if [ -z "$TARGET" ]; then
  echo "usage: scan_web.sh <url> [--go] [--out DIR]" >&2
  exit 2
fi

HOST="$(echo "$TARGET" | sed -E 's#^https?://##; s#/.*$##')"

run() {
  if [ "$GO" -eq 1 ]; then echo "+ $*"; "$@"; else echo "    $*"; fi
}

if [ "$GO" -eq 0 ]; then
  echo "DRY-RUN — safe baseline scan commands for $TARGET (pass --go to run):"
  echo "Verify $TARGET is in scope, and that you're within the allowed window."
  echo
else
  mkdir -p "$OUT"
  echo "Baseline scan of $TARGET -> $OUT/"
fi

echo "[1] ZAP baseline (passive spider + passive checks — non-intrusive)"
run zap-baseline.py -t "$TARGET" -r "$OUT/zap-baseline.html" -J "$OUT/zap-baseline.json"

echo "[2] nuclei (CVEs, misconfig, exposures — low-noise templates)"
run nuclei -u "$TARGET" -severity low,medium,high,critical -o "$OUT/nuclei.txt"

echo "[3] testssl.sh (TLS / crypto posture)"
run testssl.sh --quiet --jsonfile "$OUT/testssl.json" "$HOST"

echo
echo "Baseline done. The scanners cover the mechanical bugs. Now do the"
echo "logic-level manual testing from references/web_api.md section 4:"
echo "authorization matrix, IDOR/BOLA on every object id, multi-step flow abuse."
echo "Record confirmed issues with templates/finding.md."
