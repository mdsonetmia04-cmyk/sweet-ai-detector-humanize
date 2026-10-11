export function countWords(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function countChars(value) {
  return value.length;
}

export function countCharsNoSpaces(value) {
  return value.replace(/\s/g, "").length;
}

export function countSentences(value) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[^.!?…\n]+[.!?…]+["'”’)\]]*/g);
  if (!matches) return 1;
  return matches.length;
}

export function countParagraphs(value) {
  return value.split(/\n{2,}|\r\n{2,}/).filter((p) => p.trim()).length;
}

export function readingTimeMinutes(value) {
  const words = countWords(value);
  if (!words) return 0;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Paragraph-level before/after comparison.
 * Returns paragraphs of `revised` annotated with whether they changed
 * relative to the original, matched in order. Simple and honest:
 * it does not pretend to do word-level diffing.
 */
export function compareParagraphs(original, revised) {
  const origParas = original.split(/\n{2,}|\r\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const revParas = revised.split(/\n{2,}|\r\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const origSet = new Set(origParas);
  return revParas.map((para) => ({
    text: para,
    changed: !origSet.has(para),
  }));
}

export async function readTextFile(file, maxBytes = 1_000_000) {
  if (file.size > maxBytes) {
    throw new Error("That file is larger than the 1 MB import limit.");
  }
  return await file.text();
}
