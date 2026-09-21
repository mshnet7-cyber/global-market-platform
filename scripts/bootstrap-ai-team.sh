#!/bin/sh
set -eu

echo "AI Engineering Team bootstrap"
echo "Platform: Global Market Platform"
echo "Workstation: Mac Studio / Apple Silicon"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required" >&2
  exit 1
fi

npm ci
npm run ai:team
