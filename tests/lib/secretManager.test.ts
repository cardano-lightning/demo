import {
  mkSecretManager,
  mkGetPassphrase,
  SecretManager,
  Secret,
  loadVault,
  invalidPassphrase,
} from '../../src/lib/secretManager';

describe('SecretManager', () => {
  const testPassphrase = 'test-passphrase';
  const testSecret = Buffer.from('test-secret') as Secret;
  const getPassphrase = mkGetPassphrase(async () => testPassphrase);

  let secretManager: SecretManager<'TestContent'>;

  beforeAll(async () => {
    const result = await mkSecretManager<'TestContent'>(getPassphrase, testSecret);
    if ("type" in result && result.type === 'PassphraseGetterError') {
      throw new Error('Failed to create secret manager');
    }
    if(!("type" in result)) {
      secretManager = result;
    }
  });

  test('secretManager lifecycle - create, derive keys, functions', async () => {
    expect(secretManager).toBeDefined();
    expect(secretManager.getVault()).toBeDefined();
    const result = await secretManager.decrypt(getPassphrase, async (_) => {
      return true;
    });
    expect(result).toBe(true);
  });

  test('secretManager operations - store and retrieve secret rotates iv', async () => {
    await secretManager.decrypt(getPassphrase, async (secret) => {
      expect(secret).toEqual(testSecret);
    });

    const { iv: iv1 } = secretManager.getVault();

    await secretManager.decrypt(getPassphrase, async (secret) => {
      expect(secret).toEqual(testSecret);
    });

    const { iv: iv2 } = secretManager.getVault();

    expect(iv1.equals(iv2)).toBeFalsy();
  });

  test('secretManager - dump and load vault', async () => {
    const dumpedVault = secretManager.getVault();

    const loadedManager = loadVault<'TestContent'>(dumpedVault);

    const result = await loadedManager.decrypt(getPassphrase, async (secret) => {
      expect(secret).toEqual(testSecret);
      return true;
    });

    expect(result).toBe(true);
  });

  test('secretManager - invalid passphrase', async () => {
    const invalidGetPassphrase = mkGetPassphrase(async () => 'invalid-passphrase');

    const result = await secretManager.decrypt(invalidGetPassphrase, async (result) => {
      return result;
    });

    expect(result).toEqual(invalidPassphrase);
  });

  test('secretManager - passphrase getter error', async () => {
    const errorGetPassphrase = mkGetPassphrase(async () => {
      throw new Error('Passphrase getter error');
    });

    const result = await secretManager.decrypt(errorGetPassphrase, async () => {
      return {}
    });

    expect("type" in result && result.type === "PassphraseGetterError").toBeTruthy()
  });
});
