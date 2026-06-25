"""AI-assisted parser — fallback for unknown format variants.

Uses Qwen2.5 via OpenRouter with instructor for schema-enforced extraction.
The CA never sees this — it's invisible infrastructure.

Flow:
  text-layer PDF → markdown tables + flat text → Qwen2.5-7B-Instruct (text)
  scanned PDF    → page images                 → Qwen2.5-VL-7B (vision)
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Any

import pdfplumber

logger = logging.getLogger("statutorysync")

SYSTEM_PROMPT = """You are a precise data extractor for Indian statutory compliance documents.
Your job is to extract structured data from document text and tables.

Rules:
- Extract ONLY values explicitly present in the document
- Return null for any field not found — NEVER guess, infer, or estimate
- Amounts must be plain numbers only (strip ₹ symbol and commas)
- Dates: preserve original format from document
- Company names: preserve exact case and spelling from document
- For table data: the row/column intersection determines the value — read carefully"""


def _tables_to_markdown(pdf: pdfplumber.PDF) -> str:
    """Convert all PDF tables to markdown preserving row/column relationships."""
    try:
        from tabulate import tabulate
    except ImportError:
        return ""

    parts: list[str] = []
    for page_num, page in enumerate(pdf.pages, 1):
        tables = page.extract_tables(
            table_settings={"vertical_strategy": "lines", "horizontal_strategy": "lines"}
        )
        if not tables:
            tables = page.extract_tables()
        for t_idx, table in enumerate(tables):
            if not table:
                continue
            # Clean None cells
            cleaned = [[str(cell or "") for cell in row] for row in table]
            try:
                md = tabulate(cleaned, tablefmt="pipe")
                parts.append(f"**Table {t_idx + 1} (Page {page_num}):**\n{md}")
            except Exception:
                pass
    return "\n\n".join(parts)


def _flatten_text(pdf: pdfplumber.PDF) -> str:
    """Extract all text from PDF preserving reading order."""
    all_words = []
    for page in pdf.pages:
        words = page.extract_words(x_tolerance=3, y_tolerance=3, keep_blank_chars=False)
        all_words.extend(words)
    all_words.sort(key=lambda w: (round(w.get("top", 0) / 5) * 5, w.get("x0", 0)))
    return " ".join(w["text"].strip() for w in all_words if w["text"].strip())


def _count_null_fields(row: dict[str, Any], doc_type: str) -> tuple[int, int]:
    """Returns (null_count, total_count) for non-internal fields."""
    from app.parsers.registry import OUTPUT_FIELDS
    fields = OUTPUT_FIELDS.get(doc_type, [])
    if not fields:
        return 0, 1
    null_count = sum(1 for f in fields if row.get(f) is None)
    return null_count, len(fields)


def _should_use_ai(rows: list[dict[str, Any]], doc_type: str, threshold: float = 0.4) -> bool:
    """Return True if >threshold fraction of fields are null in any row."""
    if not rows:
        return True
    row = rows[0]
    # If parse_error exists → definitely use AI
    if row.get("_parse_error"):
        return True
    null_count, total = _count_null_fields(row, doc_type)
    if total == 0:
        return False
    null_ratio = null_count / total
    if null_ratio > threshold:
        logger.info(f"AI fallback triggered: {null_count}/{total} fields null ({null_ratio:.0%})")
        return True
    return False


async def ai_parse(
    doc_type: str,
    file_bytes: bytes,
    filename: str,
) -> list[dict[str, Any]] | None:
    """
    AI-assisted parse via OpenRouter + instructor.
    Returns list[dict] on success, None on failure (caller keeps original result).
    """
    from app.config import get_settings
    from app.parsers.ai_schemas import AI_SCHEMA_REGISTRY

    schema_cls = AI_SCHEMA_REGISTRY.get(doc_type)
    if schema_cls is None:
        logger.warning(f"No AI schema for doc_type={doc_type}")
        return None

    settings = get_settings()
    if not settings.openrouter_api_key:
        logger.warning("OPENROUTER_API_KEY not set — AI fallback skipped")
        return None

    try:
        import instructor
        from openai import AsyncOpenAI
    except ImportError:
        logger.error("instructor or openai not installed")
        return None

    # Build document content
    is_image_pdf = False
    doc_text = ""
    table_markdown = ""

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            doc_text = _flatten_text(pdf)
            table_markdown = _tables_to_markdown(pdf)
            if len(doc_text.strip()) < 20:
                is_image_pdf = True
    except Exception as e:
        logger.error(f"pdfplumber failed in AI parser: {e}")
        return None

    client = instructor.from_openai(
        AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
            default_headers={
                "HTTP-Referer": "https://statutorysync.in",
                "X-Title": "StatutorySync",
            },
        ),
        mode=instructor.Mode.JSON,
    )

    try:
        if is_image_pdf:
            # Vision path — render first page as image
            result = await _ai_parse_vision(client, file_bytes, schema_cls, settings, filename)
        else:
            # Text path — send markdown tables + flat text
            result = await _ai_parse_text(client, doc_text, table_markdown, schema_cls, settings, doc_type, filename)

        if result is None:
            return None

        output_dict = result.to_output_dict()
        output_dict["_source_file"] = filename
        logger.info(f"AI parse succeeded for {filename} ({doc_type})")
        return [output_dict]

    except Exception as e:
        logger.error(f"AI parse failed for {filename}: {e}")
        return None


async def _ai_parse_text(
    client,
    doc_text: str,
    table_markdown: str,
    schema_cls: type,
    settings,
    doc_type: str,
    filename: str,
) -> Any | None:
    """Text-layer PDF path — send extracted text + tables to text LLM."""
    content_parts = []
    if table_markdown:
        content_parts.append(f"## Document Tables\n\n{table_markdown}")
    if doc_text:
        content_parts.append(f"## Document Text\n\n{doc_text[:4000]}")

    if not content_parts:
        return None

    document_content = "\n\n".join(content_parts)

    return await client.chat.completions.create(
        model=settings.openrouter_text_model,
        response_model=schema_cls,
        max_retries=2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Extract all fields from this {doc_type.upper()} document:\n\n{document_content}",
            },
        ],
        max_tokens=1024,
        temperature=0,
    )


async def _ai_parse_vision(
    client,
    file_bytes: bytes,
    schema_cls: type,
    settings,
    filename: str,
) -> Any | None:
    """Scanned/image PDF path — render page as image, send to vision LLM."""
    try:
        # Convert first page to image using pypdfium2 (lighter than pdf2image)
        try:
            import pypdfium2 as pdfium
            pdf_doc = pdfium.PdfDocument(file_bytes)
            page = pdf_doc[0]
            bitmap = page.render(scale=2)  # 2x for better OCR quality
            pil_image = bitmap.to_pil()
        except ImportError:
            # Fallback: try pdf2image
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(file_bytes, first_page=1, last_page=1, dpi=200)
                pil_image = images[0]
            except ImportError:
                logger.error("Neither pypdfium2 nor pdf2image installed for vision path")
                return None

        # Encode image to base64
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        img_b64 = base64.b64encode(buf.getvalue()).decode()

    except Exception as e:
        logger.error(f"Image conversion failed for {filename}: {e}")
        return None

    return await client.chat.completions.create(
        model=settings.openrouter_vision_model,
        response_model=schema_cls,
        max_retries=2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{img_b64}"},
                    },
                    {
                        "type": "text",
                        "text": "Extract all fields from this statutory compliance document.",
                    },
                ],
            },
        ],
        max_tokens=1024,
        temperature=0,
    )
