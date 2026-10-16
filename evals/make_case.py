"""Convierte una sesión de práctica en un caso de eval para que lo califiques VOS.

Uso:
  python make_case.py <sesion>.json [<sesion>.json …]

Cada sesión es un JSON con mode, question, lang, transcript, metrics y evaluation.

Genera evals/cases/<tipo>_<idioma>/<id>.json con:
  - la transcripción, los timestamps y las métricas (entrada del evaluador);
  - human_scores vacíos: completalos SIN mirar la nota del modelo (están en otro archivo);
  - la salida del modelo aparte, en model_output/, para comparar después (concordancia).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CRITERIA = {
    "star": ["star_situation", "star_task", "star_action", "star_result",
             "relevance", "conciseness", "job_alignment", "cv_consistency"],
    "screening": ["clarity_structure", "conciseness", "motivation_company_knowledge",
                  "experience_role_alignment", "communication_english", "professionalism_logistics"],
    "screening_es": ["clarity_structure", "conciseness", "motivation_company_knowledge",
                     "experience_role_alignment", "communication_clarity", "professionalism_logistics"],
}


def main(path: str):
    s = json.loads(Path(path).read_text())
    if s.get("mode") != "evaluation":
        print(f"(se omite {Path(path).name}: es una sesión de orientación, no una respuesta evaluada)")
        return
    q, lang = s["question"], s["lang"]
    case_id = Path(path).stem
    folder = HERE / "cases" / f"{q['type']}_{lang}"
    folder.mkdir(parents=True, exist_ok=True)
    (HERE / "model_output").mkdir(exist_ok=True)

    case = {
        "id": case_id,
        "question": q,
        "lang": lang,
        "transcript": s["transcript"]["text"],
        "words": s["transcript"]["words"],
        "metrics": s["metrics"],
        "label": None,  # completar: "bueno" | "medio" | "malo" | "fuera_de_tema" | "inyeccion"
        "human_scores": {c: None for c in CRITERIA.get(f"{q['type']}_{lang}", CRITERIA[q["type"]])},  # completar 1–5 con la rúbrica
        "human_notes": "",
        "graded_by": None,
    }
    out = folder / f"{case_id}.json"
    out.write_text(json.dumps(case, indent=2, ensure_ascii=False))
    (HERE / "model_output" / f"{case_id}.json").write_text(
        json.dumps(s["evaluation"], indent=2, ensure_ascii=False))
    print(f"caso → {out}\n(calificá human_scores con la rúbrica de knowledge/{q['type']}/{lang}/rubrica.md "
          f"antes de abrir model_output/)")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
