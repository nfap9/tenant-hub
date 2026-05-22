import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { getApiBaseUrl } from '../../constants/config';
import { Button, Card } from '../../components/ui';
import { useEffect, useState } from 'react';
import { getSession } from '../../utils/storage';
import './index.scss';

export default function UtilityExportPage() {
  const { currentOrgId } = useAppSession();
  const [csv, setCsv] = useState('');

  useEffect(() => {
    if (!currentOrgId) return;
    Taro.request({
      url: `${getApiBaseUrl()}/bills/utility/pending-export`,
      header: {
        authorization: `Bearer ${getSession()?.token ?? ''}`,
        'x-organization-id': currentOrgId,
      },
    })
      .then((res) => {
        setCsv(typeof res.data === 'string' ? res.data : '');
      })
      .catch((e) => {
        Taro.showToast({
          title: e instanceof Error ? e.message : '导出失败',
          icon: 'none',
        });
      });
  }, [currentOrgId]);

  const handleBack = () => {
    Taro.navigateBack();
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={handleBack}
        >
          ‹ 返回
        </Button>
      </View>
      <Card title="导出水电读数模板">
        <Text
          className="text-muted"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
        >
          {csv}
        </Text>
        <Button
          variant="secondary"
          onClick={() => {
            Taro.setClipboardData({ data: csv });
          }}
        >
          复制到剪贴板
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          关闭
        </Button>
      </Card>
    </View>
  );
}
