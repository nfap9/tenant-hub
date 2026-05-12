import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('auth interaction', () => {
  const source = readFileSync(join(process.cwd(), 'src/screens/auth/LoginScreen.tsx'), 'utf8');

  it('should have independent OTP busy state', () => {
    expect(source).toMatch(/const \[otpBusy, setOtpBusy\] = useState\(false\)/);
  });

  it('should disable OTP button while auth requests are busy', () => {
    expect(source).toMatch(/disabled=\{otpBusy \|\| busy\}/);
  });

  it('should disable submit button while submitting', () => {
    expect(source).toMatch(/disabled=\{busy\}/);
  });
});
