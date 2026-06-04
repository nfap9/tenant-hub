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

/**
 * 替换模板字符串中的变量占位符
 * @param template - 包含 {{key}} 占位符的模板字符串
 * @param vars - 变量映射表，key 为占位符名称，value 为替换值
 * @returns 替换变量后的字符串
 */
function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

/**
 * 对 Record 对象的键和值进行变量替换
 * @param record - 原始键值对对象，未定义时返回空对象
 * @param vars - 变量映射表
 * @returns 键和值均已替换变量的新 Record 对象
 */
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

/**
 * 根据配置发送短信
 * @param options - 发送短信的选项，包含手机号、验证码、过期时间和短信配置
 * @returns 无返回值，发送失败时抛出异常
 */
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
