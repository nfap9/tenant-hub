import assert from "node:assert/strict";
import { buildBatchRoomNos, toggleBatchRoomSelection } from "../src/screens/apartments/batchRooms";

assert.deepEqual(buildBatchRoomNos({ startFloor: "2", endFloor: "4", roomCount: "4" }), [
  "201",
  "202",
  "203",
  "204",
  "301",
  "302",
  "303",
  "304",
  "401",
  "402",
  "403",
  "404"
]);

assert.deepEqual(buildBatchRoomNos({ startFloor: "4", endFloor: "2", roomCount: "2" }), [
  "201",
  "202",
  "301",
  "302",
  "401",
  "402"
]);

assert.deepEqual(toggleBatchRoomSelection(["201", "202", "203"], "202"), ["201", "203"]);
assert.deepEqual(toggleBatchRoomSelection(["201", "203"], "202"), ["201", "203", "202"]);
