export interface SmsConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

export interface SendSmsOptions {
  targets: string | string[];
  code: string;
  name?: string;
  number?: number;
  config: SmsConfig;
}

function replaceVars(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{code\}\}/g, vars.code)
    .replace(/\{\{targets\}\}/g, vars.targets)
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{number\}\}/g, vars.number);
}

export async function sendSms(options: SendSmsOptions): Promise<void> {
  const { targets, code, name = 'TenantHub', number = 5, config } = options;

  if (!config.url) {
    throw new Error('短信服务 URL 未配置');
  }

  const phoneList = Array.isArray(targets) ? targets.join(',') : targets;
  const vars = { code, targets: phoneList, name, number: String(number) };

  let url = replaceVars(config.url, vars);

  const headers: Record<string, string> = {};
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      headers[key] = replaceVars(value, vars);
    }
  }

  const params: Record<string, string> = {};
  if (config.params) {
    for (const [key, value] of Object.entries(config.params)) {
      params[key] = replaceVars(value, vars);
    }
  }

  let body: string | undefined;
  if (config.method === 'GET') {
    const query = new URLSearchParams(params).toString();
    if (query) {
      url += (url.includes('?') ? '&' : '?') + query;
    }
  } else {
    body = JSON.stringify(params);
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
