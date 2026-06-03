import { useState, useMemo, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { getRooms } from '../../api/rooms';
import { getSettlementPreview, terminateLease } from '../../api/leases';
import { Button, Card, Input, DateField } from '../../components/ui';
import { terminationLabels } from './constants';
import {
  computeSettlementPreview,
  defaultTerminationType,
  terminationResultText,
} from './utils';
import { money, today, numberValue, optionalText } from '../../utils/format';
import type { Room, Lease, TerminationType } from '../../types/domain';
import './index.scss';

export default function LeaseTerminatePage() {
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const { params } = useRouter();
  const roomId = params.roomId;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState({
    type: 'NEGOTIATED' as TerminationType,
    terminatedAt: today(),
    reason: '',
    depositDeductionAmount: '0',
    depositDeductionReason: '',
    rentAdjustmentAmount: '0',
    currentWater: '0',
    currentPower: '0',
    otherFeeAmount: '0',
    otherFeeReason: '',
  });
  const [previousReadings, setPreviousReadings] = useState({
    previousWater: 0,
    previousPower: 0,
  });

  const loadRooms = async () => {
    if (!currentOrgId) return;
    try {
      const data = await getRooms(currentOrgId);
      setRooms(data);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    loadRooms();
  }, [currentOrgId]);

  const room = useMemo(
    () => rooms.find((r) => r.id === roomId),
    [rooms, roomId]
  );
  const lease = useMemo(
    () => room?.leases?.find((l) => l.status === 'ACTIVE'),
    [room]
  );

  useEffect(() => {
    if (lease && currentOrgId) {
      const defaultType = defaultTerminationType(lease.endDate, today());
      setForm({
        type: defaultType,
        terminatedAt: today(),
        reason: '',
        depositDeductionAmount: '0',
        depositDeductionReason: '',
        rentAdjustmentAmount: '0',
        currentWater: '0',
        currentPower: '0',
        otherFeeAmount: '0',
        otherFeeReason: '',
      });
      getSettlementPreview(currentOrgId, lease.id, today())
        .then((data) =>
          setPreviousReadings({
            previousWater: Number(data.previousWater ?? 0),
            previousPower: Number(data.previousPower ?? 0),
          })
        )
        .catch((e) =>
          Taro.showToast({
            title: e instanceof Error ? e.message : '退租读数加载失败',
            icon: 'none',
          })
        );
    }
  }, [lease, currentOrgId]);

  const preview = useMemo(
    () =>
      lease
        ? computeSettlementPreview(lease, form, previousReadings)
        : {
            utility: 0,
            depositRefund: 0,
            receivable: 0,
            refundable: 0,
            net: 0,
          },
    [lease, form, previousReadings]
  );

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !lease) return;
    if (!canManageLease) {
      Taro.showToast({ title: '当前角色没有管理租约权限', icon: 'none' });
      return;
    }

    try {
      const settlement = await terminateLease(currentOrgId, lease.id, {
        type: form.type,
        reason: optionalText(form.reason),
        terminatedAt: form.terminatedAt,
        rentAdjustmentAmount: Number(form.rentAdjustmentAmount || 0),
        currentWater: Number(form.currentWater || 0),
        currentPower: Number(form.currentPower || 0),
        otherFeeAmount: Number(form.otherFeeAmount || 0),
        otherFeeReason: optionalText(form.otherFeeReason),
      });
      const net = settlement.netAmount;
      Taro.showToast({ title: terminationResultText(net), icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '退租失败',
        icon: 'none',
      });
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
      <Card title="合约终止">
        {lease ? (
          <>
            <View className="segment">
              {(['EXPIRED', 'NEGOTIATED', 'BREACH'] as TerminationType[]).map(
                (item) => (
                  <View
                    key={item}
                    className={`segment-item ${form.type === item ? 'segment-item--active' : ''}`}
                    onClick={() => setForm((old) => ({ ...old, type: item }))}
                  >
                    <Text
                      className={`segment-text ${form.type === item ? 'segment-text--active' : ''}`}
                    >
                      {terminationLabels[item]}
                    </Text>
                  </View>
                )
              )}
            </View>
            <DateField
              label="退租日期"
              placeholder="选择日期"
              value={form.terminatedAt}
              onChange={(value) =>
                setForm((old) => ({ ...old, terminatedAt: value }))
              }
            />
            <View className="detail-panel">
              <View className="detail-row">
                <Text className="text-muted">原押金</Text>
                <Text className="card-stat">¥{money(lease.depositAmount)}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">预计退押金</Text>
                <Text className="card-stat">
                  ¥{money(preview.depositRefund)}
                </Text>
              </View>
            </View>
            <View className="form-grid">
              <Input
                label="押金扣款"
                placeholder="请输入金额"
                type="number"
                value={form.depositDeductionAmount}
                onChange={(value) =>
                  setForm((old) => ({ ...old, depositDeductionAmount: value }))
                }
              />
              <Input
                label="房租退补"
                placeholder="正数补收，负数退款"
                type="number"
                value={form.rentAdjustmentAmount}
                onChange={(value) =>
                  setForm((old) => ({ ...old, rentAdjustmentAmount: value }))
                }
              />
            </View>
            <Input
              label="押金扣款原因"
              placeholder="可选"
              value={form.depositDeductionReason}
              onChange={(value) =>
                setForm((old) => ({ ...old, depositDeductionReason: value }))
              }
            />
            <View className="form-grid">
              <View>
                <Input
                  label="退租水表读数"
                  placeholder="当前读数"
                  type="number"
                  value={form.currentWater}
                  onChange={(value) =>
                    setForm((old) => ({ ...old, currentWater: value }))
                  }
                />
                <Text className="text-muted">
                  上次 {money(previousReadings.previousWater)}
                </Text>
              </View>
              <View>
                <Input
                  label="退租电表读数"
                  placeholder="当前读数"
                  type="number"
                  value={form.currentPower}
                  onChange={(value) =>
                    setForm((old) => ({ ...old, currentPower: value }))
                  }
                />
                <Text className="text-muted">
                  上次 {money(previousReadings.previousPower)}
                </Text>
              </View>
            </View>
            <View className="form-grid">
              <Input
                label="其他费用"
                placeholder="请输入金额"
                type="number"
                value={form.otherFeeAmount}
                onChange={(value) =>
                  setForm((old) => ({ ...old, otherFeeAmount: value }))
                }
              />
              <View>
                <Text className="field-label">预估水电费</Text>
                <Text className="card-stat">¥{money(preview.utility)}</Text>
              </View>
            </View>
            <Input
              label="其他费用说明"
              placeholder="可选"
              value={form.otherFeeReason}
              onChange={(value) =>
                setForm((old) => ({ ...old, otherFeeReason: value }))
              }
            />
            <View className="detail-panel">
              <View className="detail-row">
                <Text className="text-muted">应收</Text>
                <Text className="card-stat">¥{money(preview.receivable)}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">应退</Text>
                <Text className="card-stat">¥{money(preview.refundable)}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">结算结果</Text>
                <Text
                  className={preview.net >= 0 ? 'card-stat' : 'danger-text'}
                >
                  {preview.net > 0
                    ? `租客补交 ¥${money(preview.net)}`
                    : preview.net < 0
                      ? `退租客 ¥${money(Math.abs(preview.net))}`
                      : '结清'}
                </Text>
              </View>
            </View>
            <Input
              label="退租原因"
              placeholder="可选"
              value={form.reason}
              onChange={(value) =>
                setForm((old) => ({ ...old, reason: value }))
              }
            />
            {lease.isAutoRenewalPeriod ? (
              <Text className="text-muted">
                当前租约已进入自动续约期，到期后退房不默认视为违约。
              </Text>
            ) : null}
            <Button variant="danger" onClick={handleSubmit}>
              确认终止合约
            </Button>
            <Button variant="ghost" onClick={handleBack}>
              取消
            </Button>
          </>
        ) : (
          <Text className="text-muted">租约不存在或已结束</Text>
        )}
      </Card>
    </View>
  );
}
