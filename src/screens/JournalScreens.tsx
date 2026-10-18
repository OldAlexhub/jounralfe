import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  KeyboardSafeScreen,
  SafeScrollView,
  ScreenContainer,
} from '../components/layout';
import type {
  ExtractedItem,
  JournalEntry,
  JournalMode,
  VaultSettings,
} from '../models';
import { Documents, Vosk, VoskEvents } from '../native';
import {
  cancelEntryAnalysis,
  queueEntryAnalysis,
  retryPendingAnalysisJobs,
} from '../services/analysis';
import { appendTranscript, localDate, newId } from '../services/text';
import { invalidateEntryReferences, Vault } from '../services/vault';
import { styles } from '../theme';
import {
  Button,
  Empty,
  EvidenceCard,
  Field,
  Header,
  StatePill,
  errorMessage,
  parseTags,
  safeName,
} from '../ui';

const SAMPLE_ENTRIES: JournalEntry[] = [
  {
    id: 'sample-one',
    revision: 1,
    journalDate: '2026-10-18',
    timezone: 'America/New_York',
    createdAt: '2026-10-18T13:00:00Z',
    updatedAt: '2026-10-18T13:00:00Z',
    title: 'A calmer launch plan',
    body: 'I want to test the workshop idea with five conversations before choosing a venue. I value leaving room for family evenings.',
    mode: 'goal',
    inputSource: 'typed',
    tags: ['sample', 'planning'],
    analysisState: 'complete',
  },
];

const JOURNAL_MODES: Array<{
  key: JournalMode;
  title: string;
  detail: string;
  prompt: string;
  mark: string;
}> = [
  {
    key: 'free',
    title: 'Free write',
    detail: 'Follow the thought',
    prompt: 'What is on your mind?',
    mark: '✦',
  },
  {
    key: 'check-in',
    title: 'Daily check-in',
    detail: 'Notice today',
    prompt: 'How are you arriving today?',
    mark: '◌',
  },
  {
    key: 'goal',
    title: 'Goal review',
    detail: 'Progress and next move',
    prompt: 'What moved forward, and what comes next?',
    mark: '↗',
  },
  {
    key: 'decision',
    title: 'Decision',
    detail: 'Options and reasons',
    prompt: 'What decision are you working through?',
    mark: '◇',
  },
  {
    key: 'idea',
    title: 'Idea capture',
    detail: 'Shape a possibility',
    prompt: 'What idea do you want to explore?',
    mark: '◎',
  },
];

const journalMode = (mode?: JournalMode) =>
  JOURNAL_MODES.find(value => value.key === mode) || JOURNAL_MODES[0];

