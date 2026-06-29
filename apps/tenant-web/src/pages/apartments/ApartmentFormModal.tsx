import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  message,
  Spin,
  Row,
  Col,
} from 'antd';
import {
  SaveOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  UserOutlined,
  PhoneOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  createApartment,
  updateApartment,
  getApartments,
} from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import dayjs from 'dayjs';
import styles from './ApartmentFormPage.module.scss';

interface ApartmentFormModalProps {
  open: boolean;
  apartmentId?: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function ApartmentFormModal({
  open,
  apartmentId,
  onCancel,
  onSuccess,
}: ApartmentFormModalProps) {
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const isEdit = Boolean(apartmentId);
  const [form] = Form.useForm();

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!currentOrgId || !open) return;
    setLoading(true);
    getApartments(currentOrgId)
      .then((data) => setApartments(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [currentOrgId, open]);

  const apartment = apartments.find((a) => a.id === apartmentId);

  useEffect(() => {
    if (open && isEdit && apartment && !initializedRef.current) {
      form.setFieldsValue({
        name: apartment.name,
        address: apartment.address,
        rentAmount: apartment.rentAmount
          ? Number(apartment.rentAmount)
          : undefined,
        landlordName: apartment.landlordName,
        landlordPhone: apartment.landlordPhone,
        contractStart: apartment.contractStart
          ? dayjs(apartment.contractStart)
          : undefined,
        contractEnd: apartment.contractEnd
          ? dayjs(apartment.contractEnd)
          : undefined,
        floors: apartment.floors,
      });
      initializedRef.current = true;
    }
    if (open && !isEdit) {
      form.resetFields();
      initializedRef.current = false;
    }
  }, [open, isEdit, apartment, form]);

  const handleCancel = () => {
    form.resetFields();
    initializedRef.current = false;
    onCancel();
  };

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
      address: String(values.address).trim(),
      rentAmount:
        values.rentAmount !== undefined && values.rentAmount !== ''
          ? Number(values.rentAmount)
          : undefined,
      landlordName: values.landlordName
        ? String(values.landlordName).trim()
        : undefined,
      landlordPhone: values.landlordPhone
        ? String(values.landlordPhone).trim()
        : undefined,
      contractStart: values.contractStart
        ? dayjs(values.contractStart as string).format('YYYY-MM-DD')
        : undefined,
      contractEnd: values.contractEnd
        ? dayjs(values.contractEnd as string).format('YYYY-MM-DD')
        : undefined,
      floors:
        values.floors !== undefined && values.floors !== ''
          ? Number(values.floors)
          : undefined,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateApartment(currentOrgId, apartmentId!, payload);
        message.success('公寓信息已更新');
      } else {
        await createApartment(currentOrgId, payload);
        message.success('公寓已创建');
      }
      form.resetFields();
      initializedRef.current = false;
      onSuccess();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑公寓' : '新增公寓'}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={640}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
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
            name="address"
            rules={[{ required: true, message: '请输入地址' }]}
          >
            <Input
              prefix={<EnvironmentOutlined className="text-subtle" />}
              placeholder="请输入地址或片区"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="房东姓名" name="landlordName">
                <Input
                  prefix={<UserOutlined className="text-subtle" />}
                  placeholder="选填"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系方式" name="landlordPhone">
                <Input
                  prefix={<PhoneOutlined className="text-subtle" />}
                  placeholder="选填"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="合同开始" name="contractStart">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="合同结束" name="contractEnd">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="上游租金" name="rentAmount">
                <InputNumber
                  min={0}
                  className="w-full"
                  prefix="¥"
                  placeholder="选填"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="楼层数" name="floors">
                <InputNumber
                  min={1}
                  className="w-full"
                  prefix={<BuildOutlined className="text-subtle" />}
                  placeholder="选填"
                />
              </Form.Item>
            </Col>
          </Row>

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
            <Button className={styles.cancelBtn} onClick={handleCancel}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
