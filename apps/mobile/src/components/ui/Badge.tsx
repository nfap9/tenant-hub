import { Text, View, type ViewStyle } from 'react-native';
import { radii, spacing, toneColors, type Tone } from '../../theme/tokens';

type Props = {
  children: string;
  tone?: Tone;
  style?: ViewStyle;
};

export function Badge({ children, tone = 'neutral', style }: Props) {
  const { bg, text } = toneColors(tone);

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing[2.5],
          paddingVertical: spacing[1],
          borderRadius: radii.full,
          backgroundColor: bg,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: text,
          fontSize: 12,
          fontWeight: '700',
          lineHeight: 16,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
