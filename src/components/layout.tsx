import React, { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appearance } from '../theme';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <View style={styles.shell}>
      <StatusBar
        barStyle={appearance.isDark() ? 'light-content' : 'dark-content'}
      />
      {children}
    </View>
  );
}

export function ScreenContainer({
  children,
  style,
}: PropsWithChildren<ViewProps>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}

export function KeyboardSafeScreen({ children }: PropsWithChildren) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function SafeScrollView({
  contentContainerStyle,
  ...props
}: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      {...props}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: Math.max(insets.bottom, 8) + 24 },
        contentContainerStyle,
      ]}
    />
  );
}

export function SafeAdContainer({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.ad, { paddingBottom: Math.max(insets.bottom, 0) }]}
      accessibilityLabel="Advertisement"
    >
      {children}
    </View>
  );
}

export type TabKey = 'journal' | 'discover' | 'about' | 'plans';
const tabs: Array<[TabKey, string, string]> = [
  ['journal', 'Journal', '▤'],
  ['discover', 'Discover', '⌁'],
  ['about', 'About Me', '◉'],
  ['plans', 'Plans', '✓'],
];

export function SafeBottomBar({
  selected,
  onSelect,
}: {
  selected: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {tabs.map(([key, label, icon]) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === key }}
          key={key}
          onPress={() => onSelect(key)}
          style={styles.tab}
        >
          <Text
            style={[styles.tabIcon, selected === key && styles.tabSelected]}
          >
            {icon}
          </Text>
          <Text
            style={[styles.tabLabel, selected === key && styles.tabSelected]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const lightStyles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F7F3EB' },
  screen: { flex: 1, backgroundColor: '#F7F3EB' },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  ad: {
    backgroundColor: '#EEF2EF',
    borderTopWidth: 1,
    borderColor: '#D8E1DC',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 1,
  },
  bottom: {
    flexDirection: 'row',
    backgroundColor: '#123D36',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2C574E',
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIcon: { fontSize: 19, color: '#9BB9B0' },
  tabLabel: { fontSize: 11, fontWeight: '700', color: '#B8CCC6' },
  tabSelected: { color: '#FFF3D8' },
});

const darkStyles = StyleSheet.create({
  shell: { backgroundColor: '#0F1715' },
  screen: { backgroundColor: '#0F1715' },
  ad: { backgroundColor: '#17231F', borderColor: '#34443F' },
});

const styles = new Proxy(lightStyles, {
  get(target, property: string) {
    const font =
      property === 'tabIcon'
        ? { fontSize: Math.round(19 * appearance.fontScale()) }
        : property === 'tabLabel'
        ? { fontSize: Math.round(11 * appearance.fontScale()) }
        : undefined;
    return [
      target[property as keyof typeof target],
      appearance.isDark() && darkStyles[property as keyof typeof darkStyles],
      font,
    ];
  },
}) as typeof lightStyles;
