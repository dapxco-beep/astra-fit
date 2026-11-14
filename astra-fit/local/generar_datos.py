"""
generar_datos.py — Datos simulados de ASTRA-FIT.

Genera los mismos datos en dos formatos:
  - local/datos-ejemplo.json  → lo usa el servidor local (simula el Sheet)
  - publicar/hojas-csv/<Pestaña>.csv   → para importar al Google Sheet BD_ASTRA-FIT

Escenarios (documento ASTRA-FIT):
  AST-001  rendimiento estable
  AST-002  pérdida progresiva de fuerza (intervención en la semana 10)
  AST-003  alteración de simetría y coordinación

Escala ERDM-A (documento ASTRA-FIT, pestaña ESCALA): 6 grupos musculares, 5 dimensiones por músculo
(fuerza, coordinación, circunferencia, EMG y VO2pico), cada una de 0 a 2 puntos frente a la basal.
Evaluación basal antes del vuelo y seguimiento cada dos semanas. EMG y coordinación salen del sensor
(pestaña Monitoreo); fuerza, circunferencia y VO2pico se registran a mano.

Uso:  python3 local/generar_datos.py
"""
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

AQUI = Path(__file__).parent
rng = np.random.default_rng(2026)

INICIO_MISION = date(2026, 8, 17)   # día 0 de misión
SEMANAS = 12                         # evaluaciones semanales 1..12
HOY = date(2026, 11, 14)


def r(x, d=1):
    return None if x is None else round(float(x), d)


# ----------------------------------------------------------------- Catalogos
GRUPOS = {  # los 6 grupos de la escala ERDM-A
    "soleo": "Sóleo",
    "gastrocnemio": "Gastrocnemio",
    "cuadriceps": "Cuádriceps",
    "biceps_braquial": "Bíceps braquial",
    "triceps_braquial": "Tríceps braquial",
    "flexores_antebrazo": "Flexores del antebrazo",
}
PIERNAS = {"soleo", "gastrocnemio", "cuadriceps"}
TAREAS = {  # tarea estandarizada que se monitorea con el sensor (documento, 6.2, riesgo bajo)
    "elevacion_talones_flexionadas": ("Elevación de talones con rodillas flexionadas", "soleo"),
    "elevacion_talones_extendidas": ("Elevación de talones con rodillas extendidas", "gastrocnemio"),
    "extension_rodilla": ("Extensión de rodilla", "cuadriceps"),
    "curl_biceps": ("Curl de bíceps", "biceps_braquial"),
    "extension_codo": ("Extensión de codo", "triceps_braquial"),
    "prension_manual": ("Prensión manual", "flexores_antebrazo"),
}
TAREA_DE = {m: t for t, (_, m) in TAREAS.items()}
catalogos = []
for v, e in GRUPOS.items():
    catalogos.append({"lista": "grupo_muscular", "valor": v, "etiqueta": e, "musculos": ""})
for v, (e, m) in TAREAS.items():
    catalogos.append({"lista": "tarea", "valor": v, "etiqueta": e, "musculos": m})
for v, e in [("basal", "Basal"), ("mision", "Misión"), ("post_entrenamiento", "Post-entrenamiento"), ("post_vuelo", "Post-vuelo")]:
    catalogos.append({"lista": "fase", "valor": v, "etiqueta": e, "musculos": ""})
for v, e in [("orbita", "Estación en órbita baja"), ("luna", "Base lunar"), ("marte", "Base en Marte")]:
    catalogos.append({"lista": "entorno", "valor": v, "etiqueta": e, "musculos": ""})
for v, e in [("bajo", "Riesgo bajo"), ("moderado", "Riesgo moderado"), ("alto", "Riesgo alto")]:
    catalogos.append({"lista": "riesgo", "valor": v, "etiqueta": e, "musculos": ""})
for v, e in [("ajuste_carga", "Ajuste de carga"), ("recuperacion", "Recuperación"), ("nutricion", "Nutrición"),
             ("reevaluacion", "Reevaluación"), ("valoracion_medica", "Valoración médica")]:
    catalogos.append({"lista": "tipo_intervencion", "valor": v, "etiqueta": e, "musculos": ""})

