---
title: "Rúbrica de preguntas técnicas — criterios con descriptores 1–5"
interview_type: technical
language: es
doc_kind: rubrica
competency: [technical_correctness, reasoning, edge_cases_failures, testing_validation, security_permissions, tradeoffs_operability, clarity_structure, directness, clarifies_assumptions, uncertainty_transparency]
sources: [K09, K37, K38, K40, K42]
---

## Cómo usar esta rúbrica

Para preguntas de conocimiento técnico, debugging y diseño contestadas en voz alta (no código escrito: eso es la rúbrica de ejercicio).

**Reglas:**
- Cada criterio se puntúa de 1 a 5 contra descriptores fijos ("benchmarks of proficiency"), igual para todas las respuestas, y se cita el fragmento de la transcripción [K40].
- La OPM usa una escala de niveles de dominio de 1 a 5 por competencia, y recomienda pesos iguales salvo una justificación documentada [K42]. Acá todos los criterios aplicables pesan lo mismo.
- Un criterio que **no aplica** a la pregunta (por ejemplo, seguridad en una pregunta sin datos ni permisos) se marca como no aplicable: no se puntúa ni entra en promedios.

**Escala anclada** (la misma para todos los criterios):

| Puntaje | Ancla |
|---|---|
| 1 — Insuficiente | No responde al objetivo, tiene errores centrales o no presenta evidencia. |
| 2 — Débil | Parte de la idea es correcta, pero faltan elementos importantes y hay poca evidencia. |
| 3 — Competente | Correcta para el nivel del puesto, con razonamiento y evidencia suficientes. |
| 4 — Fuerte | Explica decisiones, trade-offs, validación y límites con claridad. |
| 5 — Excelente | Rigurosa, específica y bien priorizada. Anticipa fallos relevantes sin sobreingeniería. |

⚠ sin fuente — heurística: los descriptores de cada criterio son una síntesis propia sobre la escala anterior. No son una rúbrica publicada.

**Lo que NO se puntúa:** acento, velocidad al hablar, seguridad aparente o longitud. La comunicación se evalúa por claridad y eficacia, no por sonar nativo.

**Experiencia vs. conocimiento.** Explicar bien un concepto no prueba haberlo usado en producción. El evaluador reporta aparte el nivel de evidencia: profesional, proyecto, académico/hackathon o teórico.

## technical_correctness

¿Lo que dice es técnicamente correcto para el nivel del puesto?

| Puntaje | Descriptor |
|---|---|
| 1 | Error central (por ejemplo, "async hace más rápido el código que usa CPU"), o no aborda la parte técnica. |
| 2 | Correcto en lo general, con imprecisiones que cambiarían la implementación. |
| 3 | Correcto para el nivel. Sin errores que cambien la solución. |
| 4 | Correcto y preciso. Usa los términos justos y distingue conceptos cercanos (concurrencia vs. paralelismo, threads vs. asyncio). |
| 5 | Como el 4, y señala dónde la regla general no aplica. |

## reasoning

¿Muestra cómo llega a la respuesta? En entrevistas técnicas, pensar en voz alta y mostrar cómo se encararía el problema es lo que se evalúa [K37].

| Puntaje | Descriptor |
|---|---|
| 1 | Da una conclusión sin razonamiento, o enumera tecnologías sin explicar el flujo. |
| 2 | Razonamiento parcial: salta pasos o no conecta causa y efecto. |
| 3 | Razonamiento claro de punta a punta para el caso principal. |
| 4 | Razonamiento claro y ordenado, con hipótesis que se descartan con evidencia. |
| 5 | Como el 4, y prioriza: dice qué haría primero y por qué. |

## edge_cases_failures

¿Considera fallos, casos límite y degradación?

| Puntaje | Descriptor |
|---|---|
| 1 | Solo el camino feliz. |
| 2 | Menciona que algo puede fallar, sin decir qué ni cómo se maneja. |
| 3 | Identifica los fallos principales (timeout, error parcial, duplicados) y cómo los maneja. |
| 4 | Fallos principales + estrategia concreta (reintentos con límite, idempotencia, timeouts, rollback). |
| 5 | Como el 4, priorizando los fallos más probables o costosos sin sobreingeniería. |

