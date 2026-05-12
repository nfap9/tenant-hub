import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Input } from '../../components/ui';
import { mobileApi } from '../../services';
import { styles } from '../../theme/styles';

type AccountSettingsSubPageProps = {
  token: string;
  setNotice: (value: string) => void;
  onBack: () => void;
};

export default function AccountSettingsSubPage({
  token,
  setNotice,
  onBack,
}: AccountSettingsSubPageProps) {
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await mobileApi('/auth/password', token, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setEditingPassword(false);
      setNotice('密码已更新，下次登录请使用新密码');
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.subPageHeader}>
        <Button variant="ghost" size="small" onPress={onBack} icon="arrow-back-outline">
          返回
        </Button>
      </View>
      <Card
        title="账号安全"
        headerAction={
          <Button
            variant="ghost"
            size="small"
            onPress={() => setEditingPassword(old => !old)}
            icon={editingPassword ? 'chevron-up-outline' : 'create-outline'}
          >
            {editingPassword ? '收起' : '修改密码'}
          </Button>
        }
      >
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
            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="当前密码"
              secureTextEntry
            />
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="新密码，至少 8 位"
              secureTextEntry
            />
            <Input
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="再次输入新密码"
              secureTextEntry
            />
            <Button loading={saving} disabled={saving} onPress={submit} icon="save-outline">
              {saving ? '保存中' : '保存新密码'}
            </Button>
          </View>
        ) : null}
      </Card>
    </>
  );
}
