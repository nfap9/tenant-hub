import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button, message, Spin, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getRooms } from '@/api/rooms';
import type { Room, RoomStatus } from '@/types/domain';
import { statusLabels, filters } from './constants';
import RoomCard from '@/components/rooms/RoomCard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import RoomFormDrawer from './RoomFormDrawer';
import LeaseFormDrawer from './LeaseFormDrawer';
import ReservationDrawer from './ReservationDrawer';
import styles from './RoomListPage.module.scss';

export default function RoomListPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<RoomStatus | 'ALL'>('ALL');
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [defaultApartmentId, setDefaultApartmentId] = useState<string>();
  const [leaseDrawerOpen, setLeaseDrawerOpen] = useState(false);
  const [leaseRoomId, setLeaseRoomId] = useState<string>('');
  const [reserveDrawerOpen, setReserveDrawerOpen] = useState(false);
  const [reserveRoomId, setReserveRoomId] = useState<string>('');

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

  const handleSign = (roomId: string) => {
    setLeaseRoomId(roomId);
    setLeaseDrawerOpen(true);
  };

  const handleReserve = (roomId: string) => {
    setReserveRoomId(roomId);
    setReserveDrawerOpen(true);
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
              onClick={() => {
                setDefaultApartmentId(undefined);
                setFormDrawerOpen(true);
              }}
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
                ? {
                    label: '新增房间',
                    onClick: () => {
                      setDefaultApartmentId(undefined);
                      setFormDrawerOpen(true);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className={styles.roomGrid}>
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onStatusChange={loadRooms}
                onSign={handleSign}
                onReserve={handleReserve}
              />
            ))}
          </div>
        )}
      </Spin>

      <RoomFormDrawer
        open={formDrawerOpen}
        defaultApartmentId={defaultApartmentId}
        onCancel={() => {
          setFormDrawerOpen(false);
        }}
        onSuccess={() => {
          setFormDrawerOpen(false);
          loadRooms();
        }}
      />

      <LeaseFormDrawer
        open={leaseDrawerOpen}
        roomId={leaseRoomId}
        onCancel={() => setLeaseDrawerOpen(false)}
        onSuccess={() => {
          setLeaseDrawerOpen(false);
          loadRooms();
        }}
      />

      <ReservationDrawer
        open={reserveDrawerOpen}
        roomId={reserveRoomId}
        onCancel={() => setReserveDrawerOpen(false)}
        onSuccess={() => {
          setReserveDrawerOpen(false);
          loadRooms();
        }}
      />
    </div>
  );
}
