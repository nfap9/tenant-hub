import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Tag, Spin, message } from 'antd';
import { PlusOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getApartments } from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import { money, day } from '@/utils/format';
import { apartmentMonthlyIncome, apartmentMonthlyExpense } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import ApartmentFormModal from './ApartmentFormModal';
import styles from './ApartmentListPage.module.scss';
import clsx from 'clsx';

export default function ApartmentListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getApartments(currentOrgId);
      setApartments(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载公寓列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '公寓管理' }]}
        actions={
          canManageApartment && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setFormModalOpen(true)}
            >
              新增公寓
            </Button>
          )
        }
      />

      <Spin spinning={loading}>
        {apartments.length === 0 ? (
          <Card>
            <EmptyState
              title="暂无公寓数据"
              description="当前组织下还没有创建任何公寓，点击右上角按钮创建第一个公寓"
              action={
                canManageApartment
                  ? {
                      label: '新增公寓',
                      onClick: () => setFormModalOpen(true),
                    }
                  : undefined
              }
            />
          </Card>
        ) : (
          <div className={styles.apartmentsGrid}>
            {apartments.map((apt) => {
              const roomCount = apt.rooms?.length ?? 0;
              const occupiedCount =
                apt.rooms?.filter((r) => r.status === 'OCCUPIED').length ?? 0;
              const income = apartmentMonthlyIncome(apt);
              const expense = apartmentMonthlyExpense(apt);

              return (
                <Card
                  key={apt.id}
                  hoverable
                  onClick={() => navigate(`/apartments/${apt.id}`)}
                  title={
                    <div className={styles.cardTitle}>
                      <HomeOutlined className="text-primary" />
                      <span className={styles.cardTitleText}>{apt.name}</span>
                    </div>
                  }
                >
                  <div className={styles.tagRow}>
                    <Tag color="blue">{apt.location || '未填写地址'}</Tag>
                  </div>
                  <div className={styles.statsGrid}>
                    <div>
                      <div className={styles.statLabel}>房间数</div>
                      <div className={styles.statValue}>{roomCount} 间</div>
                    </div>
                    <div>
                      <div className={styles.statLabel}>在租</div>
                      <div className={styles.statValue}>{occupiedCount} 间</div>
                    </div>
                    <div>
                      <div className={styles.statLabel}>本月收入</div>
                      <div
                        className={clsx(
                          styles.statValue,
                          styles.statValueSuccess
                        )}
                      >
                        ¥{money(income)}
                      </div>
                    </div>
                    <div>
                      <div className={styles.statLabel}>本月支出</div>
                      <div
                        className={clsx(
                          styles.statValue,
                          styles.statValueDanger
                        )}
                      >
                        ¥{money(expense)}
                      </div>
                    </div>
                  </div>
                  {apt.contract?.contractStart && (
                    <div className={styles.contractPeriod}>
                      合同期：{day(apt.contract.contractStart)} 至{' '}
                      {day(apt.contract.contractEnd)}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Spin>

      <ApartmentFormModal
        open={formModalOpen}
        onCancel={() => setFormModalOpen(false)}
        onSuccess={() => {
          setFormModalOpen(false);
          loadApartments();
        }}
      />
    </div>
  );
}
