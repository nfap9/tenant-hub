import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scale?: number;
};

export function PressableScale({ children, style, scale = 0.97, ...props }: Props) {
  const anim = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(anim, {
      toValue: scale,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      style={[{ transform: [{ scale: anim }] }, style]}
      onPressIn={pressIn}
      onPressOut={pressOut}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
