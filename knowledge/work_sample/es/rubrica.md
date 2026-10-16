---
title: "Rúbrica de ejercicios prácticos (work sample) — criterios con descriptores 1–5"
interview_type: work_sample
language: es
doc_kind: rubrica
competency: [approach, technical_correctness, edge_cases_failures, testing_validation, tradeoffs_operability, written_communication]
sources: [K37, K38, K41, K42]
---

## Cómo usar esta rúbrica

Para ejercicios escritos parecidos al trabajo real: un endpoint, un esquema y su query, una migración, un test o un mensaje al cliente. Los work samples reproducen tareas idénticas o muy parecidas a las del puesto, y se puntúan observando el desempeño o midiendo el resultado de la tarea [K41].

**Reglas:**
- Cada criterio aplicable se puntúa de 1 a 5, con la escala anclada de la rúbrica técnica, y pesa lo mismo [K42]. Un criterio que no aplica (por ejemplo, tests en un mensaje al cliente) no se puntúa.
- **No hay una única solución correcta.** Si la alternativa es válida y está justificada, se acepta aunque difiera de la referencia.
- **El código no se ejecuta.** Se evalúa leyéndolo: si algo no compilaría o fallaría, se señala la línea y el porqué.
- Pedir aclaraciones antes de empezar suma: muestra pensamiento crítico [K38]. Las preguntas y los supuestos de la persona se consideran parte de la respuesta.

⚠ sin fuente — heurística: los descriptores son una síntesis propia.

## approach

¿El enfoque resuelve el problema planteado y está explicado?

| Puntaje | Descriptor |
|---|---|
| 1 | No resuelve lo pedido, o no se entiende el enfoque. |
| 2 | Resuelve parte, con un enfoque que no escala al caso pedido. |
| 3 | Resuelve lo pedido con un enfoque razonable y explicado brevemente. |
| 4 | Enfoque claro y justificado. Explicita los supuestos y las aclaraciones pedidas. |
| 5 | Como el 4, y prioriza bien: entrega lo esencial primero y deja anotado lo que haría después. |

## technical_correctness

¿El código, la query o el plan son correctos?

| Puntaje | Descriptor |
|---|---|
| 1 | Errores que impiden que funcione (sintaxis, lógica central, API inexistente). |
| 2 | Funcionaría en el caso feliz, con errores que aparecen enseguida. |
| 3 | Correcto para el caso pedido, con detalles menores. |
| 4 | Correcto, idiomático y consistente (tipos, status codes, transacciones donde corresponden). |
| 5 | Como el 4, y simple: sin código innecesario. |

## edge_cases_failures

¿Maneja errores, entradas inválidas, duplicados o concurrencia cuando importan?

| Puntaje | Descriptor |
|---|---|
| 1 | Sin manejo de errores. |
| 2 | Manejo genérico (un `try/except` que traga todo). |
| 3 | Maneja los errores principales con respuestas adecuadas. |
| 4 | Errores principales + validación de entrada + un caso límite relevante (duplicado, timeout, recurso inexistente). |
| 5 | Como el 4, priorizado, sin sobreingeniería. |

## testing_validation

¿Incluye o describe cómo probarlo?

| Puntaje | Descriptor |
|---|---|
| 1 | Sin tests ni plan de prueba. |
| 2 | Un test que solo cubre el caso feliz, o "lo probaría a mano". |
| 3 | Test del caso principal y de un error. |
| 4 | Tests con dependencias externas aisladas donde conviene y casos de error relevantes. |
| 5 | Como el 4, más una prueba de regresión del problema planteado. |

## tradeoffs_operability

¿Dice qué decidió y qué dejó afuera, y cómo se operaría?

| Puntaje | Descriptor |
|---|---|
| 1 | No menciona decisiones. |
| 2 | Menciona una decisión sin justificar. |
| 3 | Justifica la decisión principal. |
| 4 | Compara con una alternativa y dice qué mediría en producción. |
| 5 | Como el 4, y dice el límite de la solución y cuándo la cambiaría. |

## written_communication

¿Se entiende lo que escribió? Para mensajes al cliente: claridad, transparencia, opciones, riesgos y próximo paso.

| Puntaje | Descriptor |
|---|---|
| 1 | No se entiende, o al cliente le oculta el problema. |
| 2 | Se entiende con esfuerzo. Falta información clave (qué pasó, qué sigue). |
| 3 | Claro, con la información principal. |
| 4 | Claro y breve: estado, causa, opciones con impacto y próximo paso con fecha. |
| 5 | Como el 4, con un tono que genera confianza sin minimizar el riesgo. |
