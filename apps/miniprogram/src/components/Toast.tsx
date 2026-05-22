import Taro from '@tarojs/taro';

export function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info'
) {
  const iconMap = {
    success: 'success',
    error: 'error',
    warning: 'none',
    info: 'none',
  };

  Taro.showToast({
    title: message,
    icon: iconMap[type] as 'success' | 'error' | 'none',
    duration: 3000,
  });
}
