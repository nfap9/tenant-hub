import { useState, useCallback } from 'react';
import { ScrollView, View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import {
  getTransactions,
  getTransactionSummary,
  getTransactionCategories,
  createTransaction,
  deleteTransaction,
} from '../../api/transactions';
import { Button, Card, Input, EmptyState, Badge } from '../../components/ui';
import { money } from '../../utils/format';
import type { Transaction, TransactionCategory } from '../../types/domain';
import './index.scss';

const typeLabels = {
  INCOME: '收入',
  EXPENSE: '支出',
};

const typeColors = {
  INCOME: '#22C55E',
  EXPENSE: '#DC2626',
};

export default function TransactionsPage() {
  const { currentOrgId } = useAppSession();
  const canManageBill = useHasPermission('bill:manage');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<{
    totalIncome: string | number;
    totalExpense: string | number;
    netAmount: string | number;
  } | null>(null);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>(
    'ALL'
  );

  // 录入表单
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState('现金');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [data, sum, cats] = await Promise.all([
        getTransactions(currentOrgId, {
          type: filterType === 'ALL' ? undefined : filterType,
        }),
        getTransactionSummary(currentOrgId),
        getTransactionCategories(currentOrgId),
      ]);
      setTransactions(data.items);
      setSummary(sum);
      setCategories(cats);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, filterType]);

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh());
  });

  useState(() => {
    loadData();
  });

  const handleCreate = async () => {
    if (!currentOrgId) return;
    if (!formCategory || !formAmount || !formMethod) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await createTransaction(currentOrgId, {
        type: formType,
        category: formCategory,
        amount: Number(formAmount),
        method: formMethod,
        note: formNote.trim() || undefined,
      });
      Taro.showToast({ title: '创建成功', icon: 'success' });
      setShowForm(false);
      setFormAmount('');
      setFormNote('');
      loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '创建失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    const res = await Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条收支记录吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
    });
    if (!res.confirm) return;
    try {
      await deleteTransaction(currentOrgId, id);
      Taro.showToast({ title: '删除成功', icon: 'success' });
      loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '删除失败',
        icon: 'none',
      });
    }
  };

  const filteredCategories = categories.filter((c) => c.type === formType);

  return (
    <ScrollView className="page-container" scrollY>
      {summary && (
        <View className="transaction-summary">
          <View className="summary-card">
            <Text className="summary-label">总收入</Text>
            <Text className="summary-value" style={{ color: '#22C55E' }}>
              +¥{money(summary.totalIncome)}
            </Text>
          </View>
          <View className="summary-card">
            <Text className="summary-label">总支出</Text>
            <Text className="summary-value" style={{ color: '#DC2626' }}>
              -¥{money(summary.totalExpense)}
            </Text>
          </View>
          <View className="summary-card">
            <Text className="summary-label">净额</Text>
            <Text
              className="summary-value"
              style={{
                color: Number(summary.netAmount) >= 0 ? '#22C55E' : '#DC2626',
              }}
            >
              ¥{money(summary.netAmount)}
            </Text>
          </View>
        </View>
      )}

      <View className="segment">
        {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
          <View
            key={t}
            className={`segment-item ${filterType === t ? 'segment-item--active' : ''}`}
            onClick={() => setFilterType(t)}
          >
            <Text
              className={`segment-text ${filterType === t ? 'segment-text--active' : ''}`}
            >
              {t === 'ALL' ? '全部' : typeLabels[t]}
            </Text>
          </View>
        ))}
      </View>

      {canManageBill && (
        <Button
          variant="secondary"
          size="small"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '取消录入' : '手动录入'}
        </Button>
      )}

      {showForm && canManageBill && (
        <Card title="手动录入">
          <View className="detail-panel">
            <View className="segment">
              {(['INCOME', 'EXPENSE'] as const).map((t) => (
                <View
                  key={t}
                  className={`segment-item ${formType === t ? 'segment-item--active' : ''}`}
                  onClick={() => {
                    setFormType(t);
                    setFormCategory('');
                  }}
                >
                  <Text
                    className={`segment-text ${formType === t ? 'segment-text--active' : ''}`}
                  >
                    {typeLabels[t]}
                  </Text>
                </View>
              ))}
            </View>

            <View className="form-group">
              <Text className="field-label">科目</Text>
              <View className="tag-group">
                {filteredCategories.map((cat) => (
                  <View
                    key={cat.key}
                    className={`tag ${formCategory === cat.key ? 'tag--active' : ''}`}
                    onClick={() => setFormCategory(cat.key)}
                  >
                    <Text>{cat.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Input
              label="金额"
              value={formAmount}
              onChange={setFormAmount}
              type="digit"
              placeholder="请输入金额"
            />
            <Input
              label="支付方式"
              value={formMethod}
              onChange={setFormMethod}
              placeholder="例如 现金、微信转账"
            />
            <Input
              label="备注"
              value={formNote}
              onChange={setFormNote}
              placeholder="可选"
            />
            <Button
              loading={submitting}
              disabled={submitting}
              onClick={handleCreate}
            >
              确认录入
            </Button>
          </View>
        </Card>
      )}

      <Card title={`收支记录 (${transactions.length})`}>
        {transactions.length === 0 ? (
          <EmptyState emoji="📊" title="暂无收支记录" />
        ) : (
          <View className="transaction-list">
            {transactions.map((item) => {
              const cat = categories.find((c) => c.key === item.category);
              return (
                <View key={item.id} className="transaction-item">
                  <View className="transaction-header">
                    <View>
                      <Text className="transaction-category">
                        {cat?.label || item.category}
                      </Text>
                      <Text className="text-muted">
                        {item.occurredAt.slice(0, 16).replace('T', ' ')} ·{' '}
                        {item.method}
                      </Text>
                    </View>
                    <Text
                      className="transaction-amount"
                      style={{
                        color: typeColors[item.type],
                      }}
                    >
                      {item.type === 'INCOME' ? '+' : '-'}¥{money(item.amount)}
                    </Text>
                  </View>
                  {item.description && (
                    <Text className="text-muted">{item.description}</Text>
                  )}
                  {item.sourceType === 'MANUAL' && canManageBill && (
                    <Text
                      className="danger-text"
                      onClick={() => handleDelete(item.id)}
                    >
                      删除
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}
