import {
  type MutationFunction,
  type QueryKey,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { queryClient } from "@/app/_layout";

type TUseRQGlobalState<T> = {
  initialData?: T;
  queryKey: QueryKey;
};

export default function useRQGlobalState<T>({
  initialData = {} as T,
  queryKey,
}: TUseRQGlobalState<T>) {
  const { data } = useQuery({
    queryKey,
    initialData: () => initialData,
    queryFn: async () => {
      const cachedData = queryClient.getQueryData(queryKey);
      if (cachedData) {
        return cachedData as T;
      }
      return initialData as T;
    },
  });

  const { mutate } = useMutation({
    mutationFn: async (newData) => {
      return newData;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
    },
  });
  const setNewData = (newData: T) => {
    const executeMutation = mutate as MutationFunction<typeof newData, unknown>;
    executeMutation(newData);
  };
  return { data, setNewData };
}
