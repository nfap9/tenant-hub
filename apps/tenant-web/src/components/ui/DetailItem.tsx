import styles from './DetailItem.module.scss';

interface DetailItemProps {
  label: React.ReactNode;
  children: React.ReactNode;
}

export default function DetailItem({ label, children }: DetailItemProps) {
  return (
    <div className={styles.detailItem}>
      <div className={styles.detailLabel}>{label}</div>
      <div className={styles.detailValue}>{children}</div>
    </div>
  );
}
