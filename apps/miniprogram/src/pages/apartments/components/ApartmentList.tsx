import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button, Card, EmptyState } from '../../../components/ui';
import { money } from '../../../utils/format';
import { apartmentMonthlyIncome, apartmentMonthlyExpense } from '../utils';
import type { Apartment } from '../../../types/domain';

interface ApartmentListProps {
  apartments: Apartment[];
  canManageApartment: boolean;
}

export function ApartmentList({
  apartments,
  canManageApartment,
}: ApartmentListProps) {
  const handleCreate = () => {
    Taro.navigateTo({ url: '/pages/apartments/form' });
  };

  return (
    <Card
      title="公寓列表"
      headerAction={
        canManageApartment ? (
          <Button variant="secondary" size="small" onClick={handleCreate}>
            新建
          </Button>
        ) : undefined
      }
    >
      {apartments.length === 0 ? (
        <EmptyState
          icon="apartment"
          title="暂无公寓"
          subtitle="点击新建开始维护"
          action={<Button onClick={handleCreate}>新建公寓</Button>}
        />
      ) : null}
      {apartments.map((item) => {
        const rooms = item.rooms ?? [];
        const occupied = rooms.filter(
          (room) => room.status === 'OCCUPIED'
        ).length;
        const monthlyIncome = apartmentMonthlyIncome(item);
        const monthlyExpense = apartmentMonthlyExpense(item);
        return (
          <View
            key={item.id}
            className="apartment-card"
            onClick={() =>
              Taro.navigateTo({ url: `/pages/apartments/detail?id=${item.id}` })
            }
          >
            <View className="apartment-card-header">
              <View>
                <Text className="card-title">{item.name}</Text>
                <Text className="text-muted">{item.location}</Text>
              </View>
              <Text className="card-stat">
                {occupied}/{rooms.length} 间在租
              </Text>
            </View>
            <View className="detail-row">
              <Text className="text-muted">
                {item.floors} 层 · 总面积 {item.totalArea ?? '未填'}㎡
              </Text>
              <Text className="text-muted">{rooms.length} 间房</Text>
            </View>
            <View className="detail-row">
              <Text className="card-stat">
                本月收入 ¥{money(monthlyIncome)}
              </Text>
              <Text className="text-muted">
                本月花费 ¥{money(monthlyExpense)}
              </Text>
            </View>
            {canManageApartment ? (
              <View
                onClick={(e) => {
                  e.stopPropagation();
                  Taro.navigateTo({
                    url: `/pages/apartments/expense?apartmentId=${item.id}`,
                  });
                }}
              >
                <Button variant="ghost" size="small">
                  记录花费
                </Button>
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
