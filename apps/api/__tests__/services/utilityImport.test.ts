import { describe, it, expect } from 'vitest';
import { parseUtilityImportRows } from '../../src/services/utilityImport.js';

describe('utility import', () => {
  it('should parse basic CSV rows', () => {
    const rows = parseUtilityImportRows(
      'billId,房间号,租客,上月水表,本月水表,上月电表,本月电表\nbill-a,201,张三,10,18,100,160\n'
    );
    expect(rows).toEqual([
      {
        billId: 'bill-a',
        previousWater: 10,
        currentWater: 18,
        previousPower: 100,
        currentPower: 160,
      },
    ]);
  });

  it('should return empty for empty CSV', () => {
    expect(parseUtilityImportRows('')).toEqual([]);
  });

  it('should handle quoted CSV cells correctly', () => {
    expect(
      parseUtilityImportRows(
        'billId,房间号,租客,上月水表,本月水表,上月电表,本月电表\nbill-b,202,"李四,测试",1,3,10,15\n'
      )
    ).toEqual([
      {
        billId: 'bill-b',
        previousWater: 1,
        currentWater: 3,
        previousPower: 10,
        currentPower: 15,
      },
    ]);
  });

  it('should reject backwards readings in CSV', () => {
    expect(() =>
      parseUtilityImportRows(
        'billId,上月水表,本月水表,上月电表,本月电表\nbill-a,18,10,100,160'
      )
    ).toThrow(/水表本期读数不能小于上期读数/);
  });
});
