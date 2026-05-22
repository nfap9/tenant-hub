import { useEffect, useState } from "react";
import { Card, Table, Tag, message } from "antd";
import { getAdminSummary, getAdminOrganizations } from "@/api/admin";

export default function OpsDashboardPage() {
  const [summary, setSummary] = useState<{ organizations: number; users: number; apartments: number; rooms: number; activeLeases: number; unpaidBills: number }>();
  const [organizations, setOrganizations] = useState<Array<{
    id: string; name: string; code: string; status: string;
    _count?: { apartments: number; members: number; bills: number };
  }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAdminSummary().then(setSummary).catch((e) => message.error(e.message)),
      getAdminOrganizations().then(setOrganizations).catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>运营总览</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          ["组织", summary?.organizations],
          ["用户", summary?.users],
          ["公寓", summary?.apartments],
          ["房间", summary?.rooms],
          ["生效租约", summary?.activeLeases],
          ["待处理账单", summary?.unpaidBills],
        ].map(([label, value]) => (
          <Card key={label} size="small">
            <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6 }}>{value ?? "-"}</div>
          </Card>
        ))}
      </div>
      <Card title="组织列表" loading={loading}>
        <Table
          rowKey="id"
          dataSource={organizations}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "组织", dataIndex: "name" },
            { title: "编码", dataIndex: "code" },
            { title: "公寓数", render: (_: unknown, row: typeof organizations[0]) => row._count?.apartments },
            { title: "成员数", render: (_: unknown, row: typeof organizations[0]) => row._count?.members },
            { title: "账单数", render: (_: unknown, row: typeof organizations[0]) => row._count?.bills },
            { title: "状态", dataIndex: "status", render: (value: string) => <Tag color={value === "ACTIVE" ? "green" : "orange"}>{value}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
