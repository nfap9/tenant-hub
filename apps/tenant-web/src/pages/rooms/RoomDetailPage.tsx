import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Popconfirm,
  Divider,
  Row,
  Col,
} from 'antd';
import LeaseEditDrawer from './LeaseEditDrawer';
import LeaseFormDrawer from './LeaseFormDrawer';
import {
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  EditOutlined as EditLeaseIcon,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getRoomDetail, deleteRoom } from '@/api/rooms';
import type { Room } from '@/types/domain';
import { money, day } from '@/utils/format';
import { statusLabels, toneForStatus, cycleLabels } from './constants';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import LeaseTerminateDrawer from './LeaseTerminateDrawer';
import styles from './RoomDetailPage.module.scss';

const statusColorMap: Record<string, string> = {
  success: 'success',
  neutral: 'default',
  warning: 'warning',
  danger: 'error',
};

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const canManageLease = useHasPermission('lease:manage');

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [terminateDrawerOpen, setTerminateDrawerOpen] = useState(false);
  const [leaseDrawerOpen, setLeaseDrawerOpen] = useState(false);
  const [leaseEditDrawerOpen, setLeaseEditDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getRoomDetail(currentOrgId, id);
      setRoom(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载房间详情失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!currentOrgId || !room) return;
    if (room.status === 'OCCUPIED') {
      message.warning('已租房间不能删除，请先退租');
      return;
    }
    try {
      await deleteRoom(currentOrgId, room.id);
      message.success('房间已删除');
      navigate('/rooms');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除房间失败');
    }
  };

  if (!room && !loading) {
    return (
      <div className="page-content">
        <EmptyState
          title="房间不存在"
          action={{
            label: '返回房间列表',
            onClick: () => navigate('/rooms'),
          }}
        />
      </div>
    );
  }

  const activeLease = room?.leases?.find((l) => l.status === 'ACTIVE');

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '房间管理', path: '/rooms' },
          { label: room?.roomNo || '房间详情' },
        ]}
      />

      <Spin spinning={loading}>
        {room && (
          <>
            <DetailSection
              title="房间信息"
              actions={
                canManageRoom && (
                  <>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => navigate(`/rooms/${room.id}/edit`)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除房间"
                      description="删除后房间资料不可恢复，请确认当前房间没有有效租约。"
                      onConfirm={handleDelete}
                      okText="确认删除"
                      cancelText="取消"
                      disabled={room.status === 'OCCUPIED'}
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        danger
                        disabled={room.status === 'OCCUPIED'}
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </>
                )
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="房间号">{room.roomNo}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="状态">
                    <Tag color={statusColorMap[toneForStatus[room.status]]}>
                      {statusLabels[room.status]}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="所属公寓">
                    {room.apartment?.name}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="户型">{room.layout}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="面积">
                    {room.area ? `${room.area} ㎡` : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="设施">
                    {room.facilities?.join('、') || '无设施'}
                  </DetailItem>
                </Col>
              </Row>
            </DetailSection>

            {activeLease && (
              <>
                <Divider />
                <DetailSection
                  title="租约信息"
                  actions={
                    canManageLease && (
                      <>
                        <Button
                          icon={<EditLeaseIcon />}
                          onClick={() => setLeaseEditDrawerOpen(true)}
                        >
                          编辑租约
                        </Button>
                        <Button
                          danger
                          icon={<LogoutOutlined />}
                          onClick={() => setTerminateDrawerOpen(true)}
                        >
                          退租
                        </Button>
                      </>
                    )
                  }
                >
                  <Row gutter={[24, 0]}>
                    <Col span={8}>
                      <DetailItem label="租客姓名">
                        {activeLease.tenantName}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="租客电话">
                        {activeLease.tenantPhone}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="租金">
                        ¥{money(activeLease.rentAmount)}/
                        {cycleLabels[activeLease.cycle]}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="押金">
                        ¥{money(activeLease.depositAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="租期">
                        {day(activeLease.startDate)} 至{' '}
                        {day(activeLease.endDate)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="免租期">
                        {activeLease.graceDays} 天
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="水费单价">
                        ¥{money(activeLease.waterUnitPrice)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="电费单价">
                        ¥{money(activeLease.powerUnitPrice)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="自动续约">
                        {activeLease.autoRenew ? '是' : '否'}
                      </DetailItem>
                    </Col>
                  </Row>
                  {activeLease.fees && activeLease.fees.length > 0 && (
                    <div className={styles.feeSection}>
                      <div className={styles.feeTitle}>附加费用</div>
                      <div className={styles.feeList}>
                        {activeLease.fees.map((fee) => (
                          <Tag key={fee.id}>
                            {fee.name}: ¥{money(fee.amount)}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </DetailSection>
              </>
            )}

            {!activeLease && canManageLease && room.status === 'VACANT' && (
              <>
                <Divider />
                <DetailSection
                  title="租约信息"
                  actions={
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => setLeaseDrawerOpen(true)}
                    >
                      签约
                    </Button>
                  }
                >
                  <Row gutter={[24, 0]}>
                    <Col span={24}>
                      <DetailItem label="状态">
                        当前房间空闲，暂无租约
                      </DetailItem>
                    </Col>
                  </Row>
                </DetailSection>
              </>
            )}
          </>
        )}
      </Spin>

      <LeaseFormDrawer
        open={leaseDrawerOpen}
        roomId={room?.id ?? ''}
        onCancel={() => setLeaseDrawerOpen(false)}
        onSuccess={() => {
          setLeaseDrawerOpen(false);
          loadData();
        }}
      />
      <LeaseEditDrawer
        open={leaseEditDrawerOpen}
        roomId={room?.id ?? ''}
        onCancel={() => setLeaseEditDrawerOpen(false)}
        onSuccess={() => {
          setLeaseEditDrawerOpen(false);
          loadData();
        }}
      />
      <LeaseTerminateDrawer
        open={terminateDrawerOpen}
        roomId={room?.id ?? ''}
        onCancel={() => setTerminateDrawerOpen(false)}
        onSuccess={() => {
          setTerminateDrawerOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
