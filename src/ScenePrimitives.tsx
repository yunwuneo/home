import { RoundedBox } from '@react-three/drei';

export type V3 = [number, number, number];
export const wood = '#cda882',
  white = '#fafaf2',
  sage = '#8bb59e',
  pink = '#e6aaa1';

export function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  c = white,
  r = 0.035,
  rotation = [0, 0, 0],
}: {
  p?: V3;
  s?: V3;
  c?: string;
  r?: number;
  rotation?: V3;
}) {
  return (
    <RoundedBox
      position={p}
      args={s}
      radius={Math.min(r, ...s.map((n) => n / 2))}
      smoothness={2}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={c} roughness={0.8} />
    </RoundedBox>
  );
}
export function Ball({ p, s = [1, 1, 1], c }: { p: V3; s?: V3; c: string }) {
  return (
    <mesh position={p} scale={s} castShadow>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}
export function Cylinder({
  p,
  r = 0.2,
  h = 0.3,
  c = white,
  r2,
}: {
  p: V3;
  r?: number;
  h?: number;
  c?: string;
  r2?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, 20]} />
      <meshStandardMaterial color={c} />
    </mesh>
  );
}
export function Cup({ p, c = white }: { p: V3; c?: string }) {
  return (
    <group position={p}>
      <Cylinder p={[0, 0.08, 0]} r={0.095} h={0.16} c={c} />
      <Cylinder p={[0, 0.165, 0]} r={0.072} h={0.008} c="#94755b" />
      <mesh position={[0.1, 0.085, 0]}>
        <torusGeometry args={[0.055, 0.018, 8, 16]} />
        <meshStandardMaterial color={c} />
      </mesh>
    </group>
  );
}
