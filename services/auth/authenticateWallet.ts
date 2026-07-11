import type { ChainConfig } from "@/constants/configs/chainConfig";
import { publicApi, reset401Guard } from "@/constants/configs/ky";
import type { TWallet } from "@/constants/types/walletTypes";
import { storeTokens } from "@/hooks/queries/useAuth";
import { getNonceParams } from "@/services/walletKit/chainInfo";
import { walletKitRegistry } from "@/services/walletKit/registry";

interface TNonceResponse {
  nonce: string;
  message: string;
}

interface TVerifyResponse {
  access_token: string;
  refresh_token: string;
  user?: { id: string; walletAddress?: string };
}

/**
 * Runs the wallet's sign-in-with-X handshake and persists the resulting
 * wallet-bound tokens.
 *
 * Chain-agnostic by construction: the nonce params come from
 * `getNonceParams` (EVM authenticates with a numeric `chainId`, Solana/Sui
 * with a `chainSlug`), and the signature comes from the kit's own
 * `signAuthMessage`, which owns its message encoding — EIP-191 hex for EVM,
 * base58 for Solana, base64 SIWS for Sui. The server's `POST /auth/verify`
 * sniffs SIWE / SIWS / SIWS-Sui from the message text, so no namespace is
 * named anywhere in this file.
 *
 * Used by the post-Google-OTP path in `app/login.tsx` and available to any
 * other flow that needs a session for a specific wallet.
 *
 * @returns the authenticated wallet address, or `null` when the wallet's kit
 * isn't registered or the handshake fails.
 */
export async function authenticateWallet(
  wallet: TWallet,
  chain: ChainConfig | null | undefined,
): Promise<string | null> {
  if (!wallet?.address || !walletKitRegistry.has(wallet.namespace)) {
    return null;
  }

  try {
    const params = getNonceParams(wallet, chain);
    const query = params.chainSlug
      ? `?chainSlug=${encodeURIComponent(params.chainSlug)}`
      : params.chainId
        ? `?chainId=${params.chainId}`
        : "";

    const { message } = await publicApi
      .get(`auth/nonce/${wallet.address}${query}`)
      .json<TNonceResponse>();

    if (!message) return null;

    const signature = await walletKitRegistry
      .get(wallet.namespace)
      .signAuthMessage(wallet, message);

    const response = await publicApi
      .post("auth/verify", { json: { message, signature } })
      .json<TVerifyResponse>();

    await storeTokens(
      response.access_token,
      response.refresh_token,
      response.user?.walletAddress ?? wallet.address,
    );

    // Fresh tokens — let a future 401 trigger the re-auth cascade again.
    reset401Guard();

    return wallet.address;
  } catch (error) {
    if (__DEV__) {
      console.warn("authenticateWallet failed:", error);
    }
    return null;
  }
}
