import { useLaunch } from '@tarojs/taro';
import './app.scss';

function App({ children }: { children: React.ReactNode }) {
  useLaunch(() => {
    console.log('[TenantHub] App launched');
  });

  return <>{children}</>;
}

export default App;
