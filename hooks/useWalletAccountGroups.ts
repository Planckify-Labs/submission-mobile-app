import { useCallback, useEffect, useMemo, useState } from "react";
import type { TWallet } from "@/constants/types/walletTypes";
import {
  buildWalletAccountGroups,
  type WalletAccountGroup,
} from "@/utils/walletGrouping";

type UseWalletAccountGroups = {
  groups: WalletAccountGroup[];
  isExpanded: (accountId: string) => boolean;
  toggleExpanded: (accountId: string) => void;
};

/**
 * Groups a wallet list for the pickers and owns the per-account
 * expand/collapse state. Opening the sheet (`visible` → true) resets to
 * "active account expanded, others collapsed" so a user always lands on
 * the account they're currently using.
 */
export function useWalletAccountGroups(
  wallets: TWallet[],
  activeAddress: string | undefined,
  visible: boolean,
): UseWalletAccountGroups {
  const groups = useMemo(() => buildWalletAccountGroups(wallets), [wallets]);

  const activeAccountId = useMemo(
    () =>
      groups.find((g) => g.wallets.some((w) => w.address === activeAddress))
        ?.id,
    [groups, activeAddress],
  );

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    activeAccountId ? new Set([activeAccountId]) : new Set(),
  );

  // Reset the expansion each time the sheet opens so it always starts on
  // the active account. Keyed on `visible`; no-op while the sheet is closed.
  useEffect(() => {
    if (visible) {
      setExpanded(new Set(activeAccountId ? [activeAccountId] : []));
    }
  }, [visible, activeAccountId]);

  const isExpanded = useCallback(
    (accountId: string) => expanded.has(accountId),
    [expanded],
  );

  const toggleExpanded = useCallback((accountId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }, []);

  return { groups, isExpanded, toggleExpanded };
}
