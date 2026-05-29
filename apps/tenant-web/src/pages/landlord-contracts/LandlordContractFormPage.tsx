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
  DatePicker,
  InputNumber,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  getLandlordContract,
  createLandlordContract,
  updateLandlordContract,
} from '@/api/landlordContracts';
import { getAllApartments } from '@/api/apartments';
import type { LandlordContract } from '@/api/landlordContracts';
import type { Apartment } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import dayjs from 'dayjs';
import styles from './LandlordContractFormPage.module.scss';

const escalationTypeOptions = [
  { label: '无递增', value: 'NONE' },
  { label: '固定金额', value: 'FIXED' },
  { label: '百分比', value: 'PERCENTAGE' },
];

const paymentMethodOptions = [
  { label: '月付', value: 'MONTHLY' },
  { label: '季付', value: 'QUARTERLY' },
  { label: '半年付', value: 'HALF_YEARLY' },
  { label: '年付', value: 'YEARLY' },
];

export default function LandlordContractFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const initializedRef = useRef(false);

  const [contract, setContract] = useState<LandlordContract | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(id);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    Promise.all([
      isEdit && id
        ? getLandlordContract(currentOrgId, id)
        : Promise.resolve(null),
      getAllApartments(currentOrgId),
    ])
      .then(([cData, aData]) => {
        if (cData) setContract(cData);
        setApartments(aData);
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '加载数据失败');
      })
      .finally(() => setLoading(false));
  }, [isEdit, id, currentOrgId]);

  useEffect(() => {
    if (isEdit && contract && !initializedRef.current) {
      form.setFieldsValue({
        apartmentId: contract.apartmentId,
        contractNo: contract.contractNo,
        startDate: contract.startDate ? dayjs(contract.startDate) : null,
        endDate: contract.endDate ? dayjs(contract.endDate) : null,
        rentAmount: Number(contract.rentAmount),
        depositAmount: Number(contract.depositAmount),
        paymentMethod: contract.paymentMethod,
        escalationType: contract.escalationType,
        escalationValue: contract.escalationValue
          ? Number(contract.escalationValue)
          : undefined,
        escalationCycle: contract.escalationCycle,
        freeRentDays: contract.freeRentDays,
        freeRentStart: contract.freeRentStart
          ? dayjs(contract.freeRentStart)
          : null,
        freeRentEnd: contract.freeRentEnd ? dayjs(contract.freeRentEnd) : null,
        signDate: contract.signDate ? dayjs(contract.signDate) : null,
        attachmentUrl: contract.attachmentUrl,
        note: contract.note,
      });
      initializedRef.current = true;
    }
  }, [isEdit, contract, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        startDate: values.startDate
          ? dayjs(values.startDate as string).format('YYYY-MM-DD')
          : undefined,
        endDate: values.endDate
          ? dayjs(values.endDate as string).format('YYYY-MM-DD')
          : undefined,
        freeRentStart: values.freeRentStart
          ? dayjs(values.freeRentStart as string).format('YYYY-MM-DD')
          : undefined,
        freeRentEnd: values.freeRentEnd
          ? dayjs(values.freeRentEnd as string).format('YYYY-MM-DD')
          : undefined,
        signDate: values.signDate
          ? dayjs(values.signDate as string).format('YYYY-MM-DD')
          : undefined,
      };

      if (isEdit && id) {
        await updateLandlordContract(currentOrgId, id, payload);
        message.success('保存成功');
        navigate(`/landlord-contracts/${id}`);
      } else {
        const created = await createLandlordContract(
          currentOrgId,
          payload as Parameters<typeof createLandlordContract>[1]
        );
        message.success('创建成功');
        navigate(`/landlord-contracts/${created.id}`);
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
        breadcrumb={[
          {
            label: '房东合同',
            path: '/landlord-contracts',
          },
          { label: isEdit ? '编辑合同' : '新增合同' },
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
            <Form.Item
              label="所属公寓"
              name="apartmentId"
              rules={[{ required: true, message: '请选择公寓' }]}
            >
              <Select
                placeholder="请选择公寓"
                options={apartments.map((a) => ({
                  label: a.name,
                  value: a.id,
                }))}
              />
            </Form.Item>

            <div className={styles.formRow}>
              <Form.Item label="合同编号" name="contractNo">
                <Input placeholder="请输入合同编号" />
              </Form.Item>
              <Form.Item label="签约日期" name="signDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item
                label="开始日期"
                name="startDate"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="结束日期"
                name="endDate"
                rules={[{ required: true, message: '请选择结束日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item
                label="月租金"
                name="rentAmount"
                rules={[{ required: true, message: '请输入月租金' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入月租金"
                />
              </Form.Item>
              <Form.Item label="押金" name="depositAmount">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入押金"
                />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item
                label="付款方式"
                name="paymentMethod"
                rules={[{ required: true, message: '请选择付款方式' }]}
              >
                <Select
                  placeholder="请选择付款方式"
                  options={paymentMethodOptions}
                />
              </Form.Item>
              <Form.Item label="免租期（天）" name="freeRentDays">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="请输入免租期天数"
                />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="免租开始日期" name="freeRentStart">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="免租结束日期" name="freeRentEnd">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="递增类型" name="escalationType">
                <Select
                  placeholder="请选择递增类型"
                  options={escalationTypeOptions}
                  allowClear
                />
              </Form.Item>
              <Form.Item label="递增金额/比例" name="escalationValue">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="固定金额或百分比数值"
                />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="递增周期（月）" name="escalationCycle">
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  placeholder="如每12个月递增一次"
                />
              </Form.Item>
            </div>

            <Form.Item label="合同附件URL" name="attachmentUrl">
              <Input placeholder="请输入合同附件URL" />
            </Form.Item>

            <Form.Item label="备注" name="note">
              <Input.TextArea rows={3} placeholder="请输入备注" />
            </Form.Item>

            <div className={styles.formActions}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() =>
                  navigate(
                    isEdit ? `/landlord-contracts/${id}` : '/landlord-contracts'
                  )
                }
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
