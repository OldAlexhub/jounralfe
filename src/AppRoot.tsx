import React, { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, useColorScheme, View } from 'react-native';
import { AppShell, SafeBottomBar, TabKey } from './components/layout';
import { initializeAds } from './components/ads';
import {
  DEFAULT_SETTINGS,
  ExtractedItem,
  JournalEntry,
  JournalMode,
  Plan,
  VaultSettings,
} from './models';
import { Vosk } from './native';
import { createPlan, PLAN_TEMPLATES, PlanTemplate } from './planTemplates';
import { Vault } from './services/vault';
import {
  retryPendingAnalysisJobs,
  retryPendingRemoteDeletion,
} from './services/analysis';
import { AboutScreen, DiscoverScreen } from './screens/InsightScreens';
import { Onboarding, Unlock } from './screens/AuthScreens';
import {
  EditorScreen,
  EntryScreen,
  JournalScreen,
} from './screens/JournalScreens';
import { GuidanceScreen, PlanEditor, PlansScreen } from './screens/PlanScreens';
import { SettingsScreen } from './screens/SettingsScreen';
import { Centered } from './ui';
import { configureAppearance, styles } from './theme';

type Phase = 'loading' | 'onboarding' | 'locked' | 'ready';
type Route =
  | { name: 'tabs' }
  | { name: 'editor'; entry?: JournalEntry; mode?: JournalMode }
  | { name: 'entry'; entry: JournalEntry }
  | { name: 'settings' }
  | { name: 'guidance'; template: PlanTemplate }
  | { name: 'plan'; plan: Plan };

export function AppRoot() {
  const [phase, setPhase] = useState<Phase>('loading');
  const systemDark = useColorScheme() === 'dark';
  configureAppearance('system', 1, systemDark);
  useEffect(() => {
    void retryPendingRemoteDeletion();
    Vault.hasVault()
      .then(exists => setPhase(exists ? 'locked' : 'onboarding'))
      .catch(() => setPhase('onboarding'));
  }, []);
  if (phase === 'loading')
    return <Centered title="Opening your private space…" />;
  if (phase === 'onboarding')
    return <Onboarding onReady={() => setPhase('ready')} />;
  if (phase === 'locked') return <Unlock onReady={() => setPhase('ready')} />;
  return (
    <MainApp
      onLock={() => {
        void Vault.lock();
        setPhase('locked');
      }}
    />
  );
}

