import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, radii, shadows, spacing, typography } from "../theme/tokens";
import { Icon } from "./ui/Icon";

interface ToastProps {
  message: string;
  onDismiss?: () => void;
  duration?: number;
}

function toastIcon(message: string): { name: "checkmark-circle" | "close-circle" | "warning" | "information-circle"; color: string } {
  if (message.includes("成功") || message.includes("已") || message.includes("完成")) return { name: "checkmark-circle", color: "#4ade80" };
  if (message.includes("失败") || message.includes("错误") || message.includes("无法") || message.includes("不能")) return { name: "close-circle", color: "#f87171" };
  if (message.includes("请") || message.includes("需要") || message.includes("必须")) return { name: "warning", color: "#fbbf24" };
  return { name: "information-circle", color: "#60a5fa" };
}

export default function Toast({ message, onDismiss, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setVisible(true);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true })
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: -60, duration: 200, useNativeDriver: true })
        ]).start(() => {
          setVisible(false);
          onDismiss?.();
        });
      }, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, duration, onDismiss]);

  if (!visible) return null;

  const icon = toastIcon(message);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Icon name={icon.name} size={18} color={icon.color} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: spacing[4],
    left: spacing[4],
    right: spacing[4],
    zIndex: 100,
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.toastBg,
    ...shadows.elevated,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  text: {
    color: colors.white,
    ...typography.body,
    fontWeight: "600",
    flex: 1
  }
});
