import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Grid, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { walkPath } from '../shared/world.mjs';
import type { ActivityKind, State } from './types';

type V3 = [number, number, number];
const wood = '#cda882',
  white = '#fafaf2',
  sage = '#8bb59e',
  pink = '#e6aaa1';
function Box({
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
function Ball({ p, s = [1, 1, 1], c }: { p: V3; s?: V3; c: string }) {
  return (
    <mesh position={p} scale={s} castShadow>
      <sphereGeometry args={[1, 20, 16]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}
function Cylinder({
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
      <cylinderGeometry args={[r, r2 ?? r, h, 24]} />
      <meshStandardMaterial color={c} />
    </mesh>
  );
}
function Plant({ p, scale = 1 }: { p: V3; scale?: number }) {
  return (
    <group position={p} scale={scale}>
      <Cylinder p={[0, 0.22, 0]} r={0.27} r2={0.19} h={0.44} c="#e6d7c6" />
      <Cylinder p={[0, 0.9, 0]} r={0.035} h={1.2} c="#688269" />
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <group key={v} position={[0, 0.55 + v * 0.13, 0]} rotation={[0, v * 2.4, 0.5]}>
          <Ball p={[0.18, 0.15, 0]} s={[0.29, 0.12, 0.14]} c={v % 2 ? '#639b71' : '#9ab982'} />
        </group>
      ))}
    </group>
  );
}
function Book({ p, c, s = [0.12, 0.32, 0.24] }: { p: V3; c: string; s?: V3 }) {
  return <Box p={p} s={s} c={c} r={0.012} />;
}
function Cup({ p, c = white }: { p: V3; c?: string }) {
  return (
    <group position={p}>
      <Cylinder p={[0, 0.08, 0]} r={0.095} h={0.16} c={c} />
      <Cylinder p={[0, 0.165, 0]} r={0.072} h={0.008} c="#94755b" />
      <mesh position={[0.1, 0.085, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.055, 0.018, 8, 16]} />
        <meshStandardMaterial color={c} />
      </mesh>
    </group>
  );
}
function Clickable({
  kind,
  onSelect,
  children,
}: {
  kind: ActivityKind;
  onSelect: (k: ActivityKind) => void;
  children: React.ReactNode;
}) {
  return (
    <group
      onClick={(e) => {
        if (e.delta > 4) return;
        e.stopPropagation();
        onSelect(kind);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {children}
    </group>
  );
}
function House({
  onSelect,
  night,
  tv,
}: {
  onSelect: (k: ActivityKind) => void;
  night: boolean;
  tv: boolean;
}) {
  return (
    <group>
      <Box p={[0, -0.27, 0]} s={[12.25, 0.5, 8.3]} c="#d6c5ad" r={0.15} />
      <Box p={[-2.48, -0.005, 0]} s={[7, 0.08, 8]} c="#eadac3" />
      {Array.from({ length: 20 }, (_, i) => (
        <Box key={i} p={[-5.85 + i * 0.35, 0.039, 0]} s={[0.012, 0.004, 8]} c="#d8c3a8" r={0} />
      ))}
      <Box p={[3.55, 0.008, -1.75]} s={[4.9, 0.08, 4.5]} c="#bcc8a4" />
      {[1.12, 3.55, 5.97].map((x) => (
        <Box key={x} p={[x, 0.055, -1.75]} s={[0.045, 0.008, 4.5]} c="#8ea789" r={0} />
      ))}
      {[-3.95, -1.75, 0.46].map((z) => (
        <Box key={z} p={[3.55, 0.055, z]} s={[4.9, 0.008, 0.045]} c="#8ea789" r={0} />
      ))}
      <Box p={[4.6, 0.015, 2.3]} s={[2.8, 0.09, 3.4]} c="#d8e6e3" />
      {[3.2, 3.9, 4.6, 5.3, 6].map((x) => (
        <Box key={x} p={[x, 0.063, 2.3]} s={[0.017, 0.008, 3.4]} c="#b2cdc5" r={0} />
      ))}
      {[0.7, 1.4, 2.1, 2.8, 3.5].map((z) => (
        <Box key={z} p={[4.6, 0.063, z]} s={[2.8, 0.008, 0.017]} c="#b2cdc5" r={0} />
      ))}
      <Box p={[0, 1.3, -4.04]} s={[12.2, 2.65, 0.15]} c="#f5f2e8" />
      <Box p={[-6.03, 1.3, 0]} s={[0.15, 2.65, 8]} c="#e8efe3" />
      <Box p={[0, 0.12, -3.92]} s={[12, 0.24, 0.07]} c={wood} />
      <Box p={[-5.92, 0.12, 0]} s={[0.07, 0.24, 8]} c={wood} />
      <Box p={[1.05, 1.05, -2.8]} s={[0.17, 2.1, 2.5]} c="#ecebda" />
      <Box p={[4.75, 0.65, 0.58]} s={[2.5, 1.3, 0.14]} c="#e4ede6" />
      <Box p={[4.75, 1.33, 0.58]} s={[2.58, 0.08, 0.21]} c={wood} />
      {/* Shoji windows and a leafy view, modeled locally so the home works offline. */}
      {[-3.3, 3.5].map((x) => (
        <group key={x} position={[x, 1.7, -3.93]}>
          <Box s={[2.45, 1.55, 0.08]} c={wood} />
          <Box p={[0, 0, 0.05]} s={[2.25, 1.36, 0.04]} c={night ? '#718794' : '#cee4e3'} />
          {[-0.74, 0, 0.74].map((i) => (
            <Box key={i} p={[i, 0, 0.1]} s={[0.045, 1.4, 0.06]} c={white} />
          ))}
          {[-0.42, 0.12, 0.6].map((i) => (
            <Box key={i} p={[0, i, 0.1]} s={[2.3, 0.035, 0.06]} c={white} />
          ))}
          <Box p={[0, -0.8, 0.07]} s={[2.65, 0.09, 0.3]} c={wood} />
        </group>
      ))}
      <group position={[-5.91, 1.65, 1.1]} rotation={[0, Math.PI / 2, 0]}>
        <Box s={[2.1, 1.65, 0.07]} c={wood} />
        <Box p={[0, 0, 0.06]} s={[1.95, 1.5, 0.05]} c="#d5e7dc" />
        {[-0.65, 0, 0.65].map((i) => (
          <Box key={i} p={[i, 0, 0.1]} s={[0.04, 1.5, 0.05]} />
        ))}
        <Box p={[0, 0, 0.1]} s={[2, 0.04, 0.05]} />
      </group>
      <Clickable kind="cook" onSelect={onSelect}>
        <Box p={[-3.8, 0.48, -3.64]} s={[4.05, 0.92, 0.65]} c="#b1c2ae" />
        <Box p={[-3.8, 0.98, -3.58]} s={[4.2, 0.11, 0.83]} c={white} />
        {[-5.1, -4.25, -3.4, -2.55].map((x) => (
          <group key={x}>
            <Box p={[x, 0.5, -3.295]} s={[0.77, 0.78, 0.04]} c="#bfccba" />
            <Box p={[x, 0.72, -3.25]} s={[0.23, 0.025, 0.04]} c="#8b9785" />
          </group>
        ))}
        <Box p={[-2.6, 1.047, -3.57]} s={[1.02, 0.03, 0.6]} c="#6b7874" />
        {[-2.85, -2.37].map((x) => (
          <Cylinder key={x} p={[x, 1.075, -3.57]} r={0.18} h={0.02} c="#414d49" />
        ))}
        <Cylinder p={[-2.83, 1.21, -3.57]} r={0.19} h={0.24} c="#e5b899" />
        <Cylinder p={[-2.83, 1.35, -3.57]} r={0.21} h={0.035} c={white} />
        <Ball p={[-2.83, 1.39, -3.57]} s={[0.04, 0.035, 0.04]} c="#8d917f" />
        <Box p={[-4.7, 1.041, -3.57]} s={[0.9, 0.025, 0.48]} c="#9bafad" />
        <Box p={[-4.7, 1.06, -3.57]} s={[0.72, 0.025, 0.34]} c="#c7d6d5" />
        <Cylinder p={[-4.7, 1.24, -3.85]} r={0.032} h={0.4} c="#abb7b3" />
        <Box p={[-4.7, 1.43, -3.73]} s={[0.065, 0.06, 0.25]} c="#abb7b3" />
        <Box p={[-1.52, 0.89, -3.52]} s={[0.73, 1.76, 0.9]} c="#f1eee2" />
        <Box p={[-1.52, 1.16, -3.052]} s={[0.64, 0.04, 0.02]} c="#cecdc1" />
        <Box p={[-1.78, 0.84, -3.04]} s={[0.04, 0.28, 0.04]} c="#939c91" />
        <Box p={[-4.85, 2.4, -3.7]} s={[1.4, 0.08, 0.5]} c={wood} />
        <Cup p={[-5.25, 2.45, -3.7]} c={pink} />
        <Cup p={[-4.87, 2.45, -3.7]} />
        <Plant p={[-4.45, 2.44, -3.7]} scale={0.28} />
      </Clickable>
      <Clickable kind="eat" onSelect={onSelect}>
        <Box p={[-3.2, 0.77, -0.7]} s={[1.5, 0.13, 1.3]} c={wood} r={0.12} />
        {[-3.75, -2.65].flatMap((x) =>
          [-1.13, -0.27].map((z) => (
            <Box key={`${x}${z}`} p={[x, 0.37, z]} s={[0.09, 0.74, 0.09]} c="#b79770" />
          )),
        )}
        {[-4.22, -2.17].map((x) => (
          <group key={x}>
            <Box p={[x, 0.45, -0.7]} s={[0.55, 0.12, 0.57]} c="#c4ceb3" />
            <Box p={[x + (x < -3 ? -0.26 : 0.26), 0.82, -0.7]} s={[0.07, 0.65, 0.58]} c={wood} />
            {[-0.2, 0.2].flatMap((dx) =>
              [-0.2, 0.2].map((z) => (
                <Box key={`${dx}${z}`} p={[x + dx, 0.2, -0.7 + z]} s={[0.06, 0.4, 0.06]} c={wood} />
              )),
            )}
          </group>
        ))}
        {[-3.65, -2.75].map((x) => (
          <group key={x}>
            <Cylinder p={[x, 0.856, -0.7]} r={0.23} h={0.025} />
            <Ball p={[x, 0.9, -0.7]} s={[0.13, 0.07, 0.13]} c="#f0d899" />
            <Cup p={[x, 0.85, -1.12]} c="#d7e6dc" />
          </group>
        ))}
        <Cylinder p={[-3.2, 2.1, -0.7]} r={0.025} h={1.3} c="#989884" />
        <mesh position={[-3.2, 1.55, -0.7]}>
          <coneGeometry args={[0.36, 0.3, 32, 1, true]} />
          <meshStandardMaterial color="#e9d2a1" side={THREE.DoubleSide} />
        </mesh>
      </Clickable>
      <Box p={[-1.6, 0.075, 1.67]} s={[4.4, 0.04, 3.7]} c="#dbe5cc" r={0.25} />
      {[-2.95, -2.65, -0.55, -0.25].map((x) => (
        <Box key={x} p={[x, 0.1, 1.67]} s={[0.025, 0.005, 3.4]} c="#c1cfae" r={0} />
      ))}
      <Clickable kind="tv" onSelect={onSelect}>
        <Box p={[-1.6, 0.35, 0.43]} s={[3.1, 0.4, 1.05]} c="#769c83" r={0.17} />
        <Box p={[-1.6, 0.8, 0.02]} s={[3.1, 0.8, 0.25]} c={sage} r={0.14} />
        {[-2.5, -1.58, -0.66].map((x) => (
          <Box key={x} p={[x, 0.57, 0.49]} s={[0.86, 0.22, 0.78]} c="#a7c5ac" r={0.1} />
        ))}
        {[-3.02, -0.18].map((x) => (
          <Box key={x} p={[x, 0.62, 0.43]} s={[0.28, 0.52, 1.04]} c="#8bae93" r={0.1} />
        ))}
        <Box
          p={[-2.61, 0.84, 0.23]}
          s={[0.44, 0.42, 0.16]}
          c="#f0deb5"
          rotation={[0, 0, -0.2]}
          r={0.06}
        />
        <Box
          p={[-0.7, 0.84, 0.23]}
          s={[0.42, 0.4, 0.16]}
          c={pink}
          rotation={[0, 0, 0.16]}
          r={0.07}
        />
        <Box p={[-1.6, 0.3, 3.6]} s={[3, 0.57, 0.54]} c={wood} />
        {[-2.5, -1.6, -0.7].map((x) => (
          <Box key={x} p={[x, 0.32, 3.31]} s={[0.85, 0.42, 0.015]} c="#dcbf97" />
        ))}
        <Box p={[-1.6, 1.05, 3.6]} s={[2.1, 1.1, 0.09]} c="#44544c" r={0.035} />
        <Box p={[-1.6, 1.06, 3.54]} s={[1.98, 0.98, 0.025]} c={tv ? '#bad1cf' : '#8eaaa0'} />
        <group position={[-1.6, 1.06, 3.51]}>
          <Ball p={[0.5, 0.22, 0]} s={[0.15, 0.15, 0.02]} c="#f4deae" />
          <mesh position={[-0.35, -0.18, 0]}>
            <circleGeometry args={[0.5, 3]} />
            <meshStandardMaterial color="#dce6d7" />
          </mesh>
          <mesh position={[0.25, -0.22, -0.005]}>
            <circleGeometry args={[0.6, 3]} />
            <meshStandardMaterial color="#b3c9b1" />
          </mesh>
        </group>
        <Box p={[-1.6, 0.65, 3.6]} s={[0.3, 0.17, 0.15]} c="#45564c" />
      </Clickable>
      <Clickable kind="tea" onSelect={onSelect}>
        <Box p={[-1.65, 0.43, 1.8]} s={[1.95, 0.13, 0.9]} c="#dbbb90" r={0.2} />
        {[-2.3, -1].map((x) => (
          <Box key={x} p={[x, 0.2, 1.8]} s={[0.13, 0.4, 0.5]} c={wood} />
        ))}
        <Cup p={[-2.1, 0.5, 1.8]} />
        <Cup p={[-1.24, 0.5, 1.8]} c={pink} />
        <Cylinder p={[-1.68, 0.6, 1.72]} r={0.14} h={0.22} c="#7d9f90" />
        <Ball p={[-1.68, 0.74, 1.72]} s={[0.14, 0.04, 0.14]} c="#67887a" />
        <Book p={[-1.53, 0.52, 2.02]} c="#f2e8d1" s={[0.34, 0.035, 0.21]} />
      </Clickable>
      <Clickable kind="water" onSelect={onSelect}>
        <Plant p={[-5.4, 0, 3.15]} scale={1.25} />
        <Plant p={[-5.55, 0, 2.1]} scale={0.65} />
        <Box p={[-5.55, 0.32, 1.2]} s={[0.48, 0.64, 0.54]} c={wood} />
        <Plant p={[-5.55, 0.65, 1.2]} scale={0.55} />
      </Clickable>
      <Clickable kind="rest" onSelect={onSelect}>
        <Box p={[3.3, 0.25, -2.5]} s={[1.9, 0.35, 2.5]} c={wood} />
        <Box p={[3.3, 0.51, -2.43]} s={[1.82, 0.28, 2.35]} c={white} r={0.12} />
        <Box p={[3.3, 0.7, -3.68]} s={[2, 0.95, 0.11]} c="#bb9d7e" />
        <Box p={[3.3, 0.73, -3.13]} s={[1.15, 0.2, 0.48]} c="#fffcf0" r={0.09} />
        <Box p={[3.3, 0.69, -2.13]} s={[1.83, 0.16, 1.58]} c="#e3b5a8" r={0.06} />
        {[-2.7, -2.5, -2.3].map((z) => (
          <Box key={z} p={[3.3, 0.779, z]} s={[1.8, 0.006, 0.022]} c="#f0d3c3" r={0} />
        ))}
        <Box p={[4.72, 0.31, -3.25]} s={[0.65, 0.6, 0.7]} c={wood} />
        <Cylinder p={[4.72, 0.72, -3.25]} r={0.16} h={0.22} c="#94ac9c" />
        <Cylinder p={[4.72, 0.97, -3.25]} r={0.25} r2={0.3} h={0.33} c="#f8e9c7" />
        <Box p={[5.45, 0.92, -3.46]} s={[0.95, 1.82, 0.85]} c="#d1b68f" />
        <Box p={[5.45, 0.93, -3.015]} s={[0.03, 1.7, 0.025]} c="#b09776" />
      </Clickable>
      <Clickable kind="read" onSelect={onSelect}>
        <Box p={[1.5, 0.59, -3.2]} s={[0.46, 1.18, 1.28]} c={wood} />
        {[0.16, 0.52, 0.89, 1.2].map((y) => (
          <Box key={y} p={[1.56, y, -3.2]} s={[0.56, 0.055, 1.32]} c="#e2c39b" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <Book
            key={i}
            p={[1.63, 0.73, -3.6 + i * 0.22]}
            c={['#819f95', '#edd4a7', '#bb8d91', '#8e9faf'][i]}
            s={[0.35, 0.33, 0.15]}
          />
        ))}
        <Box p={[1.9, 0.15, -0.48]} s={[0.85, 0.25, 0.85]} c="#c6b2cf" r={0.2} />
        <Book p={[1.9, 0.3, -0.48]} c="#f0e8da" s={[0.42, 0.06, 0.3]} />
        <Plant p={[5.55, 0, -0.6]} scale={0.7} />
      </Clickable>
      <Clickable kind="wash" onSelect={onSelect}>
        <Box p={[4.95, 0.38, 3.47]} s={[1.7, 0.68, 0.8]} c={white} r={0.17} />
        <Box p={[4.95, 0.73, 3.47]} s={[1.46, 0.055, 0.61]} c="#b5d7d4" r={0.2} />
        <Box p={[5.7, 0.76, 1.37]} s={[0.56, 1.1, 0.9]} c={wood} />
        <Box p={[5.65, 1.3, 1.37]} s={[0.74, 0.13, 1.02]} c={white} />
        <Cylinder p={[5.65, 1.38, 1.37]} r={0.3} h={0.12} c="#d4e2dc" />
        <Box p={[4, 0.45, 1.08]} s={[0.6, 0.9, 0.52]} c="#edf0e7" />
        <Box p={[4, 0.97, 1.08]} s={[0.58, 0.1, 0.53]} c="#eedcca" />
        <Box p={[4.1, 0.12, 2.3]} s={[1.4, 0.08, 0.75]} c="#a5c4c0" r={0.12} />
      </Clickable>
      <group position={[-0.12, 1.83, -3.93]}>
        <Box s={[0.62, 0.83, 0.055]} c={wood} />
        <Box p={[0, 0, 0.04]} s={[0.53, 0.73, 0.025]} c="#faf6e9" />
        <Ball p={[0, 0.09, 0.07]} s={[0.16, 0.16, 0.012]} c={pink} />
        <Box p={[0, -0.17, 0.07]} s={[0.018, 0.24, 0.01]} c="#90a58a" />
      </group>
      <Plant p={[0.35, 0, -3.43]} scale={0.7} />
    </group>
  );
}

function Character({
  echo,
  position,
  speed,
  activity,
  mood,
  onClick,
}: {
  echo: boolean;
  position: [number, number];
  speed: number;
  activity: State['activity'];
  mood: string;
  onClick: () => void;
}) {
  const root = useRef<THREE.Group>(null!),
    body = useRef<THREE.Group>(null!),
    armL = useRef<THREE.Group>(null!),
    armR = useRef<THREE.Group>(null!),
    eyes = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!),
    legR = useRef<THREE.Group>(null!);
  const current = useRef(new THREE.Vector3(position[0], 0, position[1])),
    path = useRef<number[][]>([]),
    phase = useRef(0);
  const [walking, setWalking] = useState(false);
  const participates = echo || activity?.together;
  const seated =
    participates &&
    activity?.stage === 'doing' &&
    ['tv', 'tea', 'eat', 'read'].includes(activity.kind);
  const resting = participates && activity?.stage === 'doing' && activity.kind === 'rest';
  const sleeping = echo && resting && !walking;
  const happy = /开心|暖/.test(mood);
  const doing = participates && activity?.stage === 'doing' && !walking;
  useEffect(() => {
    path.current = walkPath([current.current.x, current.current.z], position).slice(1);
  }, [position[0], position[1]]);
  useFrame((_, dt) => {
    phase.current += dt * speed;
    const next = path.current[0];
    const moving = !!next;
    if (moving !== walking) setWalking(moving);
    if (next && speed) {
      const destination = new THREE.Vector3(next[0], 0, next[1]),
        distance = current.current.distanceTo(destination),
        step = Math.min(dt, 0.06) * 2.5 * speed;
      if (distance < step) {
        current.current.copy(destination);
        path.current.shift();
      } else current.current.add(destination.sub(current.current).normalize().multiplyScalar(step));
      root.current.rotation.y = Math.atan2(
        next[0] - current.current.x,
        next[1] - current.current.z,
      );
    } else if (!next)
      root.current.rotation.y = THREE.MathUtils.damp(
        root.current.rotation.y,
        resting
          ? 0
          : activity?.kind === 'cook' && participates
            ? Math.PI
            : activity?.kind === 'eat' && participates
              ? echo
                ? Math.PI / 2
                : -Math.PI / 2
              : 0.22,
        5,
        dt,
      );
    root.current.position.copy(current.current);
    const t = phase.current;
    body.current.position.y = moving
      ? Math.sin(t * 12) * 0.035
      : Math.sin(t * 2) * (happy ? 0.022 : 0.012);
    eyes.current.scale.y = t % 4.4 > 4.23 ? 0.1 : 1;
    const sitting = seated && !moving;
    legL.current.rotation.x = sitting ? -1.2 : moving ? Math.sin(t * 12) * 0.45 : 0;
    legR.current.rotation.x = sitting ? -1.2 : moving ? -Math.sin(t * 12) * 0.45 : 0;
    armL.current.rotation.x = moving
      ? -Math.sin(t * 12) * 0.35
      : participates && activity?.stage === 'doing'
        ? -0.55 + Math.sin(t * 4) * 0.12
        : Math.sin(t * 1.6) * 0.04;
    armR.current.rotation.x = moving
      ? Math.sin(t * 12) * 0.35
      : participates && activity?.stage === 'doing'
        ? -0.65 + Math.sin(t * 4 + 1) * 0.12
        : Math.sin(t * 1.6 + 1) * 0.04;
  });
  const hair = echo ? '#65504b' : '#434845',
    skin = '#f4d2b9';
  return (
    <group
      ref={root}
      position={[position[0], 0, position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <group ref={body} scale={0.87}>
        <group
          position={
            sleeping
              ? [1.3, 0.92, 0.22]
              : [
                  0,
                  seated && !walking
                    ? activity?.kind === 'read'
                      ? -0.17
                      : activity?.kind === 'eat'
                        ? 0.06
                        : 0.24
                    : resting && !walking
                      ? -0.17
                      : 0,
                  seated && !walking && ['tea', 'tv'].includes(activity!.kind) ? -0.56 : 0,
                ]
          }
          rotation={sleeping ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          <group ref={legL} position={[-0.135, 0.53, 0]}>
            <Box p={[0, -0.19, 0]} s={[0.17, 0.4, 0.18]} c={echo ? skin : '#536b72'} r={0.075} />
            <Box
              p={[0, -0.4, 0.065]}
              s={[0.22, 0.14, 0.31]}
              c={echo ? '#b98979' : '#f1eee2'}
              r={0.055}
            />
          </group>
          <group ref={legR} position={[0.135, 0.53, 0]}>
            <Box p={[0, -0.19, 0]} s={[0.17, 0.4, 0.18]} c={echo ? skin : '#536b72'} r={0.075} />
            <Box
              p={[0, -0.4, 0.065]}
              s={[0.22, 0.14, 0.31]}
              c={echo ? '#b98979' : '#f1eee2'}
              r={0.055}
            />
          </group>
          {echo && (
            <mesh position={[0, 0.59, 0]} castShadow>
              <cylinderGeometry args={[0.23, 0.36, 0.34, 24]} />
              <meshStandardMaterial color="#b3a4bb" />
            </mesh>
          )}
          <Box p={[0, 0.86, 0]} s={[0.46, 0.52, 0.3]} c={echo ? '#f4ead3' : '#6c9e91'} r={0.14} />
          <Box
            p={[0, 1.04, 0.156]}
            s={[0.13, 0.23, 0.025]}
            c={echo ? '#d5c5b2' : '#ecdfc6'}
            r={0.02}
          />
          <group ref={armL} position={[-0.3, 1.03, 0]}>
            <Box
              p={[-0.015, -0.16, 0]}
              s={[0.16, 0.38, 0.18]}
              c={echo ? '#f4ead3' : '#6c9e91'}
              r={0.07}
            />
            <Ball p={[-0.02, -0.37, 0]} s={[0.08, 0.095, 0.08]} c={skin} />
          </group>
          <group ref={armR} position={[0.3, 1.03, 0]}>
            <Box
              p={[0.015, -0.16, 0]}
              s={[0.16, 0.38, 0.18]}
              c={echo ? '#f4ead3' : '#6c9e91'}
              r={0.07}
            />
            <Ball p={[0.02, -0.37, 0]} s={[0.08, 0.095, 0.08]} c={skin} />
            {doing && activity?.kind === 'tea' && (
              <Cup p={[0.015, -0.39, 0.08]} c={echo ? '#d6aaa0' : '#a6c1b0'} />
            )}
            {doing && activity?.kind === 'cook' && (
              <>
                <Cylinder p={[0.015, -0.35, 0.07]} r={0.019} h={0.39} c={wood} />
                <Ball p={[0.015, -0.13, 0.07]} s={[0.065, 0.08, 0.018]} c={wood} />
              </>
            )}
            {doing && activity?.kind === 'water' && (
              <>
                <Cylinder p={[0.06, -0.37, 0.06]} r={0.15} h={0.2} c="#9cb6aa" />
                <Box
                  p={[0.2, -0.36, 0.06]}
                  s={[0.2, 0.04, 0.06]}
                  c="#9cb6aa"
                  rotation={[0, 0, 0.4]}
                />
              </>
            )}
          </group>
          {doing && activity?.kind === 'read' && (
            <Box p={[0, 0.72, 0.33]} s={[0.47, 0.045, 0.32]} c="#e8cf9d" rotation={[0.4, 0, 0]} />
          )}
          <Cylinder p={[0, 1.17, 0]} r={0.1} h={0.17} c={skin} />
          <Ball p={[0, 1.58, -0.035]} s={[0.425, 0.47, 0.365]} c={hair} />
          {echo && (
            <>
              <Ball p={[-0.29, 1.29, -0.09]} s={[0.16, 0.43, 0.22]} c={hair} />
              <Ball p={[0.29, 1.29, -0.09]} s={[0.16, 0.43, 0.22]} c={hair} />
            </>
          )}
          <Ball p={[0, 1.52, 0.095]} s={[0.345, 0.36, 0.3]} c={skin} />
          <Ball p={[-0.19, 1.83, 0.22]} s={[0.24, 0.16, 0.16]} c={hair} />
          <Ball p={[0.18, 1.85, 0.17]} s={[0.21, 0.16, 0.2]} c={hair} />
          <group ref={eyes} position={[0, 1.56, 0.375]}>
            {[-0.13, 0.13].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                {resting ? (
                  <Box s={[0.095, 0.023, 0.018]} c={hair} r={0.01} />
                ) : (
                  <>
                    <Ball p={[0, 0, 0]} s={[0.061, 0.088, 0.026]} c="#fffdf4" />
                    <Ball
                      p={[0.005, -0.004, 0.022]}
                      s={[0.041, 0.069, 0.02]}
                      c={echo ? '#655d4b' : '#486361'}
                    />
                    <Ball p={[0.009, 0.025, 0.041]} s={[0.014, 0.02, 0.008]} c="#fffef5" />
                  </>
                )}
              </group>
            ))}
          </group>
          <Ball
            p={[-0.235, 1.435, 0.33]}
            s={[happy ? 0.07 : 0.058, 0.026, 0.013]}
            c={happy ? '#e3948c' : '#e9b4a4'}
          />
          <Ball
            p={[0.235, 1.435, 0.33]}
            s={[happy ? 0.07 : 0.058, 0.026, 0.013]}
            c={happy ? '#e3948c' : '#e9b4a4'}
          />
          <mesh position={[0, 1.42, 0.389]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.036, 0.009, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#b0776d" />
          </mesh>
          {echo && (
            <group position={[0.35, 1.83, 0.14]} rotation={[0, 0, -0.3]}>
              <Ball p={[-0.065, 0, 0]} s={[0.075, 0.1, 0.035]} c={pink} />
              <Ball p={[0.065, 0, 0]} s={[0.075, 0.1, 0.035]} c={pink} />
              <Ball p={[0, 0, 0.02]} s={[0.036, 0.04, 0.025]} c="#f5c6b5" />
            </group>
          )}
        </group>
      </group>
      <Html
        position={sleeping ? [1.1, 1.2, -0.6] : [0, 1.95, 0]}
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className={`world-name ${echo ? 'echo' : 'player'}`}>
          {echo ? 'Echo' : '你'}
          <span>{echo ? (walking ? '散步中' : mood) : '在家'}</span>
        </div>
      </Html>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.076, 0]}>
        <ringGeometry args={[0.31, 0.35, 40]} />
        <meshBasicMaterial color={echo ? '#e3a195' : '#83a995'} transparent opacity={0.65} />
      </mesh>
    </group>
  );
}
function AnimationClock({ running }: { running: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / 30);
    return () => clearInterval(timer);
  }, [running, invalidate]);
  return null;
}
function CameraRig({ reset, zoom }: { reset: number; zoom: number }) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<any>(null);
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.min(size.width / 18.8, size.height / 13.4) * zoom;
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size, zoom, invalidate]);
  useEffect(() => {
    camera.position.set(12, 13, 16);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  }, [reset, camera, invalidate]);
  const baseZoom = Math.min(size.width / 18.8, size.height / 13.4);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      enablePan={false}
      enableZoom
      minZoom={baseZoom * 0.65}
      maxZoom={baseZoom * 1.75}
      minPolarAngle={0.3}
      maxPolarAngle={1.25}
      minAzimuthAngle={-Math.PI * 0.38}
      maxAzimuthAngle={Math.PI * 0.48}
      target={[0, 0, 0]}
    />
  );
}
function Scene({
  state,
  onSelect,
  onMove,
  onEcho,
  reset,
  zoom,
}: {
  state: State;
  onSelect: (k: ActivityKind) => void;
  onMove: (p: [number, number]) => void;
  onEcho: () => void;
  reset: number;
  zoom: number;
}) {
  const night = state.minute < 360 || state.minute > 1140;
  return (
    <>
      <color attach="background" args={[night ? '#d1dcda' : '#edf3ef']} />
      <ambientLight intensity={night ? 0.9 : 1.3} />
      <hemisphereLight args={['#fff6e1', '#aec8bb', 1.2]} />
      <directionalLight
        castShadow
        position={[-4, 12, 5]}
        intensity={night ? 1 : 2.4}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-normalBias={0.035}
      />
      <House onSelect={onSelect} night={night} tv={state.activity?.kind === 'tv'} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.07, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta < 4) {
            e.stopPropagation();
            onMove([e.point.x, e.point.z]);
          }
        }}
      >
        <planeGeometry args={[11.8, 7.8]} />
        <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0} depthWrite={false} />
      </mesh>
      <Character
        echo
        position={state.echoPosition}
        speed={state.speed}
        activity={state.activity}
        mood={state.mood}
        onClick={onEcho}
      />
      <Character
        echo={false}
        position={state.playerPosition}
        speed={state.speed}
        activity={state.activity}
        mood="在家"
        onClick={onEcho}
      />
      <ContactShadows
        position={[0, -0.535, 0]}
        opacity={0.35}
        scale={25}
        blur={2.8}
        far={8}
        resolution={512}
        frames={1}
      />
      <Grid
        position={[0, -0.55, 0]}
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#d3dfd8"
        sectionSize={5}
        sectionThickness={0.45}
        sectionColor="#d3dfd8"
        fadeDistance={32}
        infiniteGrid
      />
      <CameraRig reset={reset} zoom={zoom} />
      <AnimationClock running={state.speed > 0} />
    </>
  );
}
export default function World(props: Parameters<typeof Scene>[0]) {
  const [error, setError] = useState(false);
  return (
    <div className="world" aria-label="3D 日式小家">
      {error ? (
        <div className="world-error">3D 场景无法启动，请开启浏览器硬件加速后刷新。</div>
      ) : (
        <Canvas
          frameloop="demand"
          orthographic
          camera={{ position: [12, 13, 16], zoom: 50, near: 0.1, far: 150 }}
          shadows
          dpr={[1, 1.6]}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', () => setError(true));
          }}
          fallback={
            <div className="world-error">此浏览器不支持 WebGL，请使用支持 3D 的浏览器。</div>
          }
        >
          <Suspense fallback={null}>
            <Scene {...props} />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
