import { z } from 'zod';

export type FormFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'array'
  | 'object'
  | 'unknown';

export interface FormField {
  name: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  itemType?: FormFieldType;
  fields?: FormField[];
}

function toReadableLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getFieldLabel(key: string, schema: z.ZodTypeAny): string {
  let current: z.ZodTypeAny = schema;
  while (current) {
    const description = current.description;
    if (typeof description === 'string' && description.trim()) {
      return description.trim();
    }
    if (current instanceof z.ZodOptional) current = current.unwrap();
    else if (current instanceof z.ZodDefault) current = current.removeDefault();
    else if (current instanceof z.ZodNullable) current = current.unwrap();
    else if (current instanceof z.ZodEffects) current = current.innerType();
    else break;
  }
  return toReadableLabel(key);
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodEffects
  ) {
    if (current instanceof z.ZodOptional) current = current.unwrap();
    else if (current instanceof z.ZodDefault) current = current.removeDefault();
    else if (current instanceof z.ZodNullable) current = current.unwrap();
    else if (current instanceof z.ZodEffects) current = current.innerType();
  }
  return current;
}

function getDefaultValue(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }
  return undefined;
}

function isRequired(schema: z.ZodTypeAny): boolean {
  let current = schema;
  if (current instanceof z.ZodDefault) return false;
  if (current instanceof z.ZodOptional) return false;
  if (current instanceof z.ZodNullable) {
    current = current.unwrap();
    if (current instanceof z.ZodOptional) return false;
  }
  return true;
}

const ENUM_LABEL_MAP: Record<string, string> = {
  // 付款周期
  MONTHLY: '月付',
  QUARTERLY: '季付',
  YEARLY: '年付',
  // 房间状态
  VACANT: '空置',
  RESERVED: '已预留',
  OCCUPIED: '已出租',
  MAINTENANCE: '维修中',
  // 租约状态
  ACTIVE: '生效中',
  TERMINATED: '已退租',
  EXPIRED: '已到期',
  DRAFT: '草稿',
  // 收支/账单方向
  INCOME: '收入',
  EXPENSE: '支出',
  PREPAID: '预付费',
  POSTPAID: '后付费',
  DEPOSIT: '押金',
  // 表类型
  WATER: '水表',
  POWER: '电表',
  // 抄表来源
  MANUAL: '手工录入',
  IMPORT: '导入',
  // 抄表状态
  NORMAL: '正常',
  SUSPECTED: '可疑',
  CONFIRMED: '已确认',
  VOID: '作废',
  // 退租类型
  NEGOTIATED: '协商退租',
  BREACH: '违约退租',
  // 收退方向
  RECEIVE: '收款',
  REFUND: '退款',
  // 账单状态
  UNPAID: '未缴',
  PARTIAL_PAID: '部分缴纳',
  PAID: '已缴',
  REFUNDED: '已退款',
  FAILED: '失败',
  BILLING: '出账中',
  // 押金状态
  PARTIAL_REFUNDED: '部分退还',
  FULLY_REFUNDED: '全部退还',
  DEDUCTED: '已抵扣',
};

function labelForEnumValue(value: string): string {
  return ENUM_LABEL_MAP[value] ?? value;
}

function analyzeScalar(schema: z.ZodTypeAny): {
  type: FormFieldType;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
} {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodEnum) {
    const values = unwrapped._def.values as string[];
    return {
      type: 'select',
      options: values.map((v) => ({ label: labelForEnumValue(v), value: v })),
    };
  }

  if (unwrapped instanceof z.ZodNativeEnum) {
    const obj = unwrapped._def.values as Record<string, string | number>;
    return {
      type: 'select',
      options: Object.entries(obj)
        .filter(([key]) => Number.isNaN(Number(key)))
        .map(([_, value]) => ({
          label: labelForEnumValue(String(value)),
          value: String(value),
        })),
    };
  }

  if (unwrapped instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (unwrapped instanceof z.ZodDate) {
    return { type: 'date' };
  }

  if (unwrapped instanceof z.ZodNumber) {
    const inner = unwrapped as z.ZodNumber;
    const checks = inner._def.checks ?? [];
    const minCheck = checks.find((c) => c.kind === 'min') as
      | { value: number }
      | undefined;
    const maxCheck = checks.find((c) => c.kind === 'max') as
      | { value: number }
      | undefined;
    return {
      type: 'number',
      min: minCheck?.value,
      max: maxCheck?.value,
    };
  }

  if (unwrapped instanceof z.ZodString) {
    const checks = unwrapped._def.checks ?? [];
    const minCheck = checks.find((c) => c.kind === 'min') as
      | { value: number }
      | undefined;
    const maxCheck = checks.find((c) => c.kind === 'max') as
      | { value: number }
      | undefined;
    return {
      type: 'text',
      minLength: minCheck?.value,
      maxLength: maxCheck?.value,
    };
  }

  return { type: 'unknown' };
}

export function schemaToFormFields(schema: z.ZodTypeAny): FormField[] {
  const objectSchema = unwrapSchema(schema);
  if (!(objectSchema instanceof z.ZodObject)) {
    return [
      {
        name: 'value',
        type: analyzeScalar(schema).type,
        label: getFieldLabel('value', schema),
        required: isRequired(schema),
        defaultValue: getDefaultValue(schema),
      },
    ];
  }

  const shape = objectSchema.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape).map(([key, fieldSchema]) => {
    const unwrapped = unwrapSchema(fieldSchema);
    const base = analyzeScalar(fieldSchema);

    if (unwrapped instanceof z.ZodArray) {
      const elementSchema = unwrapped.element;
      const elementUnwrapped = unwrapSchema(elementSchema);
      const elementBase = analyzeScalar(elementSchema);

      let itemType = elementBase.type;
      let fields: FormField[] | undefined;

      if (elementUnwrapped instanceof z.ZodObject) {
        itemType = 'object';
        fields = schemaToFormFields(elementSchema);
      }

      return {
        name: key,
        type: 'array',
        label: getFieldLabel(key, fieldSchema),
        required: isRequired(fieldSchema),
        defaultValue: getDefaultValue(fieldSchema),
        itemType,
        fields,
      };
    }

    if (unwrapped instanceof z.ZodObject) {
      return {
        name: key,
        type: 'object',
        label: getFieldLabel(key, fieldSchema),
        required: isRequired(fieldSchema),
        defaultValue: getDefaultValue(fieldSchema),
        fields: schemaToFormFields(fieldSchema),
      };
    }

    return {
      name: key,
      type: base.type,
      label: getFieldLabel(key, fieldSchema),
      required: isRequired(fieldSchema),
      defaultValue: getDefaultValue(fieldSchema),
      options: base.options,
      min: base.min,
      max: base.max,
      minLength: base.minLength,
      maxLength: base.maxLength,
    };
  });
}
