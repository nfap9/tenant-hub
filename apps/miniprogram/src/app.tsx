// @ts-nocheck
import { AppSessionProvider } from './context/AppSessionContext';
import './app.scss';

function App({ children }) {
  return <AppSessionProvider>{children}</AppSessionProvider>;
}

export default App;
