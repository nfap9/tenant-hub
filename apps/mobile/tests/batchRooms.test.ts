import {
  buildBatchRoomNos,
  MAX_BATCH_ROOM_COUNT,
  toggleBatchRoomSelection,
} from '../src/screens/apartments/batchRooms';

describe('batch rooms', () => {
  it('should build room numbers across floors', () => {
    expect(buildBatchRoomNos({ startFloor: '2', endFloor: '4', roomCount: '4' })).toEqual([
      '201',
      '202',
      '203',
      '204',
      '301',
      '302',
      '303',
      '304',
      '401',
      '402',
      '403',
      '404',
    ]);
  });

  it('should handle reversed floor ranges', () => {
    expect(buildBatchRoomNos({ startFloor: '4', endFloor: '2', roomCount: '2' })).toEqual([
      '201',
      '202',
      '301',
      '302',
      '401',
      '402',
    ]);
  });

  it('should toggle room selection', () => {
    expect(toggleBatchRoomSelection(['201', '202', '203'], '202')).toEqual(['201', '203']);
    expect(toggleBatchRoomSelection(['201', '203'], '202')).toEqual(['201', '203', '202']);
  });

  it('should reject excessive floor ranges', () => {
    expect(buildBatchRoomNos({ startFloor: '1', endFloor: '9999', roomCount: '99' })).toHaveLength(
      0,
    );
  });

  it('should cap at max batch room count', () => {
    expect(buildBatchRoomNos({ startFloor: '1', endFloor: '20', roomCount: '10' })).toHaveLength(
      MAX_BATCH_ROOM_COUNT,
    );
    expect(buildBatchRoomNos({ startFloor: '1', endFloor: '21', roomCount: '10' })).toHaveLength(0);
  });
});
