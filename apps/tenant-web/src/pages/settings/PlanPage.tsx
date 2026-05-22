import { Card } from "antd";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export default function PlanPage() {
  return (
    <div className="page-content">
      <PageHeader back="/settings" breadcrumb={[{ label: "设置", path: "/settings" }, { label: "套餐订阅" }]} />
      <Card style={{ borderRadius: "var(--th-radius-lg)", boxShadow: "var(--th-shadow)" }}>
        <EmptyState title="暂无订阅信息" description="您当前没有活跃的套餐订阅" />
      </Card>
    </div>
  );
}
