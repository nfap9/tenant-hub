import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const appUrl = process.env.ACCEPTANCE_APP_URL ?? "http://localhost:19006";
const apiUrl = process.env.ACCEPTANCE_API_URL ?? "http://localhost:4000/api";
const playwrightCli = process.env.PLAYWRIGHT_CLI ?? `${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`;
const password = "Passw0rd123";

const body = (value) => JSON.stringify(value);
const phone = () => `138${String(Date.now()).slice(-8)}`;

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed: ${JSON.stringify(payload)}`);
  return payload.data;
};

const otpFromDockerLogs = (userPhone) => {
  const logs = execFileSync("docker", ["logs", "tenant-hub-api", "--since", "3m"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const matches = [...logs.matchAll(new RegExp(`${userPhone} REGISTER 验证码：([0-9]{6})`, "g"))];
  const code = matches.at(-1)?.[1];
  if (!code) throw new Error(`未能从 tenant-hub-api Docker 日志读取 ${userPhone} 的验证码`);
  return code;
};

const runPw = (...args) => execFileSync(playwrightCli, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const main = async () => {
  if (!existsSync(playwrightCli)) {
    throw new Error(`未找到 Playwright CLI：${playwrightCli}。可通过 PLAYWRIGHT_CLI 指定脚本路径`);
  }

  const userPhone = phone();
  await request("/auth/otp", { method: "POST", body: body({ phone: userPhone, purpose: "REGISTER" }) });
  const code = otpFromDockerLogs(userPhone);
  const session = await request("/auth/register", {
    method: "POST",
    body: body({ phone: userPhone, username: "UI验收账号", password, confirmPassword: password, code })
  });

  let opened = false;
  try {
    runPw("open", appUrl);
    opened = true;
    runPw("localstorage-set", "tenantHubMobileSession", JSON.stringify({ token: session.token, user: session.user }));
    runPw("reload");
    const snapshot = runPw("snapshot");

    if (!snapshot.includes("创建或加入组织")) {
      throw new Error("UI 验收失败：无组织账号首页未展示创建或加入组织入口");
    }
  } finally {
    if (opened) {
      try {
        runPw("close");
      } catch {
        // Browser cleanup should not hide the original acceptance failure.
      }
    }
  }

  console.info("acceptance ui passed");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
