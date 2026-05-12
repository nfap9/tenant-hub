import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useAppSession } from "../../src/app/useAppSession";

const mockMobileApi = jest.fn();
const mockReadSession = jest.fn();
const mockWriteSession = jest.fn();
const mockClearSession = jest.fn();

jest.mock("../../src/services", () => ({
  mobileApi: (...args: unknown[]) => mockMobileApi(...args),
  readMobileSession: () => mockReadSession(),
  writeMobileSession: (s: unknown) => mockWriteSession(s),
  clearMobileSession: () => mockClearSession()
}));

describe("useAppSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadSession.mockReturnValue(undefined);
  });

  it("should start with undefined session", () => {
    const { result } = renderHook(() => useAppSession());
    expect(result.current.session).toBeUndefined();
    expect(result.current.token).toBeUndefined();
  });

  it("should sign in and load memberships", async () => {
    const session = { token: "token-1", user: { id: "u1", phone: "13800000000", username: "测试用户", isPlatformAdmin: false } };
    mockMobileApi.mockResolvedValue({
      user: session.user,
      memberships: [{ organization: { id: "org-1", name: "组织1" }, role: { code: "owner" } }]
    });

    const { result } = renderHook(() => useAppSession());

    act(() => {
      result.current.signIn(session);
    });

    await waitFor(() => {
      expect(result.current.session).toEqual(session);
      expect(result.current.memberships.length).toBe(1);
      expect(result.current.currentOrgId).toBe("org-1");
    });
  });

  it("should sign out and clear state", () => {
    const { result } = renderHook(() => useAppSession());

    act(() => {
      result.current.signOut();
    });

    expect(result.current.session).toBeUndefined();
    expect(result.current.memberships).toEqual([]);
    expect(result.current.currentOrgId).toBeUndefined();
    expect(mockClearSession).toHaveBeenCalled();
  });

  it("should load organization data when orgId changes", async () => {
    const session = { token: "token-1", user: { id: "u1", phone: "13800000000", username: "测试用户", isPlatformAdmin: false } };
    mockMobileApi
      .mockResolvedValueOnce({
        user: session.user,
        memberships: [{ organization: { id: "org-1", name: "组织1" }, role: { code: "owner" } }]
      })
      .mockResolvedValueOnce([{ id: "m1", userId: "u1", status: "ACTIVE" }])
      .mockResolvedValueOnce([{ id: "r1", code: "owner", name: "所有者" }]);

    const { result } = renderHook(() => useAppSession());

    act(() => {
      result.current.signIn(session);
    });

    await waitFor(() => {
      expect(result.current.members).toBeDefined();
      expect(result.current.roles).toBeDefined();
    });
  });

  it("should select current membership based on orgId", async () => {
    const session = { token: "token-1", user: { id: "u1", phone: "13800000000", username: "测试用户", isPlatformAdmin: false } };
    mockMobileApi.mockResolvedValue({
      user: session.user,
      memberships: [
        { organization: { id: "org-1", name: "组织1" }, role: { code: "owner" } },
        { organization: { id: "org-2", name: "组织2" }, role: { code: "manager" } }
      ]
    });

    const { result } = renderHook(() => useAppSession());

    act(() => {
      result.current.signIn(session);
    });

    await waitFor(() => {
      expect(result.current.currentMembership?.organization.id).toBe("org-1");
    });

    act(() => {
      result.current.setCurrentOrgId("org-2");
    });

    expect(result.current.currentMembership?.organization.id).toBe("org-2");
  });
});
