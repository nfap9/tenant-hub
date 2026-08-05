import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Table, Select, Space, Tag, message, Tooltip } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getMeterReadingRooms } from '@/api/bills';
import { getApartments } from '@/api/apartments';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import ReadingDrawer from '@/pages/bills/components/ReadingDrawer';
import { day } from '@/utils/format';
import type { MeterReadingRoom, Apartment } from '@/types/domain';

export default function MeterReadingListPage() {
  const { currentOrgId } = useAppSession();
  const canManageBill = useHasPermission('bill:manage');

  const [rooms, setRooms] = useState<MeterReadingRoom[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | undefined>();
  const [apartmentFilter, setApartmentFilter] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [data, apts] = await Promise.all([
        getMeterReadingRooms(currentOrgId),
        getApartments(currentOrgId),
      ]);
      setRooms(data);
      setApartments(apts);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载待抄表房间失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRooms = useMemo(() => {
    if (!apartmentFilter) return rooms;
    return rooms.filter((r) => r.apartmentId === apartmentFilter);
  }, [rooms, apartmentFilter]);

  const handleOpenDrawer = (roomId?: string) => {
    setEditingRoomId(roomId);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingRoomId(undefined);
  };

  const handleSuccess = () => {
    loadData();
    handleCloseDrawer();
  };

  const columns = useMemo(
    () => [
      {
        title: '公寓',
        dataIndex: 'apartmentName',
        key: 'apartmentName',
        render: (name: string) => name ?? '-',
      },
      {
        title: '房间',
        dataIndex: 'roomNo',
        key: 'roomNo',
        render: (no: string) => no ?? '-',
      },
      {
        title: '租客',
        dataIndex: 'tenantName',
        key: 'tenantName',
        render: (name: string) => name || '-',
      },
      {
        title: '上次水表读数',
        align: 'right' as const,
        render: (_: unknown, record: MeterReadingRoom) => {
          if (record.lastWaterValue == null) {
            return <span>-</span>;
          }
          return (
            <Tooltip
              title={
                record.lastWaterReadingDate
                  ? `抄表日期：${day(record.lastWaterReadingDate)}`
                  : undefined
              }
            >
              <Tag color="blue">{record.lastWaterValue}</Tag>
            </Tooltip>
          );
        },
      },
      {
        title: '上次电表读数',
        align: 'right' as const,
        render: (_: unknown, record: MeterReadingRoom) => {
          if (record.lastPowerValue == null) {
            return <span>-</span>;
          }
          return (
            <Tooltip
              title={
                record.lastPowerReadingDate
                  ? `抄表日期：${day(record.lastPowerReadingDate)}`
                  : undefined
              }
            >
              <Tag color="orange">{record.lastPowerValue}</Tag>
            </Tooltip>
          );
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_: unknown, record: MeterReadingRoom) =>
          canManageBill ? (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenDrawer(record.roomId)}
            >
              录入读数
            </Button>
          ) : (
            '-'
          ),
      },
    ],
    [canManageBill]
  );

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '租务管理', path: '/leases' },
          { label: '水电抄表' },
        ]}
        actions={
          <Space>
            {canManageBill && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenDrawer()}
              >
                录入读数
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={loadData}
            >
              刷新
            </Button>
          </Space>
        }
      />

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="选择公寓"
          value={apartmentFilter || undefined}
          onChange={setApartmentFilter}
          allowClear
          style={{ width: 180 }}
          options={apartments.map((a) => ({ label: a.name, value: a.id }))}
        />
      </Space>

      {filteredRooms.length === 0 && !loading ? (
        <EmptyState
          title="暂无待抄表房间"
          description="所有有活跃租约的房间都会出现在这里，当前暂无需要抄表的房间"
        />
      ) : (
        <Table
          rowKey="roomId"
          columns={columns}
          dataSource={filteredRooms}
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      )}

      <ReadingDrawer
        open={drawerOpen}
        roomId={editingRoomId}
        onClose={handleCloseDrawer}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