# ----------------------------------------------------------------- Astronautas
astronautas = [
    {"id_astronauta": "AST-001", "nombre": "Julia", "sexo": "F", "edad": 41, "peso_kg": 63.5, "talla_cm": 168,
     "mano_dominante": "derecha", "rol": "Comandante", "fecha_inicio_mision": INICIO_MISION.isoformat(),
     "escenario": "estable", "activo": "SI"},
    {"id_astronauta": "AST-002", "nombre": "Rogelio", "sexo": "M", "edad": 45, "peso_kg": 79.0, "talla_cm": 178,
     "mano_dominante": "derecha", "rol": "Ingeniero de vuelo", "fecha_inicio_mision": INICIO_MISION.isoformat(),
     "escenario": "perdida_fuerza", "activo": "SI"},
    {"id_astronauta": "AST-003", "nombre": "Amara", "sexo": "F", "edad": 38, "peso_kg": 58.0, "talla_cm": 164,
     "mano_dominante": "izquierda", "rol": "Especialista de misión", "fecha_inicio_mision": INICIO_MISION.isoformat(),
     "escenario": "asimetria", "activo": "SI"},
]
# Campos de perfil agregados el 14-nov: emoji, entorno y fechas de registro/actualización
REGISTRO = (INICIO_MISION - timedelta(days=30)).isoformat() + " 09:00"
EXTRA = {
    "AST-001": {"emoji": "\U0001F469\u200D\U0001F680", "entorno": "orbita"},
    "AST-002": {"emoji": "\U0001F468\U0001F3FD\u200D\U0001F680", "entorno": "orbita"},
    "AST-003": {"emoji": "\U0001F469\U0001F3FE\u200D\U0001F680", "entorno": "luna"},
}
for a in astronautas:
    a.update(EXTRA[a["id_astronauta"]])
    a.update({"registrado_en": REGISTRO, "actualizado_en": REGISTRO,
              "peso_actualizado_en": REGISTRO, "talla_actualizada_en": REGISTRO})

ESCALA = {"AST-001": 0.92, "AST-002": 1.12, "AST-003": 0.85}  # fuerza relativa de cada astronauta

# ----------------------------------------------------------------- Escala ERDM-A (pestaña EscalaERDM)
FUENTE_ERDM = "Documento ASTRA-FIT, escala ERDM-A (propuesta del equipo, no validada)"
escala = [
    dict(dimension="fuerza", nombre_visible="Fuerza muscular", metodo="Dinamometría", unidad="kg", campo="fuerza_kg",
         calculo="perdida", moderado_desde=0, alto_desde=10, prioritaria_desde=20,
         explicacion="Pérdida (%) = (basal − actual) / basal × 100. Leve: sin pérdida. Moderado: más de 0 % y hasta 10 %. Alto: más de 10 %.",
         fuente=FUENTE_ERDM),
    dict(dimension="coordinacion", nombre_visible="Coordinación muscular", metodo="IMU (coeficiente de variación entre repeticiones)", unidad="% CV", campo="coordinacion_cv_pct",
         calculo="aumento", moderado_desde=10, alto_desde=20, prioritaria_desde="",
         explicacion="Cambio del CV frente a la basal. Más variabilidad = menos control. Leve: menos de 10 %. Moderado: 10–20 %. Alto: más de 20 %.",
         fuente=FUENTE_ERDM),
    dict(dimension="circunferencia", nombre_visible="Circunferencia muscular", metodo="Cinta métrica", unidad="cm", campo="circunferencia_cm",
         calculo="perdida", moderado_desde=5, alto_desde=10, prioritaria_desde=15,
         explicacion="Pérdida (%) frente a la basal. Leve: menos de 5 %. Moderado: 5–10 %. Alto: más de 10 %.",
         fuente=FUENTE_ERDM),
    dict(dimension="emg", nombre_visible="Función neuromuscular", metodo="Electromiografía (RMS y frecuencia mediana)", unidad="%", campo="emg_rms_uv,emg_frec_mediana_hz",
         calculo="cambio_absoluto", moderado_desde=10, alto_desde=20, prioritaria_desde="",
         explicacion="Se toma el mayor cambio, en valor absoluto, entre RMS y frecuencia mediana. Leve: menos de 10 %. Moderado: 10–20 %. Alto: más de 20 %.",
         fuente=FUENTE_ERDM),
    dict(dimension="vo2pico", nombre_visible="Capacidad funcional", metodo="VO2pico", unidad="mL/kg/min", campo="vo2pico_ml_kg_min",
         calculo="perdida", moderado_desde=5, alto_desde=10, prioritaria_desde="",
         explicacion="Indicador sistémico: el mismo valor cuenta para los 6 músculos. Leve: menos de 5 %. Moderado: 5–10 %. Alto: más de 10 %.",
         fuente=FUENTE_ERDM),
    dict(dimension="total", nombre_visible="Puntaje ERDM-A", metodo="Suma de las 5 dimensiones", unidad="de 10", campo="puntaje_erdm",
         calculo="suma", moderado_desde=4, alto_desde=7, prioritaria_desde="",
         explicacion="0–3 riesgo bajo, 4–6 riesgo moderado, 7–10 riesgo alto. Aquí moderado_desde y alto_desde son puntajes mínimos.",
         fuente=FUENTE_ERDM),
]
ESC = {e["dimension"]: e for e in escala}


