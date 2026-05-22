import { useState, useCallback } from 'react';
import { View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { NoOrganization } from '../../components/NoOrganization';
import { ApartmentList } from './components/ApartmentList';
import type { Apartment } from '../../types/domain';
import './index.scss';

export default function ApartmentsPage() {
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');

  const [apartments, setApartments] = useState<Apartment[]>([]);

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Apartment[]>('/apartments', {
        organizationId: currentOrgId,
      });
      setApartments(data);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载失败',
        icon: 'none',
      });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadApartments();
  });

  usePullDownRefresh(() => {
    loadApartments().finally(() => Taro.stopPullDownRefresh());
  });

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
      <ApartmentList
        apartments={apartments}
        canManageApartment={canManageApartment}
      />
    </View>
  );
}
