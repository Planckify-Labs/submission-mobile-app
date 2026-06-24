import { Check } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { queryClient } from "@/app/_layout";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import useRQGlobalState from "@/hooks/useRQGlobalState";

interface OptionSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: string) => void;
  title: string;
  options: string[];
  selectedOption?: string;
  stateKey?: string;
  clearOnClose?: boolean;
}

const OptionSelectorModal: React.FC<OptionSelectorModalProps> = ({
  visible,
  onClose,
  onSelect,
  title,
  options,
  selectedOption: propSelectedOption,
  stateKey,
  clearOnClose = false,
}) => {
  const { data: globalSelectedOption, setNewData: setGlobalSelectedOption } =
    useRQGlobalState<string | undefined>({
      queryKey: stateKey
        ? ["option-selector", stateKey]
        : ["option-selector-temp"],
      initialData: propSelectedOption,
    });

  const selectedOption = stateKey ? globalSelectedOption : propSelectedOption;

  useEffect(() => {
    return () => {
      if (stateKey) {
        queryClient.removeQueries({
          queryKey: ["option-selector", stateKey],
        });
      }
    };
  }, [stateKey]);

  const handleSelect = (option: string) => {
    if (stateKey) {
      setGlobalSelectedOption(option);
    }

    onSelect(option);
    onClose();
  };

  const handleClosed = useCallback(() => {
    if (clearOnClose && stateKey) {
      queryClient.removeQueries({ queryKey: ["option-selector", stateKey] });
    }
  }, [clearOnClose, stateKey]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      onClosed={handleClosed}
      maxHeight="70%"
      borderRadius={28}
      contentClassName="px-6"
    >
      <ModalHeader title={title} className="mb-6" />

      <ScrollView className="max-h-[400px]">
        <View className="gap-2">
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              className={`flex-row items-center justify-between p-4 bg-light rounded-xl ${
                selectedOption === option ? "bg-light-primary-red/5" : ""
              }`}
              onPress={() => handleSelect(option)}
            >
              <Text
                className={`text-lg ${
                  selectedOption === option
                    ? "text-light-primary-red font-medium"
                    : "text-light-matte-black"
                }`}
              >
                {option}
              </Text>
              {selectedOption === option && <Check size={20} color="#c71c4b" />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </BaseModal>
  );
};

export default OptionSelectorModal;
