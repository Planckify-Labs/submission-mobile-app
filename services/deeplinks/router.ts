/**
 * Deep link URI router — maps schemes to screens.
 */

import { router } from "expo-router";
import { parseEIP681, type EIP681Intent } from "./eip681";

export type DeepLinkResult =
  | { type: "send"; to: string; amount?: string; chainId?: number; eip681?: EIP681Intent }
  | { type: "wc"; uri: string }
  | { type: "dapp"; url: string }
  | { type: "unknown"; raw: string };

export function classifyURI(uri: string): DeepLinkResult {
  // EIP-681: ethereum:0x...
  if (uri.startsWith("ethereum:")) {
    const parsed = parseEIP681(uri);
    if (parsed) {
      return {
        type: "send",
        to: parsed.targetAddress,
        amount: parsed.value,
        chainId: parsed.chainId,
        eip681: parsed,
      };
    }
  }

  // WalletConnect: wc:...
  if (uri.startsWith("wc:")) {
    return { type: "wc", uri };
  }

  // Custom scheme: takumiwallet://
  if (uri.startsWith("takumiwallet://")) {
    return parseCustomScheme(uri);
  }

  // Raw Ethereum address
  if (uri.startsWith("0x") && uri.length === 42) {
    return { type: "send", to: uri };
  }

  return { type: "unknown", raw: uri };
}

function parseCustomScheme(uri: string): DeepLinkResult {
  const url = new URL(uri);
  const path = url.hostname;

  switch (path) {
    case "send": {
      return {
        type: "send",
        to: url.searchParams.get("to") ?? "",
        amount: url.searchParams.get("amount") ?? undefined,
        chainId: url.searchParams.get("chain")
          ? parseInt(url.searchParams.get("chain")!, 10)
          : undefined,
      };
    }
    case "dapp": {
      return {
        type: "dapp",
        url: url.searchParams.get("url") ?? "",
      };
    }
    case "connect": {
      const wcUri = url.searchParams.get("uri");
      if (wcUri) return { type: "wc", uri: wcUri };
      break;
    }
  }

  return { type: "unknown", raw: uri };
}

export function handleDeepLink(uri: string): void {
  const result = classifyURI(uri);

  switch (result.type) {
    case "send":
      router.push({
        pathname: "/send",
        params: {
          to: result.to,
          amount: result.amount,
          chainId: result.chainId?.toString(),
        },
      });
      break;
    case "dapp":
      router.push({
        pathname: "/dapps-browser",
        params: { url: result.url },
      });
      break;
    case "wc":
      // WC pairing handled by WalletConnect service
      // Dispatch event for WC transport to pick up
      break;
    case "unknown":
      // Toast handled by caller
      break;
  }
}