export function JournalScreen({
  refresh,
  sampleMode,
  onNew,
  onOpen,
  onSettings,
}: {
  refresh: number;
  sampleMode: boolean;
  onNew: (mode: JournalMode) => void;
  onOpen: (entry: JournalEntry) => void;
  onSettings: () => void;
}) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Vault.list<JournalEntry>('entry').then(value => {
      setEntries(value);
      setLoading(false);
    });
  }, [refresh]);
  const samples = sampleMode && entries.length === 0;
  const values = (samples ? SAMPLE_ENTRIES : entries)
    .filter(
      item =>
        (!search ||
          `${item.title} ${item.body} ${item.tags.join(' ')}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!date || item.journalDate === date),
    )
    .sort(
      (a, b) =>
        b.journalDate.localeCompare(a.journalDate) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const groups = values.reduce<Array<[string, JournalEntry[]]>>(
    (result, entry) => {
      const current = result[result.length - 1];
      if (current?.[0] === entry.journalDate) current[1].push(entry);
      else result.push([entry.journalDate, [entry]]);
      return result;
    },
    [],
  );
  return (
    <ScreenContainer>
      <Header title="Journal" onSettings={onSettings} />
      <SafeScrollView>
        <View style={styles.dashboardIntro}>
          <Text style={styles.overline}>Start where you are</Text>
          <Text style={styles.h1}>How do you want to journal?</Text>
        </View>
        <View style={styles.modeGrid}>
          {JOURNAL_MODES.map(mode => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode.title}
              key={mode.key}
              onPress={() => onNew(mode.key)}
              style={({ pressed }) => [
                styles.modeTile,
                pressed && styles.modeTilePressed,
              ]}
            >
              <Text style={styles.modeMark}>{mode.mark}</Text>
              <Text style={styles.modeTitle}>{mode.title}</Text>
              <Text style={styles.modeDetail}>{mode.detail}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.dashboardSection}>
          <Text style={styles.h2}>Your journal</Text>
          <Text style={styles.caption}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        <View style={styles.compactFilters}>
          <TextInput
            accessibilityLabel="Search journal"
            placeholder="Search"
            value={search}
            onChangeText={setSearch}
            style={[styles.input, styles.search]}
          />
          <TextInput
            accessibilityLabel="Filter by date"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
            style={[styles.input, styles.dateInput]}
          />
        </View>
        {samples && (
          <Text style={styles.sampleBadge}>
            SAMPLE CONTENT · never mixed with your vault
          </Text>
        )}
        {loading ? (
          <Text style={styles.paragraph}>Loading encrypted entries…</Text>
        ) : values.length === 0 ? (
          <Empty
            title="A quiet page is ready"
            detail="Write more than one entry a day, choose its journal date, or dictate locally when words arrive faster than typing."
          />
        ) : (
          groups.map(([groupDate, groupEntries]) => (
            <View key={groupDate} style={styles.timelineGroup}>
              <Text style={styles.timelineDate}>{groupDate}</Text>
              {groupEntries.map(entry => {
                const mode = journalMode(entry.mode);
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() =>
                      samples
                        ? Alert.alert(
                            'Sample content',
                            'Turn off sample mode before editing.',
                          )
                        : onOpen(entry)
                    }
                    style={({ pressed }) => [
                      styles.timelineRow,
                      pressed && styles.timelineRowPressed,
                    ]}
                  >
                    <View style={styles.timelineMark}>
                      <Text style={styles.timelineMarkText}>{mode.mark}</Text>
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineTitleRow}>
                        <Text numberOfLines={1} style={styles.timelineTitle}>
                          {entry.title || mode.title}
                        </Text>
                        <StatePill value={entry.analysisState} />
                      </View>
                      <Text numberOfLines={2} style={styles.timelineExcerpt}>
                        {entry.body}
                      </Text>
                      <Text style={styles.timelineMode}>{mode.title}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </SafeScrollView>
    </ScreenContainer>
  );
}

export function EditorScreen({
  initial,
  initialMode = 'free',
  settings,
  onClose,
  onSaved,
}: {
  initial?: JournalEntry;
  initialMode?: JournalMode;
  settings: VaultSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [date, setDate] = useState(initial?.journalDate || localDate());
  const [tags, setTags] = useState(initial?.tags.join(', ') || '');
  const [mode, setMode] = useState<JournalMode>(initial?.mode || initialMode);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Encrypted draft');
  const base = useRef('');
  const committed = useRef<string[]>([]);
  const draftId = initial?.id || `current_${initialMode}`;
  useEffect(() => {
    if (initial) return;
    Vault.get<JournalEntry>('draft', 'current').then(draft => {
      if (draft) {
        setTitle(draft.title);
        setBody(draft.body);
        setDate(draft.journalDate);
        setTags(draft.tags.join(', '));
        setMode(draft.mode || initialMode);
        setStatus('Recovered encrypted draft');
      }
    });
  }, [initial, initialMode]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date().toISOString();
      const draft: JournalEntry = {
        id: draftId,
        revision: initial?.revision || 1,
        journalDate: date,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: initial?.createdAt || now,
        updatedAt: now,
        title,
        body,
        mode,
        inputSource: 'typed',
        tags: parseTags(tags),
        analysisState: 'not-requested',
        isDraft: true,
      };
      if (body || title)
        Vault.put('draft', draft)
          .then(() => setStatus('Encrypted draft saved'))
          .catch(() => setStatus('Draft save failed — keep this screen open'));
    }, 700);
    return () => clearTimeout(timer);
  }, [body, title, date, tags, mode, draftId, initial]);
  useEffect(() => {
    const subs = [
      VoskEvents.addListener('VoskPartial', (raw: Object) => {
        const value = String(raw);
        setPartial(value);
        setBody(
          appendTranscript(base.current, committed.current.join(' '), value),
        );
      }),
      VoskEvents.addListener('VoskFinal', (raw: Object) => {
        const value = String(raw);
        if (value && !committed.current.includes(value))
          committed.current.push(value);
        setPartial('');
        setBody(appendTranscript(base.current, committed.current.join(' ')));
      }),
      VoskEvents.addListener('VoskState', (raw: Object) => {
        if (String(raw) !== 'listening') setListening(false);
      }),
      VoskEvents.addListener('VoskError', (raw: Object) => {
        setListening(false);
        Alert.alert('Dictation stopped', String(raw));
      }),
    ];
    return () => {
      subs.forEach(item => item.remove());
      void Vosk.cancel().catch(() => undefined);
    };
  }, []);
  const dictate = async () => {
    if (listening) {
      await Vosk.stop();
      setListening(false);
      return;
    }
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Dictate on this phone',
        message:
          'Innerfolio needs microphone access only while you dictate. Audio is processed locally and is not saved.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED)
      return Alert.alert(
        'Typing is still available',
        'Microphone permission was not granted. You can continue writing normally.',
      );
    try {
      setStatus('Preparing verified English model…');
      await Vosk.prepareModel();
      base.current = body;
      committed.current = [];
      setPartial('');
      await Vosk.start();
      setListening(true);
      setStatus('Listening locally — audio is not saved');
    } catch (reason) {
      setStatus(errorMessage(reason));
    }
  };
  const save = async () => {
    if (!body.trim())
      return Alert.alert(
        'Nothing to save',
        'Write or dictate something first. Your draft is still here.',
      );
    if (body.length > 100000)
      return Alert.alert(
        'Entry is too long',
        'This entry exceeds 100,000 characters. Split it before analysis; the draft has not been discarded.',
      );
    setBusy(true);
    const now = new Date().toISOString();
    const entry: JournalEntry = {
      id: initial?.id || newId('entry'),
      revision: (initial?.revision || 0) + 1,
      journalDate: date,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: initial?.createdAt || now,
      updatedAt: now,
      title: title.trim(),
      body,
      mode,
      tags: parseTags(tags),
      inputSource: committed.current.length
        ? base.current
          ? 'mixed'
          : 'dictated'
        : initial?.inputSource || 'typed',
      analysisState: settings.analysisConsent ? 'pending' : 'not-requested',
    };
    try {
      if (initial) {
        await cancelEntryAnalysis(initial.id);
        await invalidateEntryReferences(initial.id, false);
      }
      await Vault.put('entry', entry);
      await Vault.delete('draft', draftId);
      if (settings.analysisConsent) await queueEntryAnalysis(entry);
      onSaved();
      if (settings.analysisConsent) void retryPendingAnalysisJobs();
    } catch (reason) {
      setBusy(false);
      Alert.alert('Save failed', errorMessage(reason));
    }
  };
  const modeDetails = journalMode(mode);
  return (
    <ScreenContainer>
      <KeyboardSafeScreen>
        <Header
          title={initial ? 'Edit entry' : modeDetails.title}
          onBack={onClose}
        />
        <SafeScrollView>
          <View style={styles.editorMode}>
            <Text style={styles.modeMark}>{modeDetails.mark}</Text>
            <View style={styles.mainFlex}>
              <Text style={styles.modeTitle}>{modeDetails.title}</Text>
              <Text style={styles.modeDetail}>{modeDetails.detail}</Text>
            </View>
          </View>
          <Field
            label="Title (optional)"
            value={title}
            onChangeText={setTitle}
          />
          <Text style={styles.label}>Your entry</Text>
          <TextInput
            accessibilityLabel="Journal entry"
            multiline
            placeholder={modeDetails.prompt}
            textAlignVertical="top"
            value={body}
            onChangeText={value => {
              if (!listening) setBody(value);
            }}
            editable={!listening}
            style={[styles.input, styles.editor]}
          />
          {Boolean(partial) && (
            <Text style={styles.partial}>Hearing: {partial}</Text>
          )}
          <View style={styles.row}>
            <Button
              secondary
              label={listening ? 'Stop dictation' : 'Dictate locally'}
              onPress={dictate}
            />
            {listening && (
              <Button
                danger
                label="Cancel"
                onPress={async () => {
                  await Vosk.cancel();
                  setBody(base.current);
                  committed.current = [];
                  setPartial('');
                  setListening(false);
                }}
              />
            )}
          </View>
          <Text style={styles.caption}>{status}</Text>
          <View style={styles.divider} />
          <Button
            label={busy ? 'Saving…' : 'Save entry'}
            disabled={busy || listening}
            onPress={save}
          />
        </SafeScrollView>
      </KeyboardSafeScreen>
    </ScreenContainer>
  );
}

export function EntryScreen({
  entry: onLoad,
  onBack,
  onEdit,
  onChanged,
}: {
  entry: JournalEntry;
  onBack: () => void;
  onEdit: (entry: JournalEntry) => void;
  onChanged: () => void;
}) {
  const [entry, setEntry] = useState(onLoad);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Vault.list<ExtractedItem>('extracted_item').then(all =>
      setItems(
        all.filter(item =>
          item.evidence.some(
            e => e.entryId === entry.id && e.entryRevision === entry.revision,
          ),
        ),
      ),
    );
  }, [entry]);
  const remove = () =>
    Alert.alert(
      'Delete this entry?',
      'Its dependent suggestions and job records will also be removed. Your other entries remain encrypted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await cancelEntryAnalysis(entry.id);
            await invalidateEntryReferences(entry.id, true);
            onChanged();
          },
        },
      ],
    );
  const reanalyze = async () => {
    setBusy(true);
    try {
      const queued = { ...entry, analysisState: 'pending' as const };
      await Vault.put('entry', queued);
      await queueEntryAnalysis(queued, true);
      setEntry(queued);
      void retryPendingAnalysisJobs();
      Alert.alert(
        'Insight refresh queued',
        'You can keep using Innerfolio. Analysis will continue automatically when the server is available.',
      );
    } catch (reason) {
      Alert.alert('Could not queue analysis', errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  const exportEntry = () =>
    Alert.alert(
      'Create readable export?',
      'A Markdown export is not protected by the vault password. Store and share it carefully.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () =>
            Documents.saveText(
              `${safeName(entry.title || 'entry')}.md`,
              'text/markdown',
              `# ${entry.title || 'Untitled'}\n\nDate: ${
                entry.journalDate
              }\n\n${entry.body}\n`,
            ).catch(reason =>
              Alert.alert('Export failed', errorMessage(reason)),
            ),
        },
      ],
    );
  return (
    <ScreenContainer>
      <Header title={entry.title || 'Entry'} onBack={onBack} />
      <SafeScrollView>
        <Text style={styles.cardDate}>
          {entry.journalDate} · {entry.inputSource}
        </Text>
        <Text selectable style={[styles.paragraph, styles.entryBody]}>
          {entry.body}
        </Text>
        <Text style={styles.tags}>
          {entry.tags.map(tag => `#${tag}`).join('  ')}
        </Text>
        <View style={styles.row}>
          <Button secondary label="Edit" onPress={() => onEdit(entry)} />
          <Button secondary label="Export" onPress={exportEntry} />
        </View>
        <Button
          secondary
          disabled={busy}
          label={busy ? 'Queuing…' : 'Refresh insights'}
          onPress={reanalyze}
        />
        <Text style={styles.h2}>Extracted suggestions</Text>
        {items.length ? (
          items.map(item => <EvidenceCard key={item.id} item={item} />)
        ) : (
          <Text style={styles.paragraph}>
            No current suggestions. Analysis is optional and requires consent.
          </Text>
        )}
        <Button danger label="Delete entry" onPress={remove} />
      </SafeScrollView>
    </ScreenContainer>
  );
}
