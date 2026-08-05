import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import {
  MobileOutlined,
  SafetyOutlined,
  UserOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { loginWithPassword, register } from '@/api/auth';
import {
  phoneRule,
  usernameRule,
  passwordRule,
  confirmPasswordRule,
} from '@/utils/validators';
import styles from './LoginPage.module.scss';
import clsx from 'clsx';

const { Title, Text } = Typography;

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAppSession();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const isRegister = authMode === 'register';

  const handleSubmit = async (values: {
    phone: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
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
          })
        : await loginWithPassword({
            phone: values.phone.trim(),
            password: values.password ?? '',
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
            Tenant Hub
          </Title>
          <Text type="secondary" className={styles.loginSubtitle}>
            {isRegister
              ? '填写信息即可创建账号'
              : '使用手机号登录你的公寓经营工作台'}
          </Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item label="手机号" name="phone" rules={phoneRule}>
            <Input
              placeholder="请输入手机号"
              maxLength={11}
              prefix={<MobileOutlined className={styles.loginInputPrefix} />}
            />
          </Form.Item>

          {isRegister && (
            <Form.Item label="用户名" name="username" rules={usernameRule}>
              <Input
                placeholder="请输入用户名"
                maxLength={24}
                prefix={<UserOutlined className={styles.loginInputPrefix} />}
              />
            </Form.Item>
          )}

          <Form.Item
            label="密码"
            name="password"
            rules={passwordRule(isRegister)}
          >
            <Input.Password
              placeholder={isRegister ? '至少 8 位密码' : '请输入密码'}
              prefix={<SafetyOutlined className={styles.loginInputPrefix} />}
            />
          </Form.Item>

          {isRegister && (
            <Form.Item
              label="确认密码"
              name="confirmPassword"
              rules={confirmPasswordRule('password')}
            >
              <Input.Password
                placeholder="再次输入密码"
                prefix={<SafetyOutlined className={styles.loginInputPrefix} />}
              />
            </Form.Item>
          )}

          <Form.Item className={styles.loginFormItemSubmit}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={busy}
              className={styles.loginSubmitBtn}
            >
              {busy ? '处理中' : isRegister ? '注册并登录' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.loginAuthToggle}>
          <Button type="link" onClick={toggleAuthMode}>
            {isRegister ? '已有账号，去登录' : '注册新账号'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
