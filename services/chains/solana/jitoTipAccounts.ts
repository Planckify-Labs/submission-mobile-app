/**
 * Jito block engine tip accounts — the canonical 8 mainnet addresses.
 * Source: https://jito-labs.gitbook.io/mev/searcher-resources/bundles/api
 *
 * Transactions that transfer to one of these accounts are paying a MEV
 * tip. The transaction sheet surfaces the tip row so users see the
 * actual cost beyond the priority fee.
 */

export const JITO_TIP_ACCOUNTS: ReadonlySet<string> = new Set([
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDe3A",
  "ADuUkR4vqLUMWXxW9gh6D6L8pivKeVBBjNS6jWGT4U14",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
]);

export function isJitoTipAccount(address: string): boolean {
  return JITO_TIP_ACCOUNTS.has(address);
}

/** Count of tip accounts — for defensive assertions. */
export const JITO_TIP_ACCOUNT_COUNT = 8;
