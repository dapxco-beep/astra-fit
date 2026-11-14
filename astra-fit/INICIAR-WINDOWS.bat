@echo off
REM Doble clic en Windows: arranca ASTRA-FIT en http://localhost:3000 y abre el navegador.
cd /d "%~dp0"
where node >nul 2>nul || (echo Falta instalar Node.js: https://nodejs.org & pause & exit /b 1)
start "" "http://localhost:3000"
node local\server.js
