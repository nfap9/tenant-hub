import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Button,
  Tabs,
  Input,
  Select,
  Space,
  Tag,
  Table,
  message,
  Modal,
  Popconfirm,
  DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getBills, deleteBill, voidBill, generateBills } from '@/api/bills';
import { getLeases } from '@/api/leases';
import { getRooms } from '@/api/rooms';
import { getApartments } from '@/api/apartments';
import { money, day } from '@/utils/format';
import {
  statusLabels,
  toneForBillStatus,
  billingMethodText,
  toneForBillBillingMethod,
} from './constants';
import { groupBills, sortBillGroupsForList, type BillGroup } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaymentDialog from '@/components/PaymentDialog';
import ReadingDrawer from './components/ReadingDrawer';
import UtilityReadingDrawer from './components/UtilityReadingDrawer';
import BillGroupItemsTable from './components/BillGroupItemsTable';
import type { Bill, BillStatus, Apartment, Room, Lease } from '@/types/domain';

export default function BillListPage() {
  const { currentOrgId } = useAppSession();
  const canManageBill = useHasPermission('bill:manage');
  const [activeTab, setActiveTab] = useState<BillStatus | 'ALL'>('UNPAID');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLeaseId, setPaymentLeaseId] = useState<string | undefined>();
  const [readingOpen, setReadingOpen] = useState(false);
  const [utilityBill, setUtilityBill] = useState<Bill | null>(null);
  const [billGroups, setBillGroups] = useState<BillGroup[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [apartmentFilter, setApartmentFilter] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateLeaseId, setGenerateLeaseId] = useState<string>('');
  const [generateDate, setGenerateDate] = useState<dayjs.Dayjs>(dayjs());
  const [leases, setLeases] = useState<Lease[]>([]);
  const [generating, setGenerating] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [allBills, nextRooms, apts] = await Promise.all([
        getBills(currentOrgId),
        getRooms(currentOrgId),
        getApartments(currentOrgId),
      ]);
      setBillGroups(groupBills(allBills));
      setRooms(nextRooms);
      setApartments(apts);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '账单加载失败');
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

  const filteredBillGroups = useMemo(() => {
    let result = billGroups;
    if (apartmentFilter) {
      result = result.filter(
        (g) => g.lease?.room?.apartmentId === apartmentFilter
      );
    }
    if (roomFilter) {
      result = result.filter((g) => g.lease?.room?.id === roomFilter);
    }
    return result;
  }, [billGroups, apartmentFilter, roomFilter]);

  const handleApartmentChange = (value: string) => {
    setApartmentFilter(value);
    setRoomFilter('');
  };

  const loadLeases = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const nextLeases = await getLeases(currentOrgId);
      setLeases(nextLeases.filter((l) => l.status === 'ACTIVE'));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '租约加载失败');
    }
  }, [currentOrgId]);

  const handleOpenGenerate = () => {
    setGenerateLeaseId('');
    setGenerateDate(dayjs());
    setGenerateOpen(true);
    loadLeases();
  };

  const handleGenerate = async () => {
    if (!currentOrgId) return;
    setGenerating(true);
    try {
      const result = await generateBills(currentOrgId, {
        ...(generateLeaseId ? { leaseId: generateLeaseId } : {}),
        today: generateDate.toISOString(),
      });
      if (result.billIds.length === 0) {
        message.info('暂无需要生成的新账单');
      } else {
        message.success(`已生成 ${result.billIds.length} 笔账单`);
      }
      setGenerateOpen(false);
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const displayGroups = useMemo(() => {
    let result = [...filteredBillGroups];
    if (activeTab !== 'ALL') {
      result = result.filter((g) => g.status === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.tenantName?.toLowerCase().includes(q) ||
          g.lease?.room?.roomNo?.toLowerCase().includes(q) ||
          g.tenantPhone?.includes(q)
      );
    }
    return sortBillGroupsForList(result);
  }, [filteredBillGroups, activeTab, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts = {
      ALL: filteredBillGroups.length,
      UNPAID: 0,
      PENDING: 0,
      PAID: 0,
      VOID: 0,
    };
    for (const group of filteredBillGroups) {
      if (group.status === 'UNPAID') counts.UNPAID += 1;
      if (group.status === 'PENDING') counts.PENDING += 1;
      if (group.status === 'PAID') counts.PAID += 1;
      if (group.status === 'VOID') counts.VOID += 1;
    }
    return counts;
  }, [filteredBillGroups]);

  const handleDeleteGroup = async (group: BillGroup) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: '删除账单组',
      content: `将尝试删除该组 ${group.bills.length} 笔账单，删除后不可恢复，是否确认？`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(
          group.bills.map((b) => deleteBill(currentOrgId, b.id))
        );
        const successCount = results.filter(
          (r) => r.status === 'fulfilled'
        ).length;
        const failures = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r) =>
            r.reason instanceof Error ? r.reason.message : '删除失败'
          );

        if (successCount === group.bills.length) {
          message.success('账单组已删除');
        } else if (successCount > 0) {
          message.warning(
            `已删除 ${successCount} 笔账单，${failures.length} 笔失败：${failures.join('；')}`
          );
        } else {
          message.error(`删除失败：${failures.join('；')}`);
          return;
        }
        await loadData();
      },
    });
  };

  const handleVoidGroup = async (group: BillGroup) => {
    if (!currentOrgId) return;
    try {
      await Promise.all(group.bills.map((b) => voidBill(currentOrgId, b.id)));
      message.success('账单组已作废');
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '作废失败');
    }
  };

  const renderTenantCell = (tenantName?: string, lease?: Bill['lease']) => (
    <div>
      <div>{tenantName || '-'}</div>
      <div style={{ fontSize: 12, color: 'var(--th-foreground-muted)' }}>
        {lease?.room?.apartment?.name ?? '公寓'} ·{' '}
        {lease?.room?.roomNo ?? '房间'}
      </div>
    </div>
  );

  const renderGroupActions = (group: BillGroup) => {
    const hasUnpaidBill = group.bills.some((b) => b.status === 'UNPAID');
    const hasPendingBill = group.bills.some((b) => b.status === 'PENDING');
    const isUtilityEditable = (b: Bill) =>
      (b.status === 'UNPAID' || b.status === 'PENDING') &&
      b.items?.some(
        (item) =>
          item.category === 'UTILITY' &&
          (item.name === '水费' || item.name === '电费')
      );
    const utilityBill = group.bills.find(isUtilityEditable);
    const hasUtilityNeedEntry = utilityBill?.items?.some(
      (item) =>
        item.category === 'UTILITY' &&
        (item.name === '水费' || item.name === '电费') &&
        Number(item.amount) === 0
    );
    const hasUtilityNeedUpdate = utilityBill?.items?.some(
      (item) =>
        item.category === 'UTILITY' &&
        (item.name === '水费' || item.name === '电费') &&
        Number(item.amount) > 0
    );
    const hasDeletableBill = group.bills.some(
      (b) =>
        b.status === 'UNPAID' ||
        b.status === 'PENDING' ||
        ((b.status === 'PAID' || b.status === 'VOID') &&
          Number(b.totalAmount) === 0)
    );

    return (
      <Space size="small" onClick={(e) => e.stopPropagation()}>
        {hasUnpaidBill && !hasPendingBill && (
          <Button
            type="link"
            size="small"
            onClick={() => {
              setPaymentLeaseId(group.leaseId);
              setPaymentOpen(true);
            }}
          >
            收款
          </Button>
        )}
        {hasUtilityNeedEntry && canManageBill && (
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              if (utilityBill) setUtilityBill(utilityBill);
            }}
          >
            录入水电
          </Button>
        )}
        {hasUtilityNeedUpdate && canManageBill && (
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              if (utilityBill) setUtilityBill(utilityBill);
            }}
          >
            更新水电
          </Button>
        )}
        {canManageBill && (
          <>
            {hasUnpaidBill && (
              <Popconfirm
                title="作废账单组"
                description="作废后所有账单将无法继续收款或恢复，确认作废？"
                onConfirm={() => handleVoidGroup(group)}
                okText="确认作废"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button type="link" size="small">
                  作废
                </Button>
              </Popconfirm>
            )}
            {hasDeletableBill && (
              <Button
                type="link"
                danger
                size="small"
                onClick={() => handleDeleteGroup(group)}
              >
                删除
              </Button>
            )}
          </>
        )}
      </Space>
    );
  };

  const groupColumns = useMemo(
    () => [
      {
        title: '租客/房间',
        width: 180,
        render: (_: unknown, group: BillGroup) =>
          renderTenantCell(group.tenantName, group.lease),
      },
      {
        title: '出账日期',
        width: 110,
        render: (_: unknown, group: BillGroup) => day(group.billingDate),
      },
      {
        title: '出账方式',
        width: 100,
        render: (_: unknown, group: BillGroup) => {
          const method = group.bills[0]?.billingMethod ?? 'AUTO';
          return (
            <Tag color={toneForBillBillingMethod(method)}>
              {billingMethodText[method]}
            </Tag>
          );
        },
      },
      {
        title: '到期时间',
        width: 110,
        render: (_: unknown, group: BillGroup) => day(group.dueDate),
      },
      {
        title: '金额',
        width: 120,
        align: 'right' as const,
        render: (_: unknown, group: BillGroup) => (
          <span>¥{money(group.totalAmount)}</span>
        ),
      },
      {
        title: '已付',
        width: 120,
        align: 'right' as const,
        render: (_: unknown, group: BillGroup) => (
          <span>¥{money(group.paidAmount)}</span>
        ),
      },
      {
        title: '状态',
        width: 100,
        render: (_: unknown, group: BillGroup) => (
          <Tag color={toneForBillStatus(group.status)}>
            {statusLabels[group.status]}
          </Tag>
        ),
      },
      {
        title: '操作',
        width: 260,
        fixed: 'right' as const,
        align: 'right' as const,
        render: (_: unknown, group: BillGroup) => renderGroupActions(group),
      },
    ],
    [canManageBill]
  );

  const expandedRowRender = (group: BillGroup) => (
    <BillGroupItemsTable group={group} />
  );

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '财务管理', path: '/biz/bills' },
          { label: '账单管理' },
        ]}
        actions={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setPaymentOpen(true)}
            >
              登记收款
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => setReadingOpen(true)}
            >
              录入读数
            </Button>
            <Button icon={<ThunderboltFilled />} onClick={handleOpenGenerate}>
              生成账单
            </Button>
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

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Select
          placeholder="选择公寓"
          value={apartmentFilter || undefined}
          onChange={handleApartmentChange}
          allowClear
          style={{ width: 200 }}
          options={apartments.map((a) => ({ label: a.name, value: a.id }))}
        />
        <Select
          placeholder="选择房间"
          value={roomFilter || undefined}
          onChange={setRoomFilter}
          allowClear
          style={{ width: 200 }}
          options={filteredRooms.map((r) => ({
            label: r.roomNo,
            value: r.id,
          }))}
        />
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as BillStatus | 'ALL');
          setSearchQuery('');
        }}
        items={(['ALL', 'UNPAID', 'PENDING', 'PAID', 'VOID'] as const).map(
          (status) => ({
            key: status,
            label: `${status === 'ALL' ? '全部' : statusLabels[status]} (${statusCounts[status]})`,
            children: (
              <div>
                <Input
                  placeholder="搜索租客姓名、房间号或手机号"
                  prefix={<SearchOutlined />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-16"
                  allowClear
                />
                {displayGroups.length === 0 ? (
                  <EmptyState
                    title={
                      status === 'ALL'
                        ? '暂无账单'
                        : `暂无${statusLabels[status]}账单`
                    }
                    description="请尝试调整搜索条件或筛选条件"
                  />
                ) : (
                  <Table
                    rowKey="id"
                    columns={groupColumns}
                    dataSource={displayGroups}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                    expandable={{ expandedRowRender }}
                  />
                )}
              </div>
            ),
          })
        )}
      />

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={loadData}
        defaultLeaseId={paymentLeaseId}
      />

      <ReadingDrawer
        open={readingOpen}
        onClose={() => setReadingOpen(false)}
        onSuccess={loadData}
      />

      <UtilityReadingDrawer
        open={Boolean(utilityBill)}
        bill={utilityBill}
        onClose={() => setUtilityBill(null)}
        onSuccess={loadData}
      />

      <Modal
        title="手动生成账单"
        open={generateOpen}
        onCancel={() => setGenerateOpen(false)}
        onOk={handleGenerate}
        okText="确认生成"
        cancelText="取消"
        confirmLoading={generating}
        destroyOnClose
      >
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <p style={{ marginBottom: 16, color: 'var(--th-foreground-muted)' }}>
            选择指定租约后，将只为该租约生成到截止日期为止的账单；
            不选择则为所有有效租约生成。水电数据不足时账单将标记为待出账，
            需录入读数后才能收款。
          </p>
          <Space direction="vertical" style={{ width: '100%' }}>
            <DatePicker
              style={{ width: '100%' }}
              value={generateDate}
              onChange={(date) => setGenerateDate(date || dayjs())}
              placeholder="选择账单截止日期"
              format="YYYY-MM-DD"
            />
            <Select
              style={{ width: '100%' }}
              placeholder="全部有效租约（可选）"
              value={generateLeaseId || undefined}
              onChange={setGenerateLeaseId}
              allowClear
              showSearch
              optionFilterProp="label"
              options={leases.map((l) => ({
                label: `${l.room?.apartment?.name ?? '公寓'} · ${
                  l.room?.roomNo ?? '房间'
                }${l.tenantName ? ` · ${l.tenantName}` : ''}`,
                value: l.id,
              }))}
            />
          </Space>
        </div>
      </Modal>
    </div>
  );
}
