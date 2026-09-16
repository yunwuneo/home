import type { ActivityKind } from './types';
import type { V3 } from './ScenePrimitives';

export const CAMERA_VIEWS: Record<ActivityKind, { target: V3; offset: V3; label: string }> = {
  eat: { target: [-3.2, 0.9, -0.7], offset: [0.7, 3.8, 5], label: '餐桌' },
  cook: { target: [-3.6, 1, -3], offset: [3, 2.6, 5], label: '厨房' },
  tea: { target: [-1.6, 0.9, 1.1], offset: [3, 2.4, 5], label: '茶几' },
  tv: { target: [-1.6, 0.9, 1.6], offset: [4, 3, 3], label: '客厅' },
  rest: { target: [3, 0.7, -2.3], offset: [3, 3, 5], label: '卧室' },
  water: { target: [-5, 1, 2.1], offset: [3, 2.2, 5], label: '绿植' },
  read: { target: [2, 1, -0.6], offset: [3, 2.5, 5], label: '阅读角' },
  wash: { target: [4.7, 1, 1.7], offset: [3, 2.5, 5], label: '洗漱台' },
  shop: { target: [-3.3, 0.9, 0.1], offset: [3, 3, 5], label: '生鲜区' },
  movie: { target: [-0.6, 1, -1.8], offset: [2, 2.8, 6], label: '一号影厅' },
  work: { target: [-2.7, 1, -1.7], offset: [3, 2.6, 5], label: '协作工位' },
  coffee: { target: [-3, 0.9, -0.9], offset: [3, 2.1, 5], label: '窗边座位' },
  stroll: { target: [0.9, 1, -0.4], offset: [3, 3, 5], label: '沿河步道' },
};