def puntos(dim, cambio):
    """Puntaje 0, 1 o 2 de una dimensión. cambio en %, positivo = empeora."""
    if cambio is None:
        return None
    e = ESC[dim]
    if cambio > e["alto_desde"]:
        return 2
    if (cambio > 0) if e["moderado_desde"] == 0 else (cambio >= e["moderado_desde"]):
        return 1
    return 0


def riesgo_de(total):
    return "alto" if total >= ESC["total"]["alto_desde"] else "moderado" if total >= ESC["total"]["moderado_desde"] else "bajo"


# ----------------------------------------------------------------- Plan de fortalecimiento (documento, sección 6)
DOSIS = {
    "bajo": "2–3 sesiones por semana, 2–3 series de 10–15 repeticiones.",
    "moderado": "3 sesiones por semana, 2–3 series de 8–12 repeticiones. Reevaluar con más frecuencia.",
    "alto": "Valoración individualizada antes de intensificar. Empezar con 2–3 series de 8–10 repeticiones con carga baja, bajo supervisión.",
}
EJERCICIO_PLAN = {
    "soleo": ("Elevación de talones con rodillas flexionadas", "Flexión plantar sentado con resistencia progresiva", "Flexión plantar aislada con carga baja y progresión supervisada"),
    "gastrocnemio": ("Elevación de talones con rodillas extendidas", "Flexión plantar de pie con resistencia", "Flexión plantar controlada con carga baja y progresión supervisada"),
    "cuadriceps": ("Sentadillas y extensión de rodilla", "Extensión de rodilla con resistencia y sentadillas asistidas", "Extensión de rodilla aislada con carga baja y progresión supervisada"),
    "biceps_braquial": ("Curl de bíceps", "Curl con bandas o resistencia progresiva", "Curl aislado con carga baja y control del movimiento"),
    "triceps_braquial": ("Extensión de codo y ejercicios de empuje adaptados", "Extensión de tríceps con bandas", "Extensión aislada de codo con carga baja y progresión supervisada"),
    "flexores_antebrazo": ("Prensión manual y ejercicios de agarre", "Flexión de muñeca con resistencia", "Prensión de baja intensidad y flexión de muñeca controlada"),
}
plan = []
for m, ejs in EJERCICIO_PLAN.items():
    for riesgo, ej in zip(("bajo", "moderado", "alto"), ejs):
        plan.append({"grupo_muscular": m, "riesgo": riesgo, "ejercicio": ej, "dosificacion": DOSIS[riesgo],
                     "fuente": "Documento ASTRA-FIT, ERDM-A sección 6"})
PLAN = {(p["grupo_muscular"], p["riesgo"]): p for p in plan}

