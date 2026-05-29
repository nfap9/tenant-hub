import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  DatePicker,
  message,
  Spin,
  Select,
  Divider,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  SaveOutlined,
  HomeOutlined,
  UserOutlined,
  DollarOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  createApartment,
  updateApartment,
  getApartment,
} from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import { optionalNumber, optionalText } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import styles from './ApartmentFormPage.module.scss';

const statusOptions = [
  { label: '规划中', value: 'PLANNING' },
  { label: '装修中', value: 'RENOVATING' },
  { label: '筹备中', value: 'PREPARING' },
  { label: '运营中', value: 'ACTIVE' },
  { label: '暂停中', value: 'SUSPENDED' },
  { label: '已关闭', value: 'CLOSED' },
];

const propertyTypeOptions = [
  { label: '住宅', value: 'RESIDENTIAL' },
  { label: '商业', value: 'COMMERCIAL' },
  { label: '工业改造', value: 'INDUSTRIAL_RENOVATED' },
  { label: '城中村', value: 'URBAN_VILLAGE' },
  { label: '其他', value: 'OTHER' },
];

const propertyRightOptions = [
  { label: '自有产权', value: 'OWNED' },
  { label: '长租托管', value: 'LONG_TERM_LEASE' },
  { label: '受托管理', value: 'TRUSTEESHIP' },
];

const paymentMethodOptions = [
  { label: '月付', value: 'MONTHLY' },
  { label: '季付', value: 'QUARTERLY' },
  { label: '半年付', value: 'HALF_YEARLY' },
  { label: '年付', value: 'YEARLY' },
];

const escalationTypeOptions = [
  { label: '无递增', value: 'NONE' },
  { label: '固定金额', value: 'FIXED_AMOUNT' },
  { label: '百分比', value: 'PERCENTAGE' },
];

