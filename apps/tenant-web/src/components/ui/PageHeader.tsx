import { Space, Breadcrumb } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

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
    <div style={{ marginBottom: 28 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            ...(back
              ? [
                  {
                    title: (
                      <span
                        style={{
                          cursor: 'pointer',
                          color: 'var(--th-primary)',
                        }}
                        onClick={() =>
                          navigate(typeof back === 'string' ? back : '..')
                        }
                      >
                        <ArrowLeftOutlined style={{ marginRight: 4 }} />
                        返回
                      </span>
                    ),
                  },
                ]
              : []),
            ...breadcrumb.map((item, idx) => ({
              title: item.path ? (
                <span
                  style={{ cursor: 'pointer' }}
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
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>{children}</div>
        {actions && (
          <Space size="middle" style={{ flexShrink: 0, marginTop: 4 }}>
            {actions}
          </Space>
        )}
      </div>
    </div>
  );
}
