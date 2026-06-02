import type { ReactNode } from 'react';
import styles from './DetailItem.module.scss';

interface DetailItemProps {
  label: string;
  children: ReactNode;
}

export default function DetailItem({ label, children }: DetailItemProps) {
  return (
    <div className={styles.item}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{children ?? '-'}</div>
    </div>
  );
}
