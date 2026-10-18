import { appendTranscript, quoteMatchesUtf16 } from '../src/services/text';
import { createPlan, PLAN_TEMPLATES } from '../src/planTemplates';
import { resolveAndroidBackAction } from '../src/services/navigation';

describe('Android system back navigation', () => {
  it('closes nested and detail screens before changing tabs', () => {
    expect(resolveAndroidBackAction('tabs', 'about', true)).toBe(
      'close-nested',
    );
    expect(resolveAndroidBackAction('editor', 'journal', false)).toBe(
      'show-tabs',
    );
  });

  it('returns secondary tabs to Journal and never exits at the root', () => {
    expect(resolveAndroidBackAction('tabs', 'plans', false)).toBe(
      'show-journal',
    );
    expect(resolveAndroidBackAction('tabs', 'journal', false)).toBe('stay');
  });
});

describe('dictation transcript assembly', () => {
  it('preserves typed text and separates partial text', () => {
    expect(appendTranscript('Already typed.', 'final words', 'partial')).toBe(
      'Already typed. final words partial',
    );
  });
  it('does not add whitespace to an empty result', () => {
    expect(appendTranscript('Keep me', '', '')).toBe('Keep me');
  });
});

describe('UTF-16 evidence validation', () => {
  it('validates emoji and Arabic quotes using JavaScript offsets', () => {
    const text = 'A😀 فكرة واضحة';
    const quote = 'فكرة';
    const start = text.indexOf(quote);
    expect(
      quoteMatchesUtf16(text, {
        entryId: 'e',
        entryRevision: 1,
        quote,
        start,
        end: start + quote.length,
        offsetConvention: 'utf16-code-unit',
        contentHash: 'x',
        extractionVersion: 'x',
      }),
    ).toBe(true);
  });
  it('rejects nonexistent passages', () => {
    expect(
      quoteMatchesUtf16('hello', {
        entryId: 'e',
        entryRevision: 1,
        quote: 'world',
        start: 0,
        end: 5,
        offsetConvention: 'utf16-code-unit',
        contentHash: 'x',
        extractionVersion: 'x',
      }),
    ).toBe(false);
  });
});

describe('deterministic plan templates', () => {
  it('keeps missing information unanswered', () => {
    const plan = createPlan(PLAN_TEMPLATES[0]);
    expect(plan.sections.every(section => section.manualAnswer === '')).toBe(
      true,
    );
    expect(
      plan.sections.some(section => section.unansweredQuestions.length > 0),
    ).toBe(true);
  });
  it('ships all six requested templates', () => {
    expect(PLAN_TEMPLATES).toHaveLength(6);
  });
});
