import { useQuery } from "@tanstack/react-query";
import { dappApi } from "@/api/endpoints/dapps";
import type { TDapp, TDappSearchParams } from "@/api/types/dapp";
import { isStellarDapp } from "@/constants/configs/stellarDapps";

// The `/dapps` API has no chain field to filter on server-side (the
// catalogue is shared across every chain the backend knows about), so
// every dapp-list query here is filtered client-side against the
// Stellar allowlist — this is what makes the dapps browser read as
// Stellar-only per the app's chain-support restriction (see
// `services/walletKit/chainSupport.ts`).
function filterStellarDapps(dapps: TDapp[]): TDapp[] {
  return dapps.filter((d) => isStellarDapp(d.id));
}

export const useDappCategories = () => {
  return useQuery({
    queryKey: ["dapp-categories"],
    queryFn: dappApi.getDappCategories,
  });
};

export const useDapps = () => {
  return useQuery({
    queryKey: ["dapps"],
    queryFn: async () => filterStellarDapps(await dappApi.getDappList()),
  });
};

export const usePopularDapps = () => {
  return useQuery({
    queryKey: ["dapps", "popular"],
    queryFn: async () => filterStellarDapps(await dappApi.getPopularDapps()),
  });
};

export const useSponsoredDapps = () => {
  return useQuery({
    queryKey: ["dapps", "sponsored"],
    queryFn: async () => filterStellarDapps(await dappApi.getSponsoredDapps()),
  });
};

export const usePromotions = () => {
  return useQuery({
    queryKey: ["dapp-promotions"],
    queryFn: async () => {
      const promotions = await dappApi.getPromotions();
      // Promotions link to a dapp via `dappId`; a promo whose dapp isn't
      // Stellar (or has no linked dapp) never renders in a Stellar-only
      // browser.
      return promotions.filter((p) => !!p.dappId && isStellarDapp(p.dappId));
    },
  });
};

export const useFavoriteDapps = () => {
  return useQuery({
    queryKey: ["dapps", "favorites"],
    queryFn: async () => filterStellarDapps(await dappApi.getFavoriteDapps()),
  });
};

export const useDappsByCategory = (categoryId: string) => {
  return useQuery({
    queryKey: ["dapps", "category", categoryId],
    queryFn: async () =>
      filterStellarDapps(await dappApi.getDappsByCategory(categoryId)),
    enabled: !!categoryId,
  });
};

export const useDappSearch = (params?: TDappSearchParams) => {
  return useQuery({
    queryKey: ["dapps", "search", params],
    queryFn: async () => filterStellarDapps(await dappApi.searchDapps(params)),
    enabled: !!params,
  });
};

export const useDappById = (id: string) => {
  return useQuery({
    queryKey: ["dapps", id],
    queryFn: async () => {
      const dapp = await dappApi.getDappById(id);
      return dapp && isStellarDapp(dapp.id) ? dapp : null;
    },
    enabled: !!id,
  });
};
