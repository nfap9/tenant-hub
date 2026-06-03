import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { getRooms } from '../../api/rooms';
import { updateLease } from '../../api/leases';
import { Button, Card, Input } from '../../components/ui';
import {
  selectableFeeTypes,
  feeTypeLabels,
  type LeaseFeeFormItem,
} from './constants';
import { buildLeaseFeesPayload } from './utils';
import type { Room, Lease } from '../../types/domain';
import './index.scss';

export default function LeaseEditPage() {
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const { params } = useRouter();
  const roomId = params.roomId;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState({
    rentAmount: '',
    depositAmount: '',
    waterUnitPrice: '0',
    powerUnitPrice: '0',
  });
  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const loadRooms = async () => {
    if (!currentOrgId) return;
    try {
      const data = await getRooms(currentOrgId);
      setRooms(data);
    } catch (e) {
      // silent
    }
  };

  useDidShow(() => {
    loadRooms();
  });

  const room = useMemo(
    () => rooms.find((r) => r.id === roomId),
    [rooms, roomId]
  );
  const lease = useMemo(
    () => room?.leases?.find((l) => l.status === 'ACTIVE'),
    [room]
  );

  useEffect(() => {
    if (lease && !initializedRef.current) {
      setForm({
        rentAmount: String(lease.rentAmount ?? ''),
        depositAmount: String(lease.depositAmount ?? ''),
        waterUnitPrice: String(lease.waterUnitPrice ?? 0),
        powerUnitPrice: String(lease.powerUnitPrice ?? 0),
      });
      const leaseFees = lease.fees ?? [];
      setFees(
        leaseFees.map((fee) => ({
          id: fee.id,
          type: fee.type,
          name: fee.name || feeTypeLabels[fee.type] || '其他费用',
          amount: String(fee.amount),
        }))
      );
      initializedRef.current = true;
    }
  }, [lease]);

  const updateForm = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));

  const addFee = async () => {
    const availableTypes = selectableFeeTypes.filter(
      (item) => !fees.some((fee) => fee.type === item.type)
    );
    if (availableTypes.length === 0) {
      Taro.showToast({ title: '费用项目已全部添加', icon: 'none' });
      return;
    }
    try {
      const result = await Taro.showActionSheet({
        itemList: availableTypes.map((item) => item.label),
      });
      const selectedType = availableTypes[result.tapIndex];
      if (!selectedType) return;
      setFees((old) => [
        ...old,
        {
          id: `${selectedType.type}-${Date.now()}`,
          type: selectedType.type,
          name: selectedType.label,
          amount: '',
        },
      ]);
    } catch {
      // cancelled
    }
  };

  const updateFeeAmount = (id: string, amount: string) => {
    setFees((old) =>
      old.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const removeFee = (id: string) => {
    setFees((old) => old.filter((item) => item.id !== id));
  };

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSave = async () => {
    if (!currentOrgId || !lease) return;
    if (!canManageLease) {
      Taro.showToast({ title: '当前角色没有管理租约权限', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      await updateLease(currentOrgId, lease.id, {
        rentAmount: Number(form.rentAmount),
        depositAmount: form.depositAmount
          ? Number(form.depositAmount)
          : undefined,
        waterUnitPrice: Number(form.waterUnitPrice),
        powerUnitPrice: Number(form.powerUnitPrice),
        fees: buildLeaseFeesPayload(fees),
      });
      Taro.showToast({ title: '租约信息已更新', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '更新租约失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
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
      <Card title="编辑租约">
        <View className="form-grid">
          <Input
            label="租金"
            placeholder="每期金额"
            type="number"
            value={form.rentAmount}
            onChange={(value) => updateForm('rentAmount', value)}
          />
          <Input
            label="押金"
            placeholder="请输入押金"
            type="number"
            value={form.depositAmount}
            onChange={(value) => updateForm('depositAmount', value)}
          />
        </View>
        <View className="form-grid">
          <Input
            label="水费单价"
            placeholder="元/吨"
            type="number"
            value={form.waterUnitPrice}
            onChange={(value) => updateForm('waterUnitPrice', value)}
          />
          <Input
            label="电费单价"
            placeholder="元/度"
            type="number"
            value={form.powerUnitPrice}
            onChange={(value) => updateForm('powerUnitPrice', value)}
          />
        </View>
        <Text className="field-label">费用项目</Text>
        <View className="fee-list">
          {fees.map((item) => (
            <View key={item.id} className="fee-row">
              <Text className="fee-row__type">{item.name}</Text>
              <Input
                label=""
                placeholder="价格"
                type="number"
                value={item.amount}
                onChange={(value) => updateFeeAmount(item.id, value)}
              />
              <Text className="danger-text" onClick={() => removeFee(item.id)}>
                删除
              </Text>
            </View>
          ))}
        </View>
        <Button variant="secondary" size="small" onClick={addFee}>
          添加费用
        </Button>
        <Button loading={saving} disabled={saving} onClick={handleSave}>
          保存修改
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
