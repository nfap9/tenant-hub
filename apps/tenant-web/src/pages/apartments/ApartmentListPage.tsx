import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Tag,
  Spin,
  message,
  Input,
  Select,
  Pagination,
} from 'antd';
import { PlusOutlined, HomeOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getApartments } from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import { money, day } from '@/utils/format';
import { apartmentMonthlyIncome, apartmentMonthlyExpense } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './ApartmentListPage.module.scss';
import clsx from 'clsx';

const statusLabels: Record<string, string> = {
  PLANNING: '规划中',
  RENOVATING: '装修中',
  PREPARING: '筹备中',
  ACTIVE: '运营中',
  SUSPENDED: '暂停中',
  CLOSED: '已关闭',
};

const statusColors: Record<string, string> = {
  PLANNING: 'default',
  RENOVATING: 'processing',
  PREPARING: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CLOSED: 'default',
};

const propertyTypeLabels: Record<string, string> = {
  RESIDENTIAL: '住宅',
  COMMERCIAL: '商业',
  INDUSTRIAL_RENOVATED: '工业改造',
  URBAN_VILLAGE: '城中村',
  OTHER: '其他',
};

export default function ApartmentListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('');

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getApartments(currentOrgId, {
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        propertyType: propertyTypeFilter || undefined,
      });
      setApartments(data.items);
      setTotal(data.total);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载公寓列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, page, pageSize, search, statusFilter, propertyTypeFilter]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '公寓管理' }]}
        actions={
          canManageApartment && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/apartments/new')}
            >
              新增公寓
            </Button>
          )
        }
      />

      <div className={styles.filterBar}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索公寓名称或地址"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          allowClear
          style={{ width: 260 }}
        />
        <Select
          placeholder="状态筛选"
          value={statusFilter || undefined}
          onChange={(v) => {
            setStatusFilter(v || '');
            setPage(1);
          }}
          allowClear
          style={{ width: 140 }}
          options={Object.entries(statusLabels).map(([value, label]) => ({
            label,
            value,
          }))}
        />
        <Select
          placeholder="物业类型"
          value={propertyTypeFilter || undefined}
          onChange={(v) => {
            setPropertyTypeFilter(v || '');
            setPage(1);
          }}
          allowClear
          style={{ width: 140 }}
          options={Object.entries(propertyTypeLabels).map(([value, label]) => ({
            label,
            value,
          }))}
        />
      </div>

      <Spin spinning={loading}>
        {apartments.length === 0 ? (
          <Card>
            <EmptyState
              title="暂无公寓数据"
              description="当前组织下还没有创建任何公寓，点击右上角按钮创建第一个公寓"
              action={
                canManageApartment
                  ? {
                      label: '新增公寓',
                      onClick: () => navigate('/apartments/new'),
                    }
                  : undefined
              }
            />
          </Card>
        ) : (
          <>
            <div className={styles.apartmentsGrid}>
              {apartments.map((apt) => {
                const roomCount = apt.rooms?.length ?? 0;
                const occupiedCount =
                  apt.rooms?.filter((r) => r.status === 'OCCUPIED').length ?? 0;
                const income = apartmentMonthlyIncome(apt);
                const expense = apartmentMonthlyExpense(apt);

                return (
                  <Card
                    key={apt.id}
                    hoverable
                    onClick={() => navigate(`/apartments/${apt.id}`)}
                    title={
                      <div className={styles.cardTitle}>
                        <HomeOutlined className="text-primary" />
                        <span className={styles.cardTitleText}>{apt.name}</span>
                      </div>
                    }
                  >
                    <div className={styles.tagRow}>
                      <Tag color="blue">{apt.location || '未填写地址'}</Tag>
                      <Tag className={styles.floorsTag}>{apt.floors} 层</Tag>
                      {apt.status && (
                        <Tag color={statusColors[apt.status] || 'default'}>
                          {statusLabels[apt.status] || apt.status}
                        </Tag>
                      )}
                      {apt.propertyType && (
                        <Tag>
                          {propertyTypeLabels[apt.propertyType] ||
                            apt.propertyType}
                        </Tag>
                      )}
                    </div>
                    <div className={styles.statsGrid}>
                      <div>
                        <div className={styles.statLabel}>房间数</div>
                        <div className={styles.statValue}>{roomCount} 间</div>
                      </div>
                      <div>
                        <div className={styles.statLabel}>在租</div>
                        <div className={styles.statValue}>
                          {occupiedCount} 间
                        </div>
                      </div>
                      <div>
                        <div className={styles.statLabel}>本月收入</div>
                        <div
                          className={clsx(
                            styles.statValue,
                            styles.statValuePrimary
                          )}
                        >
                          ¥{money(income)}
                        </div>
                      </div>
                      <div>
                        <div className={styles.statLabel}>本月支出</div>
                        <div
                          className={clsx(
                            styles.statValue,
                            styles.statValueDanger
                          )}
                        >
                          ¥{money(expense)}
                        </div>
                      </div>
                    </div>
                    {apt.contractStart && (
                      <div className={styles.contractPeriod}>
                        合同期：{day(apt.contractStart)} 至{' '}
                        {day(apt.contractEnd)}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            <div className={styles.pagination}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(p) => setPage(p)}
                showSizeChanger={false}
                showTotal={(t) => `共 ${t} 条`}
              />
            </div>
          </>
        )}
      </Spin>
    </div>
  );
}
