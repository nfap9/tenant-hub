import { getRoomBillGeneratedLabel } from '../src/screens/rooms/roomBillLabel';

describe('room bill label', () => {
  const referenceDate = new Date('2026-05-07T00:00:00.000Z');

  it('should format current year bill label', () => {
    expect(getRoomBillGeneratedLabel('2026年5月', referenceDate)).toBe('5月账单已出');
  });

  it('should format future year bill label with full year', () => {
    expect(getRoomBillGeneratedLabel('2027年1月', referenceDate)).toBe('2027年1月账单已出');
  });

  it('should use default label when month is undefined', () => {
    expect(getRoomBillGeneratedLabel(undefined, referenceDate)).toBe('本月账单已出');
  });
});
