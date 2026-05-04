import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "../theme/styles";
import type { TabKey } from "../types/navigation";
import { tabItems } from "./tabs";

export default function MainTabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  return (
    <View style={styles.tabbar}>
      {tabItems.map((tab) => (
        <TouchableOpacity key={tab.key} style={[styles.tab, active === tab.key && styles.tabActive]} onPress={() => onChange(tab.key)}>
          <Text style={[styles.tabText, active === tab.key && styles.tabTextActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
