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
          colorPrimary: "#146c5c",
          colorSuccess: "#52c41a",
          colorWarning: "#faad14",
          colorError: "#f5222d",
          colorInfo: "#1890ff",
          borderRadius: 6,
        },
      }}
    >
      <AppSessionProvider>
        <AppRouter />
      </AppSessionProvider>
    </ConfigProvider>
  );
}
