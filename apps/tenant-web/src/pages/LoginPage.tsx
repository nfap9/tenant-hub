import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  message,
  Segmented,
} from 'antd';
import {
  MobileOutlined,
  SafetyOutlined,
  UserOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  sendOtp as sendOtpRequest,
  loginWithPassword,
  loginWithOtp,
  register,
} from '@/api/auth';

const { Title, Text } = Typography;

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
  const navigate = useNavigate();
  const { signIn, platformInfo } = useAppSession();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [mode, setMode] = useState<LoginMode>('password');
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const { count, running: otpBusy, start: startCountdown } = useCountdown();

  const isRegister = authMode === 'register';

  useEffect(() => {
    if (isRegister) {
      setMode('code');
    }
  }, [isRegister]);

  const sendOtp = async () => {
    const phone = form.getFieldValue('phone');
    if (!phone?.trim()) {
      message.warning('请输入手机号');
      return;
    }
    if (otpBusy || count > 0) return;

    try {
      await sendOtpRequest({
        phone: phone.trim(),
        purpose: isRegister ? 'REGISTER' : 'LOGIN',
      });
      message.success('验证码已发送，请查看短信');
      startCountdown(60);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送验证码失败');
    }
  };

  const handleSubmit = async (values: {
    phone: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
    code?: string;
  }) => {
    if (busy) return;

    setBusy(true);
    try {
      const result = isRegister
        ? await register({
            phone: values.phone.trim(),
            username: values.username?.trim() ?? '',
            password: values.password ?? '',
            confirmPassword: values.confirmPassword ?? '',
            code: values.code ?? '',
          })
        : mode === 'password'
          ? await loginWithPassword({
              phone: values.phone.trim(),
              password: values.password ?? '',
            })
          : await loginWithOtp({
              phone: values.phone.trim(),
              code: values.code ?? '',
            });

      await signIn(result);
      message.success(isRegister ? '注册成功' : '登录成功');
      navigate('/', { replace: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const toggleAuthMode = () => {
    const next = isRegister ? 'login' : 'register';
    setAuthMode(next);
    form.resetFields();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(160deg, #F0FDFA 0%, #E0F2FE 40%, #F0F9FF 100%)',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 装饰性几何元素 */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background:
            'linear-gradient(135deg, rgba(15,118,110,0.12) 0%, rgba(20,184,166,0.06) 100%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-8%',
          right: '-5%',
          width: 280,
          height: 280,
          borderRadius: 24,
          background:
            'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(15,118,110,0.06) 100%)',
          transform: 'rotate(15deg)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '30%',
          right: '10%',
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(15,118,110,0.06)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '25%',
          left: '8%',
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'rgba(14,165,233,0.08)',
          transform: 'rotate(12deg)',
          pointerEvents: 'none',
        }}
      />

      <Card
        style={{
          width: 440,
          borderRadius: 20,
          boxShadow:
            '0 20px 60px rgba(15,118,110,0.12), 0 8px 24px rgba(0,0,0,0.06)',
          position: 'relative',
          zIndex: 1,
        }}
        bodyStyle={{ padding: '40px 36px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Logo 区 */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 8px 20px rgba(15,118,110,0.25)',
            }}
          >
            <HomeOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <Title
            level={3}
            style={{
              color: 'var(--th-primary)',
              margin: 0,
              fontFamily: 'var(--th-font-heading)',
            }}
          >
            {platformInfo.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {isRegister
              ? '手机号验证后即可创建账号'
              : '使用手机号登录你的公寓经营工作台'}
          </Text>
        </div>

        {!isRegister && (
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as LoginMode)}
              options={[
                { label: '密码登录', value: 'password' },
                { label: '验证码登录', value: 'code' },
              ]}
            />
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="手机号"
            name="phone"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input
              size="large"
              placeholder="请输入手机号"
              maxLength={11}
              prefix={
                <MobileOutlined
                  style={{
                    color: 'var(--th-foreground-muted)',
                    marginRight: 6,
                  }}
                />
              }
            />
          </Form.Item>

          {isRegister && (
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                size="large"
                placeholder="请输入用户名"
                maxLength={24}
                prefix={
                  <UserOutlined
                    style={{
                      color: 'var(--th-foreground-muted)',
                      marginRight: 6,
                    }}
                  />
                }
              />
            </Form.Item>
          )}

          {(mode === 'password' || isRegister) && (
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                ...(isRegister ? [{ min: 8, message: '密码至少 8 位' }] : []),
              ]}
            >
              <Input.Password
                size="large"
                placeholder={isRegister ? '至少 8 位密码' : '请输入密码'}
                prefix={
                  <SafetyOutlined
                    style={{
                      color: 'var(--th-foreground-muted)',
                      marginRight: 6,
                    }}
                  />
                }
              />
            </Form.Item>
          )}

          {isRegister && (
            <Form.Item
              label="确认密码"
              name="confirmPassword"
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                size="large"
                placeholder="再次输入密码"
                prefix={
                  <SafetyOutlined
                    style={{
                      color: 'var(--th-foreground-muted)',
                      marginRight: 6,
                    }}
                  />
                }
              />
            </Form.Item>
          )}

          {(mode === 'code' || isRegister) && (
            <Form.Item
              label="验证码"
              name="code"
              rules={[{ required: true, message: '请输入验证码' }]}
            >
              <Input
                size="large"
                placeholder="6 位验证码"
                maxLength={6}
                prefix={
                  <SafetyOutlined
                    style={{
                      color: 'var(--th-foreground-muted)',
                      marginRight: 6,
                    }}
                  />
                }
                suffix={
                  <Button
                    type="link"
                    disabled={otpBusy || count > 0}
                    onClick={(e) => {
                      e.preventDefault();
                      sendOtp();
                    }}
                  >
                    {count > 0 ? `${count}s 后重试` : '获取验证码'}
                  </Button>
                }
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={busy}
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 12,
                boxShadow: '0 8px 20px rgba(15,118,110,0.25)',
              }}
            >
              {busy ? '处理中' : isRegister ? '注册并登录' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" onClick={toggleAuthMode}>
            {isRegister ? '已有账号，去登录' : '注册新账号'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