export default function ApartmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const isEdit = Boolean(id);
  const [form] = Form.useForm();

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isEdit || !currentOrgId || !id) return;
    setLoading(true);
    getApartment(currentOrgId, id)
      .then((data) => setApartment(data))
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '加载公寓信息失败');
      })
      .finally(() => setLoading(false));
  }, [isEdit, currentOrgId, id]);

  useEffect(() => {
    if (isEdit && apartment && !initializedRef.current) {
      form.setFieldsValue({
        name: apartment.name,
        location: apartment.location,
        status: apartment.status,
        propertyType: apartment.propertyType,
        floors: apartment.floors,
        landArea: apartment.landArea ? Number(apartment.landArea) : undefined,
        totalArea: apartment.totalArea
          ? Number(apartment.totalArea)
          : undefined,
        publicAreaRatio: apartment.publicAreaRatio
          ? Number(apartment.publicAreaRatio)
          : undefined,
        buildYear: apartment.buildYear,
        elevatorCount: apartment.elevatorCount,
        propertyRight: apartment.propertyRight,
        landlordName: apartment.landlordName,
        landlordPhone: apartment.landlordPhone,
        landlordContractNo: apartment.landlordContractNo,
        contractStart: apartment.contractStart
          ? dayjs(apartment.contractStart)
          : undefined,
        contractEnd: apartment.contractEnd
          ? dayjs(apartment.contractEnd)
          : undefined,
        rentAmount: apartment.rentAmount
          ? Number(apartment.rentAmount)
          : undefined,
        depositAmount: apartment.depositAmount
          ? Number(apartment.depositAmount)
          : undefined,
        paymentMethod: apartment.paymentMethod,
        rentEscalationType: apartment.rentEscalationType,
        rentEscalationValue: apartment.rentEscalationValue
          ? Number(apartment.rentEscalationValue)
          : undefined,
        rentEscalationCycle: apartment.rentEscalationCycle,
        costElectricityPrice: apartment.costElectricityPrice
          ? Number(apartment.costElectricityPrice)
          : undefined,
        costWaterPrice: apartment.costWaterPrice
          ? Number(apartment.costWaterPrice)
          : undefined,
        costGasPrice: apartment.costGasPrice
          ? Number(apartment.costGasPrice)
          : undefined,
        reminderDay: apartment.reminderDay,
        fireRating: apartment.fireRating,
        fireExtinguisherCount: apartment.fireExtinguisherCount,
        escapeRouteCount: apartment.escapeRouteCount,
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
      status: optionalText(values.status),
      propertyType: optionalText(values.propertyType),
      floors: Number(values.floors || 1),
      landArea: optionalNumber(values.landArea),
      totalArea: optionalNumber(values.totalArea),
      publicAreaRatio: optionalNumber(values.publicAreaRatio),
      buildYear: optionalNumber(values.buildYear),
      elevatorCount: optionalNumber(values.elevatorCount),
      propertyRight: optionalText(values.propertyRight),
      landlordName: optionalText(values.landlordName),
      landlordPhone: optionalText(values.landlordPhone),
      landlordContractNo: optionalText(values.landlordContractNo),
      contractStart: values.contractStart
        ? dayjs(values.contractStart as string).format('YYYY-MM-DD')
        : undefined,
      contractEnd: values.contractEnd
        ? dayjs(values.contractEnd as string).format('YYYY-MM-DD')
        : undefined,
      rentAmount: optionalNumber(values.rentAmount),
      depositAmount: optionalNumber(values.depositAmount),
      paymentMethod: optionalText(values.paymentMethod),
      rentEscalationType: optionalText(values.rentEscalationType),
      rentEscalationValue: optionalNumber(values.rentEscalationValue),
      rentEscalationCycle: optionalNumber(values.rentEscalationCycle),
      costElectricityPrice: optionalNumber(values.costElectricityPrice),
      costWaterPrice: optionalNumber(values.costWaterPrice),
      costGasPrice: optionalNumber(values.costGasPrice),
      reminderDay: optionalNumber(values.reminderDay),
      fireRating: optionalText(values.fireRating),
      fireExtinguisherCount: optionalNumber(values.fireExtinguisherCount),
      escapeRouteCount: optionalNumber(values.escapeRouteCount),
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
            {/* 基础信息 */}
            <h3 className={styles.sectionTitle}>
              <HomeOutlined /> 基础信息
            </h3>
            <div className={styles.formRow}>
              <Form.Item
                label="公寓名称"
                name="name"
                rules={[{ required: true, message: '请输入公寓名称' }]}
              >
                <Input placeholder="例如 阳光公寓" />
              </Form.Item>
              <Form.Item
                label="地址"
                name="location"
                rules={[{ required: true, message: '请输入地址' }]}
              >
                <Input placeholder="请输入地址或片区" />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="状态" name="status">
                <Select
                  placeholder="请选择状态"
                  options={statusOptions}
                  allowClear
                />
              </Form.Item>
              <Form.Item label="物业类型" name="propertyType">
                <Select
                  placeholder="请选择物业类型"
                  options={propertyTypeOptions}
                  allowClear
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item
                label="楼层数"
                name="floors"
                rules={[{ required: true, message: '请输入楼层数' }]}
              >
                <InputNumber min={1} className="w-full" placeholder="例如 6" />
              </Form.Item>
              <Form.Item label="建筑年代" name="buildYear">
                <InputNumber
                  min={1900}
                  max={2100}
                  className="w-full"
                  placeholder="例如 2020"
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="占地面积（㎡）" name="landArea">
                <InputNumber
                  min={0}
                  className="w-full"
                  placeholder="例如 500"
                />
              </Form.Item>
              <Form.Item label="总面积（㎡）" name="totalArea">
                <InputNumber
                  min={0}
                  className="w-full"
                  placeholder="例如 3000"
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="公摊比例" name="publicAreaRatio">
                <InputNumber
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                  placeholder="例如 0.25"
                />
              </Form.Item>
              <Form.Item label="电梯数量" name="elevatorCount">
                <InputNumber min={0} className="w-full" placeholder="例如 2" />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="产权类型" name="propertyRight">
                <Select
                  placeholder="请选择产权类型"
                  options={propertyRightOptions}
                  allowClear
                />
              </Form.Item>
            </div>

            <Divider />

            {/* 上游信息 */}
            <h3 className={styles.sectionTitle}>
              <UserOutlined /> 上游信息
            </h3>
            <div className={styles.formRow}>
              <Form.Item label="房东姓名" name="landlordName">
                <Input placeholder="请输入房东姓名" />
              </Form.Item>
              <Form.Item label="房东电话" name="landlordPhone">
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="合同编号" name="landlordContractNo">
                <Input placeholder="请输入合同编号" />
              </Form.Item>
              <Form.Item label="押金" name="depositAmount">
                <InputNumber
                  min={0}
                  className="w-full"
                  placeholder="押金金额"
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="合同开始日期" name="contractStart">
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item label="合同结束日期" name="contractEnd">
                <DatePicker className="w-full" />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="上游租金" name="rentAmount">
                <InputNumber
                  min={0}
                  className="w-full"
                  placeholder="每期金额"
                />
              </Form.Item>
              <Form.Item label="付款方式" name="paymentMethod">
                <Select
                  placeholder="请选择付款方式"
                  options={paymentMethodOptions}
                  allowClear
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="递增类型" name="rentEscalationType">
                <Select
                  placeholder="请选择递增类型"
                  options={escalationTypeOptions}
                  allowClear
                />
              </Form.Item>
              <Form.Item label="递增数值" name="rentEscalationValue">
                <InputNumber
                  min={0}
                  className="w-full"
                  placeholder="固定金额或百分比"
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="递增周期（月）" name="rentEscalationCycle">
                <InputNumber min={1} className="w-full" placeholder="例如 12" />
              </Form.Item>
            </div>

            <Divider />

            {/* 运营配置 */}
            <h3 className={styles.sectionTitle}>
              <DollarOutlined /> 运营配置
            </h3>
            <div className={styles.formRow}>
              <Form.Item label="电费成本单价" name="costElectricityPrice">
                <InputNumber
                  min={0}
                  step={0.01}
                  className="w-full"
                  placeholder="元/度"
                />
              </Form.Item>
              <Form.Item label="水费成本单价" name="costWaterPrice">
                <InputNumber
                  min={0}
                  step={0.01}
                  className="w-full"
                  placeholder="元/吨"
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="燃气成本单价" name="costGasPrice">
                <InputNumber
                  min={0}
                  step={0.01}
                  className="w-full"
                  placeholder="元/立方米"
                />
              </Form.Item>
              <Form.Item label="账单提醒日" name="reminderDay">
                <InputNumber
                  min={1}
                  max={28}
                  className="w-full"
                  placeholder="每月几号提醒"
                />
              </Form.Item>
            </div>

            <Divider />

            {/* 消防与安全 */}
            <h3 className={styles.sectionTitle}>
              <SafetyOutlined /> 消防与安全
            </h3>
            <div className={styles.formRow}>
              <Form.Item label="消防等级" name="fireRating">
                <Input placeholder="例如 一级/二级/三级" />
              </Form.Item>
              <Form.Item label="灭火器数量" name="fireExtinguisherCount">
                <InputNumber min={0} className="w-full" placeholder="例如 10" />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item label="逃生通道数量" name="escapeRouteCount">
                <InputNumber min={0} className="w-full" placeholder="例如 2" />
              </Form.Item>
            </div>

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
