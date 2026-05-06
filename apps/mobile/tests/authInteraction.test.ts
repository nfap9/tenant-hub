import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/screens/auth/LoginScreen.tsx"), "utf8");

assert.match(source, /const \[otpBusy, setOtpBusy\] = useState\(false\)/, "OTP requests should have independent busy state");
assert.match(source, /disabled=\{otpBusy \|\| busy\}/, "OTP button should be disabled while auth requests are busy");
assert.match(source, /disabled=\{busy\}/, "Submit button should be disabled while submitting");
