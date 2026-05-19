import { View, Text } from '@tarojs/components';
import { Button, Card, Input, DateField } from '../../../components/ui';
import type { emptyApartmentForm } from '../constants';

interface ApartmentFormProps {
  mode: "create" | "edit";
  form: typeof emptyApartmentForm;
  saving: boolean;
  onUpdateForm: (key: keyof typeof emptyApartmentForm, value: string) => void;
  onBack: () => void;
  onSave: () => void;
}

export function ApartmentForm({ mode, form, saving, onUpdateForm, onBack, onSave }: ApartmentFormProps) {
  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button className="page-back-button" variant="ghost" size="small" onClick={onBack}>
          {mode === "create" ? "‹ 返回公寓列表" : "‹ 返回公寓详情"}
        </Button>
      </View>
      <Card title={mode === "create" ? "新建公寓" : "编辑公寓信息"}>
        <Input label="公寓名称" placeholder="例如 阳光公寓" value={form.name} onChange={(value) => onUpdateForm("name", value)} />
        <Input label="位置" placeholder="请输入地址或片区" value={form.location} onChange={(value) => onUpdateForm("location", value)} />
        <View className="form-grid">
          <Input label="楼层数" placeholder="例如 6" type="number" value={form.floors} onChange={(value) => onUpdateForm("floors", value)} />
          <Input label="占地面积" placeholder="平方米" type="number" value={form.landArea} onChange={(value) => onUpdateForm("landArea", value)} />
          <Input label="总面积" placeholder="平方米" type="number" value={form.totalArea} onChange={(value) => onUpdateForm("totalArea", value)} />
        </View>
        <Text className="section-label">上游信息</Text>
        <Input label="房东姓名" placeholder="请输入房东姓名" value={form.landlordName} onChange={(value) => onUpdateForm("landlordName", value)} />
        <Input label="联系方式" placeholder="请输入手机号" value={form.landlordPhone} onChange={(value) => onUpdateForm("landlordPhone", value)} />
        <View className="form-grid">
          <DateField label="合同开始日期" placeholder="选择日期" value={form.contractStart} onChange={(value) => onUpdateForm("contractStart", value)} />
          <DateField label="合同结束日期" placeholder="选择日期" value={form.contractEnd} onChange={(value) => onUpdateForm("contractEnd", value)} />
          <Input label="上游租金" placeholder="每期金额" type="number" value={form.rentAmount} onChange={(value) => onUpdateForm("rentAmount", value)} />
        </View>
        <Button loading={saving} disabled={saving} onClick={onSave}>
          {mode === "create" ? "创建公寓" : "保存公寓信息"}
        </Button>
      </Card>
    </View>
  );
}
