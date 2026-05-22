import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button, Card, Tag, message, Popconfirm, Spin, Radio } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  EditOutlined as EditLeaseIcon,
  LogoutOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getRooms, deleteRoom } from '@/api/rooms';
import type { Room, RoomStatus } from '@/types/domain';
import { money, day } from '@/utils/format';
import { statusLabels, toneForStatus, filters } from './constants';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';

export default function RoomListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const canManageLease = useHasPermission('lease:manage');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<RoomStatus | 'ALL'>('ALL');

  const loadRooms = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getRooms(currentOrgId);
      setRooms(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载房间列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const filteredRooms = useMemo(() => {
    if (filter === 'ALL') return rooms;
    return rooms.filter((r) => r.status === filter);
  }, [rooms, filter]);

  const vacantCount = rooms.filter((r) => r.status === 'VACANT').length;
  const occupiedCount = rooms.filter((r) => r.status === 'OCCUPIED').length;
  const reservedCount = rooms.filter((r) => r.status === 'RESERVED').length;
  const maintenanceCount = rooms.filter(
    (r) => r.status === 'MAINTENANCE'
  ).length;

  const handleDelete = async (room: Room) => {
    if (!currentOrgId) return;
    if (room.status === 'OCCUPIED') {
      message.warning('已租房间不能删除，请先退租');
      return;
    }
    try {
      await deleteRoom(currentOrgId, room.id);
      message.success('房间已删除');
      loadRooms();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除房间失败');
    }
  };

  const statusColorMap: Record<string, string> = {
    success: 'success',
    neutral: 'default',
    warning: 'warning',
    danger: 'error',
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '房间管理' }]}
        actions={
          canManageRoom && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/rooms/new')}
            >
              新增房间
            </Button>
          )
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          title="总房间"
          value={rooms.length}
          icon={<HomeOutlined />}
          color="primary"
        />
        <StatCard
          title="空闲"
          value={vacantCount}
          icon={<CheckCircleOutlined />}
          color="success"
        />
        <StatCard
          title="已租"
          value={occupiedCount}
          icon={<UserOutlined />}
          color="warning"
        />
        <StatCard
          title="预留/维修"
          value={reservedCount + maintenanceCount}
          icon={<ToolOutlined />}
          color="danger"
        />
      </div>

      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: 'var(--th-space-4) var(--th-space-6)' }}
      >
        <Radio.Group value={filter} onChange={(e) => setFilter(e.target.value)}>
          {filters.map((f) => (
            <Radio.Button key={f} value={f}>
              {f === 'ALL'
                ? `全部 (${rooms.length})`
                : `${statusLabels[f]} (${rooms.filter((r) => r.status === f).length})`}
            </Radio.Button>
          ))}
        </Radio.Group>
      </Card>

      <Spin spinning={loading}>
        {filteredRooms.length === 0 ? (
          <Card>
            <EmptyState
              title="暂无房间数据"
              description="当前还没有创建任何房间，点击右上角按钮新增"
              action={
                canManageRoom
                  ? { label: '新增房间', onClick: () => navigate('/rooms/new') }
                  : undefined
              }
            />
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            {filteredRooms.map((room) => {
              const activeLease = room.leases?.find(
                (l) => l.status === 'ACTIVE'
              );
              return (
                <Card
                  key={room.id}
                  title={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--th-font-heading)',
                          fontWeight: 600,
                          fontSize: 16,
                        }}
                      >
                        {room.roomNo}
                      </span>
                      <Tag color={statusColorMap[toneForStatus[room.status]]}>
                        {statusLabels[room.status]}
                      </Tag>
                    </div>
                  }
                >
                  <div
                    style={{
                      marginBottom: 4,
                      color: 'var(--th-foreground-muted)',
                    }}
                  >
                    {room.apartment?.name} · {room.layout}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--th-foreground-subtle)',
                      marginBottom: 12,
                    }}
                  >
                    {room.area ? `${room.area} ㎡ · ` : ''}
                    {room.facilities?.join('、') || '无设施'}
                  </div>

                  {activeLease && (
                    <div
                      style={{
                        background: 'var(--th-success-bg)',
                        padding: 12,
                        borderRadius: 'var(--th-radius-sm)',
                        marginBottom: 12,
                        fontSize: 13,
                        border: '1px solid var(--th-border-light)',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 4,
                          color: 'var(--th-foreground)',
                        }}
                      >
                        {activeLease.tenantName} · {activeLease.tenantPhone}
                      </div>
                      <div
                        style={{
                          color: 'var(--th-foreground-muted)',
                          marginBottom: 2,
                        }}
                      >
                        租金 ¥{money(activeLease.rentAmount)}/
                        {activeLease.cycle === 'MONTHLY'
                          ? '月'
                          : activeLease.cycle === 'QUARTERLY'
                            ? '季'
                            : '年'}
                      </div>
                      <div style={{ color: 'var(--th-foreground-subtle)' }}>
                        {day(activeLease.startDate)} 至{' '}
                        {day(activeLease.endDate)}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {canManageRoom && (
                      <>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => navigate(`/rooms/${room.id}/edit`)}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="删除房间"
                          description="删除后房间资料不可恢复，请确认当前房间没有有效租约。"
                          onConfirm={() => handleDelete(room)}
                          okText="确认删除"
                          cancelText="取消"
                          disabled={room.status === 'OCCUPIED'}
                        >
                          <Button
                            size="small"
                            danger
                            disabled={room.status === 'OCCUPIED'}
                            icon={<DeleteOutlined />}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                    {canManageLease && (
                      <>
                        {!activeLease && room.status === 'VACANT' && (
                          <Button
                            size="small"
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={() =>
                              navigate(`/rooms/${room.id}/lease/new`)
                            }
                          >
                            签约
                          </Button>
                        )}
                        {activeLease && (
                          <>
                            <Button
                              size="small"
                              icon={<EditLeaseIcon />}
                              onClick={() =>
                                navigate(`/rooms/${room.id}/lease/edit`)
                              }
                            >
                              编辑租约
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<LogoutOutlined />}
                              onClick={() =>
                                navigate(`/rooms/${room.id}/lease/terminate`)
                              }
                            >
                              退租
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Spin>
    </div>
  );
}
