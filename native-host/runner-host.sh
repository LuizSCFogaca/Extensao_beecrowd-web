#!/usr/bin/env bash
# Beecrowd Companion Native Runner Host Wrapper for Linux / macOS

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Se o Node.js não estiver no PATH global (ex: instalado via nvm), tenta carregar
if ! command -v node >/dev/null 2>&1; then
  [ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc" >/dev/null 2>&1
  [ -f "$HOME/.profile" ] && source "$HOME/.profile" >/dev/null 2>&1
fi

exec node "$DIR/runner-host.js" "$@"
