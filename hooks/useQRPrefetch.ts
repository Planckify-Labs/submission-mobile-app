import { useEffect } from "react";
import { useAppLocked } from "@/app/_layout";
import { useWallet } from "@/hooks/useWallet";
import { prefetchQRMatrix } from "@/services/qrMatrixCache";

/**
 * Warms the QR-matrix cache for every wallet's receive address so the
 * Receive sheet's QR is paint-ready the instant it mounts. The
 * Reed-Solomon / mask-pattern compute (~1–3 ms per address) runs once
 * per cold start on idle; the bit-matrix persists to MMKV and is
 * reused across sessions — subsequent launches skip compute entirely.
 *
 * Gates: (a) app must be unlocked — running heavy sync work while the
 * LockScreen is floating still starves touch handlers; (b) wallets
 * must be loaded — no point firing with an empty list.
 */
export function useQRPrefetch() {
  const { wallets } = useWallet();
  const isLocked = useAppLocked();

  useEffect(() => {
    if (isLocked) return;
    if (wallets.length === 0) return;
    const id = requestIdleCallback(() => {
      for (const w of wallets) {
        if (!w?.address) continue;
        prefetchQRMatrix(w.address, { errorCorrectionLevel: "M" });
      }
    });
    return () => cancelIdleCallback(id);
  }, [wallets, isLocked]);
}
