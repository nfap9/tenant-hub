export interface SmsConfig {
  enabled: boolean;
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyParams?: Record<string, string>;
}

export interface SendSmsOptions {
  phoneNumber: string;
  code: string;
  expireMinutes: number;
  config: SmsConfig;
}

function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

function replaceRecordVars(
  record: Record<string, string> | undefined,
  vars: Record<string, string>
): Record<string, string> {
  if (!record) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    result[replaceVars(key, vars)] = replaceVars(value, vars);
  }
  return result;
}

export async function sendSms(options: SendSmsOptions): Promise<void> {
  const { phoneNumber, code, expireMinutes, config } = options;

  if (!config.url) {
    throw new Error('短信服务 URL 未配置');
  }

  const vars = { code, phoneNumber, expireMinutes: String(expireMinutes) };

  let url = replaceVars(config.url, vars);
  const headers = replaceRecordVars(config.headers, vars);
  const queryParams = replaceRecordVars(config.queryParams, vars);
  const bodyParams = replaceRecordVars(config.bodyParams, vars);

  const query = new URLSearchParams(queryParams).toString();
  if (query) {
    url += (url.includes('?') ? '&' : '?') + query;
  }

  let body: string | undefined;
  if (config.method !== 'GET' && Object.keys(bodyParams).length > 0) {
    body = JSON.stringify(bodyParams);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(url, {
    method: config.method,
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`短信发送失败: ${res.status} ${text}`);
  }
}
