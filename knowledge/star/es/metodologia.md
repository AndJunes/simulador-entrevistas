---
title: "Método STAR para respuestas a preguntas conductuales"
interview_type: star
language: es
doc_kind: metodologia
competency: [star_situation, star_task, star_action, star_result, relevance, conciseness]
sources: [K01, K02, K09, K10, K11, K18, K36]
---

## Qué es una pregunta conductual y para qué sirve STAR

Las preguntas conductuales piden algo que hiciste de verdad, por ejemplo:
- "Cuéntame de una vez en que…"
- "Dame un ejemplo de…"
- "Describe una situación en la que…"

Se basan en la premisa de que la conducta pasada en circunstancias parecidas es el mejor predictor de la conducta futura en el trabajo [K10]. La guía de entrevistas estructuradas de Google hace la misma distinción [K09]:
- Las **conductuales** preguntan por logros pasados.
- Las **hipotéticas** ("¿Qué harías si…?") plantean un escenario del puesto.

STAR entrega las tres piezas de información que, según la OPM de EE. UU., una pregunta estructurada debe obtener [K10]:
- el contexto (situación o tarea);
- lo que efectivamente se hizo (acción);
- la consecuencia (resultado).

## Los cuatro componentes

**Situación**
- Solo el contexto necesario para entender el ejemplo: cuándo, dónde y quiénes [K01][K02].
- No hace falta contar todos los detalles [K01].

**Tarea**
- El objetivo o la responsabilidad que tenías, dicho en pocas palabras [K01][K02].
- Que quede explícito tu rol. Así se separa "el problema del equipo" de "mi parte en él".

**Acción**
- Lo que hiciste **tú** y qué habilidades o rasgos muestra, según lo que apunta la pregunta [K01].
- El MIT CAPD la llama la parte más larga, la que responde directamente la pregunta [K02].
- Usa "yo" para tu aporte, aunque el trabajo haya sido en equipo, para que el entrevistador pueda evaluarte [K01][K02].

**Resultado**
- Qué salió de tus acciones [K01].
- Cuantifícalo cuando puedas. Si dudas entre dos historias, elige la que tenga resultados más concretos y medibles [K02].
- Opcional: qué aprendiste [K01].

## Reparto del tiempo y duración

El MIT CAPD propone un reparto aproximado. Aclara que es una guía, no una regla exacta [K01]:

| Parte | Proporción | En una respuesta de 75 s |
|---|---|---|
| Situación | ~20 % | ~15 s |
| Tarea | ~10 % | ~8 s |
| Acción | ~60 % | ~45 s |
| Resultado | ~10 % | ~8 s |

**Duración total**
- Un instructivo de CUNY dice que una historia STAR debería durar unos 2 minutos, y que hay que practicarla en voz alta para no pasarse [K18].
- El objetivo de la preparación del usuario es **60–90 s**. ⚠ sin fuente — heurística: no se encontró una fuente externa para 60–90 s en particular. Entra dentro del techo de ~2 minutos de [K18] y sirve para un screening de 15 minutos con varias preguntas.

La distorsión más común es una Situación larga y una Acción corta. El simulador debe marcar las respuestas donde el contexto ocupa más tiempo que lo que hizo el candidato.

## Repreguntas que puede usar el entrevistador

Las entrevistas estructuradas suelen planificar repreguntas por componente. Ejemplos de la OPM [K10]:
- **Situación/Tarea:** ¿Quiénes participaban? ¿Qué llevó a esa situación?
- **Acción:** ¿Cómo respondiste? ¿Cuál fue tu rol?
- **Resultado:** ¿Cuál fue el resultado? ¿Harías algo distinto?

La pregunta conductual de ejemplo de Google trae tres repreguntas planificadas [K09]:
- tu objetivo y por qué;
- cómo reaccionó el equipo;
- los próximos pasos.

Una respuesta STAR completa se adelanta a la mayoría de estas repreguntas. Si falta un componente, ya se sabe cuál será la próxima repregunta. El simulador puede usarlo para generar repreguntas realistas.

## Armar un banco de historias

- Prepara 3 a 5 historias antes de la entrevista [K01].
- Una misma experiencia sirve para varias preguntas conductuales distintas [K02]. Por ejemplo, un buen bug en producción cubre resolución de problemas, ownership, presión y aprendizaje.
- Elige historias que coincidan con las competencias del puesto. El MIT sugiere cruzar el aviso con tu CV [K02]. Para un desarrollador backend, las tareas centrales de O*NET dan temas [K11]:
  - analizar requisitos;
  - acordar interfaces y rendimiento con otros ingenieros;
  - modificar software para corregir errores o mejorar el rendimiento;
  - testing.
- Practica las historias en voz alta [K02]. En un estudio con 213 candidatos, quienes asistieron a coaching y se prepararon (por ejemplo, con role-play) dieron respuestas mejor organizadas, y esa organización se asoció a un mejor desempeño en la entrevista [K36].
- No memorices guiones palabra por palabra. El MIT advierte que las historias memorizadas restan flexibilidad y pueden sonar artificiales [K01].

## Preguntas cerradas o de "sí o no"

Algunas preguntas suenan cerradas ("¿Alguna vez lideraste un equipo?"). El MIT recomienda el enfoque "sí, y…": responder y después dar un ejemplo [K01]. El instructivo de CUNY dice lo mismo: una pregunta cerrada es una oportunidad para contar una historia STAR, no para quedarse en "sí" [K18].

## Honestidad y coherencia

- Cuenta lo que pasó de verdad, con tus conductas y emociones reales [K01].
- Exagerar puede sonar poco sincero, y puede no coincidir con tu CV ni con lo que digan tus referencias [K01].
- En el simulador, el criterio `cv_consistency` contrasta la historia con el CV del candidato: fechas, roles, tecnologías y escala.
