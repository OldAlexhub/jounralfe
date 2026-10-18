import type { Plan, PlanSection } from './models';
import { newId } from './services/text';

export interface PlanTemplate {
  id: string;
  version: number;
  title: string;
  description: string;
  sections: Array<{ title: string; guidance: string; questions: string[] }>;
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'business-concept',
    version: 1,
    title: 'Business concept plan',
    description: 'Clarify an idea before committing money or time.',
    sections: [
      {
        title: 'Idea and problem',
        guidance: 'State the idea and the specific problem it may address.',
        questions: [
          'What problem have you personally observed?',
          'Who experiences it?',
        ],
      },
      {
        title: 'Customer hypothesis',
        guidance: 'Record a testable hypothesis, not a claim of proven demand.',
        questions: [
          'Who might be the first customer?',
          'What evidence would change this hypothesis?',
        ],
      },
      {
        title: 'Proposed offering',
        guidance: 'Describe the smallest useful offering in your own words.',
        questions: [
          'What would be included?',
          'What is deliberately excluded?',
        ],
      },
      {
        title: 'Strengths and resources',
        guidance: 'Use only resources you have confirmed.',
        questions: ['Which skills, time, tools, or contacts are available?'],
      },
      {
        title: 'Constraints and risks',
        guidance:
          'List known limits and user-entered risks without inventing forecasts.',
        questions: [
          'What could prevent a fair test?',
          'Which assumption is most fragile?',
        ],
      },
      {
        title: 'Validation and next actions',
        guidance:
          'Choose inexpensive tests, milestones, and explicit next actions.',
        questions: [
          'What can you test this week?',
          'What result would support or reject the idea?',
        ],
      },
    ],
  },
  {
    id: 'business-launch',
    version: 1,
    title: 'Business launch/action plan',
    description: 'Turn a validated concept into an owned sequence of actions.',
    sections: [
      {
        title: 'Launch outcome',
        guidance: 'Define what “launched” means.',
        questions: ['What must be usable on launch day?'],
      },
      {
        title: 'Offer and audience',
        guidance: 'Use confirmed decisions and customer assumptions.',
        questions: ['Who is the initial audience?', 'What will they receive?'],
      },
      {
        title: 'Operations',
        guidance:
          'List the actual people, tools, approvals, and capacity required.',
        questions: [
          'Who owns each responsibility?',
          'What dependencies remain?',
        ],
      },
      {
        title: 'Milestones',
        guidance: 'Set observable checkpoints with dates you choose.',
        questions: ['What is the next irreversible decision?'],
      },
      {
        title: 'Risks and responses',
        guidance: 'Pair user-identified risks with practical responses.',
        questions: ['What will trigger a pause or change?'],
      },
    ],
  },
  {
    id: 'personal-90-day',
    version: 1,
    title: 'Personal 90-day plan',
    description: 'Connect a chosen outcome to weekly action and review.',
    sections: [
      {
        title: 'Desired outcome',
        guidance: 'Describe the outcome and editable timeframe.',
        questions: ['What would be observably different?'],
      },
      {
        title: 'Reasons and principles',
        guidance: 'Link only principles you have accepted.',
        questions: ['Why does this matter now?'],
      },
      {
        title: 'Constraints and commitments',
        guidance: 'Make existing demands visible.',
        questions: ['What time or energy limits should the plan respect?'],
      },
      {
        title: 'Milestones and schedule',
        guidance: 'Break the period into checkpoints.',
        questions: ['What must happen in the first two weeks?'],
      },
      {
        title: 'Review',
        guidance: 'Choose a recurring review question.',
        questions: ['What will you continue, stop, or adjust?'],
      },
    ],
  },
  {
    id: 'learning',
    version: 1,
    title: 'Learning plan',
    description: 'Define a skill, practice loop, evidence, and review rhythm.',
    sections: [
      {
        title: 'Capability',
        guidance: 'Name what you want to be able to do.',
        questions: ['What performance would demonstrate learning?'],
      },
      {
        title: 'Resources',
        guidance: 'List confirmed learning materials and people.',
        questions: ['Which resource will you start with?'],
      },
      {
        title: 'Practice',
        guidance: 'Plan repeated retrieval, application, and feedback.',
        questions: [
          'How often will you practice?',
          'Where will feedback come from?',
        ],
      },
      {
        title: 'Evidence and review',
        guidance: 'Use observable work rather than vague confidence.',
        questions: ['What will you produce?', 'When will you reassess?'],
      },
    ],
  },
  {
    id: 'decision-brief',
    version: 1,
    title: 'Decision brief',
    description: 'Frame a decision without manufacturing evidence.',
    sections: [
      {
        title: 'Decision',
        guidance: 'State the choice and decision date.',
        questions: ['What exactly must be decided?'],
      },
      {
        title: 'Criteria and principles',
        guidance: 'Choose criteria and user-confirmed principles.',
        questions: ['Which tradeoffs matter most?'],
      },
      {
        title: 'Options',
        guidance: 'Describe options neutrally.',
        questions: ['What options are genuinely available?'],
      },
      {
        title: 'Evidence and unknowns',
        guidance: 'Separate known evidence from assumptions and questions.',
        questions: [
          'What remains unknown?',
          'What information is worth gathering?',
        ],
      },
      {
        title: 'Decision and review',
        guidance: 'Record the decision, reasons, and revisit trigger.',
        questions: ['What would justify reopening it?'],
      },
    ],
  },
  {
    id: 'weekly-focus',
    version: 1,
    title: 'Weekly focus plan',
    description:
      'Select a small number of outcomes and protect space for them.',
    sections: [
      {
        title: 'Outcomes',
        guidance: 'Choose outcomes, not a limitless task list.',
        questions: ['What three results would make this week useful?'],
      },
      {
        title: 'Commitments',
        guidance: 'Account for commitments already made.',
        questions: ['What is fixed on the calendar?'],
      },
      {
        title: 'Focus blocks',
        guidance: 'Assign realistic work periods.',
        questions: ['When is focused work most plausible?'],
      },
      {
        title: 'Risks and boundaries',
        guidance: 'Anticipate interruptions and define boundaries.',
        questions: ['What will you decline or defer?'],
      },
      {
        title: 'Weekly review',
        guidance: 'Close the loop with facts and adjustments.',
        questions: ['What moved?', 'What needs to change next week?'],
      },
    ],
  },
];

export function createPlan(template: PlanTemplate): Plan {
  const now = new Date().toISOString();
  const sections: PlanSection[] = template.sections.map(section => ({
    id: newId('section'),
    title: section.title,
    guidance: section.guidance,
    sourceReferences: [],
    manualAnswer: '',
    acceptedAssumptions: [],
    unansweredQuestions: section.questions,
  }));
  return {
    id: newId('plan'),
    templateId: template.id,
    templateVersion: template.version,
    title: template.title,
    sections,
    milestones: [],
    tasks: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}
