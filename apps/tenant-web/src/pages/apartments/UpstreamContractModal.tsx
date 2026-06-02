import { useEffect, useRef } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Divider,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  BuildOutlined,
  AreaChartOutlined,
  DollarOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ApartmentContract } from '@/types/domain';
import { optionalNumber, optionalText } from '@/utils/format';
import styles from './ApartmentFormPage.module.scss';

interface UpstreamContractModalProps {
  open: boolean;
  contract?: ApartmentContract | null;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  submitting: boolean;
}

export default function UpstreamContractModal({
  open,
  contract,
  onCancel,
  onSubmit,
  submitting,
}: UpstreamContractModalProps) {
  const [form] = Form.useForm();
  const isEdit = Boolean(contract);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (open && contract && !initializedRef.current) {
      form.setFieldsValue({
        landlordName: contract.landlordName,
        landlordPhone: contract.landlordPhone,
        contractStart: contract.contractStart
          ? dayjs(contract.contractStart)
          : undefined,
        contractEnd: contract.contractEnd
          ? dayjs(contract.contractEnd)
          : undefined,
        rentAmount: contract.rentAmount
          ? Number(contract.rentAmount)
          : undefined,
        floors: contract.floors,
        landArea: contract.landArea ? Number(contract.landArea) : undefined,
        totalArea: contract.totalArea ? Number(contract.totalArea) : undefined,
      });
      initializedRef.current = true;
    }
    if (open && !contract) {
      form.resetFields();
      initializedRef.current = false;
    }
  }, [open, contract, form]);

  const handleCancel = () => {
    form.resetFields();
    initializedRef.current = false;
    onCancel();
  };

  const handleFinish = async (values: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {
      landlordName: optionalText(values.landlordName),
      landlordPhone: optionalText(values.landlordPhone),
      contractStart: values.contractStart
        ? dayjs(values.contractStart as string).format('YYYY-MM-DD')
        : undefined,
      contractEnd: values.contractEnd
        ? dayjs(values.contractEnd as string).format('YYYY-MM-DD')
        : undefined,
      rentAmount: optionalNumber(values.rentAmount),
      floors: values.floors ? Number(values.floors) : undefined,
      landArea: optionalNumber(values.landArea),
      totalArea: optionalNumber(values.totalArea),
    };
    await onSubmit(payload);
    form.resetFields();
    initializedRef.current = false;
  };

  return (
    <Modal
      open={open}
      title={isEdit ? '编辑上游合同' : '录入上游合同'}
      onCancel={handleCancel}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        style={{ marginTop: 16 }}
      >
        <Divider orientation="left">房东信息</Divider>
        <Form.Item label="房东姓名" name="landlordName">
          <Input
            prefix={<UserOutlined className="text-subtle" />}
            placeholder="请输入房东姓名"
          />
        </Form.Item>
        <Form.Item label="房东电话" name="landlordPhone">
          <Input
            prefix={<PhoneOutlined className="text-subtle" />}
            placeholder="请输入手机号"
          />
        </Form.Item>

        <Divider orientation="left">合同信息</Divider>
        <div className={styles.formRow}>
          <Form.Item label="合同开始日期" name="contractStart">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="合同结束日期" name="contractEnd">
            <DatePicker className="w-full" />
          </Form.Item>
        </div>
        <Form.Item label="上游租金" name="rentAmount">
          <InputNumber
            min={0}
            className="w-full"
            prefix={<DollarOutlined className="text-subtle" />}
            placeholder="每期金额"
          />
        </Form.Item>

        <Divider orientation="left">物业信息</Divider>
        <Form.Item label="楼层数" name="floors">
          <InputNumber
            min={1}
            className="w-full"
            prefix={<BuildOutlined className="text-subtle" />}
            placeholder="例如 6"
          />
        </Form.Item>
        <div className={styles.formRow}>
          <Form.Item label="占地面积（㎡）" name="landArea">
            <InputNumber
              min={0}
              className="w-full"
              prefix={<AreaChartOutlined className="text-subtle" />}
              placeholder="例如 500"
            />
          </Form.Item>
          <Form.Item label="总面积（㎡）" name="totalArea">
            <InputNumber
              min={0}
              className="w-full"
              prefix={<AreaChartOutlined className="text-subtle" />}
              placeholder="例如 3000"
            />
          </Form.Item>
        </div>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={submitting}
            disabled={submitting}
          >
            {isEdit ? '保存' : '录入'}
          </Button>
          <Button className={styles.cancelBtn} onClick={handleCancel}>
            取消
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
