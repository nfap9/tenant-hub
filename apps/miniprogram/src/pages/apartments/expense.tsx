import { useState } from 'react';
import { View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { createApartmentExpense } from '../../api/apartments';
import { Button, Card, Input, DateField } from '../../components/ui';
import { optionalText } from '../../utils/format';
import './index.scss';

export default function ExpensePage() {
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const { params } = useRouter();
  const apartmentId = params.apartmentId;

  const [expense, setExpense] = useState({
    name: '',
    amount: '',
    spentAt: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentOrgId || !apartmentId) return;
    if (!canManageApartment) {
      Taro.showToast({ title: '当前角色没有管理公寓权限', icon: 'none' });
      return;
    }
    if (!expense.name.trim() || !expense.amount.trim()) {
      Taro.showToast({ title: '请填写花费名称和金额', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      await createApartmentExpense(currentOrgId, apartmentId, {
        name: expense.name.trim(),
        amount: Number(expense.amount),
        spentAt: expense.spentAt,
        note: optionalText(expense.note),
      });
      Taro.showToast({ title: '经营花费已记录', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '记录花费失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    Taro.navigateBack();
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={handleBack}
        >
          ‹ 返回
        </Button>
      </View>
      <Card title="记录花费">
        <View className="form-grid">
          <Input
            label="花费名称"
            placeholder="例如 维修材料"
            value={expense.name}
            onChange={(value) => setExpense((old) => ({ ...old, name: value }))}
          />
          <Input
            label="金额"
            placeholder="请输入金额"
            type="number"
            value={expense.amount}
            onChange={(value) =>
              setExpense((old) => ({ ...old, amount: value }))
            }
          />
          <DateField
            label="日期"
            placeholder="选择日期"
            value={expense.spentAt}
            onChange={(value) =>
              setExpense((old) => ({ ...old, spentAt: value }))
            }
          />
        </View>
        <Input
          label="备注"
          placeholder="可选"
          value={expense.note}
          onChange={(value) => setExpense((old) => ({ ...old, note: value }))}
        />
        <Button loading={saving} disabled={saving} onClick={handleSave}>
          保存花费
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
