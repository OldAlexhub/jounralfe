export type ISODateTime = string;
export type InputSource = 'typed' | 'dictated' | 'mixed';
export type ReviewState =
  | 'suggested'
  | 'accepted'
  | 'corrected'
  | 'dismissed'
  | 'withdrawn';
export type ItemCategory =
  | 'principle'
  | 'value'
  | 'desire'
  | 'goal'
  | 'commitment'
  | 'idea'
  | 'project'
  | 'decision'
  | 'resource'
  | 'constraint'
  | 'question'
  | 'uncategorized';

export interface VaultSettings {
  id: 'settings';
  schemaVersion: 1;
  lockAfterSeconds: number;
  biometricEnabled: boolean;
  analysisConsent: boolean;
  automaticAnalysis: boolean;
  theme: 'system' | 'light' | 'dark';
  fontScale: number;
  reminder: { enabled: boolean; hour: number; minute: number };
  sampleMode: boolean;
  updatedAt: ISODateTime;
}

export interface JournalEntry {
  id: string;
  revision: number;
  journalDate: string;
  timezone: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  title: string;
  body: string;
  inputSource: InputSource;
  tags: string[];
  analysisState: 'not-requested' | 'pending' | 'complete' | 'failed' | 'stale';
  isDraft?: boolean;
}

export interface Evidence {
  entryId: string;
  entryRevision: number;
  quote: string;
  start: number;
  end: number;
  offsetConvention: 'utf16-code-unit';
  contentHash: string;
  extractionVersion: string;
}

export interface ExtractedItem {
  id: string;
  category: ItemCategory;
  originalWording: string;
  label: string;
  subject: string | null;
  temporal: { referenceDateRequired?: boolean; text?: string };
  modality: 'stated' | 'tentative' | 'attributed' | 'quoted';
  negated: boolean;
  evidence: Evidence[];
  state: ReviewState;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Person {
  id: string;
  displayName: string;
  confirmed: boolean;
  confirmedAliases: string[];
  confirmedRole?: string;
  pinned: boolean;
  evidence: Evidence[];
  confirmedLinks: Array<{ personId: string; relationship: string }>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Topic {
  id: string;
  label: string;
  terms: string[];
  linkedEntryIds: string[];
  method: 'user' | 'phrase-groups' | 'nmf-tfidf';
  version: string;
  history: Array<{
    action: 'merge' | 'split' | 'rename';
    at: ISODateTime;
    details: string;
  }>;
  updatedAt: ISODateTime;
}

export interface Observation {
  id: string;
  statement: string;
  period: { start: string; end: string };
  countedUnits: { mentions: number; distinctEntries: number };
  supportingEntryIds: string[];
  state: ReviewState;
  updatedAt: ISODateTime;
}

export interface PlanSection {
  id: string;
  title: string;
  guidance: string;
  sourceReferences: Evidence[];
  manualAnswer: string;
  acceptedAssumptions: string[];
  unansweredQuestions: string[];
}

export interface Plan {
  id: string;
  templateId: string;
  templateVersion: number;
  title: string;
  sections: PlanSection[];
  milestones: Array<{
    id: string;
    label: string;
    dueDate?: string;
    done: boolean;
  }>;
  tasks: Array<{ id: string; label: string; dueDate?: string; done: boolean }>;
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AnalysisJob {
  id: string;
  serverJobId?: string;
  entryId: string;
  entryRevision: number;
  consentState: 'granted';
  status:
    | 'queued'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'interrupted';
  retryCount: number;
  idempotencyKey: string;
  errorCode?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const DEFAULT_SETTINGS: VaultSettings = {
  id: 'settings',
  schemaVersion: 1,
  lockAfterSeconds: 60,
  biometricEnabled: false,
  analysisConsent: true,
  automaticAnalysis: false,
  theme: 'system',
  fontScale: 1,
  reminder: { enabled: false, hour: 20, minute: 0 },
  sampleMode: false,
  updatedAt: new Date(0).toISOString(),
};

export const VAULT_TYPES = [
  'settings',
  'entry',
  'draft',
  'extracted_item',
  'person',
  'topic',
  'observation',
  'plan',
  'analysis_job',
] as const;
export type VaultType = (typeof VAULT_TYPES)[number];
