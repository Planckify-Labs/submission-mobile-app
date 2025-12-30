import type { TWallet } from "./walletTypes";

export type TCryptoAsset = {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  balance: string;
  value: string;
  change: string;
  address?: string;
  isCustom?: boolean;
  contractAddress?: string;
  networkSpecific?: boolean;
  supportedNetworks?: string[];
};

export type TExtendedCryptoAsset = TCryptoAsset & {
  contractAddress?: string;
};

export type TAssetTabType = "my-assets" | "explore-assets";

// ============================================
// AssetTabContent DTOs
// ============================================
export type TAssetTabState = {
  activeTab: TAssetTabType;
  searchQuery: string;
  isLoading: boolean;
};

export type TAssetData = {
  userAssets: TCryptoAsset[];
  filteredUserAssets: TCryptoAsset[];
  filteredAvailableAssets: TCryptoAsset[];
};

export type TAssetTabActions = {
  setActiveTab: (tab: TAssetTabType) => void;
};

export type TAssetRenderItems = {
  renderUserAssetItem: ({ item }: { item: TCryptoAsset }) => React.ReactElement;
  renderAvailableAssetItem: ({
    item,
  }: {
    item: TCryptoAsset;
  }) => React.ReactElement;
};

export type TAssetTabContentProps = {
  state: TAssetTabState;
  data: TAssetData;
  actions: TAssetTabActions;
  renderItems: TAssetRenderItems;
};

// ============================================
// AssetItem DTOs
// ============================================
export type TAssetItemState = {
  isAdded: boolean;
  isSelected: boolean;
  selectionMode: boolean;
};

export type TAssetItemActions = {
  onPress: () => void;
  onLongPress?: () => void;
  onAddPress?: () => void;
};

export type TAssetItemProps = {
  item: TCryptoAsset;
  state: TAssetItemState;
  actions: TAssetItemActions;
};

// ============================================
// AssetExplorerHeader DTOs
// ============================================
export type TSelectionState = {
  selectionMode: boolean;
  selectedAssetsCount: number;
};

export type TAssetExplorerHeaderProps = {
  selection: TSelectionState;
  onCancel: () => void;
  onAdd: () => void;
};

// ============================================
// AddTokenForm DTOs
// ============================================
export type TAddTokenFormState = {
  tokenAddress: string;
  isLoading: boolean;
};

export type TAddTokenFormProps = {
  state: TAddTokenFormState;
  onAddressChange: (value: string) => void;
  onSubmit: () => void;
};

// ============================================
// AssetWalletSelectorModal DTOs
// ============================================
export type TWalletSelectorData = {
  asset: TCryptoAsset | null;
  assets?: TCryptoAsset[];
  wallets: TWallet[];
  activeNetwork: string;
};

export type TAssetWalletSelectorModalProps = {
  visible: boolean;
  data: TWalletSelectorData;
  onClose: () => void;
  onConfirm: (
    walletIndices: number[],
    asset: TCryptoAsset | null,
    assets?: TCryptoAsset[],
  ) => void;
};

// ============================================
// Legacy Types (keeping for backward compatibility during migration)
// ============================================
/** @deprecated Use TAssetTabContentProps instead */
export type AssetListContentProps = {
  activeTab: TAssetTabType;
  userAssets: TCryptoAsset[];
  filteredUserAssets: TCryptoAsset[];
  filteredAvailableAssets: TCryptoAsset[];
  searchQuery: string;
  setActiveTab: (tab: TAssetTabType) => void;
  renderUserAssetItem: ({ item }: { item: TCryptoAsset }) => React.ReactElement;
  renderAvailableAssetItem: ({
    item,
  }: {
    item: TCryptoAsset;
  }) => React.ReactElement;
  selectionMode: boolean;
  isAssetAdded: (id: string) => boolean;
  addAsset?: (asset: TCryptoAsset) => void;
  selectedAssets?: TCryptoAsset[];
  toggleAssetSelection?: (asset: TCryptoAsset) => void;
  handleAssetLongPress?: (asset: TCryptoAsset) => void;
  isLoading?: boolean;
};

export type TAssetCategoryTabsProps = {
  activeTab: TAssetTabType;
  setActiveTab: (tab: TAssetTabType) => void;
  selectionMode: boolean;
};
