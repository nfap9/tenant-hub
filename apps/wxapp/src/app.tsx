// @ts-nocheck
import { useLaunch } from '@tarojs/taro';
import { AppSessionProvider } from './context/AppSessionContext';
import './app.scss';

function App({ children }) {
  useLaunch(() => {
    console.log('[TenantHub] App launched');
  });
  return <AppSessionProvider>{children}</AppSessionProvider>;
}

export default App;
