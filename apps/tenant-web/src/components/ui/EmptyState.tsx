import { Button } from "antd";
import { InboxOutlined } from "@ant-design/icons";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({
  title = "暂无数据",
  description = "当前没有相关记录",
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "var(--th-radius-xl)",
          background: "rgba(15, 118, 110, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <InboxOutlined style={{ fontSize: 32, color: "var(--th-primary-light)" }} />
      </div>
      <div
        style={{
          fontFamily: "var(--th-font-heading)",
          fontWeight: 600,
          fontSize: 18,
          color: "var(--th-foreground)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ color: "var(--th-foreground-muted)", fontSize: 14, maxWidth: 320, marginBottom: action ? 20 : 0 }}>
        {description}
      </div>
      {action && (
        <Button type="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
