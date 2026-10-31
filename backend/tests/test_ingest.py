"""Ingestion: per-format text extraction and anti-SSRF protection (no network or LLM)."""
import shutil
import subprocess

import pytest

from app import ingest


def test_text_and_markdown_pass_through():
    raw, info = ingest.extract_file("# Hola\nCV de prueba".encode(), "cv.md")
    assert raw.startswith("# Hola") and info["ext"] == "md"


def test_rejects_unknown_extension_and_big_files():
    with pytest.raises(ingest.IngestError):
        ingest.extract_file(b"x", "virus.exe")
    with pytest.raises(ingest.IngestError):
        ingest.extract_file(b"x" * (ingest.MAX_FILE_BYTES + 1), "cv.txt")


def test_image_is_routed_to_vision():
    raw, info = ingest.extract_file(b"\x89PNG...", "cv.png")
    assert raw == "" and info["image"][0] == "image/png"


@pytest.mark.skipif(not shutil.which("textutil"), reason="textutil solo existe en macOS")
def test_html_and_docx_via_textutil(tmp_path):
    raw, _ = ingest.extract_file(b"<html><body><h1>Backend Engineer</h1><p>Rust y Node</p></body></html>", "aviso.html")
    assert "Backend Engineer" in raw and "Rust" in raw
    src = tmp_path / "a.html"
    src.write_text("<p>Experiencia con FastAPI</p>")
    subprocess.run(["textutil", "-convert", "docx", str(src), "-output", str(tmp_path / "a.docx")], check=True)
    raw, _ = ingest.extract_file((tmp_path / "a.docx").read_bytes(), "cv.docx")
    assert "FastAPI" in raw


@pytest.mark.skipif(not shutil.which("pdftotext") or not shutil.which("textutil") or not shutil.which("cupsfilter"),
                    reason="necesita poppler y cupsfilter (macOS)")
def test_pdf_via_pdftotext(tmp_path):
    src = tmp_path / "cv.txt"
    src.write_text("Alex Pérez Backend Engineer Python FastAPI")
    pdf = subprocess.run(["cupsfilter", str(src)], capture_output=True).stdout
    raw, _ = ingest.extract_file(pdf, "cv.pdf")
    assert "Backend Engineer" in raw


def test_html_to_text_skips_scripts():
    txt = ingest.html_to_text("<h2>Requisitos</h2><script>alert(1)</script><ul><li>Rust</li><li>SQL</li></ul>")
    assert "## Requisitos" in txt and "- Rust" in txt and "alert" not in txt


@pytest.mark.parametrize("url", ["http://localhost:8000/api/health", "http://127.0.0.1/", "http://10.0.0.5/x",
                                 "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://[::1]/"])
def test_ssrf_blocks_internal_addresses(url):
    with pytest.raises(ingest.IngestError, match="internas|locales"):
        ingest.fetch_url(url)


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://example.com/x", "javascript:alert(1)"])
def test_only_http_https(url):
    with pytest.raises(ingest.IngestError, match="http"):
        ingest.fetch_url(url)
