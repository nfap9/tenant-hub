import { compactMoney } from '@/utils/format';
import { Card, Col, Row } from 'antd';

interface Props {
  monthlyIncome: number;
  paidThisMonth: number;
  unpaidTotal: number;
  thisMonthExpense: number;
}
export default function Overview({
  monthlyIncome,
  paidThisMonth,
  unpaidTotal,
  thisMonthExpense,
}: Props) {
  return (
    <Card
      style={{
        marginBottom: 16,
        background:
          'linear-gradient(135deg, #0F766E 0%, #14B8A6 60%, #5EEAD4 100%)',
        color: '#fff',
        borderRadius: 'var(--th-radius-lg)',
        border: 'none',
      }}
      bodyStyle={{ padding: 'var(--th-space-6)' }}
    >
      <div
        style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: 14,
          marginBottom: 4,
          fontWeight: 500,
        }}
      >
        本月经营概览
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          marginBottom: 20,
          color: '#fff',
          fontFamily: 'var(--th-font-heading)',
        }}
      >
        ¥{compactMoney(monthlyIncome)}
      </div>
      <Row gutter={16}>
        <Col span={8}>
          <div
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            已收
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>
            ¥{compactMoney(paidThisMonth)}
          </div>
        </Col>
        <Col span={8}>
          <div
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            待收
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>
            ¥{compactMoney(unpaidTotal)}
          </div>
        </Col>
        <Col span={8}>
          <div
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            支出
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>
            ¥{compactMoney(thisMonthExpense)}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
