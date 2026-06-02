import { Button, Breadcrumb, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import styles from './PageHeader.module.scss';

interface PageHeaderProps {
  breadcrumb: { label: string; path?: string }[];
  back?: string;
  actions?: ReactNode;
}

export default function PageHeader({
  breadcrumb,
  back,
  actions,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {back && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(back)}
            className={styles.backBtn}
          />
        )}
        <Breadcrumb
          items={breadcrumb.map((item) => ({
            title: item.path ? (
              <a onClick={() => navigate(item.path!)}>{item.label}</a>
            ) : (
              item.label
            ),
          }))}
          className={styles.breadcrumb}
        />
      </div>
      {actions && <Space>{actions}</Space>}
    </div>
  );
}
