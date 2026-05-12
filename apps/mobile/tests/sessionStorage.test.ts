import { clearMobileSession, readMobileSession, writeMobileSession } from "../src/services/session";
import type { MobileSession } from "../src/types";

describe("session storage", () => {
  const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;

  const setLocalStorage = (storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined) => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage
    });
  };

  afterEach(() => {
    setLocalStorage(originalLocalStorage);
  });

  const session: MobileSession = {
    token: "token",
    user: { id: "u1", phone: "13800000000", username: "测试用户", isPlatformAdmin: false }
  };

  it("should not crash app startup on storage read failures", () => {
    setLocalStorage({
      getItem: () => { throw new Error("storage unavailable"); },
      setItem: () => undefined,
      removeItem: () => undefined
    });
    expect(readMobileSession()).toBeUndefined();
  });

  it("should ignore invalid persisted session", () => {
    setLocalStorage({
      getItem: () => "{bad json",
      setItem: () => undefined,
      removeItem: () => undefined
    });
    expect(readMobileSession()).toBeUndefined();
  });

  it("should not crash sign in on storage write failures", () => {
    setLocalStorage({
      getItem: () => null,
      setItem: () => { throw new Error("write unavailable"); },
      removeItem: () => { throw new Error("remove unavailable"); }
    });
    expect(() => writeMobileSession(session)).not.toThrow();
    expect(() => clearMobileSession()).not.toThrow();
  });
});
