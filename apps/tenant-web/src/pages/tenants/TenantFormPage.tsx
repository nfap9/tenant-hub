import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Spin,
  Select,
  InputNumber,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getTenant, updateTenant } from '@/api/tenants';
import type { Tenant } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import styles from './TenantFormPage.module.scss';

const sourceChannelOptions = [
  { label: '58同城', value: 'PLATFORM_58' },
  { label: '豆瓣', value: 'DOUBAN' },
  { label: '贝壳', value: 'BEIKE' },
  { label: '转介绍', value: 'REFERRAL' },
  { label: '中介', value: 'AGENT' },
  { label: '上门', value: 'WALK_IN' },
  { label: '其他', value: 'OTHER' },
];

export default function TenantFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const initializedRef = useRef(false);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(id);

  useEffect(() => {
    if (!isEdit || !currentOrgId || !id) return;
    setLoading(true);
    getTenant(currentOrgId, id)
      .then((data) => {
        setTenant(data);
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '加载租客信息失败');
      })
      .finally(() => setLoading(false));
  }, [isEdit, currentOrgId, id]);

  useEffect(() => {
    if (isEdit && tenant && !initializedRef.current) {
      form.setFieldsValue({
        name: tenant.name,
        phone: tenant.phone,
        idCard: tenant.idCard,
        idCardFrontUrl: tenant.idCardFrontUrl,
        idCardBackUrl: tenant.idCardBackUrl,
        emergencyContact: tenant.emergencyContact,
        emergencyPhone: tenant.emergencyPhone,
        workUnit: tenant.workUnit,
        jobTitle: tenant.jobTitle,
        sourceChannel: tenant.sourceChannel,
        creditScore: tenant.creditScore,
        remark: tenant.remark,
      });
      initializedRef.current = true;
    }
  }, [isEdit, tenant, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !id) return;
    setSaving(true);
    try {
      await updateTenant(currentOrgId, id, values);
      message.success('保存成功');
      navigate(`/tenants/${id}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '租客管理', path: '/tenants' },
          { label: isEdit ? '编辑租客' : '新增租客' },
        ]}
      />

      <Spin spinning={loading}>
        <Card className={styles.formCard}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className={styles.form}
          >
            <div className={styles.formRow}>
              <Form.Item
                label="姓名"
                name="name"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入租客姓名" />
              </Form.Item>
              <Form.Item
                label="手机号"
                name="phone"
                rules={[{ required: true, message: '请输入手机号' }]}
              >
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="身份证号" name="idCard">
                <Input placeholder="请输入身份证号" />
              </Form.Item>
              <Form.Item label="来源渠道" name="sourceChannel">
                <Select
                  placeholder="请选择来源渠道"
                  options={sourceChannelOptions}
                  allowClear
                />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="身份证正面照片URL" name="idCardFrontUrl">
                <Input placeholder="请输入身份证正面照片URL" />
              </Form.Item>
              <Form.Item label="身份证反面照片URL" name="idCardBackUrl">
                <Input placeholder="请输入身份证反面照片URL" />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="紧急联系人" name="emergencyContact">
                <Input placeholder="请输入紧急联系人姓名" />
              </Form.Item>
              <Form.Item label="紧急联系电话" name="emergencyPhone">
                <Input placeholder="请输入紧急联系人电话" />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="工作单位" name="workUnit">
                <Input placeholder="请输入工作单位" />
              </Form.Item>
              <Form.Item label="职位" name="jobTitle">
                <Input placeholder="请输入职位" />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="信用分" name="creditScore">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={1000}
                  placeholder="请输入信用分（0-1000）"
                />
              </Form.Item>
            </div>

            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={3} placeholder="请输入备注" />
            </Form.Item>

            <div className={styles.formActions}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(isEdit ? `/tenants/${id}` : '/tenants')}
              >
                返回
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saving}
              >
                保存
              </Button>
            </div>
          </Form>
        </Card>
      </Spin>
    </div>
  );
}
