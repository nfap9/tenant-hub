import { useState } from 'react';
import { View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input } from '../../components/ui';
import './index.scss';

export default function EditItemPage() {
  const { currentOrgId } = useAppSession();
  const { params } = useRouter();
  const billId = params.billId;
  const itemId = params.itemId;

  const [amount, setAmount] = useState(params.amount ?? "");
  const [note, setNote] = useState(params.note ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !billId || !itemId) return;
    setSubmitting(true);
    try {
      await apiClient(`/bills/${billId}/items/${itemId}`, {
        method: "PUT",
        organizationId: currentOrgId,
        body: { amount: Number(amount), note: note.trim() || undefined }
      });
      Taro.showToast({ title: "账单项目已更新", icon: "success" });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新失败", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button className="page-back-button" variant="ghost" size="small" onClick={handleBack}>‹ 返回</Button>
      </View>
      <Card title={params.name ? `修改 ${decodeURIComponent(params.name)}` : "修改账单项目"}>
        <Input label="金额" value={amount} onChange={setAmount} type="digit" placeholder="输入金额" />
        <Input label="备注" value={note} onChange={setNote} placeholder="备注（可选）" />
        <Button loading={submitting} disabled={submitting} onClick={handleSubmit}>保存</Button>
        <Button variant="ghost" size="small" onClick={handleBack}>取消</Button>
      </Card>
    </View>
  );
}
