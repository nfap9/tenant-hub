import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useState } from "react";

export default function App() {
  const [phone, setPhone] = useState("");

  return (
    <SafeAreaView style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tenant Hub</Text>
        <Text style={styles.subtitle}>租客与管家移动端</Text>
        <View style={styles.panel}>
          <Text style={styles.label}>手机号</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>获取验证码</Text>
          </TouchableOpacity>
        </View>
        {["待缴账单", "水电读数", "租约信息"].map((item) => (
          <View style={styles.row} key={item}>
            <Text style={styles.rowText}>{item}</Text>
            <Text style={styles.rowHint}>进入</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#f4f2ec" },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 30, fontWeight: "700", color: "#102522" },
  subtitle: { color: "#5f6865", marginBottom: 8 },
  panel: { padding: 16, backgroundColor: "white", borderRadius: 8 },
  label: { marginBottom: 8, color: "#394341" },
  input: { height: 44, borderWidth: 1, borderColor: "#d9d3c4", borderRadius: 6, paddingHorizontal: 12 },
  button: { height: 44, marginTop: 12, borderRadius: 6, backgroundColor: "#146c5c", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontWeight: "700" },
  row: { padding: 16, backgroundColor: "white", borderRadius: 8, flexDirection: "row", justifyContent: "space-between" },
  rowText: { fontSize: 16, color: "#102522" },
  rowHint: { color: "#146c5c" }
});
