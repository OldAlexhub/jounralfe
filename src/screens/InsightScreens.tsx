import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeScrollView, ScreenContainer } from '../components/layout';
import type {
  AnalysisJob,
  ExtractedItem,
  JournalEntry,
  Person,
  Topic,
} from '../models';
import { Documents } from '../native';
import { localDate, newId } from '../services/text';
import { Vault } from '../services/vault';
import { styles } from '../theme';
import { Button, Empty, EvidenceCard, Field, Header, SmallButton } from '../ui';

const insightAssist = (category: ExtractedItem['category']) => {
  switch (category) {
    case 'goal':
      return 'Turn this outcome into milestones and a first next step.';
    case 'commitment':
      return 'Protect time for this promise or add it to a weekly focus plan.';
    case 'decision':
      return 'Capture the options, criteria, and review point in a decision brief.';
    case 'idea':
    case 'project':
      return 'Shape this into a testable plan before investing more time.';
    case 'constraint':
      return 'Use this boundary to make plans more realistic.';
    case 'question':
      return 'Keep this visible until you have enough evidence to answer it.';
    case 'principle':
    case 'value':
      return 'Use this as a filter when goals or decisions compete.';
    default:
      return 'Keep it if it helps you understand what matters next.';
  }
};

const sampleNotice = () =>
  Alert.alert(
    'Sample content',
    'Turn off sample mode before changing insights or creating plans.',
  );

const SAMPLE_ENTRY: JournalEntry = {
  id: 'sample-entry',
  revision: 1,
  journalDate: '2026-10-18',
  timezone: 'America/New_York',
  createdAt: '2026-10-18T13:00:00Z',
  updatedAt: '2026-10-18T13:00:00Z',
  title: 'A calmer launch plan',
  body: 'I want to test the workshop idea with five conversations before choosing a venue. I value leaving room for family evenings. Maya offered to help me shape the first questions.',
  mode: 'goal',
  inputSource: 'typed',
  tags: ['sample', 'planning'],
  analysisState: 'complete',
};

const sampleEvidence = (quote: string) => ({
  entryId: SAMPLE_ENTRY.id,
  entryRevision: 1,
  quote,
  start: SAMPLE_ENTRY.body.indexOf(quote),
  end: SAMPLE_ENTRY.body.indexOf(quote) + quote.length,
  offsetConvention: 'utf16-code-unit' as const,
  contentHash: 'sample-content',
  extractionVersion: 'sample-v1',
});

const SAMPLE_ITEMS: ExtractedItem[] = [
  {
    id: 'sample-goal',
    category: 'goal',
    originalWording: 'test the workshop idea with five conversations',
    label: 'Test the workshop idea with five conversations',
    subject: null,
    temporal: {},
    modality: 'stated',
    negated: false,
    evidence: [
      sampleEvidence(
        'test the workshop idea with five conversations before choosing a venue',
      ),
    ],
    state: 'accepted',
    createdAt: '2026-10-18T13:00:00Z',
    updatedAt: '2026-10-18T13:00:00Z',
  },
  {
    id: 'sample-value',
    category: 'value',
    originalWording: 'leaving room for family evenings',
    label: 'Protect time for family evenings',
    subject: null,
    temporal: {},
    modality: 'stated',
    negated: false,
    evidence: [sampleEvidence('leaving room for family evenings')],
    state: 'accepted',
    createdAt: '2026-10-18T13:00:00Z',
    updatedAt: '2026-10-18T13:00:00Z',
  },
];

const SAMPLE_TOPICS: Topic[] = [
  {
    id: 'sample-topic',
    label: 'Thoughtful experiments',
    terms: ['workshop', 'conversations', 'test'],
    linkedEntryIds: [SAMPLE_ENTRY.id],
    method: 'phrase-groups',
    version: 'sample-v1',
    history: [],
    updatedAt: '2026-10-18T13:00:00Z',
  },
];

const SAMPLE_PEOPLE: Person[] = [
  {
    id: 'sample-person',
    displayName: 'Maya',
    confirmed: true,
    confirmedAliases: [],
    confirmedRole: 'Creative collaborator',
    pinned: true,
    evidence: [sampleEvidence('Maya')],
    confirmedLinks: [],
    createdAt: '2026-10-18T13:00:00Z',
    updatedAt: '2026-10-18T13:00:00Z',
  },
];

