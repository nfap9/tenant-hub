import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Tabs,
  Tag,
  Spin,
  message,
  Statistic,
  Row,
  Col,
} from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getDeposits, getDepositSummary } from '@/api/deposits';
import { money } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import type { Deposit, DepositStatus } from '@/types/domain';
import styles from './DepositsPage.module.scss';
import clsx from 'clsx';

const statusLabels: Record<DepositStatus, string> = {
  UNPAID: '未收取',
  PAID: '已收取',
  PARTIAL_REFUNDED: '部分退还',
  FULLY_REFUNDED: '已全额退还',
  DEDUCTED: '已扣款',
};

const statusColors: Record<DepositStatus, string> = {
  UNPAID: 'warning',
  PAID: 'success',
  PARTIAL_REFUNDED: 'processing',
  FULLY_REFUNDED: 'default',
  DEDUCTED: 'error',
};

const filters: (DepositStatus | 'ALL')[] = [
  'ALL',
  'UNPAID',
  'PAID',
  'PARTIAL_REFUNDED',
  'FULLY_REFUNDED',
  'DEDUCTED',
];

export default function DepositsPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [summary, setSummary] = useState<{
    totalAmount: string | number;
    paidAmount: string | number;
    heldAmount: string | number;
    count: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<DepositStatus | 'ALL'>('ALL');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [data, sum] = await Promise.all([
        getDeposits(currentOrgId, filter === 'ALL' ? undefined : filter),
        getDepositSummary(currentOrgId),
      ]);
      setDeposits(data);
      setSummary(sum);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载押金列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDeposits = useMemo(() => deposits, [deposits]);

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '押金管理' }]}
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
      />

      {summary && (
        <Row gutter={16} className="mb-16">
          <Col span={6}>
            <Card>
              <Statistic
                title="应收押金总额"
                value={money(summary.totalAmount)}
                prefix="¥"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="实收押金总额"
                value={money(summary.paidAmount)}
                prefix="¥"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="在押金额"
                value={money(summary.heldAmount)}
                prefix="¥"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="押金笔数" value={summary.count} />
            </Card>
          </Col>
        </Row>
      )}

      <Spin spinning={loading}>
        <Card>
          <Tabs
            activeKey={filter}
            onChange={(key) => setFilter(key as DepositStatus | 'ALL')}
            items={filters.map((f) => ({
              key: f,
              label:
                f === 'ALL' ? `全部 (${deposits.length})` : statusLabels[f],
            }))}
          />

          {filteredDeposits.length === 0 ? (
            <EmptyState
              title="暂无押金记录"
              description="签约租约后将自动生成押金记录"
            />
          ) : (
            <div className={styles.depositList}>
              {filteredDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className={clsx(styles.depositItem, 'flex-between')}
                >
                  <div className={styles.depositInfo}>
                    <div className={styles.depositTitle}>
                      <span className={styles.roomNo}>
                        {deposit.lease?.room?.roomNo || '-'}
                      </span>
                      <Tag color={statusColors[deposit.status]}>
                        {statusLabels[deposit.status]}
                      </Tag>
                    </div>
                    <div className={clsx(styles.depositMeta, 'text-muted')}>
                      {deposit.lease?.tenantName} · {deposit.lease?.tenantPhone}
                    </div>
                  </div>
                  <div className={styles.depositAmounts}>
                    <div className={styles.amountRow}>
                      <span className="text-muted">约定</span>
                      <span>¥{money(deposit.amount)}</span>
                    </div>
                    <div className={styles.amountRow}>
                      <span className="text-muted">已收</span>
                      <span>¥{money(deposit.paidAmount)}</span>
                    </div>
                    {(Number(deposit.refundedAmount) > 0 ||
                      Number(deposit.deductedAmount) > 0) && (
                      <div className={styles.amountRow}>
                        <span className="text-muted">已退/扣</span>
                        <span>
                          ¥{money(deposit.refundedAmount)} / ¥
                          {money(deposit.deductedAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={styles.depositActions}>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/deposits/${deposit.id}`)}
                    >
                      详情
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Spin>
    </div>
  );
}
