import { Space, Breadcrumb } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './PageHeader.scss';

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
    <div className="page-header">
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
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
                  className="breadcrumb-link"
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
      <div className="page-header-content">
        <div>{children}</div>
        {actions && (
          <Space size="middle" className="page-header-actions">
            {actions}
          </Space>
        )}
      </div>
    </div>
  );
}
