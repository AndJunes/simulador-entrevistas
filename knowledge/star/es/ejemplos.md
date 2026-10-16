---
title: "Ejemplos STAR — fuerte vs débil (ilustrativos, backend junior)"
interview_type: star
language: es
doc_kind: ejemplos
competency: [star_situation, star_task, star_action, star_result, relevance, conciseness, job_alignment, cv_consistency]
sources: [K01, K02, K10, K11, K18]
---

## Sobre estos ejemplos

**ILUSTRATIVOS — ejemplos inventados.** El candidato, la empresa, el sistema y los números son ficticios. Modelan a un backend junior genérico. No salen del CV de ninguna persona real.

Todos responden la misma pregunta:

> "Cuéntame de una vez en que resolviste un bug difícil en producción."

La pregunta apunta a la tarea de O*NET de modificar software para corregir errores [K11].

El conteo de palabras sirve para estimar la duración. ⚠ sin fuente — heurística: unas 130–150 palabras por minuto.

## Ejemplo fuerte (ILUSTRATIVO)

> **[S]** "El año pasado trabajaba en la API de pedidos de una startup de delivery, un servicio en Node.js con Postgres. Un viernes, soporte reportó que a algunos clientes se les cobraba dos veces.
>
> **[T]** Esa semana estaba de guardia, así que me tocaba encontrar la causa y frenar los cobros duplicados sin tirar el checkout.
>
> **[A]** Primero revisé los logs de pagos y vi que los duplicados llegaban de a pares, con pocos cientos de milisegundos de diferencia, y siempre desde clientes móviles con mala conexión. Mi hipótesis fue que la app reintentaba la petición después de un timeout y que nuestro endpoint no era idempotente. Lo reproduje en local agregando latencia artificial. Después agregué una clave de idempotencia: el cliente manda un ID único por intento de pago y la API lo guarda con una restricción única, así que un reintento devuelve el resultado original en lugar de cobrar otra vez. Escribí un test de integración para el caso de reintento y le pedí a un compañero senior que revisara el cambio antes de subirlo.
>
> **[R]** Después del deploy, los cobros duplicados pasaron de una docena por día a cero durante el mes siguiente. Reembolsamos a los clientes afectados. También agregué una alerta sobre IDs de pago duplicados. Me quedó la lección de revisar el comportamiento de los reintentos en cualquier endpoint con efectos secundarios."

Unas 220 palabras, o sea unos 90–100 s.

**Notas según la rúbrica**
- **star_situation 4.** Sistema concreto y qué estaba en juego, en dos oraciones [K01].
- **star_task 5.** Responsabilidad explícita (la guardia) más una restricción (sin caída del servicio).
- **star_action 5.** Pasos en primera persona: hipótesis → reproducción → corrección → test → revisión, con el razonamiento a la vista. Cubre la repregunta "¿cuál fue tu rol?" [K10].
- **star_result 5.** Resultado medido (de una docena por día a cero), una alerta de seguimiento y un aprendizaje [K01][K02].
- **relevance 5, job_alignment 5.** Depurar un servicio Node.js en producción y la idempotencia de APIs son habilidades centrales de backend [K11].
- **conciseness 4.** En el borde de los 90 s, pero bajo el techo de ~2 minutos [K18]. Recortando una oración de la Acción entra en el objetivo de 60–90 s.
- **cv_consistency.** Se puntúa contra el CV real. En una respuesta real, las fechas, la empresa y el stack tienen que coincidir.

## Ejemplo débil (ILUSTRATIVO)

> "Bueno, este, teníamos un montón de bugs en ese proyecto, era un proyecto grande con muchos microservicios y la arquitectura era medio un desastre porque el equipo anterior no documentó nada. Había un bug con los pagos, creo, del que se quejaban los usuarios. Entonces lo miramos, revisamos el código, hablamos mucho en equipo y al final lo arreglamos. Fue difícil porque el código era malo. Pero lo arreglamos y el cliente quedó contento. Aprendí que el trabajo en equipo es muy importante."

Unas 95 palabras, o sea unos 40–45 s.

**Notas según la rúbrica**
- **star_situation 2.** El contexto habla de la arquitectura y del equipo anterior, no del bug concreto. Además culpa a otros.
- **star_task 1.** No dice el rol ni la responsabilidad.
- **star_action 1.** Todo en "nosotros" ("lo miramos", "revisamos"). No se puede evaluar el aporte individual [K01].
- **star_result 2.** "Lo arreglamos, el cliente quedó contento" es vago y sin medición [K01].
- **relevance 3.** Habla de un bug, pero nunca muestra la dificultad ni el debugging.
- **job_alignment 2.** Las habilidades de backend se intuyen, pero no se demuestran.
- **conciseness 3.** Es corta porque le faltan componentes, no porque sea eficiente.
- **Forma.** Arranca con muletillas ("bueno, este"). Ver `backend/config/fillers_es.yaml`.

## Cómo transformar una respuesta débil en fuerte

Pasos que el simulador puede sugerir:

1. **Elige un incidente concreto**, no "un montón de bugs".
2. **Di tu rol en una oración:** "Yo era responsable de…" [K01].
3. **Enumera 3–4 acciones en "yo"**, en orden y cada una con su razón ("revisé X porque Y") [K01][K02].
4. **Cierra con un número o un hecho verificable,** más un aprendizaje [K01].
5. **Recorta las culpas y el contexto** hasta que la Situación quede en 2 o 3 oraciones [K01].

Después, dila en voz alta y cronométrala. Practicar en voz alta para no pasar de unos 2 minutos es el consejo del instructivo de CUNY [K18].
