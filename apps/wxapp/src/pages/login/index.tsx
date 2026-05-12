import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { switchTab } from '@tarojs/taro';
import { Button, Input, Card } from '../../components/ui';
import { apiClient } from '../../api/client';
import { setSession } from '../../utils/storage';
import { showToast } from '../../components/Toast';

type LoginMode = 'password' | 'otp';

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim()) {
      showToast('请输入手机号');
      return;
    }
    if (mode === 'password' && !password) {
      showToast('请输入密码');
      return;
    }
    if (mode === 'otp' && !otp) {
      showToast('请输入验证码');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'password' ? '/auth/login/password' : '/auth/login/otp';
      const body = mode === 'password'
        ? { phone: phone.trim(), password }
        : { phone: phone.trim(), code: otp };

      const session = await apiClient<{ token: string; user: { id: string; username: string; phone: string } }>(
        endpoint,
        { method: 'POST', body }
      );

      setSession(session);
      showToast('登录成功', 'success');
      switchTab({ url: '/pages/index/index' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '登录失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 'var(--spacing-6)', minHeight: '100vh', backgroundColor: 'var(--color-primary-dark)' }}>
      <View style={{ marginTop: '120rpx', marginBottom: 'var(--spacing-10)' }}>
        <Text style={{ fontSize: 'var(--font-size-h1)', fontWeight: 'bold', color: '#fff' }}>
          Tenant Hub
        </Text>
        <Text style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-primary-light)', marginTop: 'var(--spacing-2)' }}>
          轻量化公寓管理系统
        </Text>
      </View>

      <Card variant="warm">
        <View style={{ display: 'flex', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
          <View
            style={{
              flex: 1,
              paddingBottom: 'var(--spacing-3)',
              borderBottom: mode === 'password' ? '4rpx solid var(--color-primary)' : '4rpx solid transparent',
              textAlign: 'center'
            }}
            onClick={() => setMode('password')}
          >
            <Text style={{
              fontSize: 'var(--font-size-body)',
              fontWeight: mode === 'password' ? 'bold' : 'normal',
              color: mode === 'password' ? 'var(--color-primary)' : 'var(--color-text-muted)'
            }}>
              密码登录
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              paddingBottom: 'var(--spacing-3)',
              borderBottom: mode === 'otp' ? '4rpx solid var(--color-primary)' : '4rpx solid transparent',
              textAlign: 'center'
            }}
            onClick={() => setMode('otp')}
          >
            <Text style={{
              fontSize: 'var(--font-size-body)',
              fontWeight: mode === 'otp' ? 'bold' : 'normal',
              color: mode === 'otp' ? 'var(--color-primary)' : 'var(--color-text-muted)'
            }}>
              验证码登录
            </Text>
          </View>
        </View>

        <View style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <Input
            label="手机号"
            value={phone}
            onChange={setPhone}
            placeholder="请输入手机号"
            type="digit"
          />
          {mode === 'password' ? (
            <Input
              label="密码"
              value={password}
              onChange={setPassword}
              placeholder="请输入密码"
              password
            />
          ) : (
            <Input
              label="验证码"
              value={otp}
              onChange={setOtp}
              placeholder="请输入验证码"
              type="digit"
            />
          )}

          <Button onClick={handleLogin} loading={loading}>
            登录
          </Button>
        </View>
      </Card>
    </View>
  );
}
