import { Buffer } from 'buffer';
import { WalletIndex, KeyIndex, KeyRole } from '../../src/lib/signingKeyPair';
import { GetPassphrase, invalidPassphrase, mkGetPassphrase, Mnemonic } from '../../src/lib/secretManager';
import { KeyDerivationPath, KeysManager, mkKeysManager, fromVault, keyNotFound } from '../../src/lib/keyManager';
import * as bip39 from 'bip39';
import { Ed25519Signature } from '@cardano-sdk/crypto';

describe('KeyManager', () => {
  let keysManager: KeysManager;
  const testPassphrase = 'test-passphrase';
  const getPassphrase: GetPassphrase = mkGetPassphrase(async () => testPassphrase);
  const testMnemonic: Mnemonic = bip39.generateMnemonic(256) as Mnemonic;

  beforeAll(async () => {
    const result = await mkKeysManager(testMnemonic, getPassphrase);
    if ('type' in result && result.type === 'PassphraseGetterError') {
      throw new Error('Failed to create key manager');
    }
    keysManager = result as KeysManager;
  });

  const testPath: KeyDerivationPath = {
    accountIndex: 0 as WalletIndex,
    role: KeyRole.External,
    index: 0 as KeyIndex
  };

  test('KeyManager creation and initialization', () => {
    expect(keysManager).toBeDefined();
    expect(keysManager.getVault()).toBeDefined();
  });

  test('Key derivation', async () => {
    expect(await keysManager.derive(testPath, getPassphrase, async (signingKey) => {
      expect(signingKey).toBeDefined();
      return true;
    })).toBe(true);
  });

  test('Multiple key derivation', async () => {
    const paths = [
      testPath,
      { ...testPath, index: 1 as KeyIndex },
      { ...testPath, role: KeyRole.Internal }
    ];
    expect(await keysManager.deriveMany(paths, getPassphrase, async (signingKeys) => {
      expect(signingKeys).toHaveLength(3);
      signingKeys.forEach(key => expect(key).toBeDefined());
      return true;
    })).toBe(true);
  });

  test('Signing and verification', async () => {
    const testMessage = Buffer.from('Test message');
    const signature = await keysManager.sign(testPath, getPassphrase, testMessage);

    if ('type' in signature && (signature.type === 'InvalidPassphrase' || signature.type === 'PassphraseGetterError')) {
      throw new Error('Signing failed');
    }

    const verificationResult = await keysManager.verify(testPath, testMessage, signature);
    expect(verificationResult).toBe(true);
  });

  test('Verification with incorrect message', async () => {
    const testMessage = Buffer.from('Test message');
    const incorrectMessage = Buffer.from('Incorrect message');
    const signature = await keysManager.sign(testPath, getPassphrase, testMessage);

    if ('type' in signature && (signature.type === 'InvalidPassphrase' || signature.type === 'PassphraseGetterError')) {
      throw new Error('Signing failed');
    }

    const verificationResult = await keysManager.verify(testPath, incorrectMessage, signature);
    expect(verificationResult).toBe(false);
  });

  test('KeyManager serialization and deserialization', async () => {
    const testMessage = Buffer.from('Another test message');
    const signature = await keysManager.sign(testPath, getPassphrase, testMessage);

    if ('type' in signature && (signature.type === 'InvalidPassphrase' || signature.type === 'PassphraseGetterError')) {
      throw new Error('Signing failed');
    }

    const vault = keysManager.getVault();
    const deserializedManager = fromVault(vault);

    expect(await deserializedManager.verify(testPath, testMessage, signature)).toBe(true);
  });

  test('Invalid passphrase', async () => {
    const invalidGetPassphrase = mkGetPassphrase(async () => 'invalid-passphrase');
    expect(await keysManager.derive(testPath, invalidGetPassphrase, async () => true)).toEqual(invalidPassphrase);
  });

  test('Verification with non-existent key', async () => {
    const nonExistentPath: KeyDerivationPath = {
      accountIndex: 99 as WalletIndex,
      role: KeyRole.Stake,
      index: 99 as KeyIndex
    };

    const testMessage = Buffer.from('Test message');
    const dummySignature = Ed25519Signature.fromBytes(Buffer.alloc(64));  // Ed25519 signatures are 64 bytes

    const verificationResult = await keysManager.verify(nonExistentPath, testMessage, dummySignature);
    expect(verificationResult).toEqual(keyNotFound(nonExistentPath));
  });
});
