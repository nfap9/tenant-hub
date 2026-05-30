// PAGE-007: 通知中心页面
import { useState, useEffect, useCallback } from 'react';
import { Card, List, Badge, Button, Empty, Spin, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/api/notifications';
import PageHeader from '@/components/ui/PageHeader';
import type { Notification } from '@/api/notifications';
import styles from './NotificationsPage.module.scss';

export default function NotificationsPage() {
  const { currentOrgId } = useAppSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getNotifications(currentOrgId);
      setNotifications(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRead = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await markNotificationRead(currentOrgId, id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleReadAll = async () => {
    if (!currentOrgId) return;
    try {
      await markAllNotificationsRead(currentOrgId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      message.success('全部已读');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '通知中心' }]}
        actions={
          unreadCount > 0 && (
            <Button icon={<CheckOutlined />} onClick={handleReadAll}>
              全部已读
            </Button>
          )
        }
      />

      <Spin spinning={loading}>
        {notifications.length === 0 ? (
          <Card>
            <Empty
              image={<BellOutlined style={{ fontSize: 48, color: '#ccc' }} />}
              description="暂无通知"
            />
          </Card>
        ) : (
          <Card>
            <List
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  className={item.readAt ? styles.readItem : styles.unreadItem}
                  actions={[
                    !item.readAt && (
                      <Button
                        type="link"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => handleRead(item.id)}
                      >
                        标记已读
                      </Button>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span className={styles.itemTitle}>
                        {!item.readAt && <Badge status="processing" />}
                        {item.title}
                      </span>
                    }
                    description={
                      <div>
                        <div>{item.content}</div>
                        <div className={styles.itemTime}>
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
}
