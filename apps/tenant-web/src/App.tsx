import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AppSessionProvider } from "@/context/AppSessionContext";
import AppRouter from "@/router";

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#0F766E",
          colorSuccess: "#22C55E",
          colorWarning: "#EA580C",
          colorError: "#DC2626",
          colorInfo: "#0369A1",
          borderRadius: 12,
          fontFamily: "'Open Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          colorBgContainer: "#FFFFFF",
          colorBgLayout: "#F0FDFA",
          colorText: "#134E4A",
          colorTextSecondary: "#64748B",
          colorTextTertiary: "#94A3B8",
          colorBorder: "#E2E8F0",
          colorBorderSecondary: "#F1F5F9",
          controlHeight: 40,
        },
      }}
    >
      <AppSessionProvider>
        <AppRouter />
      </AppSessionProvider>
    </ConfigProvider>
  );
}