export function DiscoverScreen({
  refresh,
  sampleMode,
  onOpenEntry,
  onCreatePlan,
}: {
  refresh: number;
  sampleMode: boolean;
  onOpenEntry: (entryId: string) => void;
  onCreatePlan: (item: ExtractedItem) => void;
}) {
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicLabel, setTopicLabel] = useState('');
  const [mergeSource, setMergeSource] = useState<Topic | null>(null);
  useEffect(() => {
    Vault.list<ExtractedItem>('extracted_item').then(setItems);
    Vault.list<Topic>('topic').then(setTopics);
  }, [refresh]);
  const update = async (item: ExtractedItem, state: ExtractedItem['state']) => {
    if (item.id.startsWith('sample-')) return sampleNotice();
    const next = { ...item, state, updatedAt: new Date().toISOString() };
    await Vault.put('extracted_item', next);
    setItems(values =>
      values.map(value => (value.id === item.id ? next : value)),
    );
  };
  const categories = [
    'all',
    'idea',
    'goal',
    'commitment',
    'decision',
    'principle',
    'constraint',
  ];
  const samples = sampleMode && items.length === 0 && topics.length === 0;
  const availableItems = samples ? SAMPLE_ITEMS : items;
  const availableTopics = samples ? SAMPLE_TOPICS : topics;
  const visible = availableItems.filter(
    item => filter === 'all' || item.category === filter,
  );
  const actionCategories = [
    'idea',
    'project',
    'goal',
    'commitment',
    'decision',
  ];
  const renameTopic = async () => {
    if (!editingTopic || !topicLabel.trim()) return;
    if (editingTopic.id.startsWith('sample-')) return sampleNotice();
    const next: Topic = {
      ...editingTopic,
      label: topicLabel.trim(),
      history: [
        ...editingTopic.history,
        {
          action: 'rename',
          at: new Date().toISOString(),
          details: `Renamed from ${editingTopic.label}`,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    await Vault.put('topic', next);
    setTopics(values =>
      values.map(value => (value.id === next.id ? next : value)),
    );
    setEditingTopic(null);
    setTopicLabel('');
  };
  const mergeTopic = async (topic: Topic) => {
    if (topic.id.startsWith('sample-')) return sampleNotice();
    if (!mergeSource) return setMergeSource(topic);
    if (mergeSource.id === topic.id) return setMergeSource(null);
    const now = new Date().toISOString();
    const next: Topic = {
      ...mergeSource,
      label: `${mergeSource.label} / ${topic.label}`,
      terms: Array.from(new Set([...mergeSource.terms, ...topic.terms])),
      linkedEntryIds: Array.from(
        new Set([...mergeSource.linkedEntryIds, ...topic.linkedEntryIds]),
      ),
      history: [
        ...mergeSource.history,
        ...topic.history,
        { action: 'merge', at: now, details: `Merged ${topic.label}` },
      ],
      updatedAt: now,
    };
    await Vault.put('topic', next);
    await Vault.delete('topic', topic.id);
    setTopics(values => [
      next,
      ...values.filter(value => ![next.id, topic.id].includes(value.id)),
    ]);
    setMergeSource(null);
  };
  const splitTopic = async (topic: Topic) => {
    if (topic.id.startsWith('sample-')) return sampleNotice();
    if (topic.terms.length < 2)
      return Alert.alert(
        'Nothing to split',
        'This topic contains only one term.',
      );
    const now = new Date().toISOString();
    const parts: Topic[] = topic.terms.map(term => ({
      ...topic,
      id: newId('topic'),
      label: term,
      terms: [term],
      history: [
        ...topic.history,
        { action: 'split', at: now, details: `Split from ${topic.label}` },
      ],
      updatedAt: now,
    }));
    await Promise.all(parts.map(value => Vault.put('topic', value)));
    await Vault.delete('topic', topic.id);
    setTopics(values => [
      ...parts,
      ...values.filter(value => value.id !== topic.id),
    ]);
  };
  return (
    <ScreenContainer>
      <Header title="Discover" />
      <SafeScrollView>
        <View style={styles.discoverHero}>
          <Text style={styles.overline}>Your journal, working for you</Text>
          <Text style={styles.h1}>Find the signal. Choose the next move.</Text>
          <Text style={styles.paragraph}>
            Innerfolio organizes useful moments from your writing and helps you
            turn them into action.
          </Text>
        </View>
        {samples && (
          <Text style={styles.sampleBadge}>
            SAMPLE CONTENT · never mixed with your vault
          </Text>
        )}
        <View style={styles.chips}>
          {categories.map(category => (
            <Pressable
              key={category}
              onPress={() => setFilter(category)}
              style={[styles.chip, filter === category && styles.chipActive]}
            >
              <Text
                style={
                  filter === category ? styles.chipTextActive : styles.chipText
                }
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </View>
        {visible.length === 0 ? (
          <Empty
            title="Your next insight starts in the journal"
            detail="Try a Goal Review, Decision, or Idea Capture. Innerfolio will organize the useful signals after you save."
          />
        ) : (
          visible.map(item => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.overline}>
                {item.category} · {item.modality}
                {item.negated ? ' · negated' : ''}
              </Text>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.quote}>“{item.evidence[0]?.quote}”</Text>
              <Text style={styles.caption}>{insightAssist(item.category)}</Text>
              <View style={styles.row}>
                <SmallButton
                  label={
                    ['accepted', 'corrected'].includes(item.state)
                      ? 'Kept'
                      : 'Keep insight'
                  }
                  onPress={() => update(item, 'accepted')}
                />
                {item.evidence[0]?.entryId && (
                  <SmallButton
                    label="Open source"
                    onPress={() =>
                      item.id.startsWith('sample-')
                        ? sampleNotice()
                        : onOpenEntry(item.evidence[0].entryId)
                    }
                  />
                )}
                {actionCategories.includes(item.category) && (
                  <SmallButton
                    label="Make a plan"
                    onPress={() =>
                      item.id.startsWith('sample-')
                        ? sampleNotice()
                        : onCreatePlan(item)
                    }
                  />
                )}
                <SmallButton
                  label="Change type"
                  onPress={() => {
                    if (item.id.startsWith('sample-')) return sampleNotice();
                    const cycle: ExtractedItem['category'][] = [
                      'idea',
                      'goal',
                      'commitment',
                      'decision',
                    ];
                    const next = {
                      ...item,
                      category:
                        cycle[
                          (cycle.indexOf(item.category) + 1) % cycle.length
                        ],
                      state: 'corrected' as const,
                      updatedAt: new Date().toISOString(),
                    };
                    Vault.put('extracted_item', next).then(() =>
                      setItems(values =>
                        values.map(value =>
                          value.id === item.id ? next : value,
                        ),
                      ),
                    );
                  }}
                />
                <SmallButton
                  label="Not useful"
                  onPress={() => update(item, 'dismissed')}
                />
              </View>
            </View>
          ))
        )}
        <Text style={styles.h2}>Topics</Text>
        <Text style={styles.paragraph}>
          Phrase groups are suggestions, not proof of shared meaning. Rename,
          merge, split, or dismiss them to match your own organization.
        </Text>
        {mergeSource && (
          <Text style={styles.caption}>
            Merge mode: choose a different topic to combine with “
            {mergeSource.label}”.
          </Text>
        )}
        {availableTopics.map(topic => (
          <View key={topic.id} style={styles.card}>
            <Text style={styles.overline}>{topic.method}</Text>
            <Text style={styles.cardTitle}>{topic.label}</Text>
            <Text style={styles.tags}>{topic.terms.join(' · ')}</Text>
            <Text style={styles.caption}>
              Linked to {topic.linkedEntryIds.length} distinct entry/entries.
            </Text>
            <View style={styles.row}>
              <SmallButton
                label="Rename"
                onPress={() => {
                  setEditingTopic(topic);
                  setTopicLabel(topic.label);
                }}
              />
              <SmallButton
                label={mergeSource?.id === topic.id ? 'Cancel merge' : 'Merge'}
                onPress={() => mergeTopic(topic)}
              />
              <SmallButton label="Split" onPress={() => splitTopic(topic)} />
              <SmallButton
                label="Dismiss"
                onPress={async () => {
                  if (topic.id.startsWith('sample-')) return sampleNotice();
                  await Vault.delete('topic', topic.id);
                  setTopics(values =>
                    values.filter(value => value.id !== topic.id),
                  );
                }}
              />
            </View>
          </View>
        ))}
        {editingTopic && (
          <View style={styles.card}>
            <Field
              label="Topic label"
              value={topicLabel}
              onChangeText={setTopicLabel}
            />
            <View style={styles.row}>
              <Button label="Save label" onPress={renameTopic} />
              <Button
                secondary
                label="Cancel"
                onPress={() => setEditingTopic(null)}
              />
            </View>
          </View>
        )}
      </SafeScrollView>
    </ScreenContainer>
  );
}

export function AboutScreen({
  refresh,
  sampleMode,
  registerBackHandler,
  onOpenEntry,
  onCreatePlan,
}: {
  refresh: number;
  sampleMode: boolean;
  registerBackHandler: (handler: null | (() => void)) => void;
  onOpenEntry: (entryId: string) => void;
  onCreatePlan: (item: ExtractedItem) => void;
}) {
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  useEffect(() => {
    registerBackHandler(
      showAnalytics ? () => setShowAnalytics(false) : null,
    );
    return () => registerBackHandler(null);
  }, [registerBackHandler, showAnalytics]);
  useEffect(() => {
    Vault.list<ExtractedItem>('extracted_item').then(values =>
      setItems(
        values.filter(item => !['dismissed', 'withdrawn'].includes(item.state)),
      ),
    );
    Vault.list<Person>('person').then(setPeople);
    Vault.list<JournalEntry>('entry').then(setEntries);
    Vault.list<AnalysisJob>('analysis_job').then(values =>
      setPendingCount(
        values.filter(
          value => !['completed', 'cancelled'].includes(value.status),
        ).length,
      ),
    );
  }, [refresh]);
  const groups = ['principle', 'value', 'goal', 'desire', 'commitment'];
  const samples =
    sampleMode &&
    items.length === 0 &&
    people.length === 0 &&
    entries.length === 0;
  const availableItems = samples ? SAMPLE_ITEMS : items;
  const availablePeople = samples ? SAMPLE_PEOPLE : people;
  const availableEntries = samples ? [SAMPLE_ENTRY] : entries;
  const nextMoves = availableItems
    .filter(item =>
      ['goal', 'commitment', 'decision', 'idea', 'project'].includes(
        item.category,
      ),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  if (showAnalytics)
    return (
      <InsightAnalytics
        entries={availableEntries}
        items={availableItems}
        people={availablePeople}
        pendingCount={pendingCount}
        sampleMode={samples}
        onBack={() => setShowAnalytics(false)}
      />
    );
  return (
    <ScreenContainer>
      <Header title="About Me" />
      <SafeScrollView>
        <View style={styles.insightHero}>
          <Text style={styles.overline}>Your living portrait</Text>
          <Text style={styles.h1}>See the patterns shaping your story.</Text>
          <Text style={styles.paragraph}>
            Innerfolio brings together the priorities, goals, relationships, and
            themes that emerge from your journal over time.
          </Text>
          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{availableEntries.length}</Text>
              <Text style={styles.metricLabel}>entries</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{availableItems.length}</Text>
              <Text style={styles.metricLabel}>insights</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{availablePeople.length}</Text>
              <Text style={styles.metricLabel}>people</Text>
            </View>
          </View>
          <Button
            label="Deepen my insights"
            onPress={() => setShowAnalytics(true)}
          />
        </View>
        {samples && (
          <Text style={styles.sampleBadge}>
            SAMPLE CONTENT · never mixed with your vault
          </Text>
        )}
        {nextMoves.length > 0 && (
          <View style={styles.actionPanel}>
            <Text style={styles.overline}>Put insight to work</Text>
            <Text style={styles.h2}>Next moves</Text>
            <Text style={styles.paragraph}>
              Turn what Innerfolio noticed into a focused plan or revisit the
              journal moment behind it.
            </Text>
            {nextMoves.map(item => (
              <View key={item.id} style={styles.actionItem}>
                <View style={styles.mainFlex}>
                  <Text style={styles.timelineMode}>{item.category}</Text>
                  <Text style={styles.cardTitle}>{item.label}</Text>
                </View>
                <View style={styles.row}>
                  {item.evidence[0]?.entryId && (
                    <SmallButton
                      label="Open source"
                      onPress={() =>
                        item.id.startsWith('sample-')
                          ? sampleNotice()
                          : onOpenEntry(item.evidence[0].entryId)
                      }
                    />
                  )}
                  <SmallButton
                    label="Make a plan"
                    onPress={() =>
                      item.id.startsWith('sample-')
                        ? sampleNotice()
                        : onCreatePlan(item)
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        )}
        {availableItems.length === 0 ? (
          <Empty
            title="Your portrait is taking shape"
            detail="Keep journaling. Themes, goals, commitments, and useful next moves will appear here automatically."
          />
        ) : (
          <>
            <Text style={styles.h2}>What Innerfolio noticed</Text>
            {groups.map(group => {
              const groupItems = availableItems.filter(
                item => item.category === group,
              );
              if (!groupItems.length) return null;
              return (
                <View key={group}>
                  <Text style={styles.insightSectionTitle}>
                    {group[0].toUpperCase() + group.slice(1)}s
                  </Text>
                  {groupItems.map(item => (
                    <EvidenceCard key={item.id} item={item} />
                  ))}
                </View>
              );
            })}
          </>
        )}
        {availablePeople.length > 0 && (
          <>
            <Text style={styles.h2}>People in your story</Text>
            {availablePeople.map(person => (
              <View key={person.id} style={styles.card}>
                <Text style={styles.overline}>
                  {person.pinned ? 'Pinned connection' : 'From your journal'}
                </Text>
                <Text style={styles.cardTitle}>{person.displayName}</Text>
                {person.confirmedRole && (
                  <Text style={styles.cardBody}>{person.confirmedRole}</Text>
                )}
                {person.confirmedAliases.length > 0 && (
                  <Text style={styles.tags}>
                    Aliases: {person.confirmedAliases.join(', ')}
                  </Text>
                )}
                <Text style={styles.caption}>
                  {person.evidence.length} supporting passage(s)
                </Text>
                <View style={styles.row}>
                  <SmallButton
                    label={person.pinned ? 'Unpin' : 'Pin'}
                    onPress={async () => {
                      if (person.id.startsWith('sample-')) return sampleNotice();
                      const next = {
                        ...person,
                        pinned: !person.pinned,
                        updatedAt: new Date().toISOString(),
                      };
                      await Vault.put('person', next);
                      setPeople(values =>
                        values.map(value =>
                          value.id === person.id ? next : value,
                        ),
                      );
                    }}
                  />
                  <SmallButton
                    label="Remove"
                    onPress={() => {
                      if (person.id.startsWith('sample-')) return sampleNotice();
                      Alert.alert(
                        'Remove this person?',
                        'Your journal entries will stay unchanged.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: async () => {
                              await Vault.delete('person', person.id);
                              setPeople(values =>
                                values.filter(value => value.id !== person.id),
                              );
                            },
                          },
                        ],
                      );
                    }}
                  />
                </View>
              </View>
            ))}
          </>
        )}
      </SafeScrollView>
    </ScreenContainer>
  );
}

function InsightAnalytics({
  entries,
  items,
  people,
  pendingCount,
  sampleMode,
  onBack,
}: {
  entries: JournalEntry[];
  items: ExtractedItem[];
  people: Person[];
  pendingCount: number;
  sampleMode: boolean;
  onBack: () => void;
}) {
  const categoryMap = new Map<string, number>();
  items.forEach(item =>
    categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1),
  );
  const categories = Array.from(categoryMap, ([key, value]) => ({
    key,
    label: `${key[0].toUpperCase()}${key.slice(1)}s`,
    value,
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const monthMap = new Map<string, number>();
  entries.forEach(entry => {
    const month = entry.journalDate.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
  });
  const months = Array.from(monthMap, ([key, value]) => ({
    key,
    label: new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: '2-digit',
    }).format(new Date(`${key}-01T12:00:00`)),
    value,
  }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6);

  const analyzed = entries.filter(
    entry => entry.analysisState === 'complete',
  ).length;
  const coverage = entries.length
    ? Math.round((analyzed / entries.length) * 100)
    : 0;
  const wordCount = entries.reduce(
    (total, entry) =>
      total + (entry.body.trim() ? entry.body.trim().split(/\s+/u).length : 0),
    0,
  );
  const peopleRows = [...people]
    .sort((a, b) => b.evidence.length - a.evidence.length)
    .slice(0, 12);

  const download = () => {
    const data = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      summary: {
        entries: entries.length,
        words: wordCount,
        analyzedEntries: analyzed,
        analysisCoveragePercent: coverage,
        pendingAnalyses: pendingCount,
        insights: items.length,
        people: people.length,
      },
      activityByMonth: months.map(({ key, value }) => ({
        month: key,
        entries: value,
      })),
      insightCategories: categories.map(({ key, value }) => ({
        category: key,
        count: value,
      })),
      people: peopleRows.map(person => ({
        name: person.displayName,
        supportingPassages: person.evidence.length,
        pinned: person.pinned,
      })),
    };
    Documents.saveText(
      `Innerfolio-insights-${localDate()}.json`,
      'application/json',
      JSON.stringify(data, null, 2),
    ).catch(reason =>
      Alert.alert(
        'Download unavailable',
        reason instanceof Error ? reason.message : String(reason),
      ),
    );
  };

  return (
    <ScreenContainer>
      <Header title="Deeper insights" onBack={onBack} />
      <SafeScrollView>
        {sampleMode && (
          <Text style={styles.sampleBadge}>
            SAMPLE CONTENT · never mixed with your vault
          </Text>
        )}
        <Text style={styles.lead}>
          A clear view of your journaling rhythm, recurring themes, and the
          connections already found in your writing.
        </Text>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{entries.length}</Text>
            <Text style={styles.metricLabel}>entries</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{wordCount}</Text>
            <Text style={styles.metricLabel}>words captured</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{coverage}%</Text>
            <Text style={styles.metricLabel}>analyzed</Text>
          </View>
        </View>

        <InsightChart
          title="Journal activity"
          detail="Entries written over the last six active months"
          rows={months}
          empty="Your activity chart will grow as you journal."
        />
        <InsightChart
          title="Insight map"
          detail="The ideas and intentions appearing in your writing"
          rows={categories}
          empty="Insights will appear after your first analyzed entries."
        />

        <View style={styles.chartCard}>
          <Text style={styles.h2}>People in your story</Text>
          <Text style={styles.caption}>
            Supporting passages show recurrence, not importance.
          </Text>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Person</Text>
            <Text style={styles.tableHeaderText}>Passages</Text>
          </View>
          {peopleRows.length ? (
            peopleRows.map(person => (
              <View key={person.id} style={styles.tableRow}>
                <Text numberOfLines={1} style={styles.tableLabel}>
                  {person.displayName}
                </Text>
                <Text style={styles.tableValue}>{person.evidence.length}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.chartEmpty}>
              People will appear as they are found in your journal.
            </Text>
          )}
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.h2}>Analysis coverage</Text>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Ready</Text>
            <Text style={styles.tableValue}>{analyzed}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Updating</Text>
            <Text style={styles.tableValue}>{pendingCount}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Total entries</Text>
            <Text style={styles.tableValue}>{entries.length}</Text>
          </View>
        </View>

        <Button label="Download insight data" onPress={download} />
      </SafeScrollView>
    </ScreenContainer>
  );
}

function InsightChart({
  title,
  detail,
  rows,
  empty,
}: {
  title: string;
  detail: string;
  rows: Array<{ key: string; label: string; value: number }>;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return (
    <View style={styles.chartCard}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.caption}>{detail}</Text>
      {rows.length ? (
        rows.map(row => (
          <View key={row.key} style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={styles.tableLabel}>{row.label}</Text>
              <Text style={styles.tableValue}>{row.value}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.max(5, (row.value / max) * 100)}%` },
                ]}
              />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.chartEmpty}>{empty}</Text>
      )}
    </View>
  );
}
