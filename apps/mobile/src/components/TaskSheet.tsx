import type { ReactNode } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../theme/styles";

export type TaskSheetVariant = "drawer" | "dialog";

type Props = {
  visible: boolean;
  variant?: TaskSheetVariant;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function TaskSheet({ visible, variant = "drawer", title, subtitle, onClose, children, footer }: Props) {
  const isDialog = variant === "dialog";

  return (
    <Modal visible={visible} transparent animationType={isDialog ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={[styles.taskSheetOverlay, styles[`taskSheetOverlay_${variant}`]]}>
        <View style={[styles.taskSheetCard, styles[`taskSheetCard_${variant}`]]}>
          <View style={styles.sectionHeader}>
            <View style={styles.taskSheetTitleBlock}>
              <Text style={styles.sectionTitle}>{title}</Text>
              {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity style={styles.smallButton} onPress={onClose}>
              <Text style={styles.smallButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.taskSheetContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.taskSheetFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
