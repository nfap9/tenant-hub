import styles from './DetailSection.module.scss';

interface DetailSectionProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function DetailSection({
  title,
  actions,
  children,
  className,
}: DetailSectionProps) {
  return (
    <div className={`${styles.detailSection} ${className || ''}`}>
      {(title || actions) && (
        <div className={styles.sectionHeader}>
          {title && <div className={styles.sectionTitle}>{title}</div>}
          {actions && <div className={styles.sectionActions}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
