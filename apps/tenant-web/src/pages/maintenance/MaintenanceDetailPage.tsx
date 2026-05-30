// PAGE-113: 维修工单新增/编辑页面
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Row,
  Col,
  Divider,
  Image,
  Card,
} from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getMaintenanceOrder,
  deleteMaintenanceOrder,
  type MaintenanceOrder,
} from '@/api/maintenance';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import { money, day } from '@/utils/format';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function resolveUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'red' },
  DISPATCHED: { label: '已派单', color: 'orange' },
  IN_PROGRESS: { label: '处理中', color: 'blue' },
  AWAITING_ACCEPTANCE: { label: '待验收', color: 'purple' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
};

const priorityMap: Record<string, { label: string; color: string }> = {
  URGENT: { label: '紧急', color: 'red' },
  NORMAL: { label: '一般', color: 'blue' },
  LOW: { label: '低', color: 'default' },
};

const typeMap: Record<string, string> = {
  WATER_ELECTRIC: '水电',
  DOOR_WINDOW: '门窗',
  WALL: '墙面',
  FURNITURE_APPLIANCE: '家具家电',
  NETWORK: '网络',
  PIPE: '管道',
  CLEANING: '清洁',
  OTHER: '其他',
};

export default function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('lease:manage');

  const [order, setOrder] = useState<MaintenanceOrder | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getMaintenanceOrder(currentOrgId, id);
      setOrder(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!currentOrgId || !id) return;
    try {
      await deleteMaintenanceOrder(currentOrgId, id);
      message.success('工单已删除');
      navigate('/maintenance');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  if (!order && !loading) {
    return (
      <div className="page-content">
        <PageHeader
          back={true}
          breadcrumb={[
            { label: '维修工单', path: '/maintenance' },
            { label: '工单详情' },
          ]}
        />
        <div style={{ textAlign: 'center', padding: 64 }}>工单不存在</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '维修工单', path: '/maintenance' },
          { label: order?.title || '工单详情' },
        ]}
        actions={
          canManage &&
          order && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => navigate(`/maintenance?edit=${order.id}`)}
              >
                编辑
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                删除
              </Button>
            </>
          )
        }
      />

      <Spin spinning={loading}>
        {order && (
          <>
            <DetailSection title="基本信息">
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="标题">{order.title}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="类型">
                    {typeMap[order.type] || order.type}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="优先级">
                    <Tag color={priorityMap[order.priority]?.color}>
                      {priorityMap[order.priority]?.label}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="状态">
                    <Tag color={statusMap[order.status]?.color}>
                      {statusMap[order.status]?.label}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="报修人">
                    {order.reporterName || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="联系电话">
                    {order.reporterPhone || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="指派给">
                    {order.assignedTo || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="预约时间">
                    {order.scheduledDate ? day(order.scheduledDate) : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="完成时间">
                    {order.completedDate ? day(order.completedDate) : '-'}
                  </DetailItem>
                </Col>
                {order.apartment && (
                  <Col span={8}>
                    <DetailItem label="关联公寓">
                      {order.apartment.name}
                    </DetailItem>
                  </Col>
                )}
                {order.room && (
                  <Col span={8}>
                    <DetailItem label="关联房间">
                      {order.room.roomNo}
                    </DetailItem>
                  </Col>
                )}
              </Row>
            </DetailSection>

            {order.description && (
              <>
                <Divider />
                <DetailSection title="问题描述">
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {order.description}
                  </div>
                </DetailSection>
              </>
            )}

            <Divider />
            <DetailSection title="费用明细">
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="材料费">
                    ¥{money(order.materialCost)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="人工费">
                    ¥{money(order.laborCost)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="合计">
                    <strong>¥{money(order.totalCost)}</strong>
                  </DetailItem>
                </Col>
              </Row>
            </DetailSection>

            {(order.beforePhotoUrl || order.afterPhotoUrl) && (
              <>
                <Divider />
                <DetailSection title="照片记录">
                  <Row gutter={[16, 16]}>
                    {order.beforePhotoUrl && (
                      <Col span={12}>
                        <Card
                          size="small"
                          title="维修前"
                          bodyStyle={{ padding: 8 }}
                        >
                          <Image
                            src={resolveUrl(order.beforePhotoUrl)}
                            alt="维修前"
                            style={{
                              width: '100%',
                              maxHeight: 300,
                              objectFit: 'cover',
                            }}
                          />
                        </Card>
                      </Col>
                    )}
                    {order.afterPhotoUrl && (
                      <Col span={12}>
                        <Card
                          size="small"
                          title="维修后"
                          bodyStyle={{ padding: 8 }}
                        >
                          <Image
                            src={resolveUrl(order.afterPhotoUrl)}
                            alt="维修后"
                            style={{
                              width: '100%',
                              maxHeight: 300,
                              objectFit: 'cover',
                            }}
                          />
                        </Card>
                      </Col>
                    )}
                  </Row>
                </DetailSection>
              </>
            )}

            {order.acceptanceNote && (
              <>
                <Divider />
                <DetailSection title="验收备注">
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {order.acceptanceNote}
                  </div>
                </DetailSection>
              </>
            )}

            {order.items && order.items.length > 0 && (
              <>
                <Divider />
                <DetailSection title="材料/人工明细">
                  <Row gutter={[16, 8]}>
                    {order.items.map((item) => (
                      <Col span={8} key={item.id}>
                        <Card size="small">
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>{item.name}</span>
                            <Tag color={item.isLabor ? 'blue' : 'green'}>
                              {item.isLabor ? '人工' : '材料'}
                            </Tag>
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            {item.quantity} × ¥{money(item.unitPrice)} = ¥
                            {money(item.amount)}
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </DetailSection>
              </>
            )}
          </>
        )}
      </Spin>
    </div>
  );
}
