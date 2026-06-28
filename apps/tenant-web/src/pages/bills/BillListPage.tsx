import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Tabs,
  Input,
  Select,
  Space,
  Tag,
  Table,
  Tooltip,
  message,
  Modal,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  DownloadOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getBills,
  getBillsByStatus,
  deleteBill,
  voidBill,
  refundBill,
  retryBillBilling,
  generateBills,
} from '@/api/bills';
import { getRooms } from '@/api/rooms';
import { getApartments } from '@/api/apartments';
import { money, day } from '@/utils/format';
import { statusLabels, toneForBillStatus, billItemTypeText } from './constants';
import {
  groupBills,
  sortBillGroupsForList,
  getGroupItems,
  type BillGroup,
} from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaymentDialog from '@/components/PaymentDialog';
import UtilityExportModal from './components/UtilityExportModal';
import UtilityModal from './components/UtilityModal';
import ReadingDrawer from './components/ReadingDrawer';
import type {
  Bill,
  BillStatus,
  Apartment,
  Room,
  BillItem,
} from '@/types/domain';

export default function BillListPage() {
  const { currentOrgId } = useAppSession();
  const canManageBill = useHasPermission('bill:manage');
  const navigate = useNavigate();
  const [tab, setTab] = useState<'unpaid' | 'pending' | 'all'>('unpaid');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLeaseId, setPaymentLeaseId] = useState<string | undefined>();
  const [utilityExportOpen, setUtilityExportOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [utilityBillId, setUtilityBillId] = useState<string | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);
  const [billGroups, setBillGroups] = useState<BillGroup[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [apartmentFilter, setApartmentFilter] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [allBills, billingBills, nextRooms, apts] = await Promise.all([
        getBills(currentOrgId),
        getBillsByStatus(currentOrgId, 'BILLING'),
        getRooms(currentOrgId),
        getApartments(currentOrgId),
      ]);
      const postpaidReviewBills = billingBills.filter(
        (bill) => bill.mode === 'POSTPAID'
      );
      setBillGroups(groupBills(allBills));
      setReviewBills(postpaidReviewBills);
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

  const filteredReviewBills = useMemo(() => {
    let result = reviewBills;
    if (apartmentFilter) {
      result = result.filter(
        (b) => b.lease?.room?.apartmentId === apartmentFilter
      );
    }
    if (roomFilter) {
      result = result.filter((b) => b.lease?.room?.id === roomFilter);
    }
    return result;
  }, [reviewBills, apartmentFilter, roomFilter]);

  const handleApartmentChange = (value: string) => {
    setApartmentFilter(value);
    setRoomFilter('');
  };

  const unpaidGroups = useMemo(
    () => filteredBillGroups.filter((g) => g.status === 'UNPAID'),
    [filteredBillGroups]
  );
  const filteredAllGroups = useMemo(() => {
    let result = [...filteredBillGroups];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.tenantName?.toLowerCase().includes(q) ||
          g.lease?.room?.roomNo?.toLowerCase().includes(q) ||
          g.tenantPhone?.includes(q)
      );
    }
    if (statusFilter) result = result.filter((g) => g.status === statusFilter);
    return sortBillGroupsForList(result);
  }, [filteredBillGroups, searchQuery, statusFilter]);

  const handleDeleteGroup = async (group: BillGroup) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: '删除账单组',
      content: `将删除该组 ${group.bills.length} 笔账单，删除后不可恢复，是否确认？`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await Promise.all(
            group.bills.map((b) => deleteBill(currentOrgId, b.id))
          );
          message.success('账单组已删除');
          await loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        }
      },
    });
  };

  const handleRetry = async (bill: Bill) => {
    if (!currentOrgId) return;
    try {
      await retryBillBilling(currentOrgId, bill.id);
      message.success('已重新尝试出账');
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '重试失败');
    }
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

  const handleRefundGroup = async (group: BillGroup) => {
    if (!currentOrgId) return;
    const netPaid = Number(group.paidAmount) || 0;
    const method = window.prompt(
      `退款金额（已付 ¥${netPaid.toFixed(2)}）/ 退款方式：`,
      `${netPaid.toFixed(2)} 现金`
    );
    if (!method) return;
    const [amountStr, ...methodParts] = method.split(' ');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      message.warning('请输入有效退款金额');
      return;
    }
    try {
      await Promise.all(
        group.bills
          .filter((b) => b.status === 'PAID')
          .map((b) =>
            refundBill(currentOrgId, b.id, {
              amount,
              method: methodParts.join(' ') || '退款',
            })
          )
      );
      message.success('退款已登记');
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '退款失败');
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

  const renderItemTags = (items?: BillItem[]) => (
    <Space size={[4, 4]} wrap>
      {(items ?? []).map((item, index) => (
        <Tooltip key={index} title={`${item.name} ¥${money(item.amount)}`}>
          <Tag>{billItemTypeText(item.type)}</Tag>
        </Tooltip>
      ))}
    </Space>
  );

  const renderPeriods = (items?: BillItem[]) => {
    const set = new Set<string>();
    (items ?? []).forEach((item) => {
      set.add(`${day(item.periodStart)} ~ ${day(item.periodEnd)}`);
    });
    const periods = Array.from(set);
    if (periods.length === 0) return '-';
    return (
      <Tooltip title={periods.join(' / ')}>
        <span>
          {periods[0]}
          {periods.length > 1 ? ` +${periods.length - 1}` : ''}
        </span>
      </Tooltip>
    );
  };

  const renderGroupActions = (group: BillGroup, manage: boolean) => (
    <Space size="small" onClick={(e) => e.stopPropagation()}>
      <Button
        type="link"
        size="small"
        onClick={() => navigate(`/bills/monthly/${group.id}`)}
      >
        查看详情
      </Button>
      {group.status === 'UNPAID' && (
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
      {manage &&
        group.status !== 'PAID' &&
        group.status !== 'VOID' &&
        group.status !== 'REFUNDED' &&
        canManageBill && (
          <>
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
            <Button
              type="link"
              danger
              size="small"
              onClick={() => handleDeleteGroup(group)}
            >
              删除
            </Button>
          </>
        )}
      {manage && group.status === 'PAID' && canManageBill && (
        <Button
          type="link"
          size="small"
          onClick={() => handleRefundGroup(group)}
        >
          退款
        </Button>
      )}
    </Space>
  );

  const groupColumns = useMemo(
    () => [
      {
        title: '租客/房间',
        width: 180,
        render: (_: unknown, group: BillGroup) =>
          renderTenantCell(group.tenantName, group.lease),
      },
      {
        title: '费用项目',
        ellipsis: true,
        render: (_: unknown, group: BillGroup) =>
          renderItemTags(getGroupItems(group)),
      },
      {
        title: '账期',
        width: 180,
        render: (_: unknown, group: BillGroup) =>
          renderPeriods(getGroupItems(group)),
      },
      {
        title: '金额',
        width: 150,
        align: 'right' as const,
        render: (_: unknown, group: BillGroup) => (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600 }}>¥{money(group.totalAmount)}</div>
            <div style={{ fontSize: 12, color: 'var(--th-foreground-muted)' }}>
              已收 ¥{money(group.paidAmount)} / 剩余 ¥
              {money(group.totalAmount - group.paidAmount)}
            </div>
          </div>
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
        title: '到期日',
        width: 110,
        render: (_: unknown, group: BillGroup) => day(group.dueDate),
      },
      {
        title: '操作',
        width: 260,
        fixed: 'right' as const,
        align: 'right' as const,
        render: (_: unknown, group: BillGroup) =>
          renderGroupActions(group, tab === 'all'),
      },
    ],
    [canManageBill, tab]
  );

  const renderPendingActions = (bill: Bill) => (
    <Space size="small">
      <Button type="link" size="small" onClick={() => handleRetry(bill)}>
        重新出账
      </Button>
      <Button
        type="link"
        size="small"
        onClick={() => {
          setUtilityBillId(bill.id);
          setUtilityOpen(true);
        }}
      >
        录入本期水电
      </Button>
    </Space>
  );

  const pendingColumns = useMemo(
    () => [
      {
        title: '租客/房间',
        width: 180,
        render: (_: unknown, bill: Bill) =>
          renderTenantCell(bill.lease?.tenantName, bill.lease),
      },
      {
        title: '费用项目',
        ellipsis: true,
        render: (_: unknown, bill: Bill) => renderItemTags(bill.items),
      },
      {
        title: '账期',
        width: 180,
        render: (_: unknown, bill: Bill) => renderPeriods(bill.items),
      },
      {
        title: '失败原因',
        ellipsis: true,
        render: (_: unknown, bill: Bill) => bill.failureReason || '-',
      },
      {
        title: '操作',
        width: 180,
        fixed: 'right' as const,
        align: 'right' as const,
        render: (_: unknown, bill: Bill) => renderPendingActions(bill),
      },
    ],
    []
  );

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '财务管理', path: '/bills' },
          { label: '账单管理' },
        ]}
        actions={
          <Space>
            {tab === 'unpaid' && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setPaymentOpen(true)}
              >
                登记收款
              </Button>
            )}
            {tab === 'pending' && (
              <>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={() => setReadingOpen(true)}
                >
                  录入读数
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => setUtilityExportOpen(true)}
                >
                  导出
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => navigate('/bills/utility-import')}
                >
                  导入
                </Button>
              </>
            )}
            <Button
              icon={<ThunderboltFilled />}
              onClick={async () => {
                if (!currentOrgId) return;
                Modal.confirm({
                  title: '手动生成账单',
                  content:
                    '将为所有有效租约生成到当前日期为止的账单，是否继续？',
                  okText: '确认生成',
                  onOk: async () => {
                    try {
                      const result = await generateBills(currentOrgId);
                      message.success(`已生成 ${result.billIds.length} 笔账单`);
                      await loadData();
                    } catch (e) {
                      message.error(
                        e instanceof Error ? e.message : '生成失败'
                      );
                    }
                  },
                });
              }}
            >
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
        activeKey={tab}
        onChange={(key) => {
          setTab(key as 'unpaid' | 'pending' | 'all');
          setSearchQuery('');
          setStatusFilter('');
        }}
        items={[
          {
            key: 'unpaid',
            label: `待支付 (${unpaidGroups.length})`,
            children:
              unpaidGroups.length === 0 ? (
                <EmptyState
                  title="暂无待支付账单"
                  description="当前没有待支付的账单记录"
                />
              ) : (
                <Table
                  rowKey="id"
                  columns={groupColumns}
                  dataSource={sortBillGroupsForList(unpaidGroups)}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 'max-content' }}
                />
              ),
          },
          {
            key: 'pending',
            label: `待处理 (${filteredReviewBills.length})`,
            children:
              filteredReviewBills.length === 0 ? (
                <EmptyState
                  title="暂无待处理账单"
                  description="所有账单均已处理完毕"
                />
              ) : (
                <Table
                  rowKey="id"
                  columns={pendingColumns}
                  dataSource={filteredReviewBills}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 'max-content' }}
                />
              ),
          },
          {
            key: 'all',
            label: `全部 (${filteredBillGroups.length})`,
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
                <Space wrap className="mb-16">
                  {(['', 'UNPAID', 'PAID', 'VOID', 'REFUNDED'] as const).map(
                    (status) => (
                      <Button
                        key={status || 'all'}
                        type={statusFilter === status ? 'primary' : 'default'}
                        size="small"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status ? statusLabels[status] : '全部状态'}
                      </Button>
                    )
                  )}
                </Space>
                {filteredAllGroups.length === 0 ? (
                  <EmptyState
                    title="未找到账单"
                    description="请尝试调整搜索条件或筛选状态"
                  />
                ) : (
                  <Table
                    rowKey="id"
                    columns={groupColumns}
                    dataSource={filteredAllGroups}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={loadData}
        defaultLeaseId={paymentLeaseId}
      />

      <UtilityExportModal
        open={utilityExportOpen}
        onClose={() => setUtilityExportOpen(false)}
      />

      <UtilityModal
        open={utilityOpen}
        billId={utilityBillId}
        onClose={() => {
          setUtilityBillId(null);
          setUtilityOpen(false);
        }}
        onSuccess={loadData}
      />

      <ReadingDrawer
        open={readingOpen}
        onClose={() => setReadingOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
