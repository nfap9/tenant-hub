import assert from "node:assert/strict";
import { parseUtilityImportRows } from "./utilityImport.js";

const rows = parseUtilityImportRows(
  "billId,房间号,租客,上月水表,本月水表,上月电表,本月电表\nbill-a,201,张三,10,18,100,160\n"
);

assert.deepEqual(rows, [
  {
    billId: "bill-a",
    previousWater: 10,
    currentWater: 18,
    previousPower: 100,
    currentPower: 160
  }
]);

assert.deepEqual(parseUtilityImportRows(""), []);

assert.deepEqual(
  parseUtilityImportRows('billId,房间号,租客,上月水表,本月水表,上月电表,本月电表\nbill-b,202,"李四,测试",1,3,10,15\n'),
  [
    {
      billId: "bill-b",
      previousWater: 1,
      currentWater: 3,
      previousPower: 10,
      currentPower: 15
    }
  ],
  "quoted CSV cells should not shift water and power columns"
);

assert.throws(
  () => parseUtilityImportRows("billId,上月水表,本月水表,上月电表,本月电表\nbill-a,18,10,100,160"),
  /水表本期读数不能小于上期读数/
);

console.info("utility import tests passed");
