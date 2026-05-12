import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearMobileSession, mobileApi, readMobileSession, writeMobileSession } from '../services';
import type { Membership, MobileSession, OrgMember, OrgRole } from '../types';

export function useAppSession() {
  const [session, setSession] = useState<MobileSession | undefined>(() => readMobileSession());
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [notice, setNotice] = useState('');

  const token = session?.token;
  const currentMembership = useMemo(
    () => memberships.find(item => item.organization.id === currentOrgId),
    [currentOrgId, memberships],
  );

  const loadMe = useCallback(
    async (nextToken = token) => {
      if (!nextToken) return;
      const me = await mobileApi<{ user: MobileSession['user']; memberships: Membership[] }>(
        '/auth/me',
        nextToken,
      );
      setMemberships(me.memberships);
      setCurrentOrgId(old =>
        old && me.memberships.some(item => item.organization.id === old)
          ? old
          : me.memberships[0]?.organization.id,
      );
    },
    [token],
  );

  const loadOrgData = useCallback(
    async (organizationId = currentOrgId) => {
      if (!token || !organizationId) {
        setMembers([]);
        setRoles([]);
        return;
      }
      const [nextMembers, nextRoles] = await Promise.all([
        mobileApi<OrgMember[]>(`/organizations/${organizationId}/members`, token, {
          headers: { 'x-organization-id': organizationId },
        }),
        mobileApi<OrgRole[]>(`/organizations/${organizationId}/roles`, token, {
          headers: { 'x-organization-id': organizationId },
        }),
      ]);
      setMembers(nextMembers);
      setRoles(nextRoles);
    },
    [currentOrgId, token],
  );

  const signIn = useCallback(
    (nextSession: MobileSession) => {
      writeMobileSession(nextSession);
      setSession(nextSession);
      loadMe(nextSession.token).catch(error => setNotice(error.message));
    },
    [loadMe],
  );

  const signOut = useCallback(() => {
    clearMobileSession();
    setSession(undefined);
    setMemberships([]);
    setCurrentOrgId(undefined);
    setMembers([]);
    setRoles([]);
  }, []);

  const reload = useCallback(async () => {
    await loadMe();
    await loadOrgData();
  }, [loadMe, loadOrgData]);

  useEffect(() => {
    if (session?.token) {
      loadMe(session.token).catch(error => setNotice(error.message));
    }
  }, []);

  useEffect(() => {
    loadOrgData().catch(error => setNotice(error.message));
  }, [loadOrgData]);

  return {
    session,
    memberships,
    currentMembership,
    currentOrgId,
    setCurrentOrgId,
    members,
    roles,
    notice,
    setNotice,
    signIn,
    signOut,
    reload,
  };
}
