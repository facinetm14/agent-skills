#!/usr/bin/env bash
# recon.sh — passive/light web recon against ONE authorized target.
# DRY-RUN by default: prints the commands it would run. Pass --go to execute.
#
# Usage:
#   recon.sh <url-or-host> [--go] [--out DIR]
#
# This script is intentionally non-aggressive (enumeration, fingerprinting).
# It must only be pointed at a target listed in your scope file. The dry-run
# default exists so you can review exactly what will touch the target before
# anything does.
set -uo pipefail

TARGET="${1:-}"
GO=0
OUT="recon-out"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --go) GO=1 ;;
    --out) shift; OUT="${1:-recon-out}" ;;
  esac
  shift || true
done

if [ -z "$TARGET" ]; then
  echo "usage: recon.sh <url-or-host> [--go] [--out DIR]" >&2
  exit 2
fi

HOST="$(echo "$TARGET" | sed -E 's#^https?://##; s#/.*$##')"

run() {
  if [ "$GO" -eq 1 ]; then
    echo "+ $*"
    "$@"
  else
    echo "    $*"
  fi
}

if [ "$GO" -eq 0 ]; then
  echo "DRY-RUN — commands that WOULD run against $TARGET (pass --go to execute):"
  echo "Confirm this target is in your scope file first."
  echo
else
  mkdir -p "$OUT"
  echo "Running recon against $TARGET -> $OUT/"
fi

echo "[1] Subdomain enumeration"
run subfinder -d "$HOST" -silent -o "$OUT/subdomains.txt"

echo "[2] Live host / tech fingerprint"
run httpx -u "$TARGET" -title -tech-detect -status-code -o "$OUT/httpx.txt"

echo "[3] Port/service scan (light, top ports)"
run nmap -sV -T3 --top-ports 100 "$HOST" -oN "$OUT/nmap.txt"

echo "[4] Content discovery"
run ffuf -u "${TARGET%/}/FUZZ" -w /usr/share/wordlists/dirb/common.txt -o "$OUT/ffuf.json" -of json

echo
echo "Next: feed discovered hosts/endpoints into scan_web.sh and the manual"
echo "checklist in references/web_api.md. Mind the rate limits in your scope file."
