import React, { useState } from 'react';
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  KeyboardSafeScreen,
  SafeScrollView,
  ScreenContainer,
} from '../components/layout';
import type { JournalEntry, VaultSettings } from '../models';
import { Documents, Reminders } from '../native';
import { localDate } from '../services/text';
import { Vault } from '../services/vault';
import { prepareRemoteDeletion } from '../services/analysis';
import { styles } from '../theme';
import {
  Button,
  Field,
  Header,
  Setting,
  SmallButton,
  errorMessage,
} from '../ui';
import {
  privacyOptionsRequired,
  showAdPrivacyOptions,
} from '../components/ads';

export function SettingsScreen({
  value,
  onChange,
  onBack,
  onLock,
}: {
  value: VaultSettings;
  onChange: (value: VaultSettings) => Promise<void>;
  onBack: () => void;
  onLock: () => void;
}) {
  const [current, setCurrent] = useState(value);
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [backupPassword, setBackupPassword] = useState('');
  const update = async (patch: Partial<VaultSettings>) => {
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    setCurrent(next);
    await onChange(next);
  };
  const toggleBio = async (enabled: boolean) => {
    try {
      if (enabled) {
        if (!(await Vault.biometricAvailable()))
          throw new Error(
            'Strong biometric authentication is unavailable on this device.',
          );
        await Vault.enableBiometric();
      } else await Vault.disableBiometric();
      await update({ biometricEnabled: enabled });
    } catch (reason) {
      Alert.alert('Biometric setting unchanged', errorMessage(reason));
    }
  };
  const reminder = async (enabled: boolean) => {
    if (
      enabled &&
      Platform.OS === 'android' &&
      Number(Platform.Version) >= 33
    ) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    if (enabled)
      await Reminders.schedule(current.reminder.hour, current.reminder.minute);
    else await Reminders.cancel();
    await update({ reminder: { ...current.reminder, enabled } });
  };
  const backup = async () => {
    if (backupPassword.length < 10)
      return Alert.alert(
        'Longer backup password needed',
        'Use at least 10 characters.',
      );
    try {
      const records = await Vault.backupRecords();
      await Documents.exportBackup(
        `Innerfolio-${localDate()}.innerfolio`,
        JSON.stringify(records),
        backupPassword,
      );
      Alert.alert(
        'Encrypted backup saved',
        'Keep its password separately. The server cannot recover it.',
      );
    } catch (reason) {
      if (!errorMessage(reason).toLowerCase().includes('cancel'))
        Alert.alert('Backup failed', errorMessage(reason));
    }
  };
  const restore = () =>
    Alert.alert(
      'Replace the current vault?',
      'A valid backup will be fully authenticated and checked before any current record is replaced.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose backup',
          style: 'destructive',
          onPress: async () => {
            try {
              const json = await Documents.importBackup(backupPassword);
              const parsed = JSON.parse(json);
              await Vault.replaceRecords(parsed);
              Alert.alert(
                'Restore complete',
                'The validated encrypted backup replaced the vault records.',
              );
            } catch (reason) {
              Alert.alert('Nothing was replaced', errorMessage(reason));
            }
          },
        },
      ],
    );
  const readableJson = () =>
    Alert.alert(
      'Create readable export?',
      'The JSON file is not encrypted by your vault password. Store and share it carefully.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              const entries = await Vault.list<JournalEntry>('entry');
              await Documents.saveText(
                `Innerfolio-entries-${localDate()}.json`,
                'application/json',
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    exportedAt: new Date().toISOString(),
                    entries,
                  },
                  null,
                  2,
                ),
              );
            } catch (reason) {
              Alert.alert('Export failed', errorMessage(reason));
            }
          },
        },
      ],
    );
  return (
    <ScreenContainer>
      <KeyboardSafeScreen>
        <Header title="Settings" onBack={onBack} />
        <SafeScrollView>
          <Setting title="Theme" detail={current.theme}>
            <Button
              secondary
              label="Cycle"
              onPress={() =>
                update({
                  theme:
                    current.theme === 'system'
                      ? 'light'
                      : current.theme === 'light'
                      ? 'dark'
                      : 'system',
                })
              }
            />
          </Setting>
          <Setting
            title="Font size"
            detail={`${Math.round(current.fontScale * 100)}%`}
          >
            <View style={styles.row}>
              <SmallButton
                label="−"
                onPress={() =>
                  update({ fontScale: Math.max(0.85, current.fontScale - 0.1) })
                }
              />
              <SmallButton
                label="＋"
                onPress={() =>
                  update({ fontScale: Math.min(1.5, current.fontScale + 0.1) })
                }
              />
            </View>
          </Setting>
          <Setting
            title="Lock after inactivity"
            detail={`${current.lockAfterSeconds} seconds`}
          >
            <Button
              secondary
              label="Cycle"
              onPress={() =>
                update({
                  lockAfterSeconds:
                    current.lockAfterSeconds === 30
                      ? 60
                      : current.lockAfterSeconds === 60
                      ? 300
                      : 30,
                })
              }
            />
          </Setting>
          <Toggle
            title="Biometric unlock"
            detail="Android Keystore protection; password unlock always remains available."
            value={current.biometricEnabled}
            onChange={toggleBio}
          />
          <Toggle
            title="Journal insights"
            detail="Analyze saved text for themes, goals, people, and connections. Voice stays on this phone."
            value={current.analysisConsent}
            onChange={analysisConsent => update({ analysisConsent })}
          />
          <Toggle
            title="Daily reminder"
            detail="Generic local notification at 8:00 PM; no private excerpts and no exact alarm."
            value={current.reminder.enabled}
            onChange={reminder}
          />
          {privacyOptionsRequired() && (
            <Setting title="Ad privacy choices" detail="Managed by Google UMP">
              <Button
                secondary
                label="Open privacy options"
                onPress={() =>
                  showAdPrivacyOptions().catch(reason =>
                    Alert.alert('Unavailable', errorMessage(reason)),
                  )
                }
              />
            </Setting>
          )}
          <Text style={styles.h2}>Password</Text>
          <Field
            secure
            label="Current password"
            value={passwords.current}
            onChangeText={currentPassword =>
              setPasswords({ ...passwords, current: currentPassword })
            }
          />
          <Field
            secure
            label="New password"
            value={passwords.next}
            onChangeText={next => setPasswords({ ...passwords, next })}
          />
          <Field
            secure
            label="Confirm new password"
            value={passwords.confirm}
            onChangeText={confirm => setPasswords({ ...passwords, confirm })}
          />
          <Button
            secondary
            label="Change vault password"
            onPress={async () => {
              if (passwords.next !== passwords.confirm)
                return Alert.alert('Passwords do not match');
              try {
                await Vault.changePassword(passwords.current, passwords.next);
                setPasswords({ current: '', next: '', confirm: '' });
                Alert.alert(
                  'Password changed',
                  'The vault key was safely rewrapped. Your data was not decrypted to disk.',
                );
              } catch (reason) {
                Alert.alert('Password unchanged', errorMessage(reason));
              }
            }}
          />
          <Text style={styles.h2}>Export & restore</Text>
          <Field
            secure
            label="Backup password"
            value={backupPassword}
            onChangeText={setBackupPassword}
          />
          <View style={styles.row}>
            <Button secondary label="Encrypted backup" onPress={backup} />
            <Button secondary label="Restore" onPress={restore} />
            <Button secondary label="Entries JSON" onPress={readableJson} />
          </View>
          <Button
            secondary
            label="Clear derived suggestions"
            onPress={() =>
              Alert.alert(
                'Clear derived suggestions?',
                'Journal entries and plans remain. Accepted and dismissed extraction records will be removed.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      await Vault.clearType('extracted_item');
                      await Vault.clearType('topic');
                      await Vault.clearType('observation');
                    },
                  },
                ],
              )
            }
          />
          <Toggle
            title="Store screenshot sample mode"
            detail="Shows clearly marked fictional content only when the real journal is empty."
            value={current.sampleMode}
            onChange={sampleMode => update({ sampleMode })}
          />
          <Setting
            title="Privacy policy"
            detail="Local vault, optional text processing, voice, and advertising."
          >
            <Button
              secondary
              label="Open"
              onPress={() =>
                Linking.openURL('https://journal.server.oldalexhub.com/privacy')
              }
            />
          </Setting>
          <Setting
            title="Version"
            detail="1.0.0 (1) · com.oldalexhub.innerfolio"
          >
            <View />
          </Setting>
          <Button secondary label="Lock now" onPress={onLock} />
          <Button
            danger
            label="Erase entire vault"
            onPress={() =>
              Alert.alert(
                'Erase the entire vault?',
                'This permanently removes entries, plans, derived information, and biometric access. If the server is unreachable, an encrypted deletion credential is retained only until the next successful retry.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Erase',
                    style: 'destructive',
                    onPress: async () => {
                      const remoteDeleted = await prepareRemoteDeletion();
                      await Vault.eraseVault();
                      onLock();
                      if (!remoteDeleted)
                        Alert.alert(
                          'Local vault erased',
                          'Server deletion is pending and will retry the next time Innerfolio opens with a network connection.',
                        );
                    },
                  },
                ],
              )
            }
          />
        </SafeScrollView>
      </KeyboardSafeScreen>
    </ScreenContainer>
  );
}

function Toggle({
  title,
  detail,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Setting title={title} detail={detail}>
      <Switch
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#398071' }}
      />
    </Setting>
  );
}
