#!/bin/sh
set -eu
[ $# -eq 1 ] && printf '%s' "$1" | grep -Eq '^[0-9]+$' || { echo "usage: $0 <new version number>" >&2; exit 1; }
cd "$(dirname "$0")/.."
git ls-files -co --exclude-standard -z -- '*.html' '*.js' '*.mjs' '*.css' \
  | xargs -0 sed -i.bak -E "s/\?v=[0-9]+/?v=$1/g"
find . -name '*.bak' -not -path './.git/*' -not -path './.superpowers/*' -delete
