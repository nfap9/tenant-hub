// PAGE-604: 账号设置
import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Modal, Space, Row, Col } from 'antd';
import {
  SaveOutlined,
  LockOutlined,
  UserOutlined,
  MobileOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { updatePassword, updateMe } from '@/api/auth';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import styles from './AccountPage.module.scss';

export default function AccountPage() {
  const { session } = useAppSession();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      form.setFieldsValue({
        username: session.user.username,
        phone: session.user.phone,
      });
    }
  }, [session, form]);

  const handleUpdateProfile = async (values: { username: string }) => {
    setProfileLoading(true);
    try {
      await updateMe({ username: values.username.trim() });
      message.success('保存成功');
      setProfileModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    setPasswordLoading(true);
    try {
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      message.success('密码已更新');
      passwordForm.resetFields();
      setPasswordModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '密码更新失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back="/settings"
        breadcrumb={[
          { label: '设置', path: '/settings' },
          { label: '账号设置' },
        ]}
      />

      <DetailSection
        title={
          <span className={styles.settingsCardTitle}>
            <UserOutlined />
            账号信息
          </span>
        }
        actions={
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => setProfileModalOpen(true)}
            >
              修改信息
            </Button>
            <Button
              type="primary"
              icon={<LockOutlined />}
              onClick={() => setPasswordModalOpen(true)}
            >
              修改密码
            </Button>
          </Space>
        }
      >
        <Row gutter={[24, 0]}>
          <Col span={12}>
            <DetailItem label="用户名">
              {session?.user?.username || '-'}
            </DetailItem>
          </Col>
          <Col span={12}>
            <DetailItem label="手机号">
              {session?.user?.phone || '-'}
            </DetailItem>
          </Col>
        </Row>
      </DetailSection>

      <Modal
        title="修改信息"
        open={profileModalOpen}
        onCancel={() => setProfileModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateProfile}
          className={styles.settingsForm}
        >
          <Form.Item label="用户名" name="username">
            <Input prefix={<UserOutlined className="text-subtle" />} />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input
              prefix={<MobileOutlined className="text-subtle" />}
              disabled
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={profileLoading}
              icon={<SaveOutlined />}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleUpdatePassword}
          className={styles.settingsForm}
        >
          <Form.Item
            label="原密码"
            name="currentPassword"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-subtle" />}
              placeholder="请输入原密码"
            />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
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
              prefix={<LockOutlined className="text-subtle" />}
              placeholder="至少 8 位密码"
            />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-subtle" />}
              placeholder="再次输入新密码"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={passwordLoading}
              icon={<SaveOutlined />}
            >
              更新密码
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
