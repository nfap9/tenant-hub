import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiClient } from '@/api/client';
import { Badge, Card, Chip, EmptyState } from '@/ui/components';
import { colors, fontSize, radius, spacing, statusColor } from '@/ui/theme';
import { roomStatusLabel, type RoomStatus } from '@/utils/labels';

// GET /api/apartments 返回公寓列表（含房间树），这里只声明页面用到的字段
type RoomItem = {
  id: string;
  roomNo: string;
  layout: string;
  area: number | string | null;
  floor: number | null;
  status: RoomStatus;
};

type ApartmentItem = {
  id: string;
  name: string;
  address: string;
  rooms: RoomItem[];
};

const statusFilters: RoomStatus[] = [
  'VACANT',
  'OCCUPIED',
  'MAINTENANCE',
  'SELF_USE',
];

export default function AssetsScreen() {
  const router = useRouter();
  const [apartments, setApartments] = useState<ApartmentItem[]>([]);
  const [filter, setFilter] = useState<RoomStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiClient<ApartmentItem[]>('/apartments');
      setApartments(data);
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

  const statusCount = apartments
    .flatMap((a) => a.rooms)
    .reduce<Record<string, number>>((acc, room) => {
      acc[room.status] = (acc[room.status] ?? 0) + 1;
      return acc;
    }, {});

  const header = (
    <View style={styles.filterBar}>
      {statusFilters.map((key) => (
        <Chip
          key={key}
          label={`${roomStatusLabel[key]} ${statusCount[key] ?? 0}`}
          active={filter === key}
          onPress={() => setFilter(filter === key ? null : key)}
        />
      ))}
    </View>
  );

  const footer = (
    <TouchableOpacity
      style={styles.aiGuide}
      onPress={() => router.push('/')}
      activeOpacity={0.7}
    >
      <Text style={styles.aiGuideText}>需要调整房源？让 AI 助手帮你操作 →</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={styles.list}
      data={apartments}
      keyExtractor={(it) => it.id}
      ListHeaderComponent={header}
      ListFooterComponent={apartments.length > 0 ? footer : null}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        loading ? null : (
          <EmptyState
            text="还没有公寓"
            hint="回到 AI 助手，让它帮你创建公寓和房间"
          />
        )
      }
      renderItem={({ item }) => {
        const rooms = [...item.rooms].sort((a, b) =>
          a.roomNo.localeCompare(b.roomNo, 'zh-Hans-CN', { numeric: true })
        );
        const visibleRooms = filter
          ? rooms.filter((r) => r.status === filter)
          : rooms;
        return (
          <Card style={styles.aptCard}>
            <View style={styles.rowLine}>
              <Text style={styles.aptName}>{item.name}</Text>
              <Text style={styles.aptCount}>{item.rooms.length} 间房</Text>
            </View>
            {item.address ? (
              <Text style={styles.aptAddress}>{item.address}</Text>
            ) : null}
            {visibleRooms.length > 0 ? (
              <View style={styles.roomGrid}>
                {visibleRooms.map((room) => {
                  const sc = statusColor[room.status];
                  return (
                    <View key={room.id} style={styles.roomCell}>
                      <View style={styles.rowLine}>
                        <Text style={styles.roomNo}>{room.roomNo}</Text>
                        <Badge
                          label={roomStatusLabel[room.status]}
                          fg={sc.fg}
                          bg={sc.bg}
                        />
                      </View>
                      <Text style={styles.roomMeta} numberOfLines={1}>
                        {[
                          room.layout,
                          room.area != null ? `${room.area}㎡` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.noRoom}>
                没有{filter ? `「${roomStatusLabel[filter]}」状态的` : ''}房间
              </Text>
            )}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4), paddingBottom: spacing(8) },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1),
    marginBottom: spacing(2),
  },
  aptCard: { marginBottom: spacing(2) },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
  },
  aptName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  aptCount: { fontSize: fontSize.sm, color: colors.textTertiary },
  aptAddress: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing(1),
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  roomCell: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing(2.5),
  },
  roomNo: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  roomMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing(1),
  },
  noRoom: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing(3),
  },
  aiGuide: { alignItems: 'center', paddingVertical: spacing(3) },
  aiGuideText: { fontSize: fontSize.sm, color: colors.primary },
});
