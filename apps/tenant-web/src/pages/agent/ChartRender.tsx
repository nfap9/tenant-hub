import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { type ChartConfig } from '@/api/agent';
import styles from './AgentChatPage.module.scss';

const CHART_COLORS = [
  '#2563eb',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
];

function buildOption(config: ChartConfig): echarts.EChartsOption {
  const { chartType, labels, datasets, colors, unit } = config;
  const chartColors = colors || CHART_COLORS;

  const baseOption: echarts.EChartsOption = {
    color: chartColors,
    tooltip: { trigger: chartType === 'pie' ? 'item' : 'axis' },
    legend: { bottom: 0 },
  };

  switch (chartType) {
    case 'bar':
    case 'line':
    case 'area': {
      const series: echarts.SeriesOption[] = datasets.map((ds) => ({
        name: ds.label,
        type: chartType === 'area' ? 'line' : chartType,
        data: ds.data,
        smooth: chartType !== 'bar',
        ...(chartType === 'area' ? { areaStyle: {} } : {}),
        ...(chartType === 'bar'
          ? { itemStyle: { borderRadius: [4, 4, 0, 0] } }
          : {}),
      }));

      return {
        ...baseOption,
        xAxis: { type: 'category', data: labels },
        yAxis: { type: 'value', ...(unit ? { name: unit } : {}) },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          top: '10%',
          containLabel: true,
        },
        series,
      };
    }
    case 'pie': {
      return {
        ...baseOption,
        series: [
          {
            type: 'pie',
            data:
              datasets[0]?.data.map((value, i) => ({
                name: labels[i],
                value,
              })) ?? [],
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            label: { formatter: '{b} {d}%' },
          },
        ],
      };
    }
    case 'radar': {
      return {
        ...baseOption,
        radar: {
          indicator:
            datasets[0]?.data.map((_, i) => ({
              name: labels[i] || '',
              max: Math.max(...datasets[0].data, 1),
            })) ?? [],
        },
        series: [
          {
            type: 'radar',
            data: datasets.map((ds) => ({
              name: ds.label,
              value: ds.data,
            })),
          },
        ],
      };
    }
    default:
      return {};
  }
}

export const ChartRenderer: React.FC<{ config: ChartConfig }> = ({
  config,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const instance = echarts.init(chartRef.current);
    chartInstanceRef.current = instance;

    const resizeObserver = new ResizeObserver(() => {
      instance.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      instance.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = chartInstanceRef.current;
    if (!instance) return;

    instance.setOption(buildOption(config), true);
  }, [config]);

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.chartTitle}>{config.title}</div>
      <div ref={chartRef} style={{ width: '100%', height: 320 }} />
    </div>
  );
};
