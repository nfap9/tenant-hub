import { Menu, type MenuProps } from 'antd';
import styles from './SettingsLayout.module.scss';

interface SettingsLayoutProps {
  menuItems: MenuProps['items'];
  activeKey: string;
  onMenuClick: (key: string) => void;
  children: React.ReactNode;
}

export default function SettingsLayout({
  menuItems,
  activeKey,
  onMenuClick,
  children,
}: SettingsLayoutProps) {
  return (
    <div className={styles.settingsLayout}>
      <aside className={styles.settingsSider}>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={({ key }) => onMenuClick(key)}
          className={styles.settingsMenu}
        />
      </aside>
      <main className={styles.settingsContent}>{children}</main>
    </div>
  );
}
