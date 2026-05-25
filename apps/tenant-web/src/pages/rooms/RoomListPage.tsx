import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button, Card, Tag, message, Popconfirm, Spin, Tabs } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  EditOutlined as EditLeaseIcon,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getRooms, deleteRoom } from '@/api/rooms';
import type { Room, RoomStatus } from '@/types/domain';
import { money, day } from '@/utils/format';
import { statusLabels, toneForStatus, filters } from './constants';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './RoomListPage.module.scss';
import clsx from 'clsx';

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

      <Tabs
        activeKey={filter}
        onChange={(key) => setFilter(key as RoomStatus | 'ALL')}
        items={filters.map((f) => ({
          key: f,
          label:
            f === 'ALL'
              ? `全部 (${rooms.length})`
              : `${statusLabels[f]} (${rooms.filter((r) => r.status === f).length})`,
        }))}
        className={styles.roomTabs}
      />

      <Spin spinning={loading}>
        {filteredRooms.length === 0 ? (
          <EmptyState
            title="暂无房间数据"
            description="当前还没有创建任何房间，点击右上角按钮新增"
            action={
              canManageRoom
                ? { label: '新增房间', onClick: () => navigate('/rooms/new') }
                : undefined
            }
          />
        ) : (
          <div className={styles.roomGrid}>
            {filteredRooms.map((room) => {
              const activeLease = room.leases?.find(
                (l) => l.status === 'ACTIVE'
              );
              return (
                <Card
                  key={room.id}
                  title={
                    <div className="flex-between">
                      <span className={styles.roomTitle}>{room.roomNo}</span>
                      <Tag color={statusColorMap[toneForStatus[room.status]]}>
                        {statusLabels[room.status]}
                      </Tag>
                    </div>
                  }
                >
                  <div className="mb-4 text-muted">
                    {room.apartment?.name} · {room.layout}
                  </div>
                  <div className={clsx(styles.roomMeta, 'text-subtle')}>
                    {room.area ? `${room.area} ㎡ · ` : ''}
                    {room.facilities?.join('、') || '无设施'}
                  </div>

                  {activeLease && (
                    <div className={styles.leaseInfo}>
                      <div className={styles.leaseTenant}>
                        {activeLease.tenantName} · {activeLease.tenantPhone}
                      </div>
                      <div className={clsx(styles.leaseRent, 'text-muted')}>
                        租金 ¥{money(activeLease.rentAmount)}/
                        {activeLease.cycle === 'MONTHLY'
                          ? '月'
                          : activeLease.cycle === 'QUARTERLY'
                            ? '季'
                            : '年'}
                      </div>
                      <div className="text-subtle">
                        {day(activeLease.startDate)} 至{' '}
                        {day(activeLease.endDate)}
                      </div>
                    </div>
                  )}

                  <div className={styles.roomActions}>
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
