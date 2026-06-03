import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const chartTypeSchema = z.enum(['bar', 'line', 'pie', 'area', 'radar']);

const colorSchemes = [
  ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'],
  ['#3b82f6', '#10b981', '#f97316', '#dc2626', '#7c3aed', '#0891b2', '#db2777'],
];

export const generateChartTool = tool(
  async (input) => {
    return JSON.stringify({
      ...input,
      colors: colorSchemes[0],
    });
  },
  {
    name: 'generate_chart',
    description:
      '生成可视化图表数据。当用户想看趋势对比、比例分布等需要图形化展示的数据时调用。返回结构化的图表配置数据供前端渲染。',
    schema: z.object({
      chartType: chartTypeSchema.describe(
        '图表类型：bar柱状图/line折线图/pie饼图/area面积图/radar雷达图'
      ),
      title: z.string().describe('图表标题'),
      labels: z.array(z.string()).describe('数据标签，如月份、分类名称等'),
      datasets: z
        .array(
          z.object({
            label: z.string().describe('数据系列名称'),
            data: z.array(z.number()).describe('数值数组，与labels一一对应'),
          })
        )
        .describe('数据系列，每个对象为一个数据系列'),
      unit: z.string().optional().describe('数据单位，如 元、间、人'),
    }),
  }
);
