import { execFileSync } from "node:child_process";

const baseUrl = process.env.ACCEPTANCE_API_URL ?? "http://localhost:4000/api";
const password = "Passw0rd123";

const uniquePhone = () => `139${String(Date.now()).slice(-8)}`;
const date = (value) => `${value}T00:00:00.000Z`;

const readJson = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const request = async (path, { token, organizationId, expected = 200, ...options } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { "x-organization-id": organizationId } : {}),
      ...options.headers
    }
  });
  const payload = await readJson(response);
  if (response.status !== expected) {
    throw new Error(`${options.method ?? "GET"} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload.data ?? payload;
};

const body = (value) => JSON.stringify(value);

const readOtpFromDockerLogs = (phone, purpose) => {
  const logs = execFileSync("docker", ["logs", "tenant-hub-api", "--since", "3m"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const pattern = new RegExp(`${phone} ${purpose} 验证码：([0-9]{6})`, "g");
  const matches = [...logs.matchAll(pattern)];
  const code = matches.at(-1)?.[1];
  if (!code) throw new Error(`未能从 tenant-hub-api Docker 日志读取 ${phone} 的 ${purpose} 验证码`);
  return code;
};

const registerAcceptanceUser = async () => {
  const phone = uniquePhone();
  await request("/auth/otp", { method: "POST", body: body({ phone, purpose: "REGISTER" }) });
  const code = readOtpFromDockerLogs(phone, "REGISTER");
  return request("/auth/register", {
    method: "POST",
    body: body({ phone, username: "API验收账号", password, confirmPassword: password, code })
  });
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const main = async () => {
  const session = await registerAcceptanceUser();
  const token = session.token;

  const organization = await request("/organizations", {
    token,
    method: "POST",
    body: body({ name: `API验收组织-${Date.now()}`, description: "自动化功能验收" })
  });
  const organizationId = organization.id;

  const plans = await request("/organizations/plans", { token });
  assert(plans.length > 0, "验收环境需要至少一个可用套餐");
  await request(`/organizations/${organizationId}/subscriptions`, {
    token,
    organizationId,
    method: "POST",
    body: body({ planId: plans[0].id })
  });

  const apartment = await request("/apartments", {
    token,
    organizationId,
    method: "POST",
    body: body({
      name: "API云杉公寓",
      location: "广东省广州市番禺区",
      floors: 2,
      landArea: 100,
      totalArea: 1000,
      landlordName: "张三",
      landlordPhone: "13700010001",
      contractStart: date("2026-05-06"),
      contractEnd: date("2027-05-06"),
      rentAmount: 1000,
      waterUnitPrice: 4,
      powerUnitPrice: 0.8
    })
  });

  const rooms = ["201", "202", "203"].map((roomNo) => ({ roomNo, layout: "单间", area: 20, facilities: ["床", "空调"] }));
  const firstBatch = await request(`/apartments/${apartment.id}/rooms/batch`, {
    token,
    organizationId,
    method: "POST",
    body: body({ rooms })
  });
  assert(firstBatch.count === 3, "首次批量创建房间应创建 3 间");

  const duplicateBatch = await request(`/apartments/${apartment.id}/rooms/batch`, {
    token,
    organizationId,
    method: "POST",
    body: body({ rooms })
  });
  assert(duplicateBatch.count === 0, "重复批量创建房间应跳过已存在房间");

  const roomList = await request("/apartments/rooms", { token, organizationId });
  const room201 = roomList.find((room) => room.roomNo === "201");
  assert(room201, "应能找到 201 房间");

  const lease = await request("/leases", {
    token,
    organizationId,
    method: "POST",
    body: body({
      roomId: room201.id,
      tenantName: "李四",
      tenantPhone: "13900002001",
      startDate: date("2026-05-06"),
      endDate: date("2027-05-06"),
      graceDays: 0,
      cycle: "MONTHLY",
      rentAmount: 1200,
      depositAmount: 1200,
      waterUnitPrice: 4,
      powerUnitPrice: 0.8,
      autoRenew: true,
      fees: []
    })
  });
  assert(lease.status === "ACTIVE", "签约后租约应为 ACTIVE");

  const monthlyBills = await request("/bills/monthly", { token, organizationId });
  const firstMonthlyBill = monthlyBills.find((item) => item.leaseId === lease.id);
  assert(firstMonthlyBill?.totalAmount === "2400", "首期月账单应包含房租和押金");

  await request(`/bills/monthly/${firstMonthlyBill.id}/payments`, {
    token,
    organizationId,
    expected: 400,
    method: "POST",
    body: body({ amount: 2401, method: "现金" })
  });

  await request("/bills/generate", {
    token,
    organizationId,
    method: "POST",
    body: body({ leaseId: lease.id, today: date("2026-06-06") })
  });
  const postpaidBills = await request("/bills?status=FAILED", { token, organizationId });
  const utilityBill = postpaidBills.find((item) => item.leaseId === lease.id && item.mode === "POSTPAID");
  assert(utilityBill, "缺少读数时应生成待处理的后付费水电账单");

  const exportCsv = await fetch(`${baseUrl}/bills/utility/pending-export`, {
    headers: { authorization: `Bearer ${token}`, "x-organization-id": organizationId }
  }).then((response) => response.text());
  assert(exportCsv.includes("billId"), "水电导出应包含 billId 列");
  assert(exportCsv.includes(utilityBill.id), "水电导出应包含待处理账单 id");

  await request("/bills/utility/import", {
    token,
    organizationId,
    method: "POST",
    body: body({ csv: `billId,房间号,租客,上月水表,本月水表,上月电表,本月电表\n${utilityBill.id},201,"李四,验收",1,3,10,15\n` })
  });
  const unpaidBills = await request("/bills?status=UNPAID", { token, organizationId });
  const updatedUtilityBill = unpaidBills.find((item) => item.id === utilityBill.id);
  assert(updatedUtilityBill?.totalAmount === "12", "水电导入后应按用量更新后付费账单");

  const settlement = await request(`/leases/${lease.id}/terminate`, {
    token,
    organizationId,
    method: "POST",
    body: body({
      type: "NEGOTIATED",
      terminatedAt: date("2026-06-10"),
      depositDeductionAmount: 100,
      depositDeductionReason: "保洁",
      rentAdjustmentAmount: -50,
      currentWater: 3,
      currentPower: 10,
      otherFeeAmount: 30,
      otherFeeReason: "钥匙"
    })
  });
  assert(settlement.netAmount === "-1000", "退租结算应计算最终应退 1000");

  const roomsAfterSettlement = await request("/apartments/rooms", { token, organizationId });
  assert(roomsAfterSettlement.find((room) => room.id === room201.id)?.status === "VACANT", "退租后房间应释放为空闲");

  console.info("acceptance api passed");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
