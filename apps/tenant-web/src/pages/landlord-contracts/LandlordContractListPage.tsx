import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Tag, Select, Spin, message, Popconfirm } from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getLandlordContracts,
  deleteLandlordContract,
} from '@/api/landlordContracts';
import { getApartments } from '@/api/apartments';
import type { LandlordContract } from '@/api/landlordContracts';
import type { Apartment } from '@/types/domain';
import { money, day } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './LandlordContractListPage.module.scss';

export default function LandlordContractListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('apartment:manage');

  const [contracts, setContracts] = useState<LandlordContract[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [apartmentFilter, setApartmentFilter] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [cData, aData] = await Promise.all([
        getLandlordContracts(
          currentOrgId,
          apartmentFilter === 'ALL' ? undefined : apartmentFilter
        ),
        getApartments(currentOrgId),
      ]);
      setContracts(cData);
      setApartments(aData);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载房东合同列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, apartmentFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteLandlordContract(currentOrgId, id);
      message.success('删除成功');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contractNo',
      key: 'contractNo',
      render: (v?: string) => v || '-',
    },
    {
      title: '公寓',
      dataIndex: 'apartment',
      key: 'apartment',
      render: (v?: { name: string }) => v?.name || '-',
    },
    {
      title: '起止日期',
      key: 'period',
      render: (_: unknown, record: LandlordContract) =>
        `${day(record.startDate)} ~ ${day(record.endDate)}`,
    },
    {
      title: '月租金',
      dataIndex: 'rentAmount',
      key: 'rentAmount',
      render: (v: string | number) => money(v),
    },
    {
      title: '押金',
      dataIndex: 'depositAmount',
      key: 'depositAmount',
      render: (v: string | number) => money(v),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? '生效中' : '已结束'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: LandlordContract) => (
        <div className={styles.actions}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/landlord-contracts/${record.id}`)}
          >
            查看
          </Button>
          {canManage && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/landlord-contracts/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title="确认删除？"
              description="删除后不可恢复"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '房东合同' }]}
        actions={
          canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/landlord-contracts/new')}
            >
              新增合同
            </Button>
          )
        }
      />

      <div className={styles.filterBar}>
        <Select
          style={{ width: 240 }}
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
      </div>

      <Spin spinning={loading}>
        {contracts.length === 0 && !loading ? (
          <EmptyState
            title="暂无房东合同"
            description="当前还没有创建任何房东合同"
            action={
              canManage
                ? {
                    label: '新增合同',
                    onClick: () => navigate('/landlord-contracts/new'),
                  }
                : undefined
            }
          />
        ) : (
          <Table
            dataSource={contracts}
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
