import { Alert, Table } from "antd";
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

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary>();
  const [bills, setBills] = useState<any[]>([]);

  useEffect(() => {
    api<Summary>("/admin/summary").then(setSummary).catch(() => undefined);
    api<any[]>("/bills?status=BILLING").then(setBills).catch(() => undefined);
  }, []);

  return (
    <main className="page">
      <div className="page-title">
        <h1>经营总览</h1>
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
        {bills.length > 0 ? <Alert type="warning" showIcon message={`有 ${bills.length} 条水电出账中账单待录入读数`} style={{ marginBottom: 12 }} /> : null}
        <Table
          size="small"
          rowKey="id"
          dataSource={bills}
          columns={[
            { title: "房间", render: (_, row) => row.lease?.room?.roomNo },
            { title: "租客", render: (_, row) => row.lease?.tenantName },
            { title: "账期", render: (_, row) => `${row.periodStart.slice(0, 10)} 至 ${row.periodEnd.slice(0, 10)}` },
            { title: "交租日", dataIndex: "dueDate", render: (value) => value?.slice(0, 10) }
          ]}
        />
      </div>
    </main>
  );
}
