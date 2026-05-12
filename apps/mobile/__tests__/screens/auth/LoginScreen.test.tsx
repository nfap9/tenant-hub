import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../../src/screens/auth/LoginScreen';

const mockMobileApi = jest.fn();

jest.mock('../../../src/services', () => ({
  mobileApi: (...args: unknown[]) => mockMobileApi(...args),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form by default', () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen
        phone=""
        setPhone={() => {}}
        mode="password"
        setMode={() => {}}
        onSignedIn={() => {}}
      />,
    );
    expect(getByText('欢迎回来')).toBeTruthy();
    expect(getByPlaceholderText('请输入手机号')).toBeTruthy();
  });

  it('should switch to register mode', () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen
        phone=""
        setPhone={() => {}}
        mode="password"
        setMode={() => {}}
        onSignedIn={() => {}}
      />,
    );
    fireEvent.press(getByText('注册新账号'));
    expect(getByText('注册账号')).toBeTruthy();
    expect(getByPlaceholderText('请输入用户名')).toBeTruthy();
  });

  it('should switch login mode between password and code', () => {
    const setMode = jest.fn();
    const { getByText } = render(
      <LoginScreen
        phone=""
        setPhone={() => {}}
        mode="password"
        setMode={setMode}
        onSignedIn={() => {}}
      />,
    );
    fireEvent.press(getByText('验证码登录'));
    expect(setMode).toHaveBeenCalledWith('code');
  });

  it('should call onSignedIn after successful login', async () => {
    const onSignedIn = jest.fn();
    mockMobileApi.mockResolvedValue({ token: 'token-1', user: { id: 'u1' } });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen
        phone="13800138000"
        setPhone={() => {}}
        mode="password"
        setMode={() => {}}
        onSignedIn={onSignedIn}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('至少 8 位密码'), 'password123');
    fireEvent.press(getByText('登录'));

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ token: 'token-1' }));
    });
  });

  it('should show error on login failure', async () => {
    mockMobileApi.mockRejectedValue(new Error('密码错误'));

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen
        phone="13800138000"
        setPhone={() => {}}
        mode="password"
        setMode={() => {}}
        onSignedIn={() => {}}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('至少 8 位密码'), 'wrongpass');
    fireEvent.press(getByText('登录'));

    await waitFor(() => {
      expect(getByText('密码错误')).toBeTruthy();
    });
  });

  it('should send OTP in code mode', async () => {
    mockMobileApi.mockResolvedValue({});

    const { getByText } = render(
      <LoginScreen
        phone="13800138000"
        setPhone={() => {}}
        mode="code"
        setMode={() => {}}
        onSignedIn={() => {}}
      />,
    );

    fireEvent.press(getByText('获取验证码'));

    await waitFor(() => {
      expect(mockMobileApi).toHaveBeenCalledWith(
        '/auth/otp',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('should disable submit while busy', async () => {
    mockMobileApi.mockImplementation(() => new Promise(() => {}));

    const { getByText } = render(
      <LoginScreen
        phone="13800138000"
        setPhone={() => {}}
        mode="password"
        setMode={() => {}}
        onSignedIn={() => {}}
      />,
    );

    fireEvent.press(getByText('登录'));
    await waitFor(() => {
      expect(getByText('处理中...')).toBeTruthy();
    });
  });
});
