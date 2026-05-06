import assert from "node:assert/strict";
import { toCsv } from "./csv.js";

assert.equal(
  toCsv([
    ["billId", "租客", "失败原因"],
    ["bill-1", "张三", "缺少读数"]
  ]),
  "billId,租客,失败原因\nbill-1,张三,缺少读数",
  "plain CSV values should not be quoted"
);

assert.equal(
  toCsv([
    ["billId", "租客", "失败原因"],
    ["bill-2", "李,四", "他说\"缺少\n读数\""]
  ]),
  'billId,租客,失败原因\nbill-2,"李,四","他说""缺少\n读数"""',
  "CSV values with commas, quotes, or newlines should be escaped"
);

console.info("csv tests passed");
