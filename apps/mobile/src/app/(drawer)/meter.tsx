import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '@/api/client';
import { Button, Card, EmptyState } from '@/ui/components';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

// GET /api/bills/meter-reading-rooms 返回待抄表房间（含最近一次水电读数）
type MeterRoomDto = {
  leaseId: string;
  tenantName: string | null;
  roomId: string;
  roomNo: string;
  apartmentId: string;
  apartmentName: string;
  lastWaterReadingDate: string | null;
  lastWaterValue: number | null;
  lastPowerReadingDate: string | null;
  lastPowerValue: number | null;
};

type MeterSection = { title: string; data: MeterRoomDto[] };

const formatLast = (value: number | null, date: string | null) =>
  value != null
    ? `${value}（${date ? dayjs(date).format('MM-DD') : '-'}）`
    : '首次抄表';

export default function MeterScreen() {
  const insets = useSafeAreaInsets();
  const [sections, setSections] = useState<MeterSection[]>([]);
  const [waterInputs, setWaterInputs] = useState<Record<string, string>>({});
  const [powerInputs, setPowerInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiClient<MeterRoomDto[]>(
        '/bills/meter-reading-rooms'
      );
      // 接口返回扁平房间列表，前端按公寓分组展示
      const groups = new Map<string, MeterRoomDto[]>();
      for (const room of data) {
        const list = groups.get(room.apartmentName) ?? [];
        list.push(room);
        groups.set(room.apartmentName, list);
      }
      setSections(
        [...groups.entries()].map(([title, rooms]) => ({
          title,
          data: rooms,
        }))
      );
      setWaterInputs({});
      setPowerInputs({});
      setErrors({});
    } catch {
      // 请求失败时保留旧数据，由下拉刷新重试
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const updateInput = (
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    roomId: string,
    text: string
  ) => {
    setter((prev) => ({ ...prev, [roomId]: text }));
    setErrors((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  };

  const onSubmit = async () => {
    const rooms = sections.flatMap((s) => s.data);
    const nextErrors: Record<string, string> = {};
    const payload: Array<{ roomId: string; water: number; power: number }> = [];

    for (const room of rooms) {
      const waterStr = (waterInputs[room.roomId] ?? '').trim();
      const powerStr = (powerInputs[room.roomId] ?? '').trim();
      if (!waterStr && !powerStr) continue; // 未填写的房间不参与提交
      if (!waterStr || !powerStr) {
        nextErrors[room.roomId] = '水表和电表读数都需要填写';
        continue;
      }
      const water = Number(waterStr);
      const power = Number(powerStr);
      if (Number.isNaN(water) || Number.isNaN(power)) {
        nextErrors[room.roomId] = '读数必须是数字';
        continue;
      }
      if (room.lastWaterValue != null && water < room.lastWaterValue) {
        nextErrors[room.roomId] =
          `水表读数不能小于上期读数 ${room.lastWaterValue}`;
        continue;
      }
      if (room.lastPowerValue != null && power < room.lastPowerValue) {
        nextErrors[room.roomId] =
          `电表读数不能小于上期读数 ${room.lastPowerValue}`;
        continue;
      }
      payload.push({ roomId: room.roomId, water, power });
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (payload.length === 0) {
      Alert.alert('提示', '请先填写要提交的房间读数');
      return;
    }

    setSubmitting(true);
    try {
      // POST /api/bills/meter-readings 每次提交一个房间，逐条调用
      const readingDate = new Date().toISOString();
      for (const item of payload) {
        await apiClient('/bills/meter-readings', {
          method: 'POST',
          body: {
            roomId: item.roomId,
            readingDate,
            waterValue: item.water,
            powerValue: item.power,
          },
        });
      }
      Alert.alert('提交成功', `已提交 ${payload.length} 个房间的抄表读数`);
      await load();
    } catch (e) {
      Alert.alert('提交失败', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <SectionList
        style={styles.list}
        sections={sections}
        keyExtractor={(it) => it.roomId}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.primary}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              text="没有待抄表的房间"
              hint="房间签约后即可在这里录入水电读数"
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.rowLine}>
              <Text style={styles.roomTitle}>{item.roomNo}</Text>
              {item.tenantName ? (
                <Text style={styles.tenant}>{item.tenantName}</Text>
              ) : null}
            </View>
            <Text style={styles.last}>
              上期水表{' '}
              {formatLast(item.lastWaterValue, item.lastWaterReadingDate)}
              {'  ·  '}
              上期电表{' '}
              {formatLast(item.lastPowerValue, item.lastPowerReadingDate)}
            </Text>
            <View style={styles.inputRow}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>本次水表</Text>
                <TextInput
                  style={styles.input}
                  value={waterInputs[item.roomId] ?? ''}
                  onChangeText={(t) =>
                    updateInput(setWaterInputs, item.roomId, t)
                  }
                  keyboardType="numeric"
                  placeholder={
                    item.lastWaterValue != null
                      ? String(item.lastWaterValue)
                      : '读数'
                  }
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>本次电表</Text>
                <TextInput
                  style={styles.input}
                  value={powerInputs[item.roomId] ?? ''}
                  onChangeText={(t) =>
                    updateInput(setPowerInputs, item.roomId, t)
                  }
                  keyboardType="numeric"
                  placeholder={
                    item.lastPowerValue != null
                      ? String(item.lastPowerValue)
                      : '读数'
                  }
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>
            {errors[item.roomId] ? (
              <Text style={styles.errorText}>{errors[item.roomId]}</Text>
            ) : null}
          </Card>
        )}
      />
      {sections.length > 0 ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, spacing(3)) },
          ]}
        >
          <Button
            title="提交抄表"
            onPress={() => void onSubmit()}
            loading={submitting}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { padding: spacing(4), paddingBottom: spacing(4) },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing(2),
    marginBottom: spacing(2),
  },
  card: { marginBottom: spacing(2) },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
  },
  roomTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  tenant: { fontSize: fontSize.sm, color: colors.textSecondary },
  last: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing(1),
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  inputWrap: { flex: 1 },
  inputLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing(1),
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: fontSize.md,
    color: colors.text,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacing(2),
  },
  footer: {
    padding: spacing(4),
    paddingTop: spacing(2),
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
