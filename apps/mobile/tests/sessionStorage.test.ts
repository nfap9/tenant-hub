import assert from "node:assert/strict";
import { clearMobileSession, readMobileSession, writeMobileSession } from "../src/services/session";
import type { MobileSession } from "../src/types";

const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;

const setLocalStorage = (storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined) => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage
  });
};

const session: MobileSession = {
  token: "token",
  user: { id: "u1", phone: "13800000000", username: "测试用户", isPlatformAdmin: false }
};

try {
  setLocalStorage({
    getItem: () => {
      throw new Error("storage unavailable");
    },
    setItem: () => undefined,
    removeItem: () => undefined
  });
  assert.equal(readMobileSession(), undefined, "storage read failures should not crash app startup");

  setLocalStorage({
    getItem: () => "{bad json",
    setItem: () => undefined,
    removeItem: () => undefined
  });
  assert.equal(readMobileSession(), undefined, "invalid persisted session should be ignored");

  setLocalStorage({
    getItem: () => null,
    setItem: () => {
      throw new Error("write unavailable");
    },
    removeItem: () => {
      throw new Error("remove unavailable");
    }
  });
  assert.doesNotThrow(() => writeMobileSession(session), "storage write failures should not crash sign in");
  assert.doesNotThrow(() => clearMobileSession(), "storage clear failures should not crash sign out");
} finally {
  setLocalStorage(originalLocalStorage);
}
