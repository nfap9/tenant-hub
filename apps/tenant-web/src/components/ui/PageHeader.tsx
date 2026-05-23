import { Space, Breadcrumb } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import styles from './PageHeader.module.scss';

interface PageHeaderProps {
  back?: boolean | string;
  breadcrumb?: { label: string; path?: string }[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageHeader({
  back,
  breadcrumb,
  actions,
  children,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.pageHeader}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          items={[
            ...(back
              ? [
                  {
                    title: (
                      <span
                        className={styles.breadcrumbBack}
                        onClick={() =>
                          navigate(typeof back === 'string' ? back : '..')
                        }
                      >
                        <ArrowLeftOutlined />
                        返回
                      </span>
                    ),
                  },
                ]
              : []),
            ...breadcrumb.map((item, idx) => ({
              title: item.path ? (
                <span
                  className={styles.breadcrumbLink}
                  onClick={() => navigate(item.path!)}
                >
                  {item.label}
                </span>
              ) : (
                item.label
              ),
              key: idx,
            })),
          ]}
        />
      )}
      <div className={styles.pageHeaderContent}>
        <div>{children}</div>
        {actions && (
          <Space size="middle" className={styles.pageHeaderActions}>
            {actions}
          </Space>
        )}
      </div>
    </div>
  );
}
