import { useState } from 'react';
import { TextInput, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type Props = TextInputProps & {
  style?: ViewStyle;
  error?: boolean;
};

export function Input({ style, error = false, placeholderTextColor, ...props }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      placeholderTextColor={placeholderTextColor ?? colors.textPlaceholder}
      onFocus={e => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        {
          minHeight: props.multiline ? 88 : 44,
          paddingHorizontal: spacing[3],
          paddingTop: props.multiline ? spacing[3] : undefined,
          borderRadius: radii.md,
          borderWidth: focused ? 1.5 : 1,
          borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: typography.body.fontSize,
          lineHeight: typography.body.lineHeight,
          textAlignVertical: props.multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}
