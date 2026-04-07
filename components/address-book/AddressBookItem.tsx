import { Edit3, Trash2 } from "lucide-react-native";
import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";

const ACTION_WIDTH = 136; // width of the revealed actions panel

type AddressBookItemProps = {
  entry: TAddressBookEntry;
  index: number;
  onEdit: (entry: TAddressBookEntry) => void;
  onDelete: (id: string) => void;
  onCopy: (address: string) => void;
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "#c71c4b",
    "#1c6bc7",
    "#1cb87e",
    "#c77a1c",
    "#6b1cc7",
    "#c71c8e",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const AddressBookItem = memo(function AddressBookItem({
  entry,
  index,
  onEdit,
  onDelete,
  onCopy,
}: AddressBookItemProps) {
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const initials = useMemo(() => getInitials(entry.name), [entry.name]);
  const avatarColor = useMemo(() => getAvatarColor(entry.name), [entry.name]);
  const shortAddress = useMemo(
    () =>
      `${entry.address.substring(0, 6)}...${entry.address.substring(entry.address.length - 4)}`,
    [entry.address],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      const base = isOpen.value ? -ACTION_WIDTH : 0;
      const next = base + e.translationX;
      translateX.value = Math.min(0, Math.max(-ACTION_WIDTH, next));
    })
    .onEnd((e) => {
      const shouldOpen =
        !isOpen.value
          ? e.translationX < -ACTION_WIDTH / 2
          : e.translationX < ACTION_WIDTH / 2;
      if (shouldOpen) {
        translateX.value = withSpring(-ACTION_WIDTH, { damping: 18, stiffness: 180 });
        isOpen.value = true;
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
        isOpen.value = false;
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionsOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(translateX.value < -16 ? 1 : 0, { duration: 150 }),
  }));

  const handleEdit = () => {
    translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    isOpen.value = false;
    onEdit(entry);
  };

  const handleDelete = () => {
    translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    isOpen.value = false;
    onDelete(entry.id);
  };

  const handleCopyPress = () => {
    if (isOpen.value) {
      translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      isOpen.value = false;
    } else {
      onCopy(entry.address);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60)
        .duration(350)
        .springify()
        .damping(14)}
      className="mb-3 mx-4"
    >
      {/* Action buttons behind the row */}
      <Animated.View
        style={[
          {
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: ACTION_WIDTH,
            flexDirection: "row",
          },
          actionsOpacity,
        ]}
      >
        <Pressable
          onPress={handleEdit}
          style={{
            flex: 1,
            backgroundColor: "#20222c",
            borderRadius: 16,
            marginRight: 4,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Edit3 size={18} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
            }}
          >
            Edit
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDelete}
          style={{
            flex: 1,
            backgroundColor: "#c71c4b",
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 size={18} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
            }}
          >
            Delete
          </Text>
        </Pressable>
      </Animated.View>

      {/* Swipeable row */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            rowStyle,
            {
              backgroundColor: "#ffffff",
              borderRadius: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            },
          ]}
        >
          <Pressable
            onPress={handleCopyPress}
            style={{ flexDirection: "row", alignItems: "center", padding: 16 }}
          >
            {/* Avatar */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: `${avatarColor}18`,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: avatarColor,
                }}
              >
                {initials}
              </Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: "#20222c",
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {entry.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#20222c99",
                  fontFamily: "monospace",
                }}
              >
                {shortAddress}
              </Text>
            </View>

            {/* Copy hint */}
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: "#c71c4b12",
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 10, color: "#c71c4b", fontWeight: "600" }}>
                COPY
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

export default AddressBookItem;