# ----------------------------------------------------------------- Valores basales por astronauta y músculo
FUERZA_BASE = {"soleo": 60, "gastrocnemio": 65, "cuadriceps": 48, "biceps_braquial": 24, "triceps_braquial": 20}  # kg, dinamometría
AGARRE = {"AST-001": 34, "AST-002": 48, "AST-003": 31}                                                           # flexores = agarre
CIRC_BASE = {
    "AST-001": {"soleo": 30.5, "gastrocnemio": 36.5, "cuadriceps": 54.0, "biceps_braquial": 28.5, "triceps_braquial": 27.5, "flexores_antebrazo": 24.0},
    "AST-002": {"soleo": 33.0, "gastrocnemio": 39.0, "cuadriceps": 58.0, "biceps_braquial": 34.0, "triceps_braquial": 32.5, "flexores_antebrazo": 28.5},
    "AST-003": {"soleo": 29.5, "gastrocnemio": 35.0, "cuadriceps": 52.0, "biceps_braquial": 27.0, "triceps_braquial": 26.0, "flexores_antebrazo": 23.0},
}
CV_BASE = {"soleo": 7.5, "gastrocnemio": 7.0, "cuadriceps": 6.5, "biceps_braquial": 6.0, "triceps_braquial": 6.5, "flexores_antebrazo": 8.0}  # %
RMS_BASE = {"soleo": 180, "gastrocnemio": 200, "cuadriceps": 220, "biceps_braquial": 260, "triceps_braquial": 230, "flexores_antebrazo": 190}  # µV
FMED_BASE = {"soleo": 85, "gastrocnemio": 92, "cuadriceps": 82, "biceps_braquial": 75, "triceps_braquial": 78, "flexores_antebrazo": 88}   # Hz
ROM_BASE = {"soleo": 35, "gastrocnemio": 40, "cuadriceps": 90, "biceps_braquial": 130, "triceps_braquial": 120, "flexores_antebrazo": 70}   # grados
VO2_BASE = {"AST-001": 40.0, "AST-002": 45.0, "AST-003": 42.0}                                                    # mL/kg/min


def factores(esc, m, w):
    """Fracción del valor basal de cada variable en la semana w (0 = basal). Pierna = sóleo, gastrocnemio, cuádriceps."""
    p = m in PIERNAS
    if esc == "estable":
        return dict(fuerza=1 - 0.0015 * w, circ=1 - 0.001 * w, cv=1 + 0.004 * w, rms=1.0, fmed=1 - 0.003 * w, vo2=1 - 0.002 * w)
    if esc == "perdida_fuerza":
        ww = min(w, 10)
        rec = max(w - 10, 0)  # semanas después de la intervención
        if p:
            return dict(fuerza=1 - 0.019 * ww + 0.035 * rec, circ=1 - 0.0085 * ww + 0.005 * rec, cv=1 + 0.017 * ww - 0.03 * rec,
                        rms=1 - 0.012 * ww + 0.02 * rec, fmed=1 - 0.021 * ww + 0.035 * rec, vo2=1 - 0.008 * ww + 0.01 * rec)
        return dict(fuerza=1 - 0.008 * ww + 0.02 * rec, circ=1 - 0.004 * ww, cv=1 + 0.006 * ww, rms=1 - 0.005 * ww,
                    fmed=1 - 0.009 * ww + 0.01 * rec, vo2=1 - 0.008 * ww + 0.01 * rec)
    # asimetria: la coordinación es lo que más cambia
    return dict(fuerza=1 - 0.004 * w, circ=1 - 0.002 * w, cv=1 + (0.03 if p else 0.018) * w,
                rms=1 - (0.016 if p else 0.009) * w, fmed=1 - 0.002 * w, vo2=1 - 0.003 * w)


def fase_de(esc, w):
    if w == 0:
        return "basal"
    if esc == "perdida_fuerza" and w > 10:
        return "post_entrenamiento"
    return "mision"


SEMANAS_EVAL = [0, 2, 4, 6, 8, 10, 12]   # basal (antes del vuelo) y cada dos semanas


