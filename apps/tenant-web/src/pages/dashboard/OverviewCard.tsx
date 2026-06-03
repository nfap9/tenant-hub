import { compactMoney } from '@/utils/format';
import { Card } from 'antd';
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
      <div className={styles.overviewStats}>
        <div>
          <div className={styles.overviewStatLabel}>已收</div>
          <div className={styles.overviewStatValue}>
            ¥{compactMoney(paidThisMonth)}
          </div>
        </div>
        <div>
          <div className={styles.overviewStatLabel}>待收</div>
          <div className={styles.overviewStatValue}>
            ¥{compactMoney(unpaidTotal)}
          </div>
        </div>
        <div>
          <div className={styles.overviewStatLabel}>支出</div>
          <div className={styles.overviewStatValue}>
            ¥{compactMoney(thisMonthExpense)}
          </div>
        </div>
      </div>
    </Card>
  );
}
