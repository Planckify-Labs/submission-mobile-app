import { X } from "lucide-react-native";
import { Pressable } from "react-native";
import type { ModalCloseButtonProps } from "./types";

/**
 * The single, app-wide close (X) button — the `NetworkSelectorModal` style:
 * a red `X` inside a `bg-light-primary-red/10` circle. `ModalHeader` renders
 * this by default; drop it into any custom header so every sheet's close
 * looks and behaves the same.
 *
 * @example
 * <ModalCloseButton onPress={onClose} />
 * <ModalCloseButton onPress={onClose} disabled={isSaving} />
 */
const ModalCloseButton = ({
  onPress,
  disabled,
  size = 18,
  iconColor = "#c71c4b",
  className,
  accessibilityLabel = "Close",
}: ModalCloseButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`w-8 h-8 rounded-full bg-light-primary-red/10 items-center justify-center ${
        disabled ? "opacity-40" : ""
      } ${className ?? ""}`}
    >
      <X size={size} color={iconColor} />
    </Pressable>
  );
};

export default ModalCloseButton;
