@echo off
REM Arranca el servidor local de ASTRA-FIT y abre la pagina en el navegador.
REM Hace falta porque el navegador no deja cargar los modelos 3D (.glb) con doble clic (file://).
cd /d "%~dp0"
start "" "http://localhost:8080/astrafit-claro.html"
node server.js
