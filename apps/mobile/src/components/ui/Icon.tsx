import Ionicons from "react-native-vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { colors } from "../../theme/tokens";

export type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color = colors.text }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}
