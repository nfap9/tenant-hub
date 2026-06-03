import { Card, Tag, Button, Space, message } from 'antd';
import {
  UserAddOutlined,
  PauseCircleOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Room } from '@/types/domain';
import { statusLabels, toneForStatus } from '@/pages/rooms/constants';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { updateRoom } from '@/api/rooms';
import { deleteReservation } from '@/api/reservations';
import styles from './RoomCard.module.scss';
import clsx from 'clsx';

interface RoomCardProps {
  room: Room;
  apartmentName?: string;
  size?: 'default' | 'small';
  onStatusChange?: () => void;
  onSign?: (roomId: string) => void;
  onReserve?: (roomId: string) => void;
}

const statusColorMap: Record<string, string> = {
  success: 'success',
  neutral: 'default',
  warning: 'warning',
  danger: 'error',
};

export default function RoomCard({
  room,
  apartmentName,
  size = 'default',
  onStatusChange,
  onSign,
  onReserve,
}: RoomCardProps) {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const canManageRoom = useHasPermission('room:manage');
  const subtitle = apartmentName ?? room.apartment?.name;

  const handleStatusChange = async (
    e: React.MouseEvent,
    status: string,
    label: string
  ) => {
    e.stopPropagation();
    if (!currentOrgId) return;
    try {
      await updateRoom(currentOrgId, room.id, { status });
      message.success(`房间已${label}`);
      onStatusChange?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleSign = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSign) {
      onSign(room.id);
    } else {
      navigate(`/rooms/${room.id}?action=sign`);
    }
  };

  const handleUnreserve = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentOrgId) return;
    try {
      await deleteReservation(currentOrgId, room.id);
      message.success('已取消预留');
      onStatusChange?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const hasActions = canManageRoom || canManageLease;
  const isVacant = room.status === 'VACANT';
  const isReserved = room.status === 'RESERVED';
  const isMaintenance = room.status === 'MAINTENANCE';

  return (
    <Card
      className={styles.roomCard}
      size={size}
      hoverable
      onClick={() => navigate(`/rooms/${room.id}`)}
      title={
        <div className="flex-between">
          <span className={styles.roomTitle}>{room.roomNo}</span>
          <Tag color={statusColorMap[toneForStatus[room.status]]}>
            {statusLabels[room.status]}
          </Tag>
        </div>
      }
    >
      {subtitle && <div className={styles.roomSubtitle}>{subtitle}</div>}
      <div className={styles.roomMeta}>
        {room.layout}
        {room.area ? ` · ${room.area} ㎡` : ''}
      </div>
      <div className={clsx(styles.roomFacilities, 'text-subtle')}>
        {room.facilities?.join('、') || '无设施'}
      </div>

      {hasActions && !isVacant && !isReserved && !isMaintenance && (
        <div className={styles.roomActions}>
          <Button type="link" size="small" icon={<UserAddOutlined />}>
            查看详情
          </Button>
        </div>
      )}

      {hasActions && isVacant && (
        <div className={styles.roomActions}>
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<UserAddOutlined />}
              onClick={handleSign}
            >
              签约
            </Button>
            {canManageRoom && (
              <>
                <Button
                  size="small"
                  icon={<PauseCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onReserve) {
                      onReserve(room.id);
                    } else {
                      handleStatusChange(e, 'RESERVED', '预留');
                    }
                  }}
                >
                  预留
                </Button>
                <Button
                  size="small"
                  icon={<ToolOutlined />}
                  onClick={(e) => handleStatusChange(e, 'MAINTENANCE', '报修')}
                >
                  报修
                </Button>
              </>
            )}
          </Space>
        </div>
      )}

      {hasActions && isReserved && (
        <div className={styles.roomActions}>
          <Space>
            {canManageLease && (
              <Button
                type="primary"
                size="small"
                icon={<UserAddOutlined />}
                onClick={handleSign}
              >
                签约
              </Button>
            )}
            {canManageRoom && (
              <Button
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={handleUnreserve}
              >
                取消预留
              </Button>
            )}
          </Space>
        </div>
      )}

      {hasActions && isMaintenance && canManageRoom && (
        <div className={styles.roomActions}>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={(e) => handleStatusChange(e, 'VACANT', '维修完成')}
          >
            维修完成
          </Button>
        </div>
      )}
    </Card>
  );
}
