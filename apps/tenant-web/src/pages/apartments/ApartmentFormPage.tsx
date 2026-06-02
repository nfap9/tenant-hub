import { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, Button, message, Spin } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  SaveOutlined,
  HomeOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  createApartment,
  updateApartment,
  getApartments,
} from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import styles from './ApartmentFormPage.module.scss';

export default function ApartmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const isEdit = Boolean(id);
  const [form] = Form.useForm();

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getApartments(currentOrgId)
      .then((data) => setApartments(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const apartment = apartments.find((a) => a.id === id);

  useEffect(() => {
    if (isEdit && apartment && !initializedRef.current) {
      form.setFieldsValue({
        name: apartment.name,
        location: apartment.location,
      });
      initializedRef.current = true;
    }
    if (!isEdit) {
      form.resetFields();
      initializedRef.current = false;
    }
  }, [isEdit, apartment, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) {
      message.warning('请先选择组织');
      return;
    }
    if (!canManageApartment) {
      message.warning('当前角色没有管理公寓权限');
      return;
    }

    const payload = {
      name: String(values.name).trim(),
      location: String(values.location).trim(),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateApartment(currentOrgId, id!, payload);
        message.success('公寓信息已更新');
        navigate(`/apartments/${id}`);
      } else {
        const saved = await createApartment(currentOrgId, payload);
        message.success('公寓已创建');
        navigate(`/apartments/${saved.id}`);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={isEdit ? `/apartments/${id}` : '/apartments'}
        breadcrumb={[
          { label: '公寓管理', path: '/apartments' },
          { label: isEdit ? '编辑公寓' : '新增公寓' },
        ]}
      />

      <Spin spinning={loading}>
        <Card className={styles.apartmentFormCard}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="公寓名称"
              name="name"
              rules={[{ required: true, message: '请输入公寓名称' }]}
            >
              <Input
                prefix={<HomeOutlined className="text-subtle" />}
                placeholder="例如 阳光公寓"
              />
            </Form.Item>
            <Form.Item
              label="地址"
              name="location"
              rules={[{ required: true, message: '请输入地址' }]}
            >
              <Input
                prefix={<EnvironmentOutlined className="text-subtle" />}
                placeholder="请输入地址或片区"
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={saving}
              >
                {isEdit ? '保存公寓信息' : '创建公寓'}
              </Button>
              <Button
                className={styles.cancelBtn}
                onClick={() =>
                  navigate(isEdit ? `/apartments/${id}` : '/apartments')
                }
              >
                取消
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </div>
  );
}
