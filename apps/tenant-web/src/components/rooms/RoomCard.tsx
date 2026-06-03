import { Card, Tag, Button, Tooltip } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Room } from '@/types/domain';
import { statusLabels, toneForStatus } from '@/pages/rooms/constants';
import { useHasPermission } from '@/context/AppSessionContext';
import styles from './RoomCard.module.scss';
import clsx from 'clsx';

interface RoomCardProps {
  room: Room;
  apartmentName?: string;
  size?: 'default' | 'small';
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
}: RoomCardProps) {
  const navigate = useNavigate();
  const canManageLease = useHasPermission('lease:manage');
  const subtitle = apartmentName ?? room.apartment?.name;

  const handleLeaseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/rooms/${room.id}`);
  };

  const showLeaseButton = canManageLease && room.status === 'VACANT';

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
      {showLeaseButton && (
        <div className={styles.roomActions}>
          <Tooltip title="签约">
            <Button
              type="text"
              icon={<UserAddOutlined />}
              onClick={handleLeaseClick}
            />
          </Tooltip>
        </div>
      )}
    </Card>
  );
}
