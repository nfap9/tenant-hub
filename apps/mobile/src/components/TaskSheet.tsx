import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Modal, ScrollView, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';
import { Icon } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';

export type TaskSheetVariant = 'drawer' | 'dialog';

type Props = {
  visible: boolean;
  variant?: TaskSheetVariant;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function TaskSheet({
  visible,
  variant = 'drawer',
  title,
  subtitle,
  onClose,
  children,
  footer,
}: Props) {
  const isDialog = variant === 'dialog';
  const slideAnim = useRef(new Animated.Value(isDialog ? 20 : 300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 9,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, {
          toValue: isDialog ? 20 : 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, isDialog]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.overlay,
          isDialog ? styles.overlay_dialog : styles.overlay_drawer,
          { opacity: fadeAnim },
        ]}
      >
        <Animated.View
          style={[
            styles.card,
            isDialog ? styles.card_dialog : styles.card_drawer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.titleText}>{title}</Text>
              {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
            </View>
            <PressableScale scale={0.85} onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </PressableScale>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: colors.overlayHeavy,
  } as const,

  overlay_drawer: {
    justifyContent: 'flex-end' as const,
  },

  overlay_dialog: {
    justifyContent: 'center' as const,
    padding: spacing[4.5],
  },

  card: {
    backgroundColor: colors.surface,
    gap: spacing[2.5],
    padding: spacing[3.5],
  } as const,

  card_drawer: {
    maxHeight: '90%' as const,
    minHeight: '62%' as const,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.float,
  },

  card_dialog: {
    maxHeight: '78%' as const,
    borderRadius: radii.lg,
    ...shadows.float,
  },

  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: spacing[2.5],
  },

  titleBlock: {
    flex: 1,
    gap: spacing[0.5],
  },

  titleText: {
    color: colors.text,
    ...typography.h5,
  },

  subtitleText: {
    color: colors.textMuted,
    ...typography.bodySmall,
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  closeIcon: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700' as const,
  },

  content: {
    gap: spacing[2.5],
    paddingBottom: spacing[0.5],
  },

  footer: {
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
};