def cambio(dim, actual, basal):
    """Cambio en %, positivo = empeora, según el cálculo de la dimensión."""
    if actual is None or basal in (None, 0):
        return None
    calc = ESC[dim]["calculo"]
    if calc == "perdida":
        return (basal - actual) / basal * 100
    if calc == "aumento":
        return (actual - basal) / basal * 100
    return None


evaluaciones, monitoreo = [], []
for a in astronautas:
    aid, esc, k = a["id_astronauta"], a["escenario"], ESCALA[a["id_astronauta"]]
    basales = {}
    for w in SEMANAS_EVAL:
        f = INICIO_MISION - timedelta(days=7) if w == 0 else INICIO_MISION + timedelta(days=7 * w)
        vo2 = r(VO2_BASE[aid] * factores(esc, "cuadriceps", w)["vo2"] * (1 + rng.normal(0, 0.008)), 1)
        for i, m in enumerate(GRUPOS):
            fc = factores(esc, m, w)
            fuerza0 = AGARRE[aid] if m == "flexores_antebrazo" else FUERZA_BASE[m] * k
            fila = {
                "id_evaluacion": f"EVA-{aid.replace('-', '')}-{f.strftime('%Y%m%d')}-{m}", "id_astronauta": aid,
                "fecha": f.isoformat(), "fase": fase_de(esc, w), "grupo_muscular": m,
                "fuerza_kg": r(fuerza0 * fc["fuerza"] * (1 + rng.normal(0, 0.008)), 1),
                "circunferencia_cm": r(CIRC_BASE[aid][m] * fc["circ"] * (1 + rng.normal(0, 0.002)), 1),
                "coordinacion_cv_pct": r(CV_BASE[m] * fc["cv"] * (1 + rng.normal(0, 0.025)), 1),
                "emg_rms_uv": r(RMS_BASE[m] * fc["rms"] * (1 + rng.normal(0, 0.015)), 1),
                "emg_frec_mediana_hz": r(FMED_BASE[m] * fc["fmed"] * (1 + rng.normal(0, 0.01)), 1),
                "vo2pico_ml_kg_min": vo2,
            }
            if w == 0:
                basales[m] = fila
            b = basales[m]
            ce = None if w == 0 else max(abs(fila["emg_rms_uv"] / b["emg_rms_uv"] - 1), abs(fila["emg_frec_mediana_hz"] / b["emg_frec_mediana_hz"] - 1)) * 100
            cambios = {
                "fuerza": None if w == 0 else cambio("fuerza", fila["fuerza_kg"], b["fuerza_kg"]),
                "coordinacion": None if w == 0 else cambio("coordinacion", fila["coordinacion_cv_pct"], b["coordinacion_cv_pct"]),
                "circunferencia": None if w == 0 else cambio("circunferencia", fila["circunferencia_cm"], b["circunferencia_cm"]),
                "emg": ce,
                "vo2pico": None if w == 0 else cambio("vo2pico", fila["vo2pico_ml_kg_min"], b["vo2pico_ml_kg_min"]),
            }
            pts = {d: (0 if w == 0 else puntos(d, c)) for d, c in cambios.items()}
            total = sum(pts.values())
            prior = w > 0 and ((cambios["fuerza"] or 0) > ESC["fuerza"]["prioritaria_desde"] or (cambios["circunferencia"] or 0) > ESC["circunferencia"]["prioritaria_desde"])
            fila.update({
                "cambio_fuerza_pct": r(cambios["fuerza"], 1), "cambio_coordinacion_pct": r(cambios["coordinacion"], 1),
                "cambio_circunferencia_pct": r(cambios["circunferencia"], 1), "cambio_emg_pct": r(cambios["emg"], 1),
                "cambio_vo2_pct": r(cambios["vo2pico"], 1),
                "p_fuerza": pts["fuerza"], "p_coordinacion": pts["coordinacion"], "p_circunferencia": pts["circunferencia"],
                "p_emg": pts["emg"], "p_vo2": pts["vo2pico"], "puntaje_erdm": total, "riesgo": riesgo_de(total),
                "alerta_prioritaria": "SI" if prior else "NO",
                "registrado_por": "simulador", "registrado_en": f"{f.isoformat()} 10:30", "actualizado_en": f"{f.isoformat()} 10:30",
            })
            evaluaciones.append(fila)

            # Medición del sensor que produjo el EMG y la coordinación de esa evaluación
            hora = f"{9 + (i * 8) // 60:02d}:{(i * 8) % 60:02d}"
            monitoreo.append({
                "id_medicion": f"MON-{aid.replace('-', '')}-{f.strftime('%Y%m%d')}-{m}", "id_astronauta": aid,
                "fecha": f.isoformat(), "hora": hora, "fase": fila["fase"], "grupo_muscular": m, "tarea": TAREA_DE[m],
                "duracion_s": 10, "repeticiones": 6,
                "emg_rms_uv": fila["emg_rms_uv"], "emg_frec_mediana_hz": fila["emg_frec_mediana_hz"],
                "emg_amplitud_pico_uv": r(fila["emg_rms_uv"] * 3.1 * (1 + rng.normal(0, 0.03)), 0),
                "activacion_pct": r(fila["emg_rms_uv"] / b["emg_rms_uv"] * 100, 0),
                "velocidad_ms": r(0.8 * fc["fuerza"] ** 0.8 * (1 + rng.normal(0, 0.02)), 2),
                "rom_grados": r(ROM_BASE[m] * (1 - (1 - fc["fuerza"]) * 0.3) * (1 + rng.normal(0, 0.01)), 0),
                "coordinacion_cv_pct": fila["coordinacion_cv_pct"],
                "fatiga_pct": r(max(0.5, 4 + (1 - fc["fmed"]) * 40 + rng.normal(0, 1)), 1),
                "bateria_pct": int(98 - w * 1.5 - i), "calidad_senal": "Excelente" if rng.random() > 0.15 else "Buena",
                "origen": "simulador", "registrado_en": f"{f.isoformat()} {hora}",
            })

