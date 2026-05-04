import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Apartment, ApartmentFeeItem } from "../../types";

type Props = {
  token: string;
  organizationId?: string;
  setNotice: (notice: string) => void;
};

type ApartmentForm = {
  name: string;
  location: string;
  floors: string;
  landArea: string;
  totalArea: string;
  landlordName: string;
  landlordPhone: string;
  contractStart: string;
  contractEnd: string;
  rentAmount: string;
  waterUnitPrice: string;
  powerUnitPrice: string;
};

const emptyApartmentForm: ApartmentForm = {
  name: "",
  location: "",
  floors: "",
  landArea: "",
  totalArea: "",
  landlordName: "",
  landlordPhone: "",
  contractStart: "",
  contractEnd: "",
  rentAmount: "",
  waterUnitPrice: "0",
  powerUnitPrice: "0"
};

const money = (value?: string | number) => Number(value ?? 0).toFixed(2);
const optionalNumber = (value: string) => (value.trim() ? Number(value) : undefined);
const optionalText = (value: string) => (value.trim() ? value.trim() : undefined);
const apiOptions = (organizationId: string, method = "GET", body?: unknown): RequestInit => ({
  method,
  headers: { "x-organization-id": organizationId },
  ...(body ? { body: JSON.stringify(body) } : {})
});

const toDateInput = (value?: string) => (value ? value.slice(0, 10) : "");
const contractText = (apartment: Apartment) => {
  const start = toDateInput(apartment.contractStart);
  const end = toDateInput(apartment.contractEnd);
  if (!start && !end) return "未维护";
  return `${start || "未填"} 至 ${end || "未填"}`;
};

