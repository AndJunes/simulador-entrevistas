"""RAG sobre Postgres + pgvector: ingestión incremental y recuperación filtrada por metadata.

Ingestión: solo re-embebe los chunks cuyo contenido cambió (content_hash) y borra los que ya no existen.
Recuperación: filtro por (interview_type, language) ANTES de la búsqueda por similitud.
"""
import logging

from sqlalchemy import delete, select

from app.db.models import KnowledgeChunk
from app.db.session import db
from app.pipeline.llm import embed
from app.rag.corpus import chunks_of, iter_docs

log = logging.getLogger("rag")


def ingest() -> dict:
    wanted = [c for path, meta, body in iter_docs() for c in chunks_of(path, meta, body)]
    with db() as s:
        existing = {row.id: row.content_hash for row in s.execute(select(KnowledgeChunk.id, KnowledgeChunk.content_hash))}
        changed = [c for c in wanted if existing.get(c["id"]) != c["content_hash"]]
        removed = set(existing) - {c["id"] for c in wanted}
        if removed:
            s.execute(delete(KnowledgeChunk).where(KnowledgeChunk.id.in_(removed)))
        if changed:
            vectors = embed([c["text"] for c in changed], "passage")
            for c, v in zip(changed, vectors):
                s.merge(KnowledgeChunk(**c, embedding=v))
    stats = {"total": len(wanted), "embedded": len(changed), "removed": len(removed)}
    log.info("RAG ingest: %s", stats)
    return stats


def retrieve(query: str, interview_type: str, language: str, k: int = 5,
             exclude_kinds: tuple[str, ...] = ("rubrica",)) -> list[dict]:
    qv = embed([query], "query")[0]
    with db() as s:
        stmt = (select(KnowledgeChunk, KnowledgeChunk.embedding.cosine_distance(qv).label("dist"))
                .where(KnowledgeChunk.interview_type == interview_type, KnowledgeChunk.language == language)
                .order_by("dist").limit(k))
        if exclude_kinds:
            stmt = stmt.where(KnowledgeChunk.doc_kind.not_in(exclude_kinds))
        rows = s.execute(stmt).all()
    return [{"id": r.KnowledgeChunk.id, "text": r.KnowledgeChunk.text, "doc_kind": r.KnowledgeChunk.doc_kind,
             "score": round(1 - float(r.dist), 3)} for r in rows]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(ingest())