# ----------------------------------------------------------------- Seguimiento (diario)
BASE_SEG = {
    "AST-001": dict(agarre_kg=34, pantorrilla_cm=36.5, muslo_cm=54, masa_kg=63.5),
    "AST-002": dict(agarre_kg=48, pantorrilla_cm=39.0, muslo_cm=58, masa_kg=79.0),
    "AST-003": dict(agarre_kg=31, pantorrilla_cm=35.0, muslo_cm=52, masa_kg=58.0),
}
DERIVA_DIA = {  # cambio proporcional por día de misión
    "AST-001": dict(agarre_kg=-0.0002, pantorrilla_cm=-0.0001, muslo_cm=-0.0001, masa_kg=-0.00005),
    "AST-002": dict(agarre_kg=-0.0011, pantorrilla_cm=-0.0008, muslo_cm=-0.0006, masa_kg=-0.0004),
    "AST-003": dict(agarre_kg=-0.0004, pantorrilla_cm=-0.0003, muslo_cm=-0.0002, masa_kg=-0.0001),
}
seguimiento = []
for a in astronautas:
    aid = a["id_astronauta"]
    d = INICIO_MISION - timedelta(days=6)
    while d <= HOY:
        dm = (d - INICIO_MISION).days
        t = max(dm, 0)
        fila = {"id_astronauta": aid, "fecha": d.isoformat(), "dia_mision": dm, "fase": "basal" if dm < 0 else "mision"}
        for c, base in BASE_SEG[aid].items():
            medir = c in ("agarre_kg", "masa_kg") or dm % 3 == 0 or dm < 0
            ruido = {"agarre_kg": 0.015, "pantorrilla_cm": 0.004, "muslo_cm": 0.004, "masa_kg": 0.003}[c]
            fila[c] = r(base * (1 + DERIVA_DIA[aid][c] * t) * (1 + rng.normal(0, ruido)), 1) if medir else None
        bajo = aid == "AST-002" and dm > 55
        fila["min_resistencia"] = int(np.clip(rng.normal(45 if bajo else 60, 6), 0, 120))
        fila["min_cardio"] = int(np.clip(rng.normal(20 if bajo else 30, 4), 0, 90))
        fila["min_cinta"] = int(np.clip(rng.normal(25 if bajo else 30, 4), 0, 90))
        fila["carga_resistencia_kg"] = r(80 * ESCALA[aid] * (1 - (0.1 if bajo else 0)), 0)
        fila["proteina_g"] = int(rng.normal(105 if aid != "AST-002" else 95, 8))
        fila["calcio_mg"] = int(rng.normal(1000, 80))
        fila["vitamina_d_ui"] = 800
        dolor = 1.2 + rng.normal(0, 0.7)
        if aid == "AST-003":
            dolor += 0.045 * t
        fila["dolor_lumbar"] = int(np.clip(round(dolor), 0, 10))
        fila.update({"notas": "", "registrado_por": "simulador", "registrado_en": f"{d.isoformat()} 07:30"})
        seguimiento.append(fila)
        d += timedelta(days=1)

