import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ExtractedItem } from './models';
import { ScreenContainer } from './components/layout';
import { styles } from './theme';

export function Header({
  title,
  onBack,
  onSettings,
  action,
}: {
  title: string;
  onBack?: () => void;
  onSettings?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>‹ Back</Text>
        </Pressable>
      ) : (
        <View />
      )}
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      {action ||
        (onSettings ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSettings}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>Settings</Text>
          </Pressable>
        ) : (
          <View />
        ))}
    </View>
  );
}
export function EvidenceCard({ item }: { item: ExtractedItem }) {
  return (
    <View style={styles.evidence}>
      <Text style={styles.overline}>
        {item.category} · {item.state}
      </Text>
      <Text style={styles.cardTitle}>{item.label}</Text>
      <Text style={styles.quote}>“{item.evidence[0]?.quote}”</Text>
      <Text style={styles.caption}>
        Source: entry revision {item.evidence[0]?.entryRevision}; offsets are
        UTF-16 code units.
      </Text>
    </View>
  );
}
export function Setting({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.setting}>
      <View style={styles.settingText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.caption}>{detail}</Text>
      </View>
      {children}
    </View>
  );
}
export function Field({
  label,
  secure = false,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  secure?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        secureTextEntry={secure}
        style={[styles.input, props.style]}
      />
    </View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        (pressed || disabled) && styles.buttonMuted,
      ]}
    >
      <Text
        style={[styles.buttonText, secondary && styles.buttonTextSecondary]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function SmallButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.smallButton}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}
export function Choice({
  selected,
  title,
  detail,
  onPress,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={styles.cardTitle}>
        {selected ? '●' : '○'} {title}
      </Text>
      <Text style={styles.caption}>{detail}</Text>
    </Pressable>
  );
}
export function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.info}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.paragraph}>{children}</Text>
    </View>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.paragraph}>{detail}</Text>
    </View>
  );
}
export function Centered({ title }: { title: string }) {
  return (
    <ScreenContainer style={styles.centered}>
      <Text style={styles.paragraph}>{title}</Text>
    </ScreenContainer>
  );
}
export function StatePill({ value }: { value: string }) {
  return <Text style={styles.state}>{value.replace('-', ' ')}</Text>;
}
export const errorMessage = (reason: unknown) =>
  reason instanceof Error
    ? reason.message
    : String(
        (reason as { message?: string })?.message ||
          reason ||
          'Something went wrong.',
      );
export const parseTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 20);
export const safeName = (value: string) =>
  value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 70) || 'Innerfolio';
