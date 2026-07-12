import { api } from "@/constants/configs/ky";

export const authApi = {
  /**
   * Link a wallet address to the signed-in account (idempotent — safe to call
   * on every use). Records that this account owns the address so server-side
   * ownership checks recognise it.
   *
   * Used by the point-deposit flow to register a per-chain address (e.g. a
   * Stellar `G…` address) that differs from the user's primary address, so the
   * backend's deposit verification accepts it as the payer. Uses the
   * authenticated `api` client so the link lands on the wallet-session user —
   * the same user the deposit is created under.
   */
  linkWalletAddress: async (walletAddress: string): Promise<void> => {
    await api.post("auth/google/wallets", { json: { walletAddress } });
  },
};
