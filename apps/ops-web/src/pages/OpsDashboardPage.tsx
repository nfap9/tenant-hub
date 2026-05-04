import { Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

type Summary = {
  organizations: number;
  users: number;
  apartments: number;
  rooms: number;
  activeLeases: number;
  unpaidBills: number;
};

export function OpsDashboardPage() {
  const [summary, setSummary] = useState<Summary>();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    api<Summary>("/admin/summary").then(setSummary).catch((error) => messageApi.error(error.message));
    api<any[]>("/admin/organizations").then(setOrganizations).catch(() => undefined);
  }, [messageApi]);

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>运营总览</h1>
      </div>
      <div className="metric-grid">
        {[
          ["组织", summary?.organizations],
          ["用户", summary?.users],
          ["公寓", summary?.apartments],
          ["房间", summary?.rooms],
          ["生效租约", summary?.activeLeases],
          ["待处理账单", summary?.unpaidBills]
        ].map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value ?? "-"}</strong>
          </div>
        ))}
      </div>
      <div className="content-band" style={{ marginTop: 14 }}>
        <Table
          rowKey="id"
          dataSource={organizations}
          columns={[
            { title: "组织", dataIndex: "name" },
            { title: "编码", dataIndex: "code" },
            { title: "公寓数", render: (_, row) => row._count?.apartments },
            { title: "成员数", render: (_, row) => row._count?.members },
            { title: "账单数", render: (_, row) => row._count?.bills },
            { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "ACTIVE" ? "green" : "orange"}>{value}</Tag> }
          ]}
        />
      </div>
    </main>
  );
}
