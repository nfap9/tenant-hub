import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppSessionProvider } from '@/context/AppSessionContext';
import AppRouter from '@/router';

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2563EB',
          colorSuccess: '#22C55E',
          colorWarning: '#EA580C',
          colorError: '#DC2626',
          colorInfo: '#2563EB',
          borderRadius: 8,
          fontFamily:
            "'Open Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          colorBgContainer: '#FFFFFF',
          colorBgLayout: '#F3F4F6',
          colorText: '#1F2937',
          colorTextSecondary: '#6B7280',
          colorTextTertiary: '#9CA3AF',
          colorBorder: '#E5E7EB',
          colorBorderSecondary: '#F3F4F6',
          controlHeight: 40,
        },
        components: {
          Layout: {
            headerBg: '#FFFFFF',
            headerHeight: 64,
            headerPadding: '0 24px',
            siderBg: '#FFFFFF',
          },
          Menu: {
            itemBorderRadius: 6,
            itemMarginInline: 12,
            itemMarginBlock: 4,
            itemHoverBg: '#F3F4F6',
            itemHoverColor: '#2563EB',
            itemSelectedBg: 'rgba(37, 99, 235, 0.08)',
            itemSelectedColor: '#2563EB',
          },
          Card: {
            borderRadiusLG: 12,
            borderRadius: 8,
          },
          Button: {
            borderRadius: 8,
            primaryShadow: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
          },
          Input: {
            borderRadius: 8,
            activeShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
          },
          Table: {
            headerBg: '#F8FAFC',
            headerColor: '#64748B',
            rowHoverBg: '#F8FAFC',
          },
          Modal: {
            borderRadiusLG: 20,
          },
          Segmented: {
            borderRadius: 8,
            trackBg: '#F8FAFC',
            itemSelectedBg: '#FFFFFF',
          },
          Tag: {
            borderRadius: 6,
          },
        },
      }}
    >
      <AppSessionProvider>
        <AppRouter />
      </AppSessionProvider>
    </ConfigProvider>
  );
}
// test
