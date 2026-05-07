import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Badge, Button, Card, EmptyState, Input } from "../../components/ui";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Lease, LeaseStatus } from "../../types";

type LeaseFilter = "ALL" | "ACTIVE" | "AUTO_RENEWING" | "EXPIRING" | "TERMINATED";

type Props = {
  token: string;
  currentOrgId?: string;
  setNotice: (value: string) => void;
  onBack: () => void;
};

const filters: Array<{ key: LeaseFilter; label: string }> = [
  { key: "ALL", label: "全部" },
  { key: "ACTIVE", label: "有效" },
  { key: "AUTO_RENEWING", label: "自动续约" },
  { key: "EXPIRING", label: "近到期" },
  { key: "TERMINATED", label: "已终止" }
];

const statusLabels: Record<LeaseStatus, string> = {
  ACTIVE: "有效",
  TERMINATED: "已终止",
  EXPIRED: "已到期"
};

const apiOptions = (organizationId: string): RequestInit => ({
  headers: { "x-organization-id": organizationId }
});

const money = (value?: string | number) => Number(value ?? 0).toFixed(2);
const dateOnly = (value: string) => value.slice(0, 10);
const daysUntil = (value: string) => {
  const end = new Date(`${dateOnly(value)}T00:00:00.000Z`).getTime();
  const now = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.ceil((end - now) / 86400000);
};

export default function LeasesSubPage({ token, currentOrgId, setNotice, onBack }: Props) {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [filter, setFilter] = useState<LeaseFilter>("ALL");
  const [query, setQuery] = useState("");

  const loadLeases = useCallback(async () => {
    if (!currentOrgId) return;
    const data = await mobileApi<Lease[]>("/leases", token, apiOptions(currentOrgId));
    setLeases(data);
  }, [currentOrgId, token]);

  useEffect(() => {
    loadLeases().catch((error) => setNotice(error.message));
  }, [loadLeases, setNotice]);

  const visibleLeases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leases.filter((lease) => {
      const expiringSoon = lease.status === "ACTIVE" && !lease.isAutoRenewalPeriod && daysUntil(lease.endDate) >= 0 && daysUntil(lease.endDate) <= 30;
      const matchesFilter =
        filter === "ALL" ||
        (filter === "ACTIVE" && lease.status === "ACTIVE") ||
        (filter === "AUTO_RENEWING" && Boolean(lease.isAutoRenewalPeriod)) ||
        (filter === "EXPIRING" && expiringSoon) ||
        (filter === "TERMINATED" && lease.status !== "ACTIVE");

      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        lease.tenantName,
        lease.tenantPhone,
        lease.room?.roomNo,
        lease.room?.apartment?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filter, leases, query]);

  const activeCount = leases.filter((lease) => lease.status === "ACTIVE").length;
  const autoRenewingCount = leases.filter((lease) => lease.isAutoRenewalPeriod).length;
  const expiringCount = leases.filter((lease) => lease.status === "ACTIVE" && !lease.isAutoRenewalPeriod && daysUntil(lease.endDate) >= 0 && daysUntil(lease.endDate) <= 30).length;

  return (
    <>
      <View style={styles.subPageHeader}>
        <Button variant="ghost" size="small" onPress={onBack} icon="arrow-back-outline">返回</Button>
        <Text style={styles.sectionTitle}>所有租约</Text>
      </View>

      {!currentOrgId ? (
        <Card>
          <EmptyState icon="🏢" title="尚未选择组织" subtitle="请先从右上角用户菜单中选择一个组织" />
        </Card>
      ) : (
        <>
          <View style={styles.statRow}>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>有效租约</Text>
              <Text style={styles.statValue}>{activeCount}</Text>
            </Card>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>自动续约</Text>
              <Text style={styles.statValue}>{autoRenewingCount}</Text>
            </Card>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>近到期</Text>
              <Text style={styles.statValue}>{expiringCount}</Text>
            </Card>
          </View>

          <Input placeholder="搜索租客、电话、房间号或公寓" value={query} onChangeText={setQuery} />

          <View style={[styles.filterBar, { flexWrap: "wrap" }]}>
            {filters.map((item) => (
              <Button
                key={item.key}
                variant={filter === item.key ? "primary" : "ghost"}
                size="small"
                onPress={() => setFilter(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </View>

          <View style={styles.roomGrid}>
            {visibleLeases.map((lease) => (
              <Card key={lease.id} variant="outline" padding="md" gap={10}>
                <View style={styles.roomHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{lease.room?.apartment?.name ?? "未关联公寓"} · {lease.room?.roomNo ?? "未关联房间"}</Text>
                    <Text style={styles.muted}>{lease.tenantName} · {lease.tenantPhone}</Text>
                  </View>
                  <Badge tone={lease.status === "ACTIVE" ? "warning" : "neutral"}>
                    {lease.isAutoRenewalPeriod ? "自动续约中" : statusLabels[lease.status]}
                  </Badge>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.muted}>租期</Text>
                  <Text style={styles.muted}>{dateOnly(lease.startDate)} 至 {dateOnly(lease.endDate)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.muted}>租金</Text>
                  <Text style={styles.cardStat}>¥{money(lease.rentAmount)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.muted}>交租</Text>
                  <Text style={styles.muted}>{lease.cycle === "MONTHLY" ? "月付" : lease.cycle === "QUARTERLY" ? "季付" : "年付"} · 宽限 {lease.graceDays ?? 0} 天</Text>
                </View>
              </Card>
            ))}
          </View>

          {visibleLeases.length === 0 ? <EmptyState icon="📄" title="暂无符合条件的租约" /> : null}
        </>
      )}
    </>
  );
}
