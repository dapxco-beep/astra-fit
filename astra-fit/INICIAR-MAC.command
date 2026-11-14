#!/bin/bash
# Doble clic en Mac: arranca ASTRA-FIT en http://localhost:3000 y abre el navegador.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Falta instalar Node.js: https://nodejs.org"; read -r; exit 1; fi
(sleep 1 && open "http://localhost:3000") &
node local/server.js