function MainApp({ onLock }: { onLock: () => void }) {
  const systemDark = useColorScheme() === 'dark';
  const [tab, setTab] = useState<TabKey>('journal');
  const [route, setRoute] = useState<Route>({ name: 'tabs' });
  const [settings, setSettings] = useState<VaultSettings>(DEFAULT_SETTINGS);
  const [refresh, setRefresh] = useState(0);
  const backgroundAt = useRef<number | null>(null);
  const lastInteraction = useRef(Date.now());
  configureAppearance(settings.theme, settings.fontScale, systemDark);
  useEffect(() => {
    Vault.get<VaultSettings>('settings', 'settings').then(value => {
      if (!value) return;
      setSettings(value);
      if (value.analysisConsent) void retryPendingAnalysisJobs();
    });
    void initializeAds();
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        backgroundAt.current = Date.now();
        void Vosk.cancel().catch(() => undefined);
      } else {
        if (settings.analysisConsent) void retryPendingAnalysisJobs();
        if (
          backgroundAt.current &&
          Date.now() - backgroundAt.current >= settings.lockAfterSeconds * 1000
        )
          onLock();
      }
    });
    return () => subscription.remove();
  }, [settings.analysisConsent, settings.lockAfterSeconds, onLock]);
  useEffect(() => {
    if (!settings.analysisConsent) return;
    const timer = setInterval(() => {
      void retryPendingAnalysisJobs();
    }, 60000);
    return () => clearInterval(timer);
  }, [settings.analysisConsent]);
  useEffect(() => {
    Keyboard.dismiss();
  }, [route.name, tab]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        Date.now() - lastInteraction.current >
        settings.lockAfterSeconds * 1000
      )
        onLock();
    }, 15000);
    return () => clearInterval(timer);
  }, [settings.lockAfterSeconds, onLock]);
  const changed = () => setRefresh(value => value + 1);
  const openEntry = (entryId: string) => {
    Vault.get<JournalEntry>('entry', entryId).then(entry => {
      if (entry) setRoute({ name: 'entry', entry });
    });
  };
  const createPlanFromInsight = async (item: ExtractedItem) => {
    const templateId =
      item.category === 'decision'
        ? 'decision-brief'
        : item.category === 'commitment'
        ? 'weekly-focus'
        : ['idea', 'project'].includes(item.category)
        ? 'business-concept'
        : 'personal-90-day';
    const template =
      PLAN_TEMPLATES.find(value => value.id === templateId) ||
      PLAN_TEMPLATES[2];
    const plan = createPlan(template);
    plan.title = item.label;
    plan.sections[0] = {
      ...plan.sections[0],
      manualAnswer: item.originalWording || item.label,
      sourceReferences: item.evidence,
    };
    await Vault.put('plan', plan);
    changed();
    setRoute({ name: 'plan', plan });
  };
  let body: React.ReactNode;
  if (route.name === 'editor')
    body = (
      <EditorScreen
        initial={route.entry}
        initialMode={route.mode}
        settings={settings}
        onClose={() => setRoute({ name: 'tabs' })}
        onSaved={() => {
          changed();
          setRoute({ name: 'tabs' });
        }}
      />
    );
  else if (route.name === 'entry')
    body = (
      <EntryScreen
        entry={route.entry}
        onBack={() => setRoute({ name: 'tabs' })}
        onEdit={entry => setRoute({ name: 'editor', entry })}
        onChanged={() => {
          changed();
          setRoute({ name: 'tabs' });
        }}
      />
    );
  else if (route.name === 'settings')
    body = (
      <SettingsScreen
        value={settings}
        onChange={async value => {
          setSettings(value);
          await Vault.put('settings', value);
        }}
        onBack={() => setRoute({ name: 'tabs' })}
        onLock={onLock}
      />
    );
  else if (route.name === 'guidance')
    body = (
      <GuidanceScreen
        template={route.template}
        onBack={() => setRoute({ name: 'tabs' })}
        onCreate={async () => {
          const plan = createPlan(route.template);
          await Vault.put('plan', plan);
          changed();
          setRoute({ name: 'plan', plan });
        }}
      />
    );
  else if (route.name === 'plan')
    body = (
      <PlanEditor
        initial={route.plan}
        onBack={() => {
          changed();
          setRoute({ name: 'tabs' });
        }}
      />
    );
  else
    body = (
      <>
        <View style={styles.mainFlex}>
          {tab === 'journal' ? (
            <JournalScreen
              refresh={refresh}
              sampleMode={settings.sampleMode}
              onNew={mode => setRoute({ name: 'editor', mode })}
              onOpen={entry => setRoute({ name: 'entry', entry })}
              onSettings={() => setRoute({ name: 'settings' })}
            />
          ) : tab === 'discover' ? (
            <DiscoverScreen
              refresh={refresh}
              sampleMode={settings.sampleMode}
              onOpenEntry={openEntry}
              onCreatePlan={createPlanFromInsight}
            />
          ) : tab === 'about' ? (
            <AboutScreen
              refresh={refresh}
              sampleMode={settings.sampleMode}
              onOpenEntry={openEntry}
              onCreatePlan={createPlanFromInsight}
            />
          ) : (
            <PlansScreen
              refresh={refresh}
              sampleMode={settings.sampleMode}
              onOpen={plan => setRoute({ name: 'plan', plan })}
              onTemplate={template => setRoute({ name: 'guidance', template })}
            />
          )}
        </View>
        <SafeBottomBar
          selected={tab}
          onSelect={value => {
            setTab(value);
            setRoute({ name: 'tabs' });
          }}
        />
      </>
    );
  return (
    <AppShell>
      <View
        style={styles.mainFlex}
        onTouchStart={() => {
          lastInteraction.current = Date.now();
        }}
      >
        {body}
      </View>
    </AppShell>
  );
}
