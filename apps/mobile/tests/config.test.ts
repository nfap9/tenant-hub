import assert from "node:assert/strict";
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from "../src/constants/config";

assert.equal(resolveApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: "https://api.example.com/v1" }), "https://api.example.com/v1");
assert.equal(
  resolveApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: "   ", VITE_API_BASE_URL: "https://vite.example.com/api" }),
  "https://vite.example.com/api"
);
assert.equal(resolveApiBaseUrl({}), DEFAULT_API_BASE_URL);
