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
          colorPrimary: '#0F766E',
          colorSuccess: '#22C55E',
          colorWarning: '#EA580C',
          colorError: '#DC2626',
          colorInfo: '#0369A1',
          borderRadius: 12,
          fontFamily:
            "'Open Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          colorBgContainer: '#FFFFFF',
          colorBgLayout: '#F0FDFA',
          colorText: '#134E4A',
          colorTextSecondary: '#64748B',
          colorTextTertiary: '#94A3B8',
          colorBorder: '#E2E8F0',
          colorBorderSecondary: '#F1F5F9',
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
            itemBorderRadius: 8,
            itemMarginInline: 12,
            itemMarginBlock: 4,
            itemHoverBg: '#F8FAFC',
            itemHoverColor: '#0F766E',
            itemSelectedBg: 'rgba(15, 118, 110, 0.08)',
            itemSelectedColor: '#0F766E',
          },
          Card: {
            borderRadiusLG: 16,
            borderRadius: 12,
          },
          Button: {
            borderRadius: 8,
            primaryShadow: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
          },
          Input: {
            borderRadius: 8,
            activeShadow: '0 0 0 3px rgba(15, 118, 110, 0.12)',
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
