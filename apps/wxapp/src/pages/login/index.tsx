import { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button, Input, Card } from '../../components/ui';
import { apiClient } from '../../api/client';
import { useAppSession } from '../../context/AppSessionContext';
import { showToast } from '../../components/Toast';

type LoginMode = 'password' | 'code';
type AuthMode = 'login' | 'register';

function useCountdown() {
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);

  const start = useCallback((seconds: number) => {
    setCount(seconds);
    setRunning(true);
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  return { count, running, start };
}

export default function LoginPage() {
  const { signIn } = useAppSession();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [mode, setMode] = useState<LoginMode>('password');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const { count: countdown, running: otpBusy, start: startCountdown } = useCountdown();

  const isRegister = authMode === 'register';

  const sendOtp = async () => {
    if (otpBusy || busy) return;
    if (!phone.trim()) {
      showToast('请输入手机号');
      return;
    }
    try {
      await apiClient('/auth/otp', {
        method: 'POST',
        body: { phone: phone.trim(), purpose: isRegister ? 'REGISTER' : 'LOGIN' }
      });
      showToast('验证码已发送，请查看短信', 'success');
      startCountdown(60);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '发送验证码失败', 'error');
    }
  };

  const submit = async () => {
    if (busy) return;

    if (!phone.trim()) {
      showToast('请输入手机号');
      return;
    }
    if (isRegister && !username.trim()) {
      showToast('请输入用户名');
      return;
    }
    if ((isRegister || mode === 'password') && !password) {
      showToast('请输入密码');
      return;
    }
    if (isRegister && password !== confirmPassword) {
      showToast('两次输入的密码不一致');
      return;
    }
    if ((isRegister || mode === 'code') && !code) {
      showToast('请输入验证码');
      return;
    }

    setBusy(true);
    try {
      const path = isRegister
        ? '/auth/register'
        : mode === 'password'
          ? '/auth/login/password'
          : '/auth/login/otp';

      const body = isRegister
        ? { phone: phone.trim(), username: username.trim(), password, confirmPassword, code }
        : mode === 'password'
          ? { phone: phone.trim(), password }
          : { phone: phone.trim(), code };

      const result = await apiClient<{ token: string; user: { id: string; username: string; phone: string } }>(
        path,
        { method: 'POST', body }
      );

      await signIn(result);
      showToast(isRegister ? '注册成功' : '登录成功', 'success');
      Taro.switchTab({ url: '/pages/index/index' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleAuthMode = () => {
    const next = isRegister ? 'login' : 'register';
    setAuthMode(next);
    if (!isRegister) {
      // 切换到注册时默认使用验证码模式
      setMode('code');
    }
  };

  return (
    <View style={{ padding: '48rpx', minHeight: '100vh', backgroundColor: '#115e59' }}>
      <View style={{ marginTop: '160rpx', marginBottom: '80rpx' }}>
        <Text style={{ fontSize: '52rpx', fontWeight: 'bold', color: '#fff' }}>
          Tenant Hub
        </Text>
        <Text style={{ fontSize: '28rpx', color: '#5eead4', marginTop: '16rpx' }}>
          {isRegister ? '注册后即可开始管理你的公寓' : '给二房东和小型物业公司的移动经营台'}
        </Text>
      </View>

      <Card variant="warm">
        <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#1e293b', marginBottom: '8rpx' }}>
          {isRegister ? '注册账号' : '欢迎回来'}
        </Text>
        <Text style={{ fontSize: '26rpx', color: '#64748b', marginBottom: '40rpx' }}>
          {isRegister ? '手机号验证后即可创建账号' : '使用手机号登录你的公寓经营工作台'}
        </Text>

        {!isRegister && (
          <View style={{
            display: 'flex',
            gap: '16rpx',
            marginBottom: '40rpx',
            backgroundColor: '#f1f5f9',
            borderRadius: '16rpx',
            padding: '6rpx'
          }}>
            <View
              style={{
                flex: 1,
                padding: '20rpx 0',
                borderRadius: '12rpx',
                textAlign: 'center',
                backgroundColor: mode === 'code' ? '#fff' : 'transparent',
                boxShadow: mode === 'code' ? '0 2rpx 8rpx rgba(0,0,0,0.06)' : 'none'
              }}
              onClick={() => setMode('code')}
            >
              <Text style={{
                fontSize: '28rpx',
                fontWeight: mode === 'code' ? 'bold' : 'normal',
                color: mode === 'code' ? '#0d9488' : '#64748b'
              }}>
                验证码登录
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                padding: '20rpx 0',
                borderRadius: '12rpx',
                textAlign: 'center',
                backgroundColor: mode === 'password' ? '#fff' : 'transparent',
                boxShadow: mode === 'password' ? '0 2rpx 8rpx rgba(0,0,0,0.06)' : 'none'
              }}
              onClick={() => setMode('password')}
            >
              <Text style={{
                fontSize: '28rpx',
                fontWeight: mode === 'password' ? 'bold' : 'normal',
                color: mode === 'password' ? '#0d9488' : '#64748b'
              }}>
                密码登录
              </Text>
            </View>
          </View>
        )}

        <View style={{ display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
          <Input
            label="手机号"
            value={phone}
            onChange={setPhone}
            placeholder="请输入手机号"
            type="digit"
          />

          {isRegister && (
            <Input
              label="用户名"
              value={username}
              onChange={setUsername}
              placeholder="请输入用户名"
            />
          )}

          {(mode === 'password' || isRegister) && (
            <Input
              label="密码"
              value={password}
              onChange={setPassword}
              placeholder={isRegister ? '至少 8 位密码' : '请输入密码'}
              password
            />
          )}

          {isRegister && (
            <Input
              label="确认密码"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="再次输入密码"
              password
            />
          )}

          {(mode === 'code' || isRegister) && (
            <View>
              <Input
                label="验证码"
                value={code}
                onChange={setCode}
                placeholder="6 位验证码"
                type="digit"
              />
              <View style={{ marginTop: '16rpx' }}>
                <Button
                  variant="secondary"
                  size="small"
                  loading={otpBusy}
                  disabled={otpBusy || busy || countdown > 0}
                  onClick={sendOtp}
                >
                  {countdown > 0 ? `${countdown}s 后重试` : otpBusy ? '发送中' : '获取验证码'}
                </Button>
              </View>
            </View>
          )}

          <Button onClick={submit} loading={busy} disabled={busy}>
            {busy ? '处理中' : isRegister ? '注册并登录' : '登录'}
          </Button>

          <View style={{ textAlign: 'center', marginTop: '8rpx' }}>
            <Text
              style={{ fontSize: '26rpx', color: '#64748b' }}
              onClick={toggleAuthMode}
            >
              {isRegister ? '已有账号，去登录' : '注册新账号'}
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}
