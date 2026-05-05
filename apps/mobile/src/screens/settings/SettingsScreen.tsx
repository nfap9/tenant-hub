import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
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
    <>
      <TouchableOpacity style={styles.settingItem} onPress={() => setSubPage("leases")}>
        <Text style={styles.settingItemText}>所有租约</Text>
        <Text style={styles.link}>进入</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => setSubPage("team")}>
        <Text style={styles.settingItemText}>团队管理</Text>
        <Text style={styles.link}>进入</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => setSubPage("account")}>
        <Text style={styles.settingItemText}>账号设置</Text>
        <Text style={styles.link}>进入</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => setSubPage("plan")}>
        <Text style={styles.settingItemText}>付费计划</Text>
        <Text style={styles.link}>进入</Text>
      </TouchableOpacity>
    </>
  );
}
