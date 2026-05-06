import assert from "node:assert/strict";
import { getPaymentAmountError } from "../src/screens/bills/billPayment";

assert.equal(getPaymentAmountError("", 100), "请填写收款金额");
assert.equal(getPaymentAmountError("abc", 100), "收款金额必须是有效数字");
assert.equal(getPaymentAmountError("0", 100), "收款金额必须大于 0");
assert.equal(getPaymentAmountError("-1", 100), "收款金额必须大于 0");
assert.equal(getPaymentAmountError("101", 100), "收款金额不能超过剩余应收 ¥100.00");
assert.equal(getPaymentAmountError("100", 100), undefined);
