"""
generar_datos.py — Datos simulados de ASTRA-FIT.

Genera los mismos datos en dos formatos:
  - local/datos-ejemplo.json  → lo usa el servidor local (simula el Sheet)
  - local/csv/<Pestaña>.csv   → para importar al Google Sheet BD_ASTRA-FIT

Escenarios (documento ASTRA-FIT):
  AST-001  rendimiento estable
  AST-002  pérdida progresiva de fuerza (intervención en la semana 10)
  AST-003  alteración de simetría y coordinación

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
GRUPOS = {
    "cuadriceps": "Cuádriceps",
    "gluteo_mayor": "Glúteo mayor",
    "gastrocnemio_soleo": "Gastrocnemio y sóleo",
    "erectores_espinales": "Erectores espinales",
    "dorsal_ancho": "Dorsal ancho",
}
EJERCICIOS = {  # valor: (etiqueta, músculos, código corto, carga base kg, fuerza base N)
    "sentadilla":        ("Sentadilla",            ["cuadriceps", "gluteo_mayor"], "SENT", 80, 1500),
    "peso_muerto":       ("Peso muerto",           ["erectores_espinales"],        "PMUE", 90, 1700),
    "elevacion_talones": ("Elevación de talones",  ["gastrocnemio_soleo"],         "TALO", 60, 1100),
    "remo_sentado":      ("Remo sentado",          ["dorsal_ancho"],               "REMO", 45, 700),
}
catalogos = []
for v, e in GRUPOS.items():
    catalogos.append({"lista": "grupo_muscular", "valor": v, "etiqueta": e, "musculos": ""})
for v, (e, m, *_ ) in EJERCICIOS.items():
    catalogos.append({"lista": "ejercicio", "valor": v, "etiqueta": e, "musculos": ",".join(m)})
for v, e in [("basal", "Basal"), ("mision", "Misión"), ("post_entrenamiento", "Post-entrenamiento"), ("post_vuelo", "Post-vuelo")]:
    catalogos.append({"lista": "fase", "valor": v, "etiqueta": e, "musculos": ""})
for v, e in [("izquierdo", "Izquierdo"), ("derecho", "Derecho")]:
    catalogos.append({"lista": "lado", "valor": v, "etiqueta": e, "musculos": ""})
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
ESCALA = {"AST-001": 0.92, "AST-002": 1.12, "AST-003": 0.85}  # fuerza relativa de cada astronauta

RMS_BASE = {"cuadriceps": 220, "gluteo_mayor": 160, "gastrocnemio_soleo": 190, "erectores_espinales": 140, "dorsal_ancho": 170}
FMED_BASE = {"cuadriceps": 82, "gluteo_mayor": 76, "gastrocnemio_soleo": 90, "erectores_espinales": 70, "dorsal_ancho": 78}
PIERNAS = {"sentadilla", "elevacion_talones"}


def factor_fuerza(escenario, ejercicio, w):
    """Fracción de la fuerza basal en la semana w (0 = basal)."""
    if escenario == "estable":
        return 1 - 0.003 * w
    if escenario == "perdida_fuerza":
        caida = 0.021 if ejercicio in PIERNAS else 0.008
        if w <= 10:
            return 1 - caida * w
        return 1 - caida * 10 + 0.035 * (w - 10)  # recupera tras la intervención
    return 1 - 0.004 * w  # asimetria: la fuerza total casi no cambia


def fase_de(escenario, w):
    if w == 0:
        return "basal"
    if escenario == "perdida_fuerza" and w > 10:
        return "post_entrenamiento"
    return "mision"


# ----------------------------------------------------------------- Sesiones + EMG
sesiones, emg = [], []
for a in astronautas:
    aid, esc, k = a["id_astronauta"], a["escenario"], ESCALA[a["id_astronauta"]]
    for w in range(0, SEMANAS + 1):
        f = INICIO_MISION - timedelta(days=7) if w == 0 else INICIO_MISION + timedelta(days=7 * w)
        for ej, (_, musculos, cod, carga, fuerza) in EJERCICIOS.items():
            fac = factor_fuerza(esc, ej, w)
            ruido = rng.normal(0, 0.012)
            simetria = 98.2 + rng.normal(0, 0.5)
            if esc == "asimetria":
                simetria = 98.2 - 1.2 * w + rng.normal(0, 0.6)
            elif esc == "perdida_fuerza":
                simetria = 97.8 - 0.15 * w + rng.normal(0, 0.5)
            id_sesion = f"SES-{aid.replace('-', '')}-{f.strftime('%Y%m%d')}-{cod}"
            sesiones.append({
                "id_sesion": id_sesion, "id_astronauta": aid, "fecha": f.isoformat(), "semana_mision": w,
                "fase": fase_de(esc, w), "ejercicio": ej, "carga_kg": round(carga * k / 5) * 5, "repeticiones": 8,
                "fuerza_pico_n": r(fuerza * k * (fac + ruido), 0),
                "velocidad_media_ms": r(0.72 * (fac + rng.normal(0, 0.015)), 2),
                "rom_grados": r(96 * (1 - (0.004 * w if esc == "perdida_fuerza" and w <= 10 else 0)) + rng.normal(0, 1), 0),
                "simetria_pct": r(min(simetria, 99.9), 1),
                "rpe": int(np.clip(round(6 + (0.25 * w if esc == "perdida_fuerza" and w <= 10 else 0) + rng.normal(0, 0.5)), 1, 10)),
                "notas": "", "registrado_por": "simulador", "registrado_en": f"{f.isoformat()} 09:00",
            })
            for m in musculos:
                for lado in ("izquierdo", "derecho"):
                    rms_fac, fmed_fac = 1.0, 1.0
                    if esc == "perdida_fuerza" and ej in PIERNAS:
                        ww = min(w, 10) - (0.6 * (w - 10) if w > 10 else 0)
                        rms_fac, fmed_fac = 1 - 0.012 * ww, 1 - 0.019 * ww
                    elif esc == "asimetria" and lado == "izquierdo":
                        rms_fac = 1 - 0.022 * w
                    elif esc == "estable":
                        fmed_fac = 1 - 0.002 * w
                    rms = RMS_BASE[m] * rms_fac * (1 + rng.normal(0, 0.02))
                    emg.append({
                        "id_sesion": id_sesion, "id_astronauta": aid, "grupo_muscular": m, "lado": lado,
                        "rms_uv": r(rms, 1), "frec_mediana_hz": r(FMED_BASE[m] * fmed_fac * (1 + rng.normal(0, 0.015)), 1),
                        "amplitud_pico_uv": r(rms * 3.0 * (1 + rng.normal(0, 0.03)), 0),
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
umbrales = [
    dict(indicador="fuerza_pico_n", nombre_visible="Fuerza pico", unidad="N", tabla="Sesiones", modo="pct_vs_basal", malo_si="baja", amarillo=-10, rojo=-20,
         explicacion="Fuerza máxima producida en el ejercicio, medida con el sensor de fuerza.",
         recomendacion_amarillo="Repetir la medición en la próxima sesión y aumentar la carga de resistencia según el protocolo.",
         recomendacion_rojo="Notificar al médico de vuelo y revisar el plan de contramedidas.", fuente="Por validar"),
    dict(indicador="velocidad_media_ms", nombre_visible="Velocidad de ejecución", unidad="m/s", tabla="Sesiones", modo="pct_vs_basal", malo_si="baja", amarillo=-10, rojo=-20,
         explicacion="Velocidad media del movimiento medida con la IMU. Cae con la fatiga y la pérdida de potencia.",
         recomendacion_amarillo="Añadir trabajo de potencia con cargas moderadas.",
         recomendacion_rojo="Reducir la carga y reevaluar en 48 horas.", fuente="Por validar"),
    dict(indicador="simetria_pct", nombre_visible="Simetría", unidad="%", tabla="Sesiones", modo="absoluto", malo_si="baja", amarillo=90, rojo=85,
         explicacion="Qué tan parecido trabajan los dos lados del cuerpo. 100 % = lados iguales.",
         recomendacion_amarillo="Añadir ejercicios unilaterales para el lado más débil.",
         recomendacion_rojo="Revisar la técnica con el equipo en tierra y notificar al médico de vuelo.", fuente="Por validar"),
    dict(indicador="frec_mediana_hz", nombre_visible="Frecuencia mediana EMG", unidad="Hz", tabla="EMG", modo="pct_vs_basal", malo_si="baja", amarillo=-10, rojo=-20,
         explicacion="Frecuencia central de la señal EMG. Su caída es un marcador clásico de fatiga muscular.",
         recomendacion_amarillo="Priorizar recuperación: sueño, hidratación y menor volumen por 48 horas.",
         recomendacion_rojo="Suspender la carga máxima y reevaluar. Notificar al médico de vuelo.", fuente="Por validar"),
    dict(indicador="rms_uv", nombre_visible="Activación muscular (RMS)", unidad="µV", tabla="EMG", modo="pct_vs_basal", malo_si="baja", amarillo=-10, rojo=-20,
         explicacion="Amplitud de la actividad eléctrica del músculo durante el ejercicio.",
         recomendacion_amarillo="Vigilar en las próximas sesiones y comparar con el otro lado.",
         recomendacion_rojo="Revisar colocación del sensor y reevaluar; si persiste, notificar.", fuente="Por validar"),
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

# ----------------------------------------------------------------- Alertas (las que habría escrito Apps Script)
alertas = []
ses_df = pd.DataFrame(sesiones)
for a in astronautas:
    aid = a["id_astronauta"]
    for ej in EJERCICIOS:
        sub = ses_df[(ses_df.id_astronauta == aid) & (ses_df.ejercicio == ej)].sort_values("semana_mision")
        base = sub[sub.fase == "basal"]
        nivel_prev = {}
        for _, s in sub[sub.fase != "basal"].iterrows():
            for u in [u for u in umbrales if u["tabla"] == "Sesiones"]:
                ind = u["indicador"]
                val, bas = s[ind], base[ind].mean()
                m = (val / bas - 1) * 100 if u["modo"] == "pct_vs_basal" else val
                malo = (lambda x, t: x <= t) if u["malo_si"] == "baja" else (lambda x, t: x >= t)
                nivel = "rojo" if malo(m, u["rojo"]) else "amarillo" if malo(m, u["amarillo"]) else "verde"
                orden = {"verde": 0, "amarillo": 1, "rojo": 2}
                if orden[nivel] > orden[nivel_prev.get(ind, "verde")]:
                    alertas.append({
                        "id_alerta": f"ALR-{len(alertas) + 1:04d}", "creada_en": f"{s.fecha} 09:05", "id_astronauta": aid,
                        "origen": s.id_sesion, "grupo_muscular": EJERCICIOS[ej][1][0], "indicador": ind,
                        "valor_actual": r(val, 2), "valor_basal": r(bas, 2), "cambio_pct": r((val / bas - 1) * 100, 1),
                        "nivel": nivel,
                        "mensaje": f"{u['nombre_visible']} en {EJERCICIOS[ej][0].lower()}: "
                                   f"{abs((val / bas - 1) * 100):.0f} % {'por debajo' if val < bas else 'por encima'} de la basal",
                        "recomendacion": u["recomendacion_" + nivel], "estado": "abierta", "atendida_por": "", "nota_cierre": "",
                    })
                nivel_prev[ind] = nivel

# las alertas viejas de nivel amarillo que luego escalaron se marcan en seguimiento
for al in alertas:
    if al["nivel"] == "amarillo" and any(o["id_astronauta"] == al["id_astronauta"] and o["origen"].split("-")[-1] == al["origen"].split("-")[-1]
                                         and o["indicador"] == al["indicador"] and o["nivel"] == "rojo" for o in alertas):
        al["estado"] = "en_seguimiento"

# ----------------------------------------------------------------- Intervenciones
roj = next((x for x in alertas if x["id_astronauta"] == "AST-002" and x["nivel"] == "rojo"), None)
intervenciones = [{
    "id_intervencion": "INT-0001", "fecha": (INICIO_MISION + timedelta(days=71)).isoformat(), "id_astronauta": "AST-002",
    "id_alerta": roj["id_alerta"] if roj else "", "tipo": "ajuste_carga",
    "descripcion": "Subir la carga de sentadilla 10 % y añadir 3 series de elevación de talones por sesión.",
    "responsable": "Médico de vuelo", "fecha_reevaluacion": (INICIO_MISION + timedelta(days=84)).isoformat(), "resultado": "mejoro",
}]

# ----------------------------------------------------------------- Exportar
BD = {
    "Astronautas": astronautas, "Catalogos": catalogos, "Sesiones": sesiones, "EMG": emg,
    "Seguimiento": seguimiento, "Umbrales": umbrales, "Alertas": alertas, "Intervenciones": intervenciones,
}
(AQUI / "datos-ejemplo.json").write_text(json.dumps(BD, ensure_ascii=False, indent=1), encoding="utf-8")
(AQUI / "csv").mkdir(exist_ok=True)
for nombre, filas in BD.items():
    pd.DataFrame(filas).to_csv(AQUI / "csv" / f"{nombre}.csv", index=False, encoding="utf-8")
    print(f"{nombre:<15} {len(filas):>5} filas")
