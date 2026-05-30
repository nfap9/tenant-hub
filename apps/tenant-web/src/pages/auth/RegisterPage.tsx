// PAGE-002: 注册页面
import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import {
  MobileOutlined,
  SafetyOutlined,
  UserOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { sendOtp as sendOtpRequest, register as registerApi } from '@/api/auth';
import styles from '@/pages/LoginPage.module.scss';
import clsx from 'clsx';

const { Title, Text } = Typography;

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signIn, platformInfo } = useAppSession();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const { count, running: otpBusy, start: startCountdown } = useCountdown();

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
        purpose: 'REGISTER',
      });
      message.success('验证码已发送，请查看短信');
      startCountdown(60);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送验证码失败');
    }
  };

  const handleSubmit = async (values: {
    phone: string;
    username: string;
    password: string;
    confirmPassword: string;
    code: string;
  }) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await registerApi({
        phone: values.phone.trim(),
        username: values.username.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        code: values.code,
      });
      await signIn(result);
      message.success('注册成功');
      navigate('/settings/organization?action=create', { replace: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '注册失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={clsx(styles.loginBgShape, styles.loginBgShape1)} />
      <div className={clsx(styles.loginBgShape, styles.loginBgShape2)} />
      <div className={clsx(styles.loginBgShape, styles.loginBgShape3)} />
      <div className={clsx(styles.loginBgShape, styles.loginBgShape4)} />

      <Card className={styles.loginCard}>
        <div className={styles.loginLogoWrapper}>
          <div className={styles.loginLogoBox}>
            <HomeOutlined className={styles.loginLogoIcon} />
          </div>
          <Title level={3} className={styles.loginTitle}>
            {platformInfo.name}
          </Title>
          <Text type="secondary" className={styles.loginSubtitle}>
            手机号验证后即可创建账号
          </Text>
        </div>

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
              placeholder="请输入手机号"
              maxLength={11}
              prefix={<MobileOutlined className={styles.loginInputPrefix} />}
            />
          </Form.Item>

          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              placeholder="请输入用户名"
              maxLength={24}
              prefix={<UserOutlined className={styles.loginInputPrefix} />}
            />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
              {
                pattern: /[a-zA-Z]/,
                message: '密码必须包含字母',
              },
              {
                pattern: /\d/,
                message: '密码必须包含数字',
              },
            ]}
          >
            <Input.Password
              placeholder="至少 8 位密码"
              prefix={<SafetyOutlined className={styles.loginInputPrefix} />}
            />
          </Form.Item>

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
              placeholder="再次输入密码"
              prefix={<SafetyOutlined className={styles.loginInputPrefix} />}
            />
          </Form.Item>

          <Form.Item
            label="验证码"
            name="code"
            rules={[{ required: true, message: '请输入验证码' }]}
          >
            <Input
              placeholder="6 位验证码"
              maxLength={6}
              prefix={<SafetyOutlined className={styles.loginInputPrefix} />}
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

          <Form.Item className={styles.loginFormItemSubmit}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={busy}
              className={styles.loginSubmitBtn}
            >
              {busy ? '处理中' : '注册并登录'}
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.loginAuthToggle}>
          <Link to="/login">已有账号，去登录</Link>
        </div>
      </Card>
    </div>
  );
}
