import type { Rule } from 'antd/es/form';
import dayjs from 'dayjs';
import { money } from './format';

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const USERNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_-]{2,32}$/;
const PASSWORD_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,32}$/;

const MAX_MONEY = 99_999_999.99;
const MAX_AREA = 999_999.99;
const MAX_FLOOR = 999;
const MAX_READING = 999_999;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function getNumber(value: unknown): number | undefined {
  if (isBlank(value)) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export const requiredRule = (message: string): Rule => ({
  required: true,
  message,
  whitespace: true,
});

export const phoneRule: Rule[] = [
  requiredRule('请输入手机号'),
  {
    pattern: PHONE_REGEX,
    message: '请输入有效的手机号',
  },
];

export const usernameRule: Rule[] = [
  requiredRule('请输入用户名'),
  {
    pattern: USERNAME_REGEX,
    message: '用户名 2-32 位，只能包含中文、字母、数字、下划线或连字符',
  },
];

export const passwordRule = (isNewPassword = true): Rule[] => {
  const rules: Rule[] = [
    requiredRule(isNewPassword ? '请输入密码' : '请输入原密码'),
  ];
  if (isNewPassword) {
    rules.push({
      pattern: PASSWORD_REGEX,
      message: '密码 8-32 位，必须同时包含字母和数字',
    });
  }
  return rules;
};

export const confirmPasswordRule = (field = 'password'): Rule[] => [
  requiredRule('请再次输入密码'),
  ({ getFieldValue }) => ({
    validator(_, value) {
      if (!value || getFieldValue(field) === value) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('两次输入的密码不一致'));
    },
  }),
];

export const nameRule = (
  fieldName: string,
  options?: { max?: number; required?: boolean }
): Rule[] => {
  const { max = 64, required = true } = options ?? {};
  const rules: Rule[] = [];
  if (required) {
    rules.push(requiredRule(`请输入${fieldName}`));
  }
  rules.push({
    max,
    message: `${fieldName}不能超过 ${max} 个字符`,
  });
  return rules;
};

export const addressRule: Rule[] = [
  requiredRule('请输入地址'),
  {
    max: 255,
    message: '地址不能超过 255 个字符',
  },
];

export const descriptionRule = (fieldName: string, max = 255): Rule => ({
  max,
  message: `${fieldName}不能超过 ${max} 个字符`,
});

export const noteRule = (fieldName = '备注', max = 255): Rule => ({
  max,
  message: `${fieldName}不能超过 ${max} 个字符`,
});

export const moneyRule = (
  fieldName: string,
  options?: { required?: boolean; max?: number }
): Rule[] => {
  const { required = true, max = MAX_MONEY } = options ?? {};
  const rules: Rule[] = [];
  if (required) {
    rules.push(requiredRule(`请输入${fieldName}`));
  }
  rules.push({
    validator(_, value) {
      if (isBlank(value)) {
        return required
          ? Promise.reject(new Error(`请输入${fieldName}`))
          : Promise.resolve();
      }
      const num = getNumber(value);
      if (num === undefined || num < 0) {
        return Promise.reject(new Error(`${fieldName}不能小于 0`));
      }
      if (num > max) {
        return Promise.reject(
          new Error(`${fieldName}不能超过 ${max.toLocaleString()} 元`)
        );
      }
      const decimalPart = String(num).split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        return Promise.reject(new Error(`${fieldName}最多保留两位小数`));
      }
      return Promise.resolve();
    },
  });
  return rules;
};

export const positiveIntegerRule = (
  fieldName: string,
  options?: { required?: boolean; max?: number }
): Rule[] => {
  const { required = true, max = MAX_FLOOR } = options ?? {};
  const rules: Rule[] = [];
  if (required) {
    rules.push(requiredRule(`请输入${fieldName}`));
  }
  rules.push({
    validator(_, value) {
      if (isBlank(value)) {
        return required
          ? Promise.reject(new Error(`请输入${fieldName}`))
          : Promise.resolve();
      }
      const num = getNumber(value);
      if (num === undefined || !Number.isInteger(num) || num < 1) {
        return Promise.reject(new Error(`${fieldName}必须是正整数`));
      }
      if (num > max) {
        return Promise.reject(new Error(`${fieldName}不能超过 ${max}`));
      }
      return Promise.resolve();
    },
  });
  return rules;
};

export const nonNegativeIntegerRule = (
  fieldName: string,
  options?: { required?: boolean; max?: number }
): Rule[] => {
  const { required = true, max = MAX_READING } = options ?? {};
  const rules: Rule[] = [];
  if (required) {
    rules.push({ required: true, message: `请输入${fieldName}` });
  }
  rules.push({
    validator(_, value) {
      if (isBlank(value)) {
        return required
          ? Promise.reject(new Error(`请输入${fieldName}`))
          : Promise.resolve();
      }
      const num = getNumber(value);
      if (num === undefined || !Number.isInteger(num) || num < 0) {
        return Promise.reject(new Error(`${fieldName}必须是非负整数`));
      }
      if (num > max) {
        return Promise.reject(new Error(`${fieldName}不能超过 ${max}`));
      }
      return Promise.resolve();
    },
  });
  return rules;
};

