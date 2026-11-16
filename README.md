# MYOCARE — NASA Space Apps 2026 (Health Monitoring Software)

**App publicada: https://myocare.dapxco.workers.dev**

Muscle Yield Observation, Conditioning and Risk Evaluation: tablero para seguir la condición muscular de la tripulación en órbita, en la Luna y en Marte. Datos simulados; no es un dispositivo médico.

## Cómo correr y desplegar
- Local: `node astra-fit/local/server.js` y abrir http://localhost:3000 (sin instalar nada).
- Prueba de humo: `npm install` una vez y luego `node scripts/humo.js <url>`.
- Desplegar: **solo una persona**, desde `main` actualizado: `node scripts/desplegar.js`.
- Créditos, licencias y limitaciones: `CREDITOS.md`.

## Enlaces del proyecto
- Reto: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- Carpeta del equipo (Drive): https://drive.google.com/drive/folders/1SjwAuZbkyUXW7poqai0lWqigpzFFlfJI?hl=es

## Estructura
- `docs/reto/`   — descripción oficial del reto, criterios, fechas, recursos de datos
- `docs/equipo/` — notas, decisiones, reparto de tareas
- `assets/`      — recursos de la interfaz
- `*.html`, `server.js` — prototipos actuales (anatomía 3D, astrafit, etc.)

## Reglas para no pisarnos (carpeta compartida)
Antes de editar un archivo, anotarlo en `docs/equipo/NOTAS.md`.
