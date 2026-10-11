/**
 * Paragraph-aware chunking for long documents.
 *
 * Strategy:
 *  1. Split at paragraph boundaries first (blank lines).
 *  2. Split unusually long paragraphs at sentence boundaries.
 *  3. Pack pieces into chunks under a configurable character limit,
 *     preserving document order and paragraph separation.
 */

export function splitLongParagraph(paragraph, limit) {
  if (paragraph.length <= limit) return [paragraph];
  const pieces = [];
  let rest = paragraph;
  while (rest.length > limit) {
    const cut = Math.max(
      rest.lastIndexOf(". ", limit),
      rest.lastIndexOf("! ", limit),
      rest.lastIndexOf("? ", limit),
      rest.lastIndexOf("; ", limit),
      rest.lastIndexOf(", ", limit),
    );
    let end = cut;
    if (end < Math.floor(limit * 0.55)) {
      end = limit; // no good sentence boundary; hard cut
    } else {
      end += 1; // keep the punctuation with the piece
    }
    pieces.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) pieces.push(rest);
  return pieces.filter(Boolean);
}

export function chunkText(text, limit = 6500) {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const p = paragraph.trim();
    if (!p) continue;
    const pieces = splitLongParagraph(p, limit);
    for (const piece of pieces) {
      const candidate = current ? `${current}\n\n${piece}` : piece;
      if (candidate.length > limit && current) {
        chunks.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
