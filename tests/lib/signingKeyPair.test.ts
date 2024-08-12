import { execSync } from 'child_process';
import * as fs from 'fs';
import { bech32 } from 'bech32';
import { fromRecoveryPhrase } from '../../src/lib/signingKeyPair';

describe('Cardano Address Key Derivation', () => {
    const mnemonicSizes = [12, 15, 24];
    const iterationsPerSize = 30;

    mnemonicSizes.forEach(size => {
        // Sanity checks
        describe(`Test fromRecoveryPhrase against reference implementation`, () => {
            test(`Mnemonic size: ${size}`, () => {
              for (let i = 0; i < iterationsPerSize; i++) {
                  execSync(`cardano-address recovery-phrase generate --size ${size} > temp_mnemonic`);
                  const mnemonic = fs.readFileSync('temp_mnemonic', 'utf-8').trim();

                  const result = execSync('cat temp_mnemonic | cardano-address key from-recovery-phrase Shelley', { encoding: 'utf-8' });
                  fs.unlinkSync('temp_mnemonic');

                  const signingKeyPairBech32 = result.trim();
                  const { words } = bech32.decode(signingKeyPairBech32, 1000);
                  const signingKeyPairBytes = Buffer.from(bech32.fromWords(words));

                  const ourBytes = fromRecoveryPhrase(mnemonic);

                  expect(ourBytes.hex()).toBe(signingKeyPairBytes.toString('hex'));
              }
          });
        });
    });
});
