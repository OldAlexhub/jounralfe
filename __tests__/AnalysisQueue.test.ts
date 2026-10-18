jest.mock('../src/services/vault', () => ({
  Vault: { list: jest.fn(), put: jest.fn() },
}));

jest.mock('../src/services/text', () => ({
  newId: jest.fn((prefix: string) => `${prefix}-test-id`),
  quoteMatchesUtf16: jest.fn(() => true),
}));

import { DEFAULT_SETTINGS, type JournalEntry } from '../src/models';
import { queueEntryAnalysis } from '../src/services/analysis';
import { Vault } from '../src/services/vault';

const mockList = Vault.list as jest.Mock;
const mockPut = Vault.put as jest.Mock;

beforeEach(() => {
  mockList.mockReset().mockResolvedValue([]);
  mockPut.mockReset().mockResolvedValue(true);
});

it('enables journal insights by default', () => {
  expect(DEFAULT_SETTINGS.analysisConsent).toBe(true);
});

it('persists analysis work before a network request is attempted', async () => {
  const entry: JournalEntry = {
    id: 'entry-1',
    revision: 1,
    journalDate: '2026-10-18',
    timezone: 'America/New_York',
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
    title: 'A saved thought',
    body: 'I want to make space for deeper work.',
    inputSource: 'typed',
    tags: [],
    analysisState: 'pending',
  };

  const job = await queueEntryAnalysis(entry);

  expect(job.status).toBe('queued');
  expect(job.entryId).toBe(entry.id);
  expect(mockPut).toHaveBeenCalledWith(
    'analysis_job',
    expect.objectContaining({
      entryId: entry.id,
      entryRevision: entry.revision,
      status: 'queued',
    }),
  );
});
