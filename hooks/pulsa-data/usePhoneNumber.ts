import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  detectProvider,
  PROVIDER_CONFIG,
  type ProviderKey,
} from "@/constants/ISP-list";
import { useProductById } from "@/hooks/queries/useProducts";
import useRQGlobalState from "@/hooks/useRQGlobalState";

const MAX_PHONE_LENGTH = 12;
const MIN_VALID_LENGTH = 11;
const MIN_PREFIX_LENGTH = 4;

const PHONE_NUMBER_QUERY_KEY = ["pulsa-data", "phone-number"] as const;

interface PhoneNumberFormValues {
  phoneNumber: string;
}

export function usePhoneNumberForm() {
  const { data: globalPhoneNumber, setNewData: setGlobalPhoneNumber } =
    useRQGlobalState<string>({
      queryKey: PHONE_NUMBER_QUERY_KEY,
      initialData: "",
    });

  const { control, watch, setValue } = useForm<PhoneNumberFormValues>({
    defaultValues: {
      phoneNumber: globalPhoneNumber ?? "",
    },
    mode: "onChange",
  });

  const localPhoneNumber = watch("phoneNumber");

  // Sync local form state to global state
  useEffect(() => {
    if (localPhoneNumber !== globalPhoneNumber) {
      setGlobalPhoneNumber(localPhoneNumber);
    }
  }, [localPhoneNumber, globalPhoneNumber, setGlobalPhoneNumber]);

  const setPhoneFromContact = useCallback(
    (phone: string) => {
      let cleaned = phone.replace(/\D/g, "");
      if (cleaned.startsWith("62")) {
        cleaned = "0" + cleaned.slice(2);
      }
      if (cleaned.length <= MAX_PHONE_LENGTH) {
        setValue("phoneNumber", cleaned);
      }
    },
    [setValue],
  );

  return {
    control,
    setPhoneFromContact,
  };
}

export function usePhoneNumber() {
  const { data: phoneNumber } = useRQGlobalState<string>({
    queryKey: PHONE_NUMBER_QUERY_KEY,
    initialData: "",
  });

  const safePhoneNumber = phoneNumber ?? "";

  const detectedProvider = useMemo<ProviderKey | null>(() => {
    return detectProvider(safePhoneNumber);
  }, [safePhoneNumber]);

  const detectedProductId = detectedProvider
    ? PROVIDER_CONFIG[detectedProvider].productId
    : null;

  const { data: productDetail, isLoading: isLoadingProductDetail } =
    useProductById(detectedProductId || "");

  const providerInfo = detectedProvider
    ? PROVIDER_CONFIG[detectedProvider]
    : null;

  const isValidPhoneNumber = safePhoneNumber.length >= MIN_VALID_LENGTH;
  const showProviderNotDetected =
    !detectedProvider && safePhoneNumber.length >= MIN_PREFIX_LENGTH;
  const showMinLengthError =
    safePhoneNumber.length > 0 && safePhoneNumber.length < MIN_VALID_LENGTH;

  return {
    phoneNumber: safePhoneNumber,
    detectedProvider,
    productDetail,
    providerInfo,
    isLoading: isLoadingProductDetail,
    isValidPhoneNumber,
    showProviderNotDetected,
    showMinLengthError,
  };
}
