# Pendientes del documento "ASTRA-FIT" (Drive)

Revisión del 14-nov-2026. Marcar con [x] lo que se vaya resolviendo.
Documento: https://docs.google.com/document/d/1XQ6PV023wvNEetous8dRfMAo_1oPe-6Gh7xj7CbIM0E/edit

## Se puede hacer ya

- [ ] Corregir la errata "hombros <34 cm" por "hombres <34 cm" (circunferencia de pantorrilla).
- [ ] Quitar "Ejercicios aeróbicos????" o convertirlo en una frase (en "Riesgo de disminución de la capacidad cardiorrespiratoria y musculoesquelética").
- [ ] Actualizar la sección 4 "Tecnologías": la app es HTML + JavaScript + Google Sheets sobre Apps Script, no Python/Streamlit/SQLite.
- [ ] Actualizar la Fase 5: la base de datos es un Sheet con 8 pestañas (Astronautas, Catalogos, Sesiones, EMG, Seguimiento, Umbrales, Alertas, Intervenciones), no CSV.
- [ ] Citar la fuente de la sección "Riesgos" (NASA HRP, https://www.nasa.gov/hrp/risks/) y reducirla a los riesgos que ASTRA-FIT aborda: musculoesquelético, cardiorrespiratorio y sensoriomotor.
- [ ] Rellenar "Activación muscular" en la evaluación basal simulada (hoy está vacío).
- [ ] Reemplazar los 5 marcadores [image] rotos (IMC y otros).
- [ ] Agregar apartado de limitaciones: datos simulados, no es dispositivo médico, las alertas son de seguimiento.
- [ ] Agregar créditos de los modelos 3D: BodyParts3D © DBCLS (CC BY 4.0) y Xbot de los ejemplos de three.js.
- [ ] Explicar dónde se usa la "correlación de Pearson" o quitarla.

## Esperando respuesta del equipo

- [x] Grupos musculares: la app ya usa los 5 de la Fase 2 (catálogo y panel). Solo el modelo 3D junta erectores y dorsal en una malla. Falta aclararlo en el documento.
- [ ] "Músculos a evaluar" lista solo cuádriceps y gastrocnemio: ¿se amplía a los cinco de la Fase 2?
- [ ] Fuerza de agarre: el documento dice <10 % / >10 % de pérdida; la app usa −5 % (amarillo) y −10 % (rojo). Elegir una.
- [ ] Todos los umbrales de la pestaña Umbrales dicen "Por validar": poner la fuente (NASA, literatura) de cada uno.
- [ ] Tabla única de umbrales verde/amarillo/rojo por indicador (EMG 10 y 20 %, fuerza de agarre 10 %, espirometría 5 y 10 %) y que coincida con la pestaña Umbrales del Sheet.
- [ ] Responder las 4 preguntas finales del reto (qué se mide en el espacio, por qué un examen, cómo afectan los riesgos, qué acciones previenen una condición crítica).
- [ ] Cerrar el flujo de intervención: cómo se mide que la intervención funcionó (pestaña Intervenciones).
- [ ] Qué se puede medir de verdad en la Estación Espacial (dinamómetro sí; ecografía depende del equipo).
- [ ] Plan de demo y video (figura en entregables, sin plan).
- [ ] Pegar el texto oficial del reto en `docs/reto/reto.md` para contrastar el documento con los criterios.
