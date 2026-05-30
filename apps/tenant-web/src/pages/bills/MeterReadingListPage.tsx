// PAGE-220: 抄表记录页面
import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Spin, message, Select } from 'antd';
import { useAppSession } from '@/context/AppSessionContext';
import { getMeterReadings } from '@/api/bills';
import { getAllApartments } from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './MeterReadingListPage.module.scss';

const meterTypeLabels: Record<string, string> = {
  WATER: '水表',
  POWER: '电表',
  GAS: '气表',
};

const sourceLabels: Record<string, string> = {
  MANUAL: '手工录入',
  IMPORT: '批量导入',
  SYSTEM: '系统生成',
};

const statusLabels: Record<string, string> = {
  NORMAL: '正常',
  SUSPECTED: '疑似异常',
  CONFIRMED: '已确认',
  VOID: '作废',
};

const statusColors: Record<string, string> = {
  NORMAL: 'success',
  SUSPECTED: 'warning',
  CONFIRMED: 'default',
  VOID: 'default',
};

export default function MeterReadingListPage() {
  const { currentOrgId } = useAppSession();
  const [readings, setReadings] = useState<
    Array<{
      id: string;
      roomId: string;
      room?: { roomNo: string; apartment?: { name: string } };
      meterType: string;
      value: number | string;
      usage?: number | string;
      readingDate: string;
      source: string;
      status: string;
      note?: string;
    }>
  >([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [apartmentFilter, setApartmentFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [rData, aData] = await Promise.all([
        getMeterReadings(currentOrgId),
        getAllApartments(currentOrgId),
      ]);
      setReadings(rData);
      setApartments(aData);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载抄表记录失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredReadings = readings.filter((r) => {
    if (apartmentFilter !== 'ALL') {
      const aptId = apartments.find(
        (a) => a.name === r.room?.apartment?.name
      )?.id;
      if (aptId !== apartmentFilter) return false;
    }
    if (typeFilter !== 'ALL' && r.meterType !== typeFilter) return false;
    return true;
  });

  const columns = [
    {
      title: '房间',
      key: 'room',
      render: (_: unknown, record: (typeof readings)[0]) =>
        `${record.room?.apartment?.name || ''} ${record.room?.roomNo || ''}`,
    },
    {
      title: '表具类型',
      dataIndex: 'meterType',
      key: 'meterType',
      render: (v: string) => meterTypeLabels[v] || v,
    },
    {
      title: '读数',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '用量',
      dataIndex: 'usage',
      key: 'usage',
      render: (v?: number | string) => v ?? '-',
    },
    {
      title: '抄表日期',
      dataIndex: 'readingDate',
      key: 'readingDate',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (v: string) => sourceLabels[v] || v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusColors[v] || 'default'}>{statusLabels[v] || v}</Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (v?: string) => v || '-',
    },
  ];

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '抄表记录' }]} />

      <div className={styles.filterBar}>
        <Select
          style={{ width: 200 }}
          placeholder="按公寓筛选"
          value={apartmentFilter}
          onChange={setApartmentFilter}
          options={[
            { label: '全部公寓', value: 'ALL' },
            ...apartments.map((a) => ({
              label: a.name,
              value: a.id,
            })),
          ]}
        />
        <Select
          style={{ width: 160 }}
          placeholder="按类型筛选"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { label: '全部类型', value: 'ALL' },
            { label: '水表', value: 'WATER' },
            { label: '电表', value: 'POWER' },
            { label: '气表', value: 'GAS' },
          ]}
        />
      </div>

      <Spin spinning={loading}>
        {filteredReadings.length === 0 && !loading ? (
          <EmptyState
            title="暂无抄表记录"
            description="当前还没有任何抄表记录"
          />
        ) : (
          <Table
            dataSource={filteredReadings}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
          />
        )}
      </Spin>
    </div>
  );
}