export default function ApartmentsScreen({ token, organizationId, setNotice }: Props) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<"list" | "detail" | "edit" | "create">("list");
  const [activeDetailForm, setActiveDetailForm] = useState<"expense" | "fee" | "rooms">();
  const [form, setForm] = useState<ApartmentForm>(emptyApartmentForm);
  const [expense, setExpense] = useState({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
  const [fee, setFee] = useState({ name: "", spec: "", amount: "" });
  const [batchRooms, setBatchRooms] = useState("101,102,103\n201,202,203");
  const [batchLayout, setBatchLayout] = useState("一室一卫");
  const [batchArea, setBatchArea] = useState("");
  const [batchFacilities, setBatchFacilities] = useState("床,衣柜,空调,热水器");
  const [saving, setSaving] = useState(false);

  const selectedApartment = useMemo(() => apartments.find((item) => item.id === selectedId), [apartments, selectedId]);

  const loadApartments = useCallback(async () => {
    if (!organizationId) return;
    const data = await mobileApi<Apartment[]>("/apartments", token, apiOptions(organizationId));
    setApartments(data);
    setSelectedId((old) => (old && data.some((item) => item.id === old) ? old : undefined));
  }, [organizationId, token]);

  useEffect(() => {
    loadApartments().catch((error) => setNotice(error.message));
  }, [loadApartments, setNotice]);

  useEffect(() => {
    if (!selectedApartment) {
      setForm(emptyApartmentForm);
      return;
    }
    setForm({
      name: selectedApartment.name,
      location: selectedApartment.location,
      floors: String(selectedApartment.floors),
      landArea: selectedApartment.landArea ? String(selectedApartment.landArea) : "",
      totalArea: selectedApartment.totalArea ? String(selectedApartment.totalArea) : "",
      landlordName: selectedApartment.landlordName ?? "",
      landlordPhone: selectedApartment.landlordPhone ?? "",
      contractStart: toDateInput(selectedApartment.contractStart),
      contractEnd: toDateInput(selectedApartment.contractEnd),
      rentAmount: selectedApartment.rentAmount ? String(selectedApartment.rentAmount) : "",
      waterUnitPrice: String(selectedApartment.waterUnitPrice ?? 0),
      powerUnitPrice: String(selectedApartment.powerUnitPrice ?? 0)
    });
  }, [selectedApartment]);

  const updateForm = (key: keyof ApartmentForm, value: string) => setForm((old) => ({ ...old, [key]: value }));

  const saveApartment = async () => {
    if (!organizationId) return setNotice("请先选择组织");
    if (!form.name.trim() || !form.location.trim()) return setNotice("请填写公寓名称和位置");
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
        rentAmount: optionalNumber(form.rentAmount),
        waterUnitPrice: Number(form.waterUnitPrice || 0),
        powerUnitPrice: Number(form.powerUnitPrice || 0)
      };
      const path = selectedApartment ? `/apartments/${selectedApartment.id}` : "/apartments";
      const method = selectedApartment ? "PUT" : "POST";
      const saved = await mobileApi<Apartment>(path, token, apiOptions(organizationId, method, payload));
      setNotice(selectedApartment ? "公寓信息已更新" : "公寓已创建");
      setSelectedId(saved.id);
      await loadApartments();
      setMode("detail");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const resetForCreate = () => {
    setSelectedId(undefined);
    setForm(emptyApartmentForm);
    setMode("create");
  };

  const openDetail = (apartmentId: string) => {
    setSelectedId(apartmentId);
    setActiveDetailForm(undefined);
    setMode("detail");
  };

  const backToList = () => {
    setSelectedId(undefined);
    setActiveDetailForm(undefined);
    setMode("list");
  };

  const addExpense = async () => {
    if (!organizationId || !selectedApartment) return;
    if (!expense.name.trim() || !expense.amount.trim()) return setNotice("请填写花费名称和金额");
    await mobileApi(`/apartments/${selectedApartment.id}/expenses`, token, apiOptions(organizationId, "POST", {
      name: expense.name.trim(),
      amount: Number(expense.amount),
      spentAt: expense.spentAt,
      note: optionalText(expense.note)
    }));
    setExpense({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
    setActiveDetailForm(undefined);
    setNotice("经营花费已记录");
    await loadApartments();
  };

  const addFee = async () => {
    if (!organizationId || !selectedApartment) return;
    if (!fee.name.trim() || !fee.amount.trim()) return setNotice("请填写费用名称和金额");
    await mobileApi(`/apartments/${selectedApartment.id}/fees`, token, apiOptions(organizationId, "POST", {
      name: fee.name.trim(),
      spec: optionalText(fee.spec),
      amount: Number(fee.amount),
      enabled: true
    }));
    setFee({ name: "", spec: "", amount: "" });
    setActiveDetailForm(undefined);
    setNotice("费用项目已添加");
    await loadApartments();
  };

  const toggleFee = async (item: ApartmentFeeItem) => {
    if (!organizationId) return;
    await mobileApi(`/apartments/fees/${item.id}`, token, apiOptions(organizationId, "PUT", { enabled: !item.enabled }));
    await loadApartments();
  };

  const addBatchRooms = async () => {
    if (!organizationId || !selectedApartment) return;
    const roomNos = batchRooms.split(/[\n,，\s]+/).map((item) => item.trim()).filter(Boolean);
    if (roomNos.length === 0) return setNotice("请输入房间号");
    const facilities = batchFacilities.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    await mobileApi(`/apartments/${selectedApartment.id}/rooms/batch`, token, apiOptions(organizationId, "POST", {
      rooms: roomNos.map((roomNo) => ({
        roomNo,
        layout: batchLayout.trim() || "未配置",
        area: optionalNumber(batchArea),
        facilities
      }))
    }));
    setActiveDetailForm(undefined);
    setNotice(`已提交 ${roomNos.length} 间房间，重复房间会自动跳过`);
    await loadApartments();
  };

  if (!organizationId) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>请先选择组织</Text>
      </View>
    );
  }

  return (
    <>
      {mode === "list" ? (
        <View style={styles.panel}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>公寓列表</Text>
            <TouchableOpacity style={styles.smallButton} onPress={resetForCreate}>
              <Text style={styles.smallButtonText}>新建</Text>
            </TouchableOpacity>
          </View>
          {apartments.length === 0 ? <Text style={styles.emptyText}>暂无公寓，点击新建开始维护</Text> : null}
          {apartments.map((item) => {
            const rooms = item.rooms ?? [];
            const occupied = rooms.filter((room) => room.status === "OCCUPIED").length;
            return (
              <TouchableOpacity key={item.id} style={styles.apartmentListCard} onPress={() => openDetail(item.id)}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.muted}>{item.location}</Text>
                  </View>
                  <Text style={styles.cardStat}>{occupied}/{rooms.length} 间在租</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.muted}>{item.floors} 层 · 总面积 {item.totalArea ?? "未填"}㎡</Text>
                  <Text style={styles.muted}>水 {money(item.waterUnitPrice)} / 电 {money(item.powerUnitPrice)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {(mode === "edit" || mode === "create") ? (
      <>
        <View style={styles.subPageHeader}>
          <TouchableOpacity style={styles.backButton} onPress={mode === "create" ? backToList : () => setMode("detail")}>
            <Text style={styles.backButtonText}>{mode === "create" ? "返回公寓列表" : "返回公寓详情"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{mode === "create" ? "新建公寓" : "编辑公寓信息"}</Text>
          <TextInput style={styles.input} placeholder="公寓名称" value={form.name} onChangeText={(value) => updateForm("name", value)} />
          <TextInput style={styles.input} placeholder="位置" value={form.location} onChangeText={(value) => updateForm("location", value)} />
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>楼层数</Text>
              <TextInput style={styles.input} placeholder="例如 6" value={form.floors} keyboardType="numeric" onChangeText={(value) => updateForm("floors", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>占地面积</Text>
              <TextInput style={styles.input} placeholder="平方米" value={form.landArea} keyboardType="numeric" onChangeText={(value) => updateForm("landArea", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>总面积</Text>
              <TextInput style={styles.input} placeholder="平方米" value={form.totalArea} keyboardType="numeric" onChangeText={(value) => updateForm("totalArea", value)} />
            </View>
          </View>
          <Text style={styles.label}>上游信息</Text>
          <TextInput style={styles.input} placeholder="房东姓名" value={form.landlordName} onChangeText={(value) => updateForm("landlordName", value)} />
          <TextInput style={styles.input} placeholder="联系方式" value={form.landlordPhone} onChangeText={(value) => updateForm("landlordPhone", value)} />
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>合同开始</Text>
              <TextInput style={styles.input} placeholder="2026-05-01" value={form.contractStart} onChangeText={(value) => updateForm("contractStart", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>合同结束</Text>
              <TextInput style={styles.input} placeholder="2027-04-30" value={form.contractEnd} onChangeText={(value) => updateForm("contractEnd", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>上游租金</Text>
              <TextInput style={styles.input} placeholder="每期金额" value={form.rentAmount} keyboardType="numeric" onChangeText={(value) => updateForm("rentAmount", value)} />
            </View>
          </View>
          <Text style={styles.label}>水电单价</Text>
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>水费单价</Text>
              <TextInput style={styles.input} placeholder="元/吨" value={form.waterUnitPrice} keyboardType="numeric" onChangeText={(value) => updateForm("waterUnitPrice", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>电费单价</Text>
              <TextInput style={styles.input} placeholder="元/度" value={form.powerUnitPrice} keyboardType="numeric" onChangeText={(value) => updateForm("powerUnitPrice", value)} />
            </View>
          </View>
          <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={saveApartment}>
            <Text style={styles.buttonText}>{mode === "create" ? "创建公寓" : "保存公寓信息"}</Text>
          </TouchableOpacity>
        </View>
      </>
      ) : null}

      {mode === "detail" && selectedApartment ? (
        <>
          <View style={styles.subPageHeader}>
            <TouchableOpacity style={styles.backButton} onPress={backToList}>
              <Text style={styles.backButtonText}>返回公寓列表</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{selectedApartment.name}</Text>
                <Text style={styles.muted}>{selectedApartment.location}</Text>
              </View>
              <View style={styles.roomActions}>
                <TouchableOpacity style={styles.smallButtonActive} onPress={() => setMode("edit")}>
                  <Text style={styles.smallButtonTextActive}>编辑</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.detailPanel}>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>楼层/面积</Text>
                <Text style={styles.cardTitle}>{selectedApartment.floors} 层 · 占地 {selectedApartment.landArea ?? "未填"}㎡ · 总 {selectedApartment.totalArea ?? "未填"}㎡</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>上游房东</Text>
                <Text style={styles.cardTitle}>{selectedApartment.landlordName || "未维护"} · {selectedApartment.landlordPhone || "未维护"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>合同期</Text>
                <Text style={styles.muted}>{contractText(selectedApartment)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>上游租金</Text>
                <Text style={styles.cardStat}>¥{money(selectedApartment.rentAmount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>水电单价</Text>
                <Text style={styles.muted}>水 ¥{money(selectedApartment.waterUnitPrice)} · 电 ¥{money(selectedApartment.powerUnitPrice)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>房间数量</Text>
                <Text style={styles.cardStat}>{selectedApartment.rooms?.length ?? 0} 间</Text>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>经营花费</Text>
              <TouchableOpacity style={styles.smallButton} onPress={() => setActiveDetailForm((old) => (old === "expense" ? undefined : "expense"))}>
                <Text style={styles.smallButtonText}>{activeDetailForm === "expense" ? "收起" : "记录花费"}</Text>
              </TouchableOpacity>
            </View>
            {activeDetailForm === "expense" ? (
              <>
                <View style={styles.formGrid}>
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="花费名称" value={expense.name} onChangeText={(value) => setExpense((old) => ({ ...old, name: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="金额" value={expense.amount} keyboardType="numeric" onChangeText={(value) => setExpense((old) => ({ ...old, amount: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="日期" value={expense.spentAt} onChangeText={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
                </View>
                <TextInput style={styles.input} placeholder="备注" value={expense.note} onChangeText={(value) => setExpense((old) => ({ ...old, note: value }))} />
                <TouchableOpacity style={styles.secondaryButton} onPress={addExpense}>
                  <Text style={styles.secondaryButtonText}>保存花费</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {(selectedApartment.expenses ?? []).slice(0, 4).map((item) => (
              <View style={styles.detailRow} key={item.id}>
                <Text style={styles.muted}>{item.name} · {toDateInput(item.spentAt)}</Text>
                <Text style={styles.cardStat}>¥{money(item.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>签约可选费用</Text>
              <TouchableOpacity style={styles.smallButton} onPress={() => setActiveDetailForm((old) => (old === "fee" ? undefined : "fee"))}>
                <Text style={styles.smallButtonText}>{activeDetailForm === "fee" ? "收起" : "添加费用项"}</Text>
              </TouchableOpacity>
            </View>
            {activeDetailForm === "fee" ? (
              <>
                <View style={styles.formGrid}>
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="费用名称" value={fee.name} onChangeText={(value) => setFee((old) => ({ ...old, name: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="规格" value={fee.spec} onChangeText={(value) => setFee((old) => ({ ...old, spec: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="金额" value={fee.amount} keyboardType="numeric" onChangeText={(value) => setFee((old) => ({ ...old, amount: value }))} />
                </View>
                <TouchableOpacity style={styles.secondaryButton} onPress={addFee}>
                  <Text style={styles.secondaryButtonText}>保存费用项</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {(selectedApartment.feeItems ?? []).map((item) => (
              <TouchableOpacity style={styles.feeItem} key={item.id} onPress={() => toggleFee(item)}>
                <Text style={styles.cardTitle}>{item.name}{item.spec ? ` · ${item.spec}` : ""}</Text>
                <Text style={item.enabled ? styles.cardStat : styles.muted}>¥{money(item.amount)} · {item.enabled ? "启用" : "停用"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>房间维护</Text>
                <Text style={styles.muted}>当前已维护 {selectedApartment.rooms?.length ?? 0} 间房</Text>
              </View>
              <TouchableOpacity style={styles.smallButton} onPress={() => setActiveDetailForm((old) => (old === "rooms" ? undefined : "rooms"))}>
                <Text style={styles.smallButtonText}>{activeDetailForm === "rooms" ? "收起" : "批量添加"}</Text>
              </TouchableOpacity>
            </View>
            {activeDetailForm === "rooms" ? (
              <>
                <TextInput style={[styles.input, styles.textarea]} multiline placeholder="房间号，用逗号、空格或换行分隔" value={batchRooms} onChangeText={setBatchRooms} />
                <View style={styles.formGrid}>
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="户型" value={batchLayout} onChangeText={setBatchLayout} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="面积" value={batchArea} keyboardType="numeric" onChangeText={setBatchArea} />
                </View>
                <TextInput style={styles.input} placeholder="设施，用逗号分隔" value={batchFacilities} onChangeText={setBatchFacilities} />
                <TouchableOpacity style={styles.button} onPress={addBatchRooms}>
                  <Text style={styles.buttonText}>确认添加房间</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </>
      ) : null}
    </>
  );
}
