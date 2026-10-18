import type { Evidence } from '../models';

export function appendTranscript(
  original: string,
  committed: string,
  partial = '',
): string {
  const cleanCommitted = committed.trim();
  const cleanPartial = partial.trim();
  const addition = [cleanCommitted, cleanPartial].filter(Boolean).join(' ');
  if (!addition) return original;
  if (!original) return addition;
  return `${original}${/\s$/.test(original) ? '' : ' '}${addition}`;
}

export function quoteMatchesUtf16(text: string, evidence: Evidence): boolean {
  if (
    evidence.offsetConvention !== 'utf16-code-unit' ||
    evidence.start < 0 ||
    evidence.end < evidence.start ||
    evidence.end > text.length
  )
    return false;
  return text.slice(evidence.start, evidence.end) === evidence.quote;
}

export function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