export const areaRule: Rule[] = moneyRule('面积', {
  required: false,
  max: MAX_AREA,
});

export const unitPriceRule = (
  fieldName: string,
  options?: { required?: boolean }
): Rule[] =>
  moneyRule(fieldName, {
    required: options?.required ?? false,
    max: MAX_MONEY,
  });

export const endDateAfterStartRule =
  (startField: string): Rule =>
  ({ getFieldValue }) => ({
    dependencies: [startField],
    validator(_, value) {
      if (!value) return Promise.resolve();
      const start = getFieldValue(startField);
      if (!start) return Promise.resolve();
      const startDay = dayjs(start);
      const endDay = dayjs(value);
      if (endDay.isAfter(startDay, 'day') || endDay.isSame(startDay, 'day')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('结束日期必须晚于或等于开始日期'));
    },
  });

export const noFutureDateRule = (fieldName: string): Rule => ({
  validator(_, value) {
    if (!value) return Promise.resolve();
    if (!dayjs(value).isAfter(dayjs(), 'day')) return Promise.resolve();
    return Promise.reject(new Error(`${fieldName}不能选择未来日期`));
  },
});

export const readingIncreaseRule =
  (previousField: string, fieldName: string): Rule =>
  ({ getFieldValue }) => ({
    dependencies: [previousField],
    validator(_, value) {
      if (isBlank(value)) return Promise.resolve();
      const previous = getFieldValue(previousField);
      if (isBlank(previous)) return Promise.resolve();
      if (Number(value) >= Number(previous)) return Promise.resolve();
      return Promise.reject(new Error(`${fieldName}不能小于上期读数`));
    },
  });

export const inviteCodeRule: Rule[] = [
  requiredRule('请输入邀请码'),
  {
    min: 6,
    max: 32,
    message: '邀请码长度在 6-32 位之间',
  },
];

export const paymentAmountRule = (
  totalRemaining: number,
  waiverChecked: boolean
): Rule[] => {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return [
    requiredRule('请输入实付金额'),
    {
      validator(_, value) {
        if (isBlank(value)) return Promise.resolve();
        const num = getNumber(value);
        if (num === undefined || num <= 0) {
          return Promise.reject(new Error('金额必须大于 0'));
        }
        if (num > totalRemaining) {
          return Promise.reject(
            new Error(`金额不能超过剩余应收 ¥${money(totalRemaining)}`)
          );
        }
        const decimalPart = String(num).split('.')[1];
        if (decimalPart && decimalPart.length > 2) {
          return Promise.reject(new Error('金额最多保留两位小数'));
        }
        if (waiverChecked) {
          const waiver = round2(totalRemaining - num);
          if (waiver > 1) {
            return Promise.reject(
              new Error('抹零金额不能超过 1 元，请减少实付金额或取消抹零')
            );
          }
          if (waiver < 0) {
            return Promise.reject(new Error('抹零金额不能为负数'));
          }
          if (Math.abs(num + waiver - totalRemaining) > 0.01) {
            return Promise.reject(
              new Error('实付金额与抹零金额之和应等于剩余应收')
            );
          }
        }
        return Promise.resolve();
      },
    },
  ];
};

export interface FeeFormItem {
  type: string;
  name: string;
  amount: string;
}

export const feesRule = (fees: FeeFormItem[]): Rule => ({
  validator() {
    const invalidFee = fees.find((item) => {
      const amount = Number(item.amount);
      return item.amount.trim() === '' || Number.isNaN(amount) || amount < 0;
    });
    if (invalidFee) {
      return Promise.reject(new Error('费用项目金额必须大于或等于 0'));
    }
    return Promise.resolve();
  },
});

export const selectedRoomNosRule = (selectedNos: string[]): Rule => ({
  validator() {
    if (selectedNos.length === 0) {
      return Promise.reject(new Error('请至少选择一个房间号'));
    }
    return Promise.resolve();
  },
});

export const floorRangeRule =
  (startField: string, endField: string): Rule =>
  ({ getFieldValue }) => ({
    dependencies: [startField, endField],
    validator(_, value) {
      if (isBlank(value)) return Promise.resolve();
      const start = getNumber(getFieldValue(startField));
      const end = getNumber(getFieldValue(endField));
      if (start === undefined || end === undefined) return Promise.resolve();
      if (start <= end) return Promise.resolve();
      return Promise.reject(new Error('结束楼层不能小于开始楼层'));
    },
  });
