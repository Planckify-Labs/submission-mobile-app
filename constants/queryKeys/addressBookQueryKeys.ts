export const addressBookQueryKeys = {
  all: ["address-book"] as const,
  list: () => [...addressBookQueryKeys.all, "list"] as const,
  detail: (id: string) => [...addressBookQueryKeys.all, "detail", id] as const,
};