# ----------------------------------------------------------------- Umbrales (ilustrativos)
umbrales = [  # solo seguimiento diario; las evaluaciones por músculo usan la pestaña EscalaERDM
    dict(indicador="agarre_kg", nombre_visible="Fuerza de agarre", unidad="kg", tabla="Seguimiento", modo="pct_vs_basal", malo_si="baja", amarillo=-5, rojo=-10,
         explicacion="Dinamometría manual, mejor de 3 intentos con la mano dominante.",
         recomendacion_amarillo="Añadir trabajo de tracción y agarre.",
         recomendacion_rojo="Notificar al médico de vuelo.", fuente="Por validar"),
    dict(indicador="pantorrilla_cm", nombre_visible="Circunferencia de pantorrilla", unidad="cm", tabla="Seguimiento", modo="pct_vs_basal", malo_si="baja", amarillo=-3, rojo=-6,
         explicacion="Perímetro en el punto más ancho. Refleja la masa de los músculos antigravitatorios.",
         recomendacion_amarillo="Priorizar elevación de talones con carga.",
         recomendacion_rojo="Notificar al médico de vuelo para ajustar el plan de ejercicio.", fuente="Por validar"),
    dict(indicador="muslo_cm", nombre_visible="Circunferencia de muslo", unidad="cm", tabla="Seguimiento", modo="pct_vs_basal", malo_si="baja", amarillo=-3, rojo=-6,
         explicacion="Perímetro a media distancia entre cadera y rodilla.",
         recomendacion_amarillo="Aumentar la carga de sentadilla.",
         recomendacion_rojo="Notificar al médico de vuelo.", fuente="Por validar"),
    dict(indicador="dolor_lumbar", nombre_visible="Dolor lumbar", unidad="de 10", tabla="Seguimiento", modo="absoluto", malo_si="sube", amarillo=4, rojo=7,
         explicacion="Valoración del dolor al despertar, de 0 a 10.",
         recomendacion_amarillo="Rutina de estiramientos y evitar flexión con carga.",
         recomendacion_rojo="Suspender carga axial y notificar al médico de vuelo.", fuente="Por validar"),
]

# ----------------------------------------------------------------- Alertas (las que habría escrito la app)
# Una alerta cuando el riesgo ERDM-A de un músculo sube (bajo → moderado → alto) o aparece una alerta prioritaria.
NIVEL = {"bajo": "verde", "moderado": "amarillo", "alto": "rojo"}
ORDEN = {"bajo": 0, "moderado": 1, "alto": 2}
NOMBRE_DIM = [("fuerza", "cambio_fuerza_pct", "fuerza", -1), ("coordinacion", "cambio_coordinacion_pct", "coordinación", 1),
              ("circunferencia", "cambio_circunferencia_pct", "circunferencia", -1), ("emg", "cambio_emg_pct", "EMG", 1),
              ("vo2pico", "cambio_vo2_pct", "VO₂pico", -1)]


