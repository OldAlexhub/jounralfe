import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { GuidanceBanner, GuidanceNativeAd } from '../components/ads';
import {
  KeyboardSafeScreen,
  SafeScrollView,
  ScreenContainer,
} from '../components/layout';
import type { Plan } from '../models';
import { Documents } from '../native';
import { PLAN_TEMPLATES, PlanTemplate } from '../planTemplates';
import { newId } from '../services/text';
import { Vault } from '../services/vault';
import { styles } from '../theme';
import {
  Button,
  Field,
  Header,
  SmallButton,
  errorMessage,
  safeName,
} from '../ui';

export function PlansScreen({
  refresh,
  onOpen,
  onTemplate,
}: {
  refresh: number;
  onOpen: (plan: Plan) => void;
  onTemplate: (template: PlanTemplate) => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => {
    Vault.list<Plan>('plan').then(setPlans);
  }, [refresh]);
  return (
    <ScreenContainer>
      <Header title="Plans" />
      <SafeScrollView>
        <Text style={styles.h2}>Your plans</Text>
        {plans.length ? (
          plans.map(plan => (
            <Pressable
              key={plan.id}
              onPress={() => onOpen(plan)}
              style={styles.card}
            >
              <Text style={styles.overline}>{plan.status}</Text>
              <Text style={styles.cardTitle}>{plan.title}</Text>
              <Text style={styles.cardBody}>
                {plan.sections.filter(section => section.manualAnswer).length}{' '}
                of {plan.sections.length} sections answered
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.paragraph}>
            No saved plans yet. Start with a template; missing information stays
            unanswered.
          </Text>
        )}
        <Text style={styles.h2}>General templates & guidance</Text>
        {PLAN_TEMPLATES.map(template => (
          <Pressable
            key={template.id}
            onPress={() => onTemplate(template)}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{template.title}</Text>
            <Text style={styles.cardBody}>{template.description}</Text>
            <Text style={styles.link}>Read guidance →</Text>
          </Pressable>
        ))}
      </SafeScrollView>
    </ScreenContainer>
  );
}

export function GuidanceScreen({
  template,
  onBack,
  onCreate,
}: {
  template: PlanTemplate;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <ScreenContainer>
      <Header title={template.title} onBack={onBack} />
      <View style={styles.mainFlex}>
        <SafeScrollView>
          <Text style={styles.lead}>{template.description}</Text>
          {template.sections.map((section, index) => (
            <React.Fragment key={section.title}>
              <View style={styles.guidance}>
                <Text style={styles.cardDate}>SECTION {index + 1}</Text>
                <Text style={styles.cardTitle}>{section.title}</Text>
                <Text style={styles.paragraph}>{section.guidance}</Text>
                {section.questions.map(question => (
                  <Text key={question} style={styles.question}>
                    • {question}
                  </Text>
                ))}
              </View>
              {index === 5 && <GuidanceNativeAd />}
            </React.Fragment>
          ))}
          <Button label="Create an editable plan" onPress={onCreate} />
          <Text style={styles.caption}>
            Template guidance is publisher-authored. Innerfolio never invents
            answers, market facts, budgets, or intentions.
          </Text>
        </SafeScrollView>
        <GuidanceBanner />
      </View>
    </ScreenContainer>
  );
}

export function PlanEditor({
  initial,
  onBack,
}: {
  initial: Plan;
  onBack: () => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [milestone, setMilestone] = useState('');
  const [task, setTask] = useState('');
  const save = async () => {
    const next = { ...plan, updatedAt: new Date().toISOString() };
    await Vault.put('plan', next);
    setPlan(next);
    Alert.alert('Plan saved', 'Your plan remains inside the encrypted vault.');
  };
  const exportPlan = () =>
    Alert.alert(
      'Create readable export?',
      'This Markdown or PDF file will not be encrypted by the vault.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Markdown',
          onPress: () =>
            Documents.saveText(
              `${safeName(plan.title)}.md`,
              'text/markdown',
              planMarkdown(plan),
            ).catch(reason =>
              Alert.alert('Export failed', errorMessage(reason)),
            ),
        },
        {
          text: 'PDF',
          onPress: () =>
            Documents.savePdf(
              `${safeName(plan.title)}.pdf`,
              plan.title,
              planMarkdown(plan),
            ).catch(reason =>
              Alert.alert('Export failed', errorMessage(reason)),
            ),
        },
      ],
    );
  return (
    <ScreenContainer>
      <KeyboardSafeScreen>
        <Header title="Plan editor" onBack={onBack} />
        <SafeScrollView>
          <Field
            label="Plan title"
            value={plan.title}
            onChangeText={title => setPlan({ ...plan, title })}
          />
          {plan.sections.map((section, index) => (
            <View key={section.id} style={styles.card}>
              <Text style={styles.overline}>SECTION {index + 1}</Text>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.caption}>{section.guidance}</Text>
              <TextInput
                accessibilityLabel={`${section.title} answer`}
                multiline
                placeholder={
                  section.unansweredQuestions[0] || 'Write your answer'
                }
                value={section.manualAnswer}
                onChangeText={manualAnswer =>
                  setPlan({
                    ...plan,
                    sections: plan.sections.map(value =>
                      value.id === section.id
                        ? { ...value, manualAnswer }
                        : value,
                    ),
                  })
                }
                style={[styles.input, styles.planAnswer]}
              />
              {!section.manualAnswer &&
                section.unansweredQuestions.map(question => (
                  <Text style={styles.question} key={question}>
                    Unanswered: {question}
                  </Text>
                ))}
            </View>
          ))}
          <Text style={styles.h2}>Milestones</Text>
          {plan.milestones.map(value => (
            <View key={value.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {value.done ? '✓ ' : ''}
                {value.label}
              </Text>
              {value.dueDate && (
                <Text style={styles.caption}>Due {value.dueDate}</Text>
              )}
              <SmallButton
                label={value.done ? 'Mark open' : 'Mark done'}
                onPress={() =>
                  setPlan({
                    ...plan,
                    milestones: plan.milestones.map(item =>
                      item.id === value.id
                        ? { ...item, done: !item.done }
                        : item,
                    ),
                  })
                }
              />
            </View>
          ))}
          <Field
            label="New milestone"
            value={milestone}
            onChangeText={setMilestone}
          />
          <Button
            secondary
            label="Add milestone"
            disabled={!milestone.trim()}
            onPress={() => {
              setPlan({
                ...plan,
                milestones: [
                  ...plan.milestones,
                  {
                    id: newId('milestone'),
                    label: milestone.trim(),
                    done: false,
                  },
                ],
              });
              setMilestone('');
            }}
          />
          <Text style={styles.h2}>Tasks</Text>
          {plan.tasks.map(value => (
            <View key={value.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {value.done ? '✓ ' : ''}
                {value.label}
              </Text>
              {value.dueDate && (
                <Text style={styles.caption}>Due {value.dueDate}</Text>
              )}
              <SmallButton
                label={value.done ? 'Mark open' : 'Mark done'}
                onPress={() =>
                  setPlan({
                    ...plan,
                    tasks: plan.tasks.map(item =>
                      item.id === value.id
                        ? { ...item, done: !item.done }
                        : item,
                    ),
                  })
                }
              />
            </View>
          ))}
          <Field label="New task" value={task} onChangeText={setTask} />
          <Button
            secondary
            label="Add task"
            disabled={!task.trim()}
            onPress={() => {
              setPlan({
                ...plan,
                tasks: [
                  ...plan.tasks,
                  { id: newId('task'), label: task.trim(), done: false },
                ],
              });
              setTask('');
            }}
          />
          <View style={styles.row}>
            <Button label="Save plan" onPress={save} />
            <Button secondary label="Export" onPress={exportPlan} />
          </View>
          <Button
            secondary
            label="Duplicate"
            onPress={async () => {
              const copy = {
                ...plan,
                id: newId('plan'),
                title: `${plan.title} copy`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await Vault.put('plan', copy);
              setPlan(copy);
            }}
          />
          <Button
            danger
            label="Delete plan"
            onPress={() =>
              Alert.alert(
                'Delete this plan?',
                'Journal entries and source evidence remain.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await Vault.delete('plan', plan.id);
                      onBack();
                    },
                  },
                ],
              )
            }
          />
          <Button
            secondary
            label={plan.status === 'archived' ? 'Reopen' : 'Archive'}
            onPress={() =>
              setPlan({
                ...plan,
                status: plan.status === 'archived' ? 'active' : 'archived',
              })
            }
          />
        </SafeScrollView>
      </KeyboardSafeScreen>
    </ScreenContainer>
  );
}

const planMarkdown = (plan: Plan) =>
  `# ${plan.title}\n\nStatus: ${plan.status}\n\n${plan.sections
    .map(
      section =>
        `## ${section.title}\n\n${
          section.manualAnswer || '_Unanswered_'
        }\n\n${section.unansweredQuestions
          .map(question => `- Question: ${question}`)
          .join('\n')}`,
    )
    .join('\n\n')}`;
