const ABBREVIATIONS = new Set(['dr.', 'mr.', 'mrs.', 'ms.', 'e.g.', 'i.e.']);
const CLOSING = new Set(['"', "'", '”', '’', ')', ']']);

/** Incrementally assembles arbitrary token chunks into complete sentence-sized segments. */
export class SentenceSegmenter {
  private buffer = '';

  push(chunk: string): readonly string[] {
    this.buffer += chunk;
    const boundary = completeBoundary(this.buffer);
    if (boundary < 0) return [];

    const segments: string[] = [];
    let remaining = this.buffer;
    let end = completeBoundary(remaining);
    while (end >= 0) {
      segments.push(remaining.slice(0, end).trim());
      remaining = remaining.slice(end).trimStart();
      end = completeBoundary(remaining);
    }
    this.buffer = remaining;
    return segments.filter((segment) => segment !== '');
  }

  flush(): string | null {
    const value = this.buffer.trim();
    this.buffer = '';
    return value === '' ? null : value;
  }
}

function completeBoundary(text: string): number {
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (!isPunctuation(character)) continue;
    if (character === '.' && isInternalPeriod(text, index)) continue;
    const end = boundaryAfterClosers(text, index + 1);
    if (end === text.length || isWhitespace(text[end])) return end;
  }
  return -1;
}

function isInternalPeriod(text: string, index: number): boolean {
  if (surroundedBy(text, index, /\d/u)) return true;
  if (surroundedBy(text, index, /[a-z]/iu)) return true;
  if (isEllipsis(text, index)) return true;
  const prefix = text.slice(0, index + 1).toLowerCase();
  const word = /(?:[a-z]\.){2,}|[a-z]+\.$/u.exec(prefix)?.[0];
  return word !== undefined && ABBREVIATIONS.has(word);
}

function isPunctuation(character: string | undefined): boolean {
  return character === '.' || character === '?' || character === '!';
}

function boundaryAfterClosers(text: string, start: number): number {
  let end = start;
  while (end < text.length && CLOSING.has(text[end] ?? '')) end += 1;
  return end;
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/u.test(character);
}

function surroundedBy(text: string, index: number, pattern: RegExp): boolean {
  return pattern.test(text[index - 1] ?? '') && pattern.test(text[index + 1] ?? '');
}

function isEllipsis(text: string, index: number): boolean {
  return (
    text.slice(index, index + 3) === '...' ||
    text.slice(Math.max(0, index - 2), index + 1) === '...'
  );
}
