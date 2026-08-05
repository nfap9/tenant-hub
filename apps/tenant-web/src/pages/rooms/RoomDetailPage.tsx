import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Table,
  Space,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  PlayCircleOutlined,
  ToolOutlined,
  HomeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getRoomDetail, deleteRoom, updateRoom } from '@/api/rooms';
import { activateLease } from '@/api/leases';
import type { Room, Lease, LeaseStatus } from '@/types/domain';
import { money } from '@/utils/format';
import { statusLabels, toneForStatus, cycleLabels } from './constants';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import RoomFormDrawer from './RoomFormDrawer';
import LeaseFormDrawer from './LeaseFormDrawer';

const statusColorMap: Record<string, string> = {
  success: 'success',
  neutral: 'default',
  warning: 'warning',
  danger: 'error',
  primary: 'blue',
};

const leaseStatusLabels: Record<LeaseStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '生效中',
  TERMINATED: '已终止',
  EXPIRED: '已到期',
};

const leaseStatusColors: Record<LeaseStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  TERMINATED: 'warning',
  EXPIRED: 'error',
};

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const canManageLease = useHasPermission('lease:manage');

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaseDrawerOpen, setLeaseDrawerOpen] = useState(false);
  const [roomFormOpen, setRoomFormOpen] = useState(false);

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

  const leases = useMemo(
    () =>
      [...(room?.leases ?? [])].sort(
        (left, right) =>
          new Date(right.startDate).getTime() -
          new Date(left.startDate).getTime()
      ),
    [room?.leases]
  );
  const activeLease = useMemo(
    () => leases.find((l) => l.status === 'ACTIVE'),
    [leases]
  );
  const draftLease = useMemo(
    () => leases.find((l) => l.status === 'DRAFT'),
    [leases]
  );

  const handleDelete = async () => {
    if (!currentOrgId || !room) return;
    if (room.status === 'OCCUPIED') {
      message.warning('已租房间不能删除，请先退租');
      return;
    }
    try {
      await deleteRoom(currentOrgId, room.id);
      message.success('房间已删除');
      navigate('/biz/rooms');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除房间失败');
    }
  };

  const handleActivate = async (leaseId: string) => {
    if (!currentOrgId) return;
    try {
      await activateLease(currentOrgId, leaseId);
      message.success('租约已激活');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '激活租约失败');
    }
  };

  const handleRoomStatus = async (status: string) => {
    if (!currentOrgId || !id) return;
    try {
      await updateRoom(currentOrgId, id, { status });
      message.success('房间状态已更新');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新房间状态失败');
    }
  };

  if (!room && !loading) {
    return (
      <div className="page-content">
        <EmptyState
          title="房间不存在"
          action={{
            label: '返回房间列表',
            onClick: () => navigate('/biz/rooms'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '房间管理', path: '/biz/rooms' },
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
                    {room.status === 'VACANT' && (
                      <>
                        <Button
                          icon={<ToolOutlined />}
                          onClick={() => handleRoomStatus('MAINTENANCE')}
                        >
                          报修
                        </Button>
                        <Button
                          icon={<HomeOutlined />}
                          onClick={() => handleRoomStatus('SELF_USE')}
                        >
                          设为自用
                        </Button>
                      </>
                    )}
                    {room.status === 'SELF_USE' && (
                      <Button
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleRoomStatus('VACANT')}
                      >
                        改为空闲
                      </Button>
                    )}
                    {room.status === 'MAINTENANCE' && (
                      <Button
                        icon={<ToolOutlined />}
                        onClick={() => handleRoomStatus('VACANT')}
                      >
                        维修完成
                      </Button>
                    )}
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => setRoomFormOpen(true)}
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
                  <DetailItem label="楼层">
                    {room.floor ? `${room.floor} 层` : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="家具家电">
                    {room.furnishings?.join('、') || '无家具家电'}
                  </DetailItem>
                </Col>
              </Row>
            </DetailSection>

            <Divider />

            <DetailSection
              title="租约记录"
              actions={
                canManageLease &&
                room.status === 'VACANT' &&
                !activeLease &&
                !draftLease && (
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={() => setLeaseDrawerOpen(true)}
                  >
                    签约
                  </Button>
                )
              }
            >
              {leases.length === 0 ? (
                <EmptyState
                  title="暂无租约记录"
                  description="当前房间没有任何租约"
                />
              ) : (
                <Table<Lease>
                  rowKey="id"
                  dataSource={leases}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    {
                      title: '租客',
                      render: (_: unknown, row: Lease) => (
                        <div>
                          <div>{row.tenantName || '-'}</div>
                          <div className="text-muted">
                            {row.tenantPhone || '-'}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: '租期',
                      render: (_: unknown, row: Lease) => (
                        <div>
                          <div>
                            {row.startDate} ~ {row.endDate}
                          </div>
                          <div className="text-muted">
                            {cycleLabels[row.rentCycle]}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: '租金',
                      render: (_: unknown, row: Lease) => (
                        <span>¥{money(row.rentAmount)}</span>
                      ),
                    },
                    {
                      title: '押金',
                      render: (_: unknown, row: Lease) => (
                        <span>¥{money(row.depositAmount)}</span>
                      ),
                    },
                    {
                      title: '状态',
                      render: (_: unknown, row: Lease) => (
                        <Tag color={leaseStatusColors[row.status]}>
                          {leaseStatusLabels[row.status]}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      fixed: 'right',
                      render: (_: unknown, row: Lease) => (
                        <Space>
                          {row.status === 'DRAFT' && canManageLease && (
                            <Popconfirm
                              title="激活租约"
                              description="确认激活草稿租约？激活后将开始生成账单。"
                              onConfirm={() => handleActivate(row.id)}
                              okText="确认激活"
                              cancelText="取消"
                            >
                              <Button
                                type="link"
                                size="small"
                                icon={<PlayCircleOutlined />}
                              >
                                激活
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              )}
            </DetailSection>
          </>
        )}
      </Spin>

      <RoomFormDrawer
        open={roomFormOpen}
        roomId={room?.id ?? ''}
        onCancel={() => setRoomFormOpen(false)}
        onSuccess={() => {
          setRoomFormOpen(false);
          loadData();
        }}
      />
      <LeaseFormDrawer
        open={leaseDrawerOpen}
        roomId={room?.id ?? ''}
        onCancel={() => setLeaseDrawerOpen(false)}
        onSuccess={() => {
          setLeaseDrawerOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
