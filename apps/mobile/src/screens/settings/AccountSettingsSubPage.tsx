import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";

type AccountSettingsSubPageProps = {
  token: string;
  setNotice: (value: string) => void;
  onBack: () => void;
};

export default function AccountSettingsSubPage({ token, setNotice, onBack }: AccountSettingsSubPageProps) {
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await mobileApi("/auth/password", token, {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setEditingPassword(false);
      setNotice("密码已更新，下次登录请使用新密码");
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.subPageHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>返回</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>账号安全</Text>
          <TouchableOpacity style={styles.smallButton} onPress={() => setEditingPassword((old) => !old)}>
            <Text style={styles.smallButtonText}>{editingPassword ? "收起" : "修改密码"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.detailPanel}>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>登录密码</Text>
            <Text style={styles.cardTitle}>已设置</Text>
          </View>
          <Text style={styles.muted}>定期更新密码可以降低账号被误用的风险。</Text>
        </View>
        {editingPassword ? (
          <View style={styles.detailPanel}>
            <Text style={styles.sectionTitle}>修改密码</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              style={styles.input}
              placeholder="当前密码"
              secureTextEntry
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
              placeholder="新密码，至少 8 位"
              secureTextEntry
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              placeholder="再次输入新密码"
              secureTextEntry
            />
            <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={submit}>
              <Text style={styles.buttonText}>{saving ? "保存中" : "保存新密码"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </>
  );
}
