import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const cycleLabels: Record<string, string> = { MONTHLY: "月付", QUARTERLY: "季付", YEARLY: "年付" };

export function LeasesPage() {
  const [leases, setLeases] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const rooms = useMemo(() => apartments.flatMap((apt) => apt.rooms.map((room: any) => ({ ...room, apartment: apt }))), [apartments]);
  const load = () => {
    api<any[]>("/leases").then(setLeases).catch((error) => messageApi.error(error.message));
    api<any[]>("/apartments").then(setApartments).catch(() => undefined);
  };

  useEffect(load, []);

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>租约管理</h1>
        <Button type="primary" onClick={() => setOpen(true)}>
          签订租约
        </Button>
      </div>
      <div className="content-band">
        <Table
          rowKey="id"
          dataSource={leases}
          columns={[
            { title: "公寓", render: (_, row) => row.room?.apartment?.name },
            { title: "房间", render: (_, row) => row.room?.roomNo },
            { title: "租客", dataIndex: "tenantName" },
            { title: "周期", dataIndex: "cycle", render: (value) => cycleLabels[value] },
            { title: "租金", dataIndex: "rentAmount" },
            { title: "租期", render: (_, row) => `${row.startDate.slice(0, 10)} 至 ${row.endDate.slice(0, 10)}` },
            { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "ACTIVE" ? "green" : "default"}>{value}</Tag> }
          ]}
        />
      </div>
      <Modal open={open} title="签订租约" footer={null} width={720} onCancel={() => setOpen(false)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            const room = rooms.find((item) => item.id === values.roomId);
            const payload = {
              ...values,
              startDate: values.dates[0].format("YYYY-MM-DD"),
              endDate: values.dates[1].format("YYYY-MM-DD"),
              waterUnitPrice: values.waterUnitPrice ?? room?.apartment?.waterUnitPrice ?? 0,
              powerUnitPrice: values.powerUnitPrice ?? room?.apartment?.powerUnitPrice ?? 0,
              fees: []
            };
            delete payload.dates;
            await api("/leases", { method: "POST", body: JSON.stringify(payload) });
            setOpen(false);
            load();
          }}
        >
          <Form.Item name="roomId" label="房间" rules={[{ required: true }]}>
            <Select
              showSearch
              options={rooms.map((room) => ({ value: room.id, label: `${room.apartment.name} / ${room.roomNo}` }))}
            />
          </Form.Item>
          <Space wrap>
            <Form.Item name="tenantName" label="租客姓名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="tenantPhone" label="租客电话" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="rentAmount" label="租金" rules={[{ required: true }]}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="depositAmount" label="押金" initialValue={0}>
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="dates" label="租期" rules={[{ required: true }]}>
              <DatePicker.RangePicker />
            </Form.Item>
            <Form.Item name="cycle" label="交租周期" initialValue="MONTHLY">
              <Select style={{ width: 120 }} options={[{ value: "MONTHLY", label: "月付" }, { value: "QUARTERLY", label: "季付" }, { value: "YEARLY", label: "年付" }]} />
            </Form.Item>
            <Form.Item name="graceDays" label="交租期限" initialValue={3}>
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="waterUnitPrice" label="水费单价">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="powerUnitPrice" label="电费单价">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit">
            保存并出账
          </Button>
        </Form>
      </Modal>
    </main>
  );
}
