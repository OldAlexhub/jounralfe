import { NativeModules } from 'react-native';
import type {
  AnalysisJob,
  ExtractedItem,
  Person,
  Plan,
  Topic,
  VaultType,
} from '../models';

type BackupRecord = {
  type: string;
  id: string;
  json: string;
  updatedAt: string;
};

interface NativeVault {
  hasVault(): Promise<boolean>;
  isUnlocked(): Promise<boolean>;
  createVault(password: string): Promise<boolean>;
  unlock(password: string): Promise<boolean>;
  lock(): Promise<boolean>;
  changePassword(current: string, next: string): Promise<boolean>;
  putRecord(
    type: string,
    id: string,
    json: string,
    updatedAt: string,
  ): Promise<boolean>;
  getRecord(type: string, id: string): Promise<string | null>;
  listRecords(type: string): Promise<string[]>;
  listAllRecords(): Promise<BackupRecord[]>;
  replaceAllRecords(recordsJson: string): Promise<number>;
  deleteRecord(type: string, id: string): Promise<boolean>;
  clearType(type: string): Promise<boolean>;
  eraseVault(): Promise<boolean>;
  integrityCheck(): Promise<boolean>;
  biometricAvailable(): Promise<boolean>;
  biometricEnabled(): Promise<boolean>;
  enableBiometric(): Promise<boolean>;
  unlockBiometric(): Promise<boolean>;
  disableBiometric(): Promise<boolean>;
  setProtectedSecret(name: string, value: string): Promise<boolean>;
  getProtectedSecret(name: string): Promise<string | null>;
  clearProtectedSecret(name: string): Promise<boolean>;
}

const native = NativeModules.InnerfolioVault as NativeVault;

export const Vault = {
  hasVault: () => native.hasVault(),
  isUnlocked: () => native.isUnlocked(),
  createVault: (password: string) => native.createVault(password),
  unlock: (password: string) => native.unlock(password),
  lock: () => native.lock(),
  changePassword: (current: string, next: string) =>
    native.changePassword(current, next),
  putRecord: (type: string, id: string, json: string, updatedAt: string) =>
    native.putRecord(type, id, json, updatedAt),
  getRecord: (type: string, id: string) => native.getRecord(type, id),
  listRecords: (type: string) => native.listRecords(type),
  listAllRecords: () => native.listAllRecords(),
  replaceAllRecords: (recordsJson: string) =>
    native.replaceAllRecords(recordsJson),
  deleteRecord: (type: string, id: string) => native.deleteRecord(type, id),
  clearType: (type: string) => native.clearType(type),
  eraseVault: () => native.eraseVault(),
  integrityCheck: () => native.integrityCheck(),
  biometricAvailable: () => native.biometricAvailable(),
  biometricEnabled: () => native.biometricEnabled(),
  enableBiometric: () => native.enableBiometric(),
  unlockBiometric: () => native.unlockBiometric(),
  disableBiometric: () => native.disableBiometric(),
  setProtectedSecret: (name: string, value: string) =>
    native.setProtectedSecret(name, value),
  getProtectedSecret: (name: string) => native.getProtectedSecret(name),
  clearProtectedSecret: (name: string) => native.clearProtectedSecret(name),
  async put<T extends { id: string; updatedAt?: string }>(
    type: VaultType,
    value: T,
  ) {
    const updatedAt = value.updatedAt || new Date().toISOString();
    return native.putRecord(
      type,
      value.id,
      JSON.stringify({ ...value, updatedAt }),
      updatedAt,
    );
  },
  async get<T>(type: VaultType, id: string): Promise<T | null> {
    const value = await native.getRecord(type, id);
    return value ? (JSON.parse(value) as T) : null;
  },
  async list<T>(type: VaultType): Promise<T[]> {
    return (await native.listRecords(type)).map(item => JSON.parse(item) as T);
  },
  async backupRecords() {
    return native.listAllRecords();
  },
  async replaceRecords(records: BackupRecord[]) {
    return native.replaceAllRecords(JSON.stringify(records));
  },
  delete(type: VaultType, id: string) {
    return native.deleteRecord(type, id);
  },
};

/** Removes derived references while preserving deliberate plan writing. */
export async function invalidateEntryReferences(
  entryId: string,
  deleteEntry: boolean,
): Promise<void> {
  const [items, people, topics, plans, jobs] = await Promise.all([
    Vault.list<ExtractedItem>('extracted_item'),
    Vault.list<Person>('person'),
    Vault.list<Topic>('topic'),
    Vault.list<Plan>('plan'),
    Vault.list<AnalysisJob>('analysis_job'),
  ]);
  await Promise.all(
    items
      .filter(item => item.evidence.some(value => value.entryId === entryId))
      .map(item => Vault.delete('extracted_item', item.id)),
  );
  await Promise.all(
    jobs
      .filter(job => job.entryId === entryId)
      .map(job => Vault.delete('analysis_job', job.id)),
  );
  await Promise.all(
    people.map(async person => {
      const evidence = person.evidence.filter(
        value => value.entryId !== entryId,
      );
      if (evidence.length === person.evidence.length) return;
      if (!person.confirmed && evidence.length === 0)
        return Vault.delete('person', person.id);
      return Vault.put('person', {
        ...person,
        evidence,
        updatedAt: new Date().toISOString(),
      });
    }),
  );
  await Promise.all(
    topics.map(async topic => {
      if (!topic.linkedEntryIds.includes(entryId)) return;
      const linkedEntryIds = topic.linkedEntryIds.filter(
        value => value !== entryId,
      );
      if (linkedEntryIds.length === 0) return Vault.delete('topic', topic.id);
      return Vault.put('topic', {
        ...topic,
        linkedEntryIds,
        updatedAt: new Date().toISOString(),
      });
    }),
  );
  await Promise.all(
    plans.map(async plan => {
      let affected = false;
      const sections = plan.sections.map(section => {
        const sourceReferences = section.sourceReferences.filter(
          value => value.entryId !== entryId,
        );
        if (sourceReferences.length === section.sourceReferences.length)
          return section;
        affected = true;
        const note =
          'A linked journal source changed or was removed; review this section.';
        return {
          ...section,
          sourceReferences,
          unansweredQuestions: Array.from(
            new Set([...section.unansweredQuestions, note]),
          ),
        };
      });
      if (affected)
        await Vault.put('plan', {
          ...plan,
          sections,
          updatedAt: new Date().toISOString(),
        });
    }),
  );
  if (deleteEntry) await Vault.delete('entry', entryId);
}
