#!/usr/bin/env bash
# Script para registrar o Native Messaging Host no Linux (Chrome, Chromium, Firefox, Brave)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "======================================================"
echo "   Instalando Beecrowd Companion Native Host (Linux)"
echo "======================================================"

node "$DIR/native-host/install.js" "$@"
