import React, { useEffect, useState } from 'react';
import { Image, Keyboard, Text } from 'react-native';
import {
  KeyboardSafeScreen,
  SafeScrollView,
  ScreenContainer,
} from '../components/layout';
import { DEFAULT_SETTINGS } from '../models';
import { Vault } from '../services/vault';
import { styles } from '../theme';
import { Button, Field, InfoCard, errorMessage } from '../ui';

export function Onboarding({ onReady }: { onReady: () => void }) {
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finish = async () => {
    if (password.length < 10)
      return setError(
        'Use at least 10 characters. A longer passphrase is easier to remember and harder to guess.',
      );
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await Vault.createVault(password);
      await Vault.put('settings', {
        ...DEFAULT_SETTINGS,
        updatedAt: new Date().toISOString(),
      });
      Keyboard.dismiss();
      onReady();
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(false);
    }
  };
  return (
    <ScreenContainer>
      <KeyboardSafeScreen>
        <SafeScrollView contentContainerStyle={styles.centerColumn}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brand}>Innerfolio</Text>
          <Text style={styles.tagline}>Your thoughts, connected.</Text>
          {step === 0 ? (
            <>
              <InfoCard title="Private by design">
                Your journal and plans live in an encrypted vault on this
                device. There is no consumer account or cloud sync.
              </InfoCard>
              <InfoCard title="Dictation stays here">
                English speech recognition runs on your Android phone. The app
                keeps editable text—not recordings.
              </InfoCard>
              <InfoCard title="Optional text analysis">
                Turn journal entries into useful themes, goals, and connections.
                You can switch analysis off anytime in Settings.
              </InfoCard>
              <Button label="Continue" onPress={() => setStep(1)} />
            </>
          ) : (
            <>
              <Text style={styles.h1}>Protect your vault</Text>
              <Text style={styles.paragraph}>
                There is no server password reset. Without your password, a
                valid biometric unlock, or an encrypted backup, the journal
                cannot be recovered.
              </Text>
              <Field
                secure
                label="Password"
                value={password}
                onChangeText={setPassword}
              />
              <Field
                secure
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
              />
              {Boolean(error) && <Text style={styles.error}>{error}</Text>}
              <Button
                label={busy ? 'Creating encrypted vault…' : 'Create vault'}
                disabled={busy}
                onPress={finish}
              />
            </>
          )}
        </SafeScrollView>
      </KeyboardSafeScreen>
    </ScreenContainer>
  );
}

export function Unlock({ onReady }: { onReady: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bio, setBio] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Vault.biometricEnabled()
      .then(setBio)
      .catch(() => {});
  }, []);
  const unlock = async () => {
    setBusy(true);
    setError('');
    try {
      await Vault.unlock(password);
      Keyboard.dismiss();
      onReady();
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(false);
    }
  };
  const biometric = async () => {
    setError('');
    try {
      await Vault.unlockBiometric();
      Keyboard.dismiss();
      onReady();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  return (
    <ScreenContainer>
      <KeyboardSafeScreen>
        <SafeScrollView contentContainerStyle={styles.centerColumn}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoSmall}
          />
          <Text style={styles.h1}>Welcome back</Text>
          <Text style={styles.paragraph}>
            Unlock your encrypted journal. Incorrect attempts never erase it.
          </Text>
          <Field
            secure
            label="Vault password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={unlock}
          />
          {Boolean(error) && <Text style={styles.error}>{error}</Text>}
          <Button
            label={busy ? 'Unlocking…' : 'Unlock'}
            disabled={busy || !password}
            onPress={unlock}
          />
          {bio && (
            <Button
              secondary
              label="Use biometric unlock"
              onPress={biometric}
            />
          )}
          <Text style={styles.caption}>
            Forgotten passwords cannot be reset by the server.
          </Text>
        </SafeScrollView>
      </KeyboardSafeScreen>
    </ScreenContainer>
  );
}
