import { Button, Form, Input, InputNumber, Modal, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

export function BillsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [utilityItem, setUtilityItem] = useState<any>();
  const [paymentBill, setPaymentBill] = useState<any>();
  const [messageApi, contextHolder] = message.useMessage();
  const load = () => api<any[]>("/bills").then(setItems).catch((error) => messageApi.error(error.message));

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>账单管理</h1>
        <Button onClick={() => window.open("/api/bills/utility/pending-export")}>导出待录入水电</Button>
      </div>
      <div className="content-band">
        <Table
          rowKey="id"
          dataSource={items}
          expandable={{
            expandedRowRender: (row) => (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={row.items}
                columns={[
                  { title: "类型", dataIndex: "type" },
                  { title: "名称", dataIndex: "name" },
                  { title: "金额", dataIndex: "amount" },
                  { title: "状态", dataIndex: "status" },
                  { title: "操作", render: (_: unknown, item: any) => item.type === "UTILITY" && item.status === "BILLING" ? <Button onClick={() => setUtilityItem(item)}>录入读数</Button> : null }
                ]}
              />
            )
          }}
          columns={[
            { title: "房间", render: (_, row) => row.lease?.room?.roomNo },
            { title: "租客", render: (_, row) => row.lease?.tenantName },
            { title: "账期", render: (_, row) => `${row.periodStart.slice(0, 10)} 至 ${row.periodEnd.slice(0, 10)}` },
            { title: "应收", dataIndex: "totalAmount" },
            { title: "已收", dataIndex: "paidAmount" },
            { title: "状态", dataIndex: "status", render: (value) => <Tag>{value}</Tag> },
            { title: "操作", render: (_, row) => <Button onClick={() => setPaymentBill(row)}>收款</Button> }
          ]}
        />
      </div>
      <Modal open={!!utilityItem} title="录入水电读数" footer={null} onCancel={() => setUtilityItem(undefined)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api(`/bills/items/${utilityItem.id}/utility-reading`, { method: "POST", body: JSON.stringify(values) });
            setUtilityItem(undefined);
            load();
          }}
        >
          <Space wrap>
            <Form.Item name="previousWater" label="上月水表" rules={[{ required: true }]}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="currentWater" label="本月水表" rules={[{ required: true }]}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="previousPower" label="上月电表" rules={[{ required: true }]}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="currentPower" label="本月电表" rules={[{ required: true }]}>
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
      <Modal open={!!paymentBill} title="记录收款" footer={null} onCancel={() => setPaymentBill(undefined)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api(`/bills/${paymentBill.id}/payments`, { method: "POST", body: JSON.stringify(values) });
            setPaymentBill(undefined);
            load();
          }}
        >
          <Form.Item name="amount" label="收款金额" rules={[{ required: true }]}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="method" label="收款方式" initialValue="微信">
            <Input />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
    </main>
  );
}
