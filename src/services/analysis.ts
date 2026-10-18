import type {
  AnalysisJob,
  Evidence,
  ExtractedItem,
  JournalEntry,
  Person,
  Topic,
} from '../models';
import { Vault } from './vault';
import { quoteMatchesUtf16, newId } from './text';

const API_BASE = 'https://jorunal.server.oldalexhub.com/api/v1';

type ServerEntity = {
  name: string;
  type: 'person' | 'organization';
  confirmed: false;
  evidence: Evidence;
};

type ServerJob = {
  id: string;
  status: string;
  result?: {
    entryId: string;
    entryRevision: number;
    items: Array<Omit<ExtractedItem, 'createdAt' | 'updatedAt'>>;
    entities: ServerEntity[];
    keywords: Array<{ term: string; count: number }>;
  };
};

async function credential(): Promise<string> {
  const existing = await Vault.getProtectedSecret('installation_credential');
  if (existing) return existing;
  const response = await fetch(`${API_BASE}/installations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!response.ok)
    throw new Error(
      'Could not register this installation for optional analysis',
    );
  const created = await response.json();
  await Vault.setProtectedSecret('installation_credential', created.credential);
  return created.credential;
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), ms));

/** Persists analysis work before any network request so Save never depends on the server. */
export async function queueEntryAnalysis(
  entry: JournalEntry,
  force = false,
): Promise<AnalysisJob> {
  const jobs = await Vault.list<AnalysisJob>('analysis_job');
  const existing = jobs.find(
    job =>
      job.entryId === entry.id &&
      job.entryRevision === entry.revision &&
      !['completed', 'cancelled'].includes(job.status),
  );
  if (existing && !force) return existing;
  if (existing && force) {
    const refreshed: AnalysisJob = {
      ...existing,
      serverJobId: undefined,
      status: 'queued',
      retryCount: 0,
      idempotencyKey: `${entry.id}:${entry.revision}:${newId('try')}`,
      errorCode: undefined,
      updatedAt: new Date().toISOString(),
    };
    await Vault.put('analysis_job', refreshed);
    return refreshed;
  }
  const now = new Date().toISOString();
  const queued: AnalysisJob = {
    id: newId('job'),
    entryId: entry.id,
    entryRevision: entry.revision,
    consentState: 'granted',
    status: 'queued',
    retryCount: 0,
    idempotencyKey: `${entry.id}:${entry.revision}:${newId('try')}`,
    createdAt: now,
    updatedAt: now,
  };
  await Vault.put('analysis_job', queued);
  return queued;
}

async function deleteRemoteData(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/installation-data`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    return response.ok || response.status === 401 || response.status === 404;
  } catch {
    return false;
  }
}

/** Attempts remote deletion and protects a minimal retry credential if offline. */
export async function prepareRemoteDeletion(): Promise<boolean> {
  const token = await Vault.getProtectedSecret('installation_credential');
  if (!token) return true;
  if (await deleteRemoteData(token)) {
    await Vault.clearProtectedSecret('installation_credential');
    await Vault.clearProtectedSecret('pending_remote_deletion');
    return true;
  }
  await Vault.setProtectedSecret('pending_remote_deletion', token);
  await Vault.clearProtectedSecret('installation_credential');
  return false;
}

/** Safe to call before the vault exists; never creates an installation. */
export async function retryPendingRemoteDeletion(): Promise<void> {
  const token = await Vault.getProtectedSecret('pending_remote_deletion');
  if (token && (await deleteRemoteData(token))) {
    await Vault.clearProtectedSecret('pending_remote_deletion');
  }
}

