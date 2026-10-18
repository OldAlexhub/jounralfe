jest.mock('react-native', () => {
  const nativeVault = {};
  Object.defineProperty(nativeVault, 'hasVault', {
    enumerable: false,
    value: jest.fn().mockResolvedValue(true),
  });
  return { NativeModules: { InnerfolioVault: nativeVault } };
});

import { Vault } from '../src/services/vault';

it('delegates to non-enumerable React Native module methods', async () => {
  expect(typeof Vault.hasVault).toBe('function');
  await expect(Vault.hasVault()).resolves.toBe(true);
});
