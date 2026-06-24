import { Text, View } from "react-native";
import type { ModalHeaderProps } from "./types";

/**
 * Optional title row for a sheet. The close button is owned by `BaseModal`
 * (rendered top-right by default), so this only handles the title and any
 * leading/trailing header content. To keep clear of BaseModal's close button,
 * the row reserves trailing space (`pr-10`).
 *
 * @example
 * <BaseModal visible={open} onClose={close}>
 *   <ModalHeader title="Networks" />
 *   {content}
 * </BaseModal>
 */
const ModalHeader = ({
  title,
  showTitle = true,
  left,
  right,
  className,
  titleClassName,
}: ModalHeaderProps) => {
  return (
    <View
      className={`flex-row justify-between items-center mb-5 pr-10 ${
        className ?? ""
      }`}
    >
      <View className="flex-1 flex-row items-center">
        {left ??
          (showTitle && title ? (
            <Text
              className={`text-xl font-bold text-light-matte-black ${
                titleClassName ?? ""
              }`}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null)}
      </View>

      {right ?? null}
    </View>
  );
};

export default ModalHeader;
