import { Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { Icon } from '../components/ui/Icon';
import { PressableScale } from '../components/ui/PressableScale';
import type { TabKey } from '../types/navigation';
import { tabItems } from './tabs';

export default function MainTabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
}) {
  return (
    <View style={styles.tabbar}>
      {tabItems.map(tab => {
        const isActive = active === tab.key;
        return (
          <PressableScale
            key={tab.key}
            scale={0.92}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Icon
              name={isActive ? tab.iconActive : tab.icon}
              size={22}
              color={isActive ? colors.white : colors.textPlaceholder}
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = {
  tabbar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 64,
    padding: spacing[2],
    paddingBottom: spacing[2] + 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLighter,
    flexDirection: 'row' as const,
    gap: spacing[1.5],
  },
  tab: {
    flex: 1,
    borderRadius: radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[0.5],
    paddingVertical: spacing[1],
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textPlaceholder, fontSize: 12, lineHeight: 16 },
  tabTextActive: { color: colors.white, fontWeight: '700' as const },
};
