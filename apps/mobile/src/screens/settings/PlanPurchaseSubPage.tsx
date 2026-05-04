import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Membership, Plan, SubscriptionOverview } from "../../types";

type PlanPurchaseSubPageProps = {
  token: string;
  currentMembership?: Membership;
  currentOrgId?: string;
  setNotice: (value: string) => void;
  reload: () => Promise<void>;
  onBack: () => void;
};

export default function PlanPurchaseSubPage({
  token,
  currentMembership,
  currentOrgId,
  setNotice,
  reload,
  onBack
}: PlanPurchaseSubPageProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [overview, setOverview] = useState<SubscriptionOverview>();
  const [buyingPlanId, setBuyingPlanId] = useState<string>();
  const canManageOrg = currentMembership?.role.permissions.includes("*") || currentMembership?.role.permissions.includes("org:manage");

  const loadPlans = async () => {
    try {
      const nextPlans = await mobileApi<Plan[]>("/organizations/plans", token);
      setPlans(nextPlans);
      if (currentOrgId) {
        const nextOverview = await mobileApi<SubscriptionOverview>(`/organizations/${currentOrgId}/subscription`, token, {
          headers: { "x-organization-id": currentOrgId }
        });
        setOverview(nextOverview);
      } else {
        setOverview(undefined);
      }
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [currentOrgId]);

  const buy = async (planId: string) => {
    if (!currentOrgId) {
      setNotice("请先创建或加入组织");
      return;
    }
    setBuyingPlanId(planId);
    try {
      await mobileApi(`/organizations/${currentOrgId}/subscriptions`, token, {
        method: "POST",
        headers: { "x-organization-id": currentOrgId },
        body: JSON.stringify({ planId })
      });
      setNotice("套餐购买成功");
      await loadPlans();
      await reload();
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBuyingPlanId(undefined);
    }
  };

  const activePlanId = overview?.subscription?.planId;
  const endsAt = overview?.subscription?.endsAt ? new Date(overview.subscription.endsAt).toLocaleDateString() : "长期有效";

  return (
    <>
      <View style={styles.subPageHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>返回</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>当前套餐</Text>
        {overview?.subscription ? (
          <>
            <Text style={styles.cardTitle}>{overview.subscription.plan.name}</Text>
            <Text style={styles.muted}>有效期至 {endsAt}</Text>
            <View style={styles.quotaRow}>
              <Text style={styles.quotaText}>公寓 {overview.usage.apartments}/{overview.subscription.plan.apartmentLimit + overview.extraQuota.apartmentQuota}</Text>
              <Text style={styles.quotaText}>成员 {overview.usage.members}/{overview.subscription.plan.memberLimit + overview.extraQuota.memberQuota}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.muted}>尚未购买套餐</Text>
        )}
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>购买套餐</Text>
        {!currentOrgId ? <Text style={styles.muted}>请先创建或加入组织后再购买套餐。</Text> : null}
        {plans.length === 0 ? <Text style={styles.muted}>暂无可购买套餐，请联系运营端启用套餐。</Text> : null}
        {plans.map((plan) => {
          const active = activePlanId === plan.id;
          const buying = buyingPlanId === plan.id;
          return (
            <View style={[styles.planCard, active && styles.planCardActive]} key={plan.id}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.cardTitle}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{formatPlanPrice(plan.price)}</Text>
                </View>
                {active ? <Text style={styles.roleBadge}>当前</Text> : null}
              </View>
              <View style={styles.quotaRow}>
                <Text style={styles.quotaText}>公寓 {plan.apartmentLimit}</Text>
                <Text style={styles.quotaText}>房间 {plan.roomLimit}</Text>
                <Text style={styles.quotaText}>成员 {plan.memberLimit}</Text>
              </View>
              <TouchableOpacity
                style={[styles.secondaryButton, (!canManageOrg || active || buying) && styles.buttonDisabled]}
                disabled={!canManageOrg || active || buying}
                onPress={() => buy(plan.id)}
              >
                <Text style={styles.secondaryButtonText}>{active ? "已购买" : buying ? "购买中" : "购买此套餐"}</Text>
              </TouchableOpacity>
              {!canManageOrg ? <Text style={styles.muted}>需要组织管理权限才能购买套餐</Text> : null}
            </View>
          );
        })}
      </View>
    </>
  );
}

const formatPlanPrice = (price: string | number) => {
  const value = Number(price);
  if (Number.isNaN(value) || value <= 0) return "免费";
  return `${value.toFixed(2).replace(/\.00$/, "")} 元/年`;
};
