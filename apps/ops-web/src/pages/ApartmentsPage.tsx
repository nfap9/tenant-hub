import { Button, Form, Input, InputNumber, Modal, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

export function ApartmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState<any>();
  const [messageApi, contextHolder] = message.useMessage();
  const load = () => api<any[]>("/apartments").then(setItems).catch((error) => messageApi.error(error.message));

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>公寓管理</h1>
        <Button type="primary" onClick={() => setOpen(true)}>
          新增公寓
        </Button>
      </div>
      <div className="content-band">
        <Table
          rowKey="id"
          dataSource={items}
          columns={[
            { title: "名称", dataIndex: "name" },
            { title: "位置", dataIndex: "location" },
            { title: "楼层", dataIndex: "floors" },
            { title: "房间", render: (_, row) => row.rooms?.length ?? 0 },
            { title: "水价", dataIndex: "waterUnitPrice" },
            { title: "电价", dataIndex: "powerUnitPrice" },
            {
              title: "房间状态",
              render: (_, row) => row.rooms?.slice(0, 5).map((room: any) => <Tag key={room.id}>{room.roomNo}</Tag>)
            },
            { title: "操作", render: (_, row) => <Button onClick={() => setRoomOpen(row)}>批量加房</Button> }
          ]}
        />
      </div>
      <Modal open={open} title="新增公寓" footer={null} onCancel={() => setOpen(false)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api("/apartments", { method: "POST", body: JSON.stringify(values) });
            setOpen(false);
            load();
          }}
        >
          <Form.Item name="name" label="公寓名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="location" label="位置" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space>
            <Form.Item name="floors" label="楼层数" initialValue={1}>
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="waterUnitPrice" label="水费单价" initialValue={0}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="powerUnitPrice" label="电费单价" initialValue={0}>
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="landlordName" label="房东姓名">
            <Input />
          </Form.Item>
          <Form.Item name="landlordPhone" label="房东联系方式">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
      <Modal open={!!roomOpen} title="批量添加房间" footer={null} onCancel={() => setRoomOpen(undefined)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            const rooms = values.rooms
              .split("\n")
              .map((line: string) => line.trim())
              .filter(Boolean)
              .map((roomNo: string) => ({ roomNo, layout: values.layout, area: values.area, facilities: values.facilities?.split("，").filter(Boolean) || [] }));
            await api(`/apartments/${roomOpen.id}/rooms/batch`, { method: "POST", body: JSON.stringify({ rooms }) });
            setRoomOpen(undefined);
            load();
          }}
        >
          <Form.Item name="rooms" label="房间号，每行一个" rules={[{ required: true }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="layout" label="户型" initialValue="单间">
            <Input />
          </Form.Item>
          <Form.Item name="area" label="面积">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="facilities" label="设施，中文逗号分隔">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            添加
          </Button>
        </Form>
      </Modal>
    </main>
  );
}
