/**
 * Groups a flat `TWallet[]` into account groups for the wallet pickers.
 *
 * An "account" is the set of chain rows derived from one seed (EVM +
 * Solana + Sui for a Google login) — see `groupWalletsIntoAccounts` in
 * `hooks/useWallet.helpers.ts`. The pickers show these grouped under a
 * single header so two accounts that both display as "Satria" are told
 * apart by their email instead of only their address.
 *
 * Pure module — no react / react-native imports — so the grouping and
 * flatten logic can be exercised under `node:test`.
 */

import type { TWallet } from "@/constants/types/walletTypes";
import { groupWalletsIntoAccounts } from "@/hooks/useWallet.helpers";
import { walletAvatarInitials } from "@/utils/walletUtils";

export type WalletAccountGroup = {
  /** Stable key shared with `WalletAccount.id`. */
  id: string;
  /** Email for a social (Google) account, canonical wallet name otherwise. */
  label: string;
  /** Avatar initials for the group header. */
  initials: string;
  /** Capitalised social provider ("Google") when the account is a social login. */
  provider?: string;
  wallets: TWallet[];
};

/**
 * Builds account groups from a flat wallet list. The header label prefers
 * the social account email (the disambiguator the user asked for) and
 * falls back to the account's canonical name for seed / imported wallets,
 * which have no email.
 */
export function buildWalletAccountGroups(
  wallets: TWallet[],
): WalletAccountGroup[] {
  return groupWalletsIntoAccounts(wallets).map((account) => {
    const social = account.wallets.find(
      (w) => w.socialAccount?.email,
    )?.socialAccount;
    const email = social?.email?.trim();
    const provider = social?.provider
      ? social.provider.charAt(0).toUpperCase() + social.provider.slice(1)
      : undefined;
    // Initials come from the first row, which carries the social account
    // name for Google wallets ("Satria Ali" → "SA"); `walletAvatarInitials`
    // strips the chain suffix on the local-name fallback.
    const initials = walletAvatarInitials(
      account.wallets[0] ?? { name: account.name },
    );
    return {
      id: account.id,
      label: email || account.name,
      initials,
      provider,
      wallets: account.wallets,
    };
  });
}

export type WalletGroupListItem =
  | {
      type: "header";
      group: WalletAccountGroup;
      /** Wallets in this group passing the current filter. */
      count: number;
      expanded: boolean;
      /** False when tapping the header should not toggle (single account / forced open). */
      collapsible: boolean;
      containsActive: boolean;
    }
  | { type: "wallet"; wallet: TWallet; indented: boolean };

export type FlattenWalletGroupsOptions = {
  /** Per-picker search / chain filter — a wallet is shown only when true. */
  isVisible: (wallet: TWallet) => boolean;
  isExpanded: (accountId: string) => boolean;
  /** When true every group renders expanded and headers aren't collapsible (search / chain tab active). */
  forceExpand: boolean;
  activeAddress?: string;
};

/** One account section: the group, its visible wallets, and header state. */
export type WalletGroupSection = {
  group: WalletAccountGroup;
  /** Wallets in this group passing the current filter. */
  wallets: TWallet[];
  showHeader: boolean;
  expanded: boolean;
  collapsible: boolean;
  containsActive: boolean;
};

/**
 * Resolves each account into a display section — visible wallets, whether
 * to show its header, and its expand state. Shared source of truth for
 * both the pickers' flat `FlatList` and the dApp connection manager's
 * per-account cards.
 */
export function groupWalletSections(
  groups: WalletAccountGroup[],
  {
    isVisible,
    isExpanded,
    forceExpand,
    activeAddress,
  }: FlattenWalletGroupsOptions,
): WalletGroupSection[] {
  const singleGroup = groups.length === 1;
  const showHeaders = !(singleGroup && (groups[0]?.wallets.length ?? 0) <= 1);
  const sections: WalletGroupSection[] = [];

  for (const group of groups) {
    const visible = group.wallets.filter(isVisible);
    if (visible.length === 0) continue;

    const expanded =
      !showHeaders || singleGroup || forceExpand || isExpanded(group.id);

    sections.push({
      group,
      wallets: visible,
      showHeader: showHeaders,
      expanded,
      collapsible: showHeaders && !singleGroup && !forceExpand,
      containsActive: activeAddress
        ? visible.some((w) => w.address === activeAddress)
        : false,
    });
  }

  return sections;
}

/**
 * Flattens groups into a single list for a `FlatList`, honouring the
 * filter and the per-account expand state. A header row precedes each
 * account's wallet rows.
 *
 * Header suppression: a lone single-wallet account (e.g. one imported
 * private key) has nothing to group, so it renders flat with no header.
 * Any account holding multiple chain rows keeps its header so the email
 * label is always visible.
 */
export function flattenWalletGroups(
  groups: WalletAccountGroup[],
  options: FlattenWalletGroupsOptions,
): WalletGroupListItem[] {
  const items: WalletGroupListItem[] = [];

  for (const section of groupWalletSections(groups, options)) {
    if (section.showHeader) {
      items.push({
        type: "header",
        group: section.group,
        count: section.wallets.length,
        expanded: section.expanded,
        collapsible: section.collapsible,
        containsActive: section.containsActive,
      });
    }
    if (section.expanded) {
      for (const wallet of section.wallets) {
        items.push({ type: "wallet", wallet, indented: section.showHeader });
      }
    }
  }

  return items;
}
