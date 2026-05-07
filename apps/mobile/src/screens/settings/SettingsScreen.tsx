import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, PressableScale } from "../../components/ui";
import { styles } from "../../theme/styles";
import type { Membership, OrgMember, OrgRole } from "../../types";
import AccountSettingsSubPage from "./AccountSettingsSubPage";
import LeasesSubPage from "./LeasesSubPage";
import OrganizationSettingsSubPage from "./OrganizationSettingsSubPage";
import PlanPurchaseSubPage from "./PlanPurchaseSubPage";

type SettingsSubPage = "menu" | "leases" | "team" | "account" | "plan";

type SettingsScreenProps = {
  token: string;
  currentUserId: string;
  memberships: Membership[];
  currentMembership?: Membership;
  currentOrgId?: string;
  setCurrentOrgId: (value: string) => void;
  members: OrgMember[];
  roles: OrgRole[];
  orgName: string;
  setOrgName: (value: string) => void;
  setNotice: (value: string) => void;
  reload: () => Promise<void>;
};

const settingsItems: Array<{ key: SettingsSubPage; label: string; icon: string }> = [
  { key: "leases", label: "所有租约", icon: "📄" },
  { key: "team", label: "团队管理", icon: "👥" },
  { key: "account", label: "账号设置", icon: "🔐" },
  { key: "plan", label: "付费计划", icon: "💎" }
];

export default function SettingsScreen({
  token,
  currentUserId,
  memberships,
  currentMembership,
  currentOrgId,
  setCurrentOrgId,
  members,
  roles,
  orgName,
  setOrgName,
  setNotice,
  reload
}: SettingsScreenProps) {
  const [subPage, setSubPage] = useState<SettingsSubPage>("menu");
  const backToMenu = () => setSubPage("menu");

  if (subPage === "team") {
    return (
      <OrganizationSettingsSubPage
        token={token}
        currentUserId={currentUserId}
        memberships={memberships}
        currentMembership={currentMembership}
        currentOrgId={currentOrgId}
        setCurrentOrgId={setCurrentOrgId}
        members={members}
        roles={roles}
        orgName={orgName}
        setOrgName={setOrgName}
        setNotice={setNotice}
        reload={reload}
        onBack={backToMenu}
      />
    );
  }

  if (subPage === "leases") {
    return <LeasesSubPage token={token} currentOrgId={currentOrgId} setNotice={setNotice} onBack={backToMenu} />;
  }

  if (subPage === "account") {
    return <AccountSettingsSubPage token={token} setNotice={setNotice} onBack={backToMenu} />;
  }

  if (subPage === "plan") {
    return (
      <PlanPurchaseSubPage
        token={token}
        currentMembership={currentMembership}
        currentOrgId={currentOrgId}
        setNotice={setNotice}
        reload={reload}
        onBack={backToMenu}
      />
    );
  }

  return (
    <View style={{ gap: styles.content.gap }}>
      {settingsItems.map((item) => (
        <PressableScale key={item.key} onPress={() => setSubPage(item.key)}>
          <Card padding="md" gap={0}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                <Text style={styles.settingItemText}>{item.label}</Text>
              </View>
              <Text style={{ color: "#9a9488", fontSize: 16 }}>➤</Text>
            </View>
          </Card>
        </PressableScale>
      ))}
    </View>
  );
}
