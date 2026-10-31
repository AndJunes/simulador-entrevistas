"""Reads the knowledge/**/*.md corpus: frontmatter + chunks per `##` heading.
pm-knowledge-base convention: each chunk is prefixed with title and metadata."""

import hashlib
import re
from pathlib import Path

import yaml

from app.core.config import KNOWLEDGE, ROOT


def parse_frontmatter(text: str) -> tuple[dict, str]:
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        meta = {}
    return meta, m.group(2)


def iter_docs():
    for path in sorted(KNOWLEDGE.glob("*/*/*.md")):
        meta, body = parse_frontmatter(path.read_text())
        if not meta.get("interview_type") or not meta.get("language"):
            continue
        yield path, meta, body


def chunks_of(path: Path, meta: dict, body: str) -> list[dict]:
    rel = str(path.relative_to(ROOT))
    title = meta.get("title", path.stem)
    out = []
    for pos, part in enumerate(re.split(r"(?m)^## ", body)[1:]):
        heading, _, content = part.partition("\n")
        heading = heading.strip()
        text = (
            f"[{title} · {meta['interview_type']}/{meta['language']} · {meta.get('doc_kind', '')}] "
            f"## {heading}\n{content.strip()}"
        )
        out.append(
            {
                "id": f"{rel}#{heading}"[:300],
                "doc_path": rel,
                "heading": heading[:255],
                "interview_type": str(meta["interview_type"]),
                "language": str(meta["language"]),
                "doc_kind": str(meta.get("doc_kind", "")),
                "sources": list(meta.get("sources") or []),
                "text": text,
                "content_hash": hashlib.sha256(text.encode()).hexdigest(),
                "position": pos,
            }
        )
    return out


def rubric_text(interview_type: str, language: str) -> str | None:
    """The rubric goes into the prompt IN FULL (not retrieved by similarity): it's mandatory."""
    path = KNOWLEDGE / interview_type / language / "rubrica.md"
    if not path.exists():
        return None
    return parse_frontmatter(path.read_text())[1].strip()
