---
title: "Banco de preguntas conductuales para backend junior, por competencia"
interview_type: star
language: es
doc_kind: preguntas
competency: [problem_solving, ownership, learning, collaboration, prioritization, quality, feedback, communication, failure]
sources: [K01, K02, K09, K10, K11, K12]
---

## Cómo está organizado este banco

Las preguntas se agrupan por competencia. Las competencias salen de tres lugares:
- **El perfil de tareas y habilidades de O*NET para desarrolladores de software** [K11]. Tareas: analizar requisitos, acordar interfaces y rendimiento con otros ingenieros, modificar software para corregir errores, testing, informar avances. Habilidades: pensamiento crítico, aprendizaje activo, expresión oral. Estilos de trabajo: adaptabilidad, atención al detalle, confiabilidad.
- **Los atributos de contratación de Google re:Work** [K09]: conocimiento del rol, resolución de problemas y liderazgo emergente en contribuidores individuales.
- **Los Leadership Principles de Amazon** [K12], como ejemplo conocido de cómo una empresa nombra competencias conductuales.

Las preguntas siguen el modelo de la OPM: una consigna sobre conducta pasada que pide quiénes participaron, qué hiciste y qué resultó, más repreguntas planificadas [K10].

En todas, una respuesta fuerte es un hecho concreto del pasado contado en STAR, con acciones en primera persona y un resultado medible si se puede [K01][K02]. Una misma historia sirve para varias competencias [K02].

Las preguntas se dan en español. En una entrevista en inglés, ver `star/en/preguntas.md`.

## Resolución de problemas y debugging

Tarea central de O*NET: modificar software para corregir errores o mejorar el rendimiento [K11]. Google: resolución de problemas [K09]. Amazon: Dive Deep [K12].

**Preguntas**
- Cuéntame el bug más difícil que hayas depurado. ¿Cómo encontraste la causa raíz?
- Describe una vez que un servicio en producción falló o se degradó. ¿Qué hiciste?
- Cuéntame de una vez en que mejoraste el rendimiento de una API o una consulta.

**Una respuesta fuerte contiene**
- Los pasos de diagnóstico: reproducir, logs, métricas, hipótesis probadas.
- Por qué elegiste esos pasos.
- La corrección.
- Un resultado medido (tasa de errores, latencia).
- Una medida de prevención.

**Repreguntas típicas** [K10]: ¿Cómo supiste que estaba resuelto? ¿Qué harías distinto?

## Ownership e iniciativa

Amazon: Ownership, Bias for Action [K12]. Google: liderazgo emergente en contribuidores individuales [K09]. O*NET: confiabilidad [K11].

**Preguntas**
- Cuéntame de una vez en que te hiciste cargo de algo fuera de tus tareas asignadas.
- Describe una vez en que detectaste un problema que nadie te había pedido resolver.

**Una respuesta fuerte contiene**
- Qué notaste.
- Por qué importaba.
- Qué hiciste sin que te lo pidieran.
- Cómo mantuviste informados a los demás.
- El resultado.

## Aprender una tecnología nueva rápido

Habilidad esencial de O*NET: aprendizaje activo [K11]. Amazon: Learn and Be Curious [K12]. Muy relevante para un perfil Node.js que pasa a Rust.

**Preguntas**
- Cuéntame de una vez en que tuviste que aprender rápido un lenguaje o framework para entregar algo.
- ¿Cómo te volviste productivo en un código que no conocías?

**Una respuesta fuerte contiene**
- La estrategia concreta: documentación, prototipos chicos, leer código, pedir revisión.
- Cuánto tiempo te llevó.
- Qué entregaste con lo aprendido.

## Colaboración y desacuerdo

Tarea de O*NET: acordar con ingenieros y analistas el diseño y las interfaces [K11]. Amazon: Earn Trust; Have Backbone, Disagree and Commit [K12]. La pregunta de ejemplo de Google repregunta cómo reaccionó el equipo [K09].

**Preguntas**
- Cuéntame de una vez en que no estuviste de acuerdo con un compañero en una decisión técnica.
- Describe una vez en que definiste el contrato de una API con un equipo de frontend o mobile.

**Una respuesta fuerte contiene**
- Tu postura y la evidencia que la sostenía.
- Cómo escuchaste.
- Cómo se tomó la decisión.
- Cómo la apoyaste después.
- Sin culpar a nadie.

## Plazos y priorización

O*NET: gestión del tiempo, y evaluar si un diseño es viable en tiempo y costo [K11]. Amazon: Deliver Results [K12].

**Preguntas**
- Cuéntame de una vez en que tenías más trabajo que tiempo. ¿Cómo priorizaste?
- Describe una vez en que tuviste que recortar alcance para cumplir un plazo.

**Una respuesta fuerte contiene**
- Los criterios que usaste.
- A quién consultaste.
- Qué postergaste y por qué.
- Qué se entregó a tiempo.

## Calidad y testing

Tarea de O*NET: desarrollar procedimientos de prueba o validación. Estilo de trabajo: atención al detalle [K11]. Amazon: Insist on the Highest Standards [K12].

**Preguntas**
- Cuéntame de una vez en que un test o un code review detectó un problema serio.
- Describe una vez en que mejoraste la confiabilidad o la cobertura de tests de un servicio.

**Una respuesta fuerte contiene**
- La práctica concreta que aplicaste o introdujiste.
- Qué detectó o evitó.
- Su efecto medible.

## Recibir feedback

O*NET: adaptabilidad [K11]. La pregunta de ejemplo de Google indaga el impacto de tu conducta en el equipo [K09].

**Preguntas**
- Cuéntame de un feedback crítico que recibiste sobre tu código. ¿Qué hiciste con él?

**Una respuesta fuerte contiene**
- El feedback, contado sin ponerte a la defensiva.
- Qué cambiaste.
- Evidencia de que lo sostuviste en el tiempo.

## Comunicar con personas no técnicas

O*NET: expresión oral y escrita; informar el estado de un proyecto [K11].

**Preguntas**
- Cuéntame de una vez en que tuviste que explicar un problema técnico o una demora a alguien no técnico.

**Una respuesta fuerte contiene**
- Cómo adaptaste el mensaje: impacto primero, poca jerga.
- Qué decisión permitió.
- El resultado.

## Errores y fracasos

Amazon: Earn Trust, que incluye la autocrítica [K12]. Repregunta de resultado de la OPM: ¿qué harías distinto? [K10].

**Preguntas**
- Cuéntame de un error tuyo que afectó a otros. ¿Cómo lo manejaste?
- Describe un proyecto que no salió como estaba planeado.

**Una respuesta fuerte contiene**
- Un error real, asumido en primera persona.
- La mitigación inmediata.
- Cómo lo comunicaste.
- El cambio duradero que hiciste.

Evita las falsas debilidades y culpar a las circunstancias.
