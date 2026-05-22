import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Tag, Spin, message, Popconfirm, Tooltip } from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getApartments, deleteApartment } from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import { money, day } from '@/utils/format';
import { apartmentMonthlyIncome, apartmentMonthlyExpense } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import './ApartmentListPage.scss';

export default function ApartmentListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteApartment(currentOrgId, id);
      message.success('公寓已删除');
      loadApartments();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除公寓失败');
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '公寓管理' }]}
        actions={
          canManageApartment && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/apartments/new')}
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
                      onClick: () => navigate('/apartments/new'),
                    }
                  : undefined
              }
            />
          </Card>
        ) : (
          <div className="apartments-grid">
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
                  title={
                    <div className="card-title">
                      <HomeOutlined className="text-primary" />
                      <span className="card-title-text">{apt.name}</span>
                    </div>
                  }
                  extra={
                    <div className="card-extra">
                      <Tooltip title="详情">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => navigate(`/apartments/${apt.id}`)}
                        />
                      </Tooltip>
                      {canManageApartment && (
                        <>
                          <Tooltip title="编辑">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() =>
                                navigate(`/apartments/${apt.id}/edit`)
                              }
                            />
                          </Tooltip>
                          <Popconfirm
                            title="删除公寓"
                            description="删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。"
                            onConfirm={() => handleDelete(apt.id)}
                            okText="确认删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Tooltip title="删除">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </>
                      )}
                    </div>
                  }
                >
                  <div className="tag-row">
                    <Tag color="blue">{apt.location || '未填写地址'}</Tag>
                    <Tag className="floors-tag">{apt.floors} 层</Tag>
                  </div>
                  <div className="stats-grid">
                    <div>
                      <div className="stat-label">房间数</div>
                      <div className="stat-value">{roomCount} 间</div>
                    </div>
                    <div>
                      <div className="stat-label">在租</div>
                      <div className="stat-value">{occupiedCount} 间</div>
                    </div>
                    <div>
                      <div className="stat-label">本月收入</div>
                      <div className="stat-value stat-value--success">
                        ¥{money(income)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">本月支出</div>
                      <div className="stat-value stat-value--danger">
                        ¥{money(expense)}
                      </div>
                    </div>
                  </div>
                  {apt.contractStart && (
                    <div className="contract-period">
                      合同期：{day(apt.contractStart)} 至 {day(apt.contractEnd)}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Spin>
    </div>
  );
}
