import React, { useEffect, useRef, useState } from 'react';
import { AppState, useColorScheme, View } from 'react-native';
import { AppShell, SafeBottomBar, TabKey } from './components/layout';
import { initializeAds } from './components/ads';
import { DEFAULT_SETTINGS, JournalEntry, Plan, VaultSettings } from './models';
import { Vosk } from './native';
import { createPlan, PlanTemplate } from './planTemplates';
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
  | { name: 'editor'; entry?: JournalEntry }
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
      } else if (
        backgroundAt.current &&
        Date.now() - backgroundAt.current >= settings.lockAfterSeconds * 1000
      )
        onLock();
    });
    return () => subscription.remove();
  }, [settings.lockAfterSeconds, onLock]);
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
  let body: React.ReactNode;
  if (route.name === 'editor')
    body = (
      <EditorScreen
        initial={route.entry}
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
              onNew={() => setRoute({ name: 'editor' })}
              onOpen={entry => setRoute({ name: 'entry', entry })}
              onSettings={() => setRoute({ name: 'settings' })}
            />
          ) : tab === 'discover' ? (
            <DiscoverScreen refresh={refresh} />
          ) : tab === 'about' ? (
            <AboutScreen refresh={refresh} />
          ) : (
            <PlansScreen
              refresh={refresh}
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
