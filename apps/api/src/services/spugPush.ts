const SPUG_PUSH_URL = "https://push.spug.cc/send";

export interface SpugPushOptions {
  templateCode?: string;
  name?: string;
  bodyTemplate?: Record<string, string>;
}

export async function sendSpugSms(
  targets: string | string[],
  code: string,
  options?: SpugPushOptions
): Promise<void> {
  const templateCode = options?.templateCode;
  if (!templateCode) {
    throw new Error("templateCode is not provided");
  }

  const phoneList = Array.isArray(targets) ? targets.join(",") : targets;
  const name = options?.name ?? "TenantHub";

  let bodyObj: Record<string, string>;
  if (options?.bodyTemplate) {
    bodyObj = {};
    for (const [key, value] of Object.entries(options.bodyTemplate)) {
      bodyObj[key] = value
        .replace(/\{\{code\}\}/g, code)
        .replace(/\{\{targets\}\}/g, phoneList)
        .replace(/\{\{name\}\}/g, name);
    }
  } else {
    bodyObj = {
      name,
      code,
      targets: phoneList
    };
  }

  const res = await fetch(`${SPUG_PUSH_URL}/${templateCode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spug push failed: ${res.status} ${text}`);
  }
}
