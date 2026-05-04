import { Text, View } from "react-native";
import { styles } from "../styles";

export default function HomeScreen() {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>资产统计</Text>
        <Text style={styles.muted}>资产统计功能开发中</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>营收统计</Text>
        <Text style={styles.muted}>营收统计功能开发中</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>待办事项</Text>
        <Text style={styles.muted}>待办事项功能开发中</Text>
      </View>
    </>
  );
}
