import { compactMoney } from '@/utils/format';
import { Card, Col, Row } from 'antd';
import styles from './OverviewCard.module.scss';

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
      className={styles.overviewCard}
      bodyStyle={{ padding: 'var(--th-space-6)' }}
    >
      <div className={styles.overviewLabel}>本月经营概览</div>
      <div className={styles.overviewTotal}>¥{compactMoney(monthlyIncome)}</div>
      <Row gutter={16}>
        <Col span={8}>
          <div className={styles.overviewStatLabel}>已收</div>
          <div className={styles.overviewStatValue}>
            ¥{compactMoney(paidThisMonth)}
          </div>
        </Col>
        <Col span={8}>
          <div className={styles.overviewStatLabel}>待收</div>
          <div className={styles.overviewStatValue}>
            ¥{compactMoney(unpaidTotal)}
          </div>
        </Col>
        <Col span={8}>
          <div className={styles.overviewStatLabel}>支出</div>
          <div className={styles.overviewStatValue}>
            ¥{compactMoney(thisMonthExpense)}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
