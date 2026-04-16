export type { NFTAsset, NFTAttribute } from "@/services/indexer/types";

export interface NFTCollection {
  name: string;
  slug?: string;
  imageUrl?: string;
  isVerified: boolean;
  floorPrice?: number;
  items: import("@/services/indexer/types").NFTAsset[];
}