## testing_validation

¿Cómo sabría que funciona? ¿Cómo lo verificaría o lo probaría?

| Puntaje | Descriptor |
|---|---|
| 1 | No menciona cómo verificarlo. |
| 2 | "Le haría tests", sin decir cuáles ni qué cubren. |
| 3 | Tests concretos para el caso principal y al menos un caso de error. |
| 4 | Distingue unitarios e integración, aísla dependencias externas solo donde conviene y cubre fallos. |
| 5 | Como el 4, más verificación en uso real (métricas, logs, trazas) o una prueba de regresión. |

## security_permissions

Solo aplica si la pregunta involucra datos de usuarios, permisos, secretos o entradas no confiables.

| Puntaje | Descriptor |
|---|---|
| 1 | Ignora un riesgo evidente (datos de otro usuario, secretos en código, entrada sin validar). |
| 2 | Menciona "seguridad" sin un control concreto. |
| 3 | Nombra el control principal (autorización por recurso, validación de entrada, manejo de secretos). |
| 4 | Controles concretos y dónde aplicarlos en el flujo. |
| 5 | Como el 4, y cómo verificaría que el control funciona. |

## tradeoffs_operability

¿Compara alternativas y piensa en operar el sistema (costo, latencia, monitoreo)?

| Puntaje | Descriptor |
|---|---|
| 1 | Una sola opción, sin alternativas ni costos. |
| 2 | Menciona alternativas sin criterio para elegir. |
| 3 | Elige con un criterio razonable (simplicidad, costo, latencia). |
| 4 | Compara al menos dos opciones con criterios explícitos y dice qué mediría para operarlo. |
| 5 | Como el 4, y dice cuándo cambiaría de decisión (escala, costo, equipo). |

## clarity_structure

¿Se entiende al escucharla una vez? ¿Tiene un orden?

| Puntaje | Descriptor |
|---|---|
| 1 | Desordenada: no se puede seguir. |
| 2 | Se entiende con esfuerzo. Saltos de tema. |
| 3 | Orden reconocible, con algún desvío. |
| 4 | Estructura clara (enfoque → pasos → riesgos), fácil de seguir. |
| 5 | Como el 4, y anticipa la estructura al empezar ("lo veo en tres partes…"). |

## directness

¿Responde lo que se preguntó, sin rodeos?

| Puntaje | Descriptor |
|---|---|
| 1 | No responde la pregunta. |
| 2 | Responde de costado o tarde. |
| 3 | Responde, con algo de relleno. |
| 4 | Responde directamente desde el principio. |
| 5 | Responde directamente y cierra conectando con lo que se preguntó. |

## clarifies_assumptions

Pedir aclaraciones muestra pensamiento crítico [K38]. Aplica cuando la pregunta deja datos abiertos (volumen, restricciones, contexto).

| Puntaje | Descriptor |
|---|---|
| 1 | Asume datos clave sin decirlo y la respuesta depende de ellos. |
| 2 | Asume en silencio, aunque la respuesta sigue siendo razonable. |
| 3 | Dice al menos un supuesto importante. |
| 4 | Explicita los supuestos clave, o pregunta por ellos antes de avanzar. |
| 5 | Como el 4, y explica cómo cambiaría la solución si el supuesto fuera otro. |

## uncertainty_transparency

¿Es honesto sobre lo que no sabe o no usó? No terminar en "no sé": mostrar cómo lo resolvería [K37].

| Puntaje | Descriptor |
|---|---|
| 1 | Inventa o afirma con seguridad algo incorrecto, o se corta en "no sé". |
| 2 | Duda sin decirlo y mezcla lo que sabe con lo que supone. |
| 3 | Distingue lo que sabe de lo que supone. |
| 4 | Admite el límite y dice cómo lo averiguaría o lo probaría. |
| 5 | Como el 4, y conecta con la experiencia real más cercana sin exagerarla. |
