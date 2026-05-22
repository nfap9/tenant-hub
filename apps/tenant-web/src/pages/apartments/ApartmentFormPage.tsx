import { useState, useEffect, useRef } from "react";
import { Card, Form, Input, InputNumber, Button, DatePicker, message, Spin } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import {
  SaveOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  BuildOutlined,
  AreaChartOutlined,
  UserOutlined,
  PhoneOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { createApartment, updateApartment, getApartments } from "@/api/apartments";
import type { Apartment } from "@/types/domain";
import { optionalNumber, optionalText } from "@/utils/format";
import PageHeader from "@/components/ui/PageHeader";

export default function ApartmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission("apartment:manage");
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
        floors: apartment.floors,
        landArea: apartment.landArea ? Number(apartment.landArea) : undefined,
        totalArea: apartment.totalArea ? Number(apartment.totalArea) : undefined,
        landlordName: apartment.landlordName,
        landlordPhone: apartment.landlordPhone,
        contractStart: apartment.contractStart ? dayjs(apartment.contractStart) : undefined,
        contractEnd: apartment.contractEnd ? dayjs(apartment.contractEnd) : undefined,
        rentAmount: apartment.rentAmount ? Number(apartment.rentAmount) : undefined,
      });
      initializedRef.current = true;
    }
    if (!isEdit) {
      form.resetFields();
      initializedRef.current = false;
    }
  }, [isEdit, apartment, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) { message.warning("请先选择组织"); return; }
    if (!canManageApartment) { message.warning("当前角色没有管理公寓权限"); return; }

    const payload = {
      name: String(values.name).trim(),
      location: String(values.location).trim(),
      floors: Number(values.floors || 1),
      landArea: optionalNumber(values.landArea),
      totalArea: optionalNumber(values.totalArea),
      landlordName: optionalText(values.landlordName),
      landlordPhone: optionalText(values.landlordPhone),
      contractStart: values.contractStart ? dayjs(values.contractStart as string).format("YYYY-MM-DD") : undefined,
      contractEnd: values.contractEnd ? dayjs(values.contractEnd as string).format("YYYY-MM-DD") : undefined,
      rentAmount: optionalNumber(values.rentAmount),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateApartment(currentOrgId, id!, payload);
        message.success("公寓信息已更新");
        navigate(`/apartments/${id}`);
      } else {
        const saved = await createApartment(currentOrgId, payload);
        message.success("公寓已创建");
        navigate(`/apartments/${saved.id}`);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={isEdit ? `/apartments/${id}` : "/apartments"}
        breadcrumb={[
          { label: "公寓管理", path: "/apartments" },
          { label: isEdit ? "编辑公寓" : "新增公寓" },
        ]}
      />

      <Spin spinning={loading}>
        <Card style={{ maxWidth: 720 }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item label="公寓名称" name="name" rules={[{ required: true, message: "请输入公寓名称" }]}>
              <Input
                size="large"
                prefix={<HomeOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                placeholder="例如 阳光公寓"
              />
            </Form.Item>
            <Form.Item label="地址" name="location" rules={[{ required: true, message: "请输入地址" }]}>
              <Input
                size="large"
                prefix={<EnvironmentOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                placeholder="请输入地址或片区"
              />
            </Form.Item>
            <Form.Item label="楼层数" name="floors" rules={[{ required: true, message: "请输入楼层数" }]}>
              <InputNumber
                min={1}
                size="large"
                style={{ width: "100%" }}
                prefix={<BuildOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                placeholder="例如 6"
              />
            </Form.Item>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Form.Item label="占地面积（㎡）" name="landArea">
                <InputNumber
                  min={0}
                  size="large"
                  style={{ width: "100%" }}
                  prefix={<AreaChartOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                  placeholder="例如 500"
                />
              </Form.Item>
              <Form.Item label="总面积（㎡）" name="totalArea">
                <InputNumber
                  min={0}
                  size="large"
                  style={{ width: "100%" }}
                  prefix={<AreaChartOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                  placeholder="例如 3000"
                />
              </Form.Item>
            </div>
            <Form.Item label="房东姓名" name="landlordName">
              <Input
                size="large"
                prefix={<UserOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                placeholder="请输入房东姓名"
              />
            </Form.Item>
            <Form.Item label="房东电话" name="landlordPhone">
              <Input
                size="large"
                prefix={<PhoneOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                placeholder="请输入手机号"
              />
            </Form.Item>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Form.Item label="合同开始日期" name="contractStart">
                <DatePicker size="large" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item label="合同结束日期" name="contractEnd">
                <DatePicker size="large" style={{ width: "100%" }} />
              </Form.Item>
            </div>
            <Form.Item label="上游租金" name="rentAmount">
              <InputNumber
                min={0}
                size="large"
                style={{ width: "100%" }}
                prefix={<DollarOutlined style={{ color: "var(--th-foreground-subtle)" }} />}
                placeholder="每期金额"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={saving} size="large">
                {isEdit ? "保存公寓信息" : "创建公寓"}
              </Button>
              <Button
                size="large"
                style={{ marginLeft: 12 }}
                onClick={() => navigate(isEdit ? `/apartments/${id}` : "/apartments")}
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
