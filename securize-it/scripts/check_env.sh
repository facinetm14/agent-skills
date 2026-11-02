#!/usr/bin/env bash
# check_env.sh — report which security tools are available and how to get them.
# Read-only. Safe to run anywhere.
set -uo pipefail

echo "securize-it — tool environment check"
echo "======================================"

check() {
  local name="$1" hint="$2"
  if command -v "$name" >/dev/null 2>&1; then
    printf "  [ok]      %-14s %s\n" "$name" "$(command -v "$name")"
  else
    printf "  [missing] %-14s -> %s\n" "$name" "$hint"
  fi
}

echo
echo "Web / API:"
check nmap        "apt install nmap"
check httpx       "go install github.com/projectdiscovery/httpx/cmd/httpx@latest"
check subfinder   "go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest"
check nuclei      "go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"
check ffuf        "go install github.com/ffuf/ffuf/v2@latest"
check testssl.sh  "git clone https://github.com/drwetter/testssl.sh"
check zap-baseline.py "docker pull ghcr.io/zaproxy/zaproxy  (or install ZAP)"
check sqlmap      "apt install sqlmap  (use only when authorized)"
check jwt_tool    "pip install jwt-tool  /  github.com/ticarpi/jwt_tool"

echo
echo "Mobile (Android):"
check apktool     "apt install apktool"
check jadx        "apt install jadx  /  github.com/skylot/jadx"
check adb         "apt install android-tools-adb"
check frida       "pip install frida-tools"

echo
echo "Mobile (iOS):"
check otool       "install Xcode command line tools (macOS)"
check class-dump  "brew install class-dump (macOS)"

echo
echo "Both / static:"
check semgrep     "pip install semgrep"
check docker      "needed for MobSF: docker run -it -p 8000:8000 opensecurity/mobile-security-framework-mobsf"

echo
echo "Note: MobSF runs as a container/web app rather than a CLI; the mobile"
echo "playbooks drive it through its web UI or REST API."
