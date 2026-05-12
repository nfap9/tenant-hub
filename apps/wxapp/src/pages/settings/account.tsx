import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card } from '../../components/ui';
import './index.scss';

export default function AccountPage() {
  const { session } = useAppSession();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = async () => {
    if (!newPassword || !oldPassword) return Taro.showToast({ title: "请填写完整", icon: "none" });
    if (newPassword !== confirmPassword) return Taro.showToast({ title: "两次密码不一致", icon: "none" });
    try {
      await apiClient("/auth/password", { method: "PUT", body: { currentPassword: oldPassword, newPassword, confirmPassword: newPassword } });
      Taro.showToast({ title: "密码已修改", icon: "success" });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "修改失败", icon: "none" });
    }
  };

  return (
    <View className="page-container">
      <Card title="账号信息">
        <View className="detail-row">
          <Text className="text-muted">用户名</Text>
          <Text className="card-title">{session?.user.username}</Text>
        </View>
        <View className="detail-row">
          <Text className="text-muted">手机号</Text>
          <Text className="card-title">{session?.user.phone}</Text>
        </View>
      </Card>

      <Card title="修改密码">
        <Input placeholder="当前密码" password value={oldPassword} onInput={(e) => setOldPassword(e.detail.value)} />
        <Input placeholder="新密码" password value={newPassword} onInput={(e) => setNewPassword(e.detail.value)} />
        <Input placeholder="确认新密码" password value={confirmPassword} onInput={(e) => setConfirmPassword(e.detail.value)} />
        <Button onClick={changePassword}>确认修改</Button>
      </Card>
    </View>
  );
}