def resumen_cambios(e):
    partes = []
    for _, col, nombre, signo in NOMBRE_DIM:
        v = e[col]
        if v is None:
            continue
        if col == "cambio_emg_pct":
            partes.append(f"{nombre} cambió {v:.0f} %")
        else:
            val = signo * v
            partes.append(f"{nombre} {'−' if val < 0 else '+'}{abs(val):.0f} %")
    return ", ".join(partes)


alertas = []
ev_df = pd.DataFrame(evaluaciones)
for a in astronautas:
    for m in GRUPOS:
        previo, prior_previo = "bajo", False
        sub = ev_df[(ev_df.id_astronauta == a["id_astronauta"]) & (ev_df.grupo_muscular == m)].sort_values("fecha")
        for _, e in sub.iterrows():
            if e.fase == "basal":
                continue
            prior = e.alerta_prioritaria == "SI"
            sube = ORDEN[e.riesgo] > ORDEN[previo]
            if sube or (prior and not prior_previo):
                nivel = "rojo" if prior else NIVEL[e.riesgo]
                p = PLAN[(m, e.riesgo)]
                alertas.append({
                    "id_alerta": f"ALR-{len(alertas) + 1:04d}", "creada_en": f"{e.fecha} 10:35", "id_astronauta": e.id_astronauta,
                    "origen": e.id_evaluacion, "grupo_muscular": m, "indicador": "puntaje_erdm",
                    "valor_actual": int(e.puntaje_erdm), "valor_basal": 0, "cambio_pct": None, "nivel": nivel,
                    "mensaje": f"{GRUPOS[m]}: riesgo {e.riesgo} en la ERDM-A ({int(e.puntaje_erdm)} de 10)"
                               + (". Alerta prioritaria" if prior else "") + f". {resumen_cambios(e)[:1].upper() + resumen_cambios(e)[1:]}.",
                    "recomendacion": f"{p['ejercicio']}. {p['dosificacion']}",
                    "estado": "abierta", "atendida_por": "", "nota_cierre": "",
                })
            previo = e.riesgo if ORDEN[e.riesgo] > ORDEN[previo] else previo
            prior_previo = prior_previo or prior

# las amarillas que después escalaron a rojo quedan en seguimiento
for al in alertas:
    if al["nivel"] == "amarillo" and any(o["id_astronauta"] == al["id_astronauta"] and o["grupo_muscular"] == al["grupo_muscular"]
                                         and o["nivel"] == "rojo" for o in alertas):
        al["estado"] = "en_seguimiento"

# ----------------------------------------------------------------- Intervenciones
roj = next((x for x in alertas if x["id_astronauta"] == "AST-002" and x["nivel"] == "rojo"), None)
intervenciones = [{
    "id_intervencion": "INT-0001", "fecha": (INICIO_MISION + timedelta(days=71)).isoformat(), "id_astronauta": "AST-002",
    "id_alerta": roj["id_alerta"] if roj else "", "tipo": "ajuste_carga",
    "descripcion": "Plan de riesgo alto para piernas: flexión plantar y extensión de rodilla con carga baja, progresión supervisada, 3 sesiones por semana.",
    "responsable": "Médico de vuelo", "fecha_reevaluacion": (INICIO_MISION + timedelta(days=84)).isoformat(), "resultado": "mejoro",
}]

# ----------------------------------------------------------------- Exportar
BD = {
    "Astronautas": astronautas, "Catalogos": catalogos, "Evaluaciones": evaluaciones, "Monitoreo": monitoreo,
    "EscalaERDM": escala, "PlanFortalecimiento": plan, "Seguimiento": seguimiento, "Umbrales": umbrales,
    "Alertas": alertas, "Intervenciones": intervenciones,
}
(AQUI / "datos-ejemplo.json").write_text(json.dumps(BD, ensure_ascii=False, indent=1), encoding="utf-8")
CSV = AQUI.parent / "publicar" / "hojas-csv"
CSV.mkdir(parents=True, exist_ok=True)
for nombre, filas in BD.items():
    pd.DataFrame(filas).to_csv(CSV / f"{nombre}.csv", index=False, encoding="utf-8")
    print(f"{nombre:<15} {len(filas):>5} filas")
