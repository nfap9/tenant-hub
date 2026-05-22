import { describe, it, expect, vi } from 'vitest';
import { PERMISSIONS, ensureSystemRoles } from '../../src/services/roles.js';

describe('roles', () => {
  it('should define all required permissions', () => {
    expect(PERMISSIONS.APARTMENT_VIEW).toBe('apartment:view');
    expect(PERMISSIONS.APARTMENT_MANAGE).toBe('apartment:manage');
    expect(PERMISSIONS.ROOM_VIEW).toBe('room:view');
    expect(PERMISSIONS.ROOM_MANAGE).toBe('room:manage');
    expect(PERMISSIONS.LEASE_VIEW).toBe('lease:view');
    expect(PERMISSIONS.LEASE_MANAGE).toBe('lease:manage');
    expect(PERMISSIONS.BILL_VIEW).toBe('bill:view');
    expect(PERMISSIONS.BILL_MANAGE).toBe('bill:manage');
    expect(PERMISSIONS.ORG_MANAGE).toBe('org:manage');
    expect(PERMISSIONS.MEMBER_MANAGE).toBe('member:manage');
  });

  it('should upsert owner role with all permissions', async () => {
    const mockUpsert = vi.fn();
    await ensureSystemRoles({ role: { upsert: mockUpsert } } as never);

    const ownerCall = mockUpsert.mock.calls.find(
      (call) => call[0].where.code === 'owner'
    );
    expect(ownerCall).toBeDefined();
    expect(ownerCall[0].create).toMatchObject({
      code: 'owner',
      name: '所有者',
      description: '组织所有权限',
      permissions: ['*'],
      system: true,
    });
  });

  it('should upsert manager role with limited permissions', async () => {
    const mockUpsert = vi.fn();
    await ensureSystemRoles({ role: { upsert: mockUpsert } } as never);

    const managerCall = mockUpsert.mock.calls.find(
      (call) => call[0].where.code === 'manager'
    );
    expect(managerCall).toBeDefined();
    expect(managerCall[0].create.permissions).toEqual([
      PERMISSIONS.APARTMENT_VIEW,
      PERMISSIONS.APARTMENT_MANAGE,
      PERMISSIONS.ROOM_VIEW,
      PERMISSIONS.ROOM_MANAGE,
      PERMISSIONS.LEASE_VIEW,
      PERMISSIONS.LEASE_MANAGE,
      PERMISSIONS.BILL_VIEW,
      PERMISSIONS.BILL_MANAGE,
    ]);
  });

  it('should upsert readonly role with view-only permissions', async () => {
    const mockUpsert = vi.fn();
    await ensureSystemRoles({ role: { upsert: mockUpsert } } as never);

    const readonlyCall = mockUpsert.mock.calls.find(
      (call) => call[0].where.code === 'readonly'
    );
    expect(readonlyCall).toBeDefined();
    expect(readonlyCall[0].create.permissions).toEqual([
      PERMISSIONS.APARTMENT_VIEW,
      PERMISSIONS.ROOM_VIEW,
      PERMISSIONS.LEASE_VIEW,
      PERMISSIONS.BILL_VIEW,
    ]);
  });
});