export async function analyzeEntry(
  entry: JournalEntry,
): Promise<ExtractedItem[]> {
  const localJob = await queueEntryAnalysis(entry);
  localJob.retryCount += 1;
  localJob.status = 'queued';
  localJob.updatedAt = new Date().toISOString();
  await Vault.put('analysis_job', localJob);
  const token = await credential();
  const response = await fetch(`${API_BASE}/analysis/jobs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': localJob.idempotencyKey,
    },
    body: JSON.stringify({
      entryId: entry.id,
      entryRevision: entry.revision,
      text: entry.body,
      context: [],
      features: ['entities', 'statements', 'keywords', 'summary'],
    }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? 'Text analysis is busy. The encrypted outbox will keep this request for retry.'
        : 'Text analysis could not be started.',
    );
  const accepted = await response.json();
  localJob.serverJobId = accepted.id;
  localJob.status = 'processing';
  localJob.updatedAt = new Date().toISOString();
  await Vault.put('analysis_job', localJob);
  let result: ServerJob | undefined;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(Math.min(4000, 800 + attempt * 100));
    const poll = await fetch(`${API_BASE}/analysis/jobs/${accepted.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!poll.ok) throw new Error('Text analysis status is unavailable.');
    result = await poll.json();
    if (
      result &&
      ['completed', 'failed', 'cancelled', 'interrupted', 'expired'].includes(
        result.status,
      )
    )
      break;
  }
  if (!result || result.status !== 'completed' || !result.result)
    throw new Error(
      `Text analysis did not complete (${result?.status || 'timeout'}).`,
    );
  const current = await Vault.get<JournalEntry>('entry', entry.id);
  if (
    !current ||
    current.revision !== entry.revision ||
    result.result.entryRevision !== entry.revision
  )
    throw new Error(
      'A stale analysis result was discarded because the entry changed.',
    );
  const now = new Date().toISOString();
  const items: ExtractedItem[] = result.result.items
    .filter(item =>
      item.evidence.every((value: Evidence) =>
        quoteMatchesUtf16(entry.body, value),
      ),
    )
    .map(item => ({ ...item, createdAt: now, updatedAt: now }));
  await Promise.all(items.map(item => Vault.put('extracted_item', item)));
  const people: Person[] = (result.result.entities || [])
    .filter(
      entity =>
        entity.type === 'person' &&
        quoteMatchesUtf16(entry.body, entity.evidence),
    )
    .map(entity => ({
      id: `person:${entry.id}:${entry.revision}:${entity.evidence.start}`,
      displayName: entity.name,
      confirmed: false,
      confirmedAliases: [],
      pinned: false,
      evidence: [entity.evidence],
      confirmedLinks: [],
      createdAt: now,
      updatedAt: now,
    }));
  await Promise.all(people.map(person => Vault.put('person', person)));
  const topics: Topic[] = (result.result.keywords || [])
    .slice(0, 12)
    .map((keyword, index) => ({
      id: `topic:${entry.id}:${entry.revision}:${index}`,
      label: keyword.term,
      terms: [keyword.term],
      linkedEntryIds: [entry.id],
      method: 'phrase-groups',
      version: 'spacy-keywords-1',
      history: [],
      updatedAt: now,
    }));
  await Promise.all(topics.map(topic => Vault.put('topic', topic)));
  await fetch(`${API_BASE}/analysis/jobs/${accepted.id}/ack`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: '{}',
  }).catch(() => undefined);
  localJob.status = 'completed';
  localJob.updatedAt = now;
  await Vault.put('analysis_job', localJob);
  await Vault.put('entry', {
    ...current,
    analysisState: 'complete',
    updatedAt: now,
  });
  return items;
}

/** Retries encrypted outbox records after unlock without changing idempotency keys. */
let retrying = false;
export async function retryPendingAnalysisJobs(): Promise<void> {
  if (retrying) return;
  retrying = true;
  try {
    const jobs = await Vault.list<AnalysisJob>('analysis_job');
    const pending = jobs
      .filter(value => !['completed', 'cancelled'].includes(value.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const job of pending) {
      const entry = await Vault.get<JournalEntry>('entry', job.entryId);
      if (!entry || entry.revision !== job.entryRevision) {
        await Vault.put('analysis_job', {
          ...job,
          status: 'cancelled',
          errorCode: 'STALE_ENTRY_REVISION',
          updatedAt: new Date().toISOString(),
        });
        continue;
      }
      try {
        await analyzeEntry(entry);
      } catch {
        // The encrypted outbox remains available for the next unlock/retry.
      }
    }
  } finally {
    retrying = false;
  }
}

/** Best-effort remote cancellation; stale results are still rejected locally. */
export async function cancelEntryAnalysis(entryId: string): Promise<void> {
  const token = await Vault.getProtectedSecret('installation_credential');
  if (!token) return;
  const jobs = (await Vault.list<AnalysisJob>('analysis_job')).filter(
    job => job.entryId === entryId && job.serverJobId,
  );
  await Promise.all(
    jobs.map(job =>
      fetch(`${API_BASE}/analysis/jobs/${job.serverJobId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => undefined),
    ),
  );
}
