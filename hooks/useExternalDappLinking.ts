/**
 * `useExternalDappLinking()` — installs a global `Linking` listener so
 * that any third-party link opened via Android's generic VIEW/BROWSABLE
 * intent-filter (see `android.intentFilters` in `app.config.ts`) lands
 * in TakumiPay's own dApp browser, same as tapping a link in MetaMask
 * or Bitget Wallet's "Open with" entry.
 *
 * Only acts on `classifyURI` results of type `"dapp"` (a bare http/https
 * URL to a host other than our own verified `takumipay.xyz`). Every
 * other case — our own universal links, `takumiwallet://`, `wc:`,
 * `ethereum:` — is left alone: `takumipay.xyz` links already go through
 * expo-router's file-based linking config, and the other schemes have
 * their own (currently unwired) handling in `services/deeplinks/router.ts`
 * that this hook intentionally does not activate.
 */

import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { classifyURI } from "@/services/deeplinks/router";

export function useExternalDappLinking(): void {
  useEffect(() => {
    const openIfExternalDapp = (url: string) => {
      const result = classifyURI(url);
      if (result.type === "dapp" && result.url) {
        router.push({
          pathname: "/dapps-browser",
          params: { url: result.url },
        });
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) openIfExternalDapp(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) =>
      openIfExternalDapp(url),
    );
    return () => sub.remove();
  }, []);
}
