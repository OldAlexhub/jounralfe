import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  KeyboardSafeScreen,
  SafeScrollView,
  ScreenContainer,
} from '../components/layout';
import type { ExtractedItem, Person, Topic } from '../models';
import { newId } from '../services/text';
import { Vault } from '../services/vault';
import { styles } from '../theme';
import {
  Button,
  Empty,
  EvidenceCard,
  Field,
  Header,
  SmallButton,
  parseTags,
} from '../ui';

export function DiscoverScreen({ refresh }: { refresh: number }) {
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
  const visible = items.filter(
    item => filter === 'all' || item.category === filter,
  );
  const renameTopic = async () => {
    if (!editingTopic || !topicLabel.trim()) return;
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
            title="Patterns need evidence"
            detail="Analyze reviewed text to receive suggestions. Small journals show ordinary phrases rather than forced topics."
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
              <Text style={styles.caption}>
                Suggestion status: {item.state}. Inspect the source before
                accepting.
              </Text>
              <View style={styles.row}>
                <SmallButton
                  label="Accept"
                  onPress={() => update(item, 'accepted')}
                />
                <SmallButton
                  label="Reclassify"
                  onPress={() => {
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
                  label="Dismiss"
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
        {topics.map(topic => (
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

export function AboutScreen({ refresh }: { refresh: number }) {
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [editing, setEditing] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [role, setRole] = useState('');
  useEffect(() => {
    Vault.list<ExtractedItem>('extracted_item').then(values =>
      setItems(
        values.filter(item => ['accepted', 'corrected'].includes(item.state)),
      ),
    );
    Vault.list<Person>('person').then(setPeople);
  }, [refresh]);
  const clearPersonForm = () => {
    setEditing(null);
    setName('');
    setAliases('');
    setRole('');
  };
  const savePerson = async () => {
    if (!name.trim())
      return Alert.alert('Name required', 'Enter a name before saving.');
    const now = new Date().toISOString();
    const person: Person = {
      id: editing?.id || newId('person'),
      displayName: name.trim(),
      confirmed: true,
      confirmedAliases: parseTags(aliases),
      confirmedRole: role.trim() || undefined,
      pinned: editing?.pinned || false,
      evidence: editing?.evidence || [],
      confirmedLinks: editing?.confirmedLinks || [],
      createdAt: editing?.createdAt || now,
      updatedAt: now,
    };
    await Vault.put('person', person);
    setPeople(values => [
      person,
      ...values.filter(value => value.id !== person.id),
    ]);
    clearPersonForm();
  };
  const editPerson = (person: Person) => {
    setEditing(person);
    setName(person.displayName);
    setAliases(person.confirmedAliases.join(', '));
    setRole(person.confirmedRole || '');
  };
  const groups = ['principle', 'value', 'goal', 'desire', 'commitment'];
  return (
    <ScreenContainer>
      <KeyboardSafeScreen>
        <Header title="About Me" />
        <SafeScrollView>
          <Text style={styles.paragraph}>
            A reflection of statements and priorities you confirmed—not a
            diagnosis, personality score, or claim about your inner life.
          </Text>
          {groups.map(group => (
            <View key={group}>
              <Text style={styles.h2}>
                {group[0].toUpperCase() + group.slice(1)}s
              </Text>
              {items.filter(item => item.category === group).length ? (
                items
                  .filter(item => item.category === group)
                  .map(item => <EvidenceCard key={item.id} item={item} />)
              ) : (
                <Text style={styles.caption}>No confirmed {group}s yet.</Text>
              )}
            </View>
          ))}
          <Text style={styles.h2}>People</Text>
          <Text style={styles.paragraph}>
            Names found in analyzed text remain separate suggestions until you
            confirm them. Matching first names are never merged automatically.
            Mention count is evidence of recurrence, not importance.
          </Text>
          {people.map(person => (
            <View key={person.id} style={styles.card}>
              <Text style={styles.overline}>
                {person.confirmed
                  ? 'confirmed person'
                  : 'unconfirmed suggestion'}
                {person.pinned ? ' · pinned' : ''}
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
                  label="Review / edit"
                  onPress={() => editPerson(person)}
                />
                <SmallButton
                  label={person.pinned ? 'Unpin' : 'Pin'}
                  onPress={async () => {
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
                  label="Delete"
                  onPress={() =>
                    Alert.alert(
                      'Delete this person?',
                      'Journal entries remain unchanged.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            await Vault.delete('person', person.id);
                            setPeople(values =>
                              values.filter(value => value.id !== person.id),
                            );
                            if (editing?.id === person.id) clearPersonForm();
                          },
                        },
                      ],
                    )
                  }
                />
              </View>
            </View>
          ))}
          <Text style={styles.h2}>
            {editing ? 'Review person' : 'Add a person'}
          </Text>
          <Field label="Display name" value={name} onChangeText={setName} />
          <Field
            label="Confirmed aliases, separated by commas"
            value={aliases}
            onChangeText={setAliases}
          />
          <Field
            label="Relationship / role (optional)"
            value={role}
            onChangeText={setRole}
          />
          <View style={styles.row}>
            <Button
              label={editing ? 'Confirm changes' : 'Add person'}
              onPress={savePerson}
            />
            {editing && (
              <Button secondary label="Cancel" onPress={clearPersonForm} />
            )}
          </View>
        </SafeScrollView>
      </KeyboardSafeScreen>
    </ScreenContainer>
  );
}
