import { Card } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";

interface StatCardProps {
  title: string;
  value: string | number;
  prefix?: React.ReactNode;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  color?: "primary" | "success" | "warning" | "danger" | "accent";
  icon?: React.ReactNode;
  onClick?: () => void;
}

const colorMap = {
  primary: { bg: "rgba(15, 118, 110, 0.08)", icon: "#0F766E", text: "#0F766E" },
  success: { bg: "rgba(34, 197, 94, 0.08)", icon: "#22C55E", text: "#22C55E" },
  warning: { bg: "rgba(234, 88, 12, 0.08)", icon: "#EA580C", text: "#EA580C" },
  danger: { bg: "rgba(220, 38, 38, 0.08)", icon: "#DC2626", text: "#DC2626" },
  accent: { bg: "rgba(3, 105, 161, 0.08)", icon: "#0369A1", text: "#0369A1" },
};

export default function StatCard({
  title,
  value,
  prefix,
  suffix,
  trend,
  trendLabel,
  color = "primary",
  icon,
  onClick,
}: StatCardProps) {
  const c = colorMap[color];
  const trendUp = trend !== undefined && trend >= 0;


  return (
    <Card
      style={{ cursor: onClick ? "pointer" : "default", borderRadius: "var(--th-radius-lg)" }}
      bodyStyle={{ padding: "var(--th-space-6)" }}
      onClick={onClick}
      hoverable={!!onClick}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: c.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: c.icon,
          }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: trendUp ? "#22C55E" : "#DC2626",
              background: trendUp ? "rgba(34, 197, 94, 0.08)" : "rgba(220, 38, 38, 0.08)",
              padding: "4px 10px",
              borderRadius: 20,
            }}
          >
            {trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--th-font-heading)",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--th-foreground)",
          lineHeight: 1.2,
          marginBottom: 4,
          display: "flex",
          alignItems: "baseline",
          gap: 4,
        }}
      >
        {prefix && <span style={{ fontSize: 18, color: "var(--th-foreground-subtle)" }}>{prefix}</span>}
        {value}
        {suffix && <span style={{ fontSize: 14, color: "var(--th-foreground-subtle)", fontWeight: 400 }}>{suffix}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--th-foreground-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </span>
        {trendLabel && (
          <span style={{ fontSize: 12, color: "var(--th-foreground-subtle)" }}>{trendLabel}</span>
        )}
      </div>
    </Card>
  );
}
