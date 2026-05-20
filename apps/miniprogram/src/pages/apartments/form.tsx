import { useState, useEffect, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input, DateField } from '../../components/ui';
import { optionalNumber, optionalText } from '../../utils/format';
import { emptyApartmentForm } from './constants';
import type { Apartment } from '../../types/domain';
import './index.scss';

export default function ApartmentFormPage() {
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission("apartment:manage");
  const { params } = useRouter();
  const editId = params.id;

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [form, setForm] = useState(emptyApartmentForm);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const loadApartments = async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Apartment[]>("/apartments", { organizationId: currentOrgId });
      setApartments(data);
    } catch (e) {
      // silent
    }
  };

  useDidShow(() => {
    loadApartments();
  });

  const apartment = apartments.find((a) => a.id === editId);

  useEffect(() => {
    if (editId && apartment && !initializedRef.current) {
      setForm({
        name: apartment.name,
        location: apartment.location,
        floors: String(apartment.floors || 1),
        landArea: apartment.landArea ? String(apartment.landArea) : "",
        totalArea: apartment.totalArea ? String(apartment.totalArea) : "",
        landlordName: apartment.landlordName ?? "",
        landlordPhone: apartment.landlordPhone ?? "",
        contractStart: apartment.contractStart ? apartment.contractStart.slice(0, 10) : "",
        contractEnd: apartment.contractEnd ? apartment.contractEnd.slice(0, 10) : "",
        rentAmount: apartment.rentAmount ? String(apartment.rentAmount) : ""
      });
      initializedRef.current = true;
    }
    if (!editId) {
      setForm(emptyApartmentForm);
      initializedRef.current = false;
    }
  }, [editId, apartment]);

  const updateForm = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSave = async () => {
    if (!currentOrgId) { Taro.showToast({ title: "请先选择组织", icon: "none" }); return; }
    if (!canManageApartment) { Taro.showToast({ title: "当前角色没有管理公寓权限", icon: "none" }); return; }
    if (!form.name.trim() || !form.location.trim()) { Taro.showToast({ title: "请填写公寓名称和位置", icon: "none" }); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        floors: Number(form.floors || 1),
        landArea: optionalNumber(form.landArea),
        totalArea: optionalNumber(form.totalArea),
        landlordName: optionalText(form.landlordName),
        landlordPhone: optionalText(form.landlordPhone),
        contractStart: optionalText(form.contractStart),
        contractEnd: optionalText(form.contractEnd),
        rentAmount: optionalNumber(form.rentAmount)
      };
      const path = editId ? `/apartments/${editId}` : "/apartments";
      const method = editId ? "PUT" : "POST";
      const saved = await apiClient<Apartment>(path, { method, body: payload, organizationId: currentOrgId });
      Taro.showToast({ title: editId ? "公寓信息已更新" : "公寓已创建", icon: "success" });

      if (editId) {
        Taro.navigateBack();
      } else {
        Taro.redirectTo({ url: `/pages/apartments/detail?id=${saved.id}` });
      }
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button className="page-back-button" variant="ghost" size="small" onClick={handleBack}>
          {editId ? "‹ 返回公寓详情" : "‹ 返回公寓列表"}
        </Button>
      </View>
      <Card title={editId ? "编辑公寓信息" : "新建公寓"}>
        <Input label="公寓名称" placeholder="例如 阳光公寓" value={form.name} onChange={(value) => updateForm("name", value)} />
        <Input label="位置" placeholder="请输入地址或片区" value={form.location} onChange={(value) => updateForm("location", value)} />
        <View className="form-grid">
          <Input label="楼层数" placeholder="例如 6" type="number" value={form.floors} onChange={(value) => updateForm("floors", value)} />
          <Input label="占地面积" placeholder="平方米" type="number" value={form.landArea} onChange={(value) => updateForm("landArea", value)} />
          <Input label="总面积" placeholder="平方米" type="number" value={form.totalArea} onChange={(value) => updateForm("totalArea", value)} />
        </View>
        <Text className="section-label">上游信息</Text>
        <Input label="房东姓名" placeholder="请输入房东姓名" value={form.landlordName} onChange={(value) => updateForm("landlordName", value)} />
        <Input label="联系方式" placeholder="请输入手机号" value={form.landlordPhone} onChange={(value) => updateForm("landlordPhone", value)} />
        <View className="form-grid">
          <DateField label="合同开始日期" placeholder="选择日期" value={form.contractStart} onChange={(value) => updateForm("contractStart", value)} />
          <DateField label="合同结束日期" placeholder="选择日期" value={form.contractEnd} onChange={(value) => updateForm("contractEnd", value)} />
          <Input label="上游租金" placeholder="每期金额" type="number" value={form.rentAmount} onChange={(value) => updateForm("rentAmount", value)} />
        </View>
        <Button loading={saving} disabled={saving} onClick={handleSave}>
          {editId ? "保存公寓信息" : "创建公寓"}
        </Button>
      </Card>
    </View>
  );
}
