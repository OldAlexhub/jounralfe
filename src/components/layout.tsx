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
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function KeyboardSafeScreen({ children }: PropsWithChildren) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function SafeScrollView({
  contentContainerStyle,
  style,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  ...props
}: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...props}
      style={[styles.flex, style]}
      keyboardDismissMode={
        keyboardDismissMode ||
        (Platform.OS === 'ios' ? 'interactive' : 'on-drag')
      }
      keyboardShouldPersistTaps={keyboardShouldPersistTaps || 'handled'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
      style={[
        styles.ad,
        {
          paddingBottom: Math.max(insets.bottom, 0),
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
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
      style={[
        styles.bottom,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          paddingLeft: Math.max(insets.left, 8),
          paddingRight: Math.max(insets.right, 8),
        },
      ]}
    >
      {tabs.map(([key, label, icon]) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === key }}
          key={key}
          onPress={() => onSelect(key)}
          style={[styles.tab, selected === key && styles.tabActive]}
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
  shell: { flex: 1, backgroundColor: '#F5F7F4' },
  screen: { flex: 1, backgroundColor: '#F5F7F4' },
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
    backgroundColor: '#FFF',
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E9E5',
    shadowColor: '#173F38',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 16,
  },
  tabActive: { backgroundColor: '#E8F3EF' },
  tabIcon: { fontSize: 19, color: '#789089' },
  tabLabel: { fontSize: 11, fontWeight: '700', color: '#6C817B' },
  tabSelected: { color: '#0F6654' },
});

const darkStyles = StyleSheet.create({
  shell: { backgroundColor: '#0F1715' },
  screen: { backgroundColor: '#0F1715' },
  ad: { backgroundColor: '#17231F', borderColor: '#34443F' },
  bottom: { backgroundColor: '#14201D', borderTopColor: '#2B3B36' },
  tabActive: { backgroundColor: '#234039' },
  tabIcon: { color: '#839A93' },
  tabLabel: { color: '#9AAFA9' },
  tabSelected: { color: '#C9F0E5' },
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
