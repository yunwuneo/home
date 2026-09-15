import PF from 'pathfinding';

export const ACTIVITIES = {
  cook: {
    label: '一起做饭',
    verb: '准备晚餐',
    room: '厨房',
    duration: 24,
    echo: [-3.7, -2.9],
    player: [-2.5, -2.9],
    line: '我来洗菜，你来掌勺，好不好？今天想试试玉子烧。',
    memory: '一起做了第一份家常料理，厨房里满是香气。',
  },
  eat: {
    label: '一起吃饭',
    verb: '享用料理',
    room: '餐厅',
    duration: 22,
    echo: [-4.25, -0.65],
    player: [-2.15, -0.65],
    line: '坐这边吧，我把好看的那份留给你了。',
    memory: '面对面吃了一顿饭，连普通的一天也变得特别。',
  },
  tea: {
    label: '泡一壶茶',
    verb: '喝茶聊天',
    room: '客厅',
    duration: 18,
    echo: [-2.2, 1.05],
    player: [-0.95, 1.05],
    line: '茶刚刚泡好。我们坐一会儿，慢慢聊。',
    memory: '分享了一壶热茶，还有不急着说完的话。',
  },
  tv: {
    label: '一起看电视',
    verb: '看一部电影',
    room: '客厅',
    duration: 30,
    echo: [-2.2, 1.05],
    player: [-0.95, 1.05],
    line: '发现了一部温柔的老电影，想和你一起看。',
    memory: '并肩看了一部老电影，笑点竟然出奇地一致。',
  },
  rest: {
    label: '休息一会儿',
    verb: '午后小憩',
    room: '卧室',
    duration: 28,
    echo: [1.85, -2.3],
    player: [1.65, -1.5],
    line: '有一点点困了……陪我安静地待一会儿吧。',
    memory: '一起度过了一段安静的休息时光。',
  },
  water: {
    label: '照顾绿植',
    verb: '给植物浇水',
    room: '阳台',
    duration: 16,
    echo: [-4.9, 2.75],
    player: [-3.8, 2.8],
    line: '你看，长出新叶子了！明天也一起来看看吧。',
    memory: '给窗边的绿植浇了水，发现了一片刚长出的嫩叶。',
  },
  read: {
    label: '一起读书',
    verb: '翻一会儿书',
    room: '卧室',
    duration: 24,
    echo: [1.7, -0.55],
    player: [2.7, -0.4],
    line: '读到一句很喜欢的话，想念给你听。',
    memory: '分享了书里喜欢的句子，又多了解了彼此一点。',
  },
  wash: {
    label: '整理洗漱台',
    verb: '整理洗漱台',
    room: '浴室',
    duration: 16,
    echo: [4.85, 2.1],
    player: [3.65, 2.1],
    line: '给你准备了一条干净的毛巾，放在这里啦。',
    memory: '一起整理了洗漱台，日用品开始成双成对。',
  },
};

// Walkable grid shared by server validation and character animation.
export const OBSTACLES = [
  [-5.8, -4, -1.25, -3.4],
  [0.9, -4, 1.15, -1.45],
  [2.4, -3.6, 4.2, -1.3],
  [4.55, -3.8, 5.8, -2.6],
  [-3.95, -1.4, -2.45, -0.05],
  [-3.15, -0.12, -0.05, 0.95],
  [-2.6, 1.35, -0.65, 2.25],
  [-3.1, 3.3, -0.1, 3.9],
  [3.45, 0.45, 5.9, 0.7],
  [4.2, 3, 5.8, 3.85],
  [-5.6, 2.65, -5.05, 3.5],
];
const STEP = 0.25,
  WIDTH = 47,
  HEIGHT = 31;
const cell = (p) => [Math.round((p[0] + 5.75) / STEP), Math.round((p[1] + 3.75) / STEP)];
const point = (p) => [p[0] * STEP - 5.75, p[1] * STEP - 3.75];
function grid() {
  const g = new PF.Grid(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const [wx, wz] = point([x, y]);
      if (OBSTACLES.some(([x1, z1, x2, z2]) => wx >= x1 && wx <= x2 && wz >= z1 && wz <= z2))
        g.setWalkableAt(x, y, false);
    }
  return g;
}
export function walkPath(from, to) {
  const g = grid(),
    a = cell(from),
    b = cell(to);
  if (!g.isInside(...a) || !g.isInside(...b) || !g.isWalkableAt(...b)) return [];
  g.setWalkableAt(...a, true);
  return new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true })
    .findPath(...a, ...b, g)
    .map(point);
}
export function accessibleTarget(p) {
  const g = grid(),
    c = cell(p);
  return g.isInside(...c) && g.isWalkableAt(...c);
}
