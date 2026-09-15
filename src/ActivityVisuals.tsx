import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Ball, Box, Cup, Cylinder, pink, sage, white, wood, type V3 } from './ScenePrimitives';
import type { State } from './types';

export function activityFraction(activity: State['activity']) {
  return activity
    ? THREE.MathUtils.clamp((activity.progress - 7) / (activity.duration - 7), 0, 1)
    : 0;
}

export function Bowl({
  p = [0, 0, 0],
  food = true,
  c = white,
}: {
  p?: V3;
  food?: boolean;
  c?: string;
}) {
  return (
    <group position={p}>
      <Cylinder p={[0, 0.07, 0]} r={0.17} r2={0.09} h={0.14} c={c} />
      <Cylinder p={[0, 0.144, 0]} r={0.145} h={0.012} c={food ? '#f3e5be' : '#bac9bf'} />
      {food &&
        [-1, 0, 1].map((i) => (
          <Ball
            key={i}
            p={[i * 0.075, 0.155, 0.025]}
            s={[0.04, 0.02, 0.04]}
            c={i === 0 ? '#dc8d62' : '#71965b'}
          />
        ))}
    </group>
  );
}

export function Teapot() {
  return (
    <group>
      <Ball p={[0, 0.12, 0]} s={[0.17, 0.14, 0.15]} c={sage} />
      <Cylinder p={[0, 0.25, 0]} r={0.12} h={0.025} c="#5d8879" />
      <Ball p={[0, 0.28, 0]} s={[0.035, 0.03, 0.035]} c={sage} />
      <group position={[0, 0.13, 0.17]} rotation={[0.9, 0, 0]}>
        <Cylinder p={[0, 0, 0]} r={0.04} r2={0.065} h={0.24} c={sage} />
      </group>
      <mesh position={[0, 0.13, -0.17]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.105, 0.025, 8, 20]} />
        <meshStandardMaterial color={sage} />
      </mesh>
    </group>
  );
}

export function WateringCan() {
  return (
    <group>
      <Cylinder p={[0, 0, 0]} r={0.16} h={0.25} c="#83b7b5" />
      <Cylinder p={[0, 0.13, 0]} r={0.11} h={0.012} c="#497a80" />
      <group position={[0, 0.01, 0.24]} rotation={[0.95, 0, 0]}>
        <Cylinder p={[0, 0, 0]} r={0.032} h={0.38} c="#83b7b5" />
        <Cylinder p={[0, 0.2, 0]} r={0.075} h={0.04} c="#d1e3db" />
      </group>
      <mesh position={[0, 0.02, -0.18]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.12, 0.025, 8, 20]} />
        <meshStandardMaterial color="#83b7b5" />
      </mesh>
    </group>
  );
}

export function OpenBook({ time }: { time: React.RefObject<number> }) {
  const page = useRef<THREE.Group>(null!);
  useFrame(() => {
    page.current.rotation.z = -Math.PI * THREE.MathUtils.smoothstep(time.current % 5, 3.6, 4.7);
  });
  return (
    <group rotation={[0.25, 0, 0]}>
      {[-1, 1].map((side) => (
        <group key={side} rotation={[0, 0, side * 0.1]}>
          <Box p={[side * 0.13, 0, 0]} s={[0.26, 0.025, 0.34]} c="#7799a0" r={0.008} />
          <Box p={[side * 0.125, 0.025, 0]} s={[0.24, 0.025, 0.31]} c="#fff9e9" r={0.003} />
          {[-0.09, -0.035, 0.02, 0.075].map((z) => (
            <Box key={z} p={[side * 0.125, 0.04, z]} s={[0.17, 0.003, 0.008]} c="#b1afa0" r={0} />
          ))}
        </group>
      ))}
      <group ref={page} position={[0, 0.047, 0]}>
        <Box p={[0.12, 0, 0]} s={[0.24, 0.006, 0.3]} c="#fffbed" r={0} />
      </group>
      <Box p={[-0.11, 0.055, 0.16]} s={[0.035, 0.008, 0.09]} c={pink} r={0} />
    </group>
  );
}

export function Particles({
  p,
  time,
  mode = 'steam',
  active = true,
}: {
  p: V3;
  time: React.RefObject<number>;
  mode?: 'steam' | 'water' | 'sparkle';
  active?: boolean;
}) {
  const root = useRef<THREE.Group>(null!);
  useFrame(() => {
    root.current.children.forEach((child, i) => {
      const f = (time.current * (mode === 'water' ? 1.7 : 0.5) + i / 9) % 1;
      child.position.set(
        Math.sin(i * 2.4 + f * 3) * (mode === 'water' ? 0.055 : 0.12),
        mode === 'water' ? -f * 0.45 : f * 0.55,
        Math.cos(i * 2.4) * 0.065,
      );
      child.scale.setScalar(mode === 'water' ? 0.8 : 0.4 + f);
      (child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity =
        (1 - f) * (mode === 'water' ? 0.75 : 0.3);
    });
  });
  return (
    <group ref={root} position={p} visible={active}>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[mode === 'steam' ? 0.065 : 0.018, 8, 6]} />
          <meshBasicMaterial
            color={mode === 'water' ? '#74b9d6' : '#ffffff'}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function ActivityDetails({ state }: { state: State }) {
  const time = useRef(0),
    food = useRef<THREE.Group>(null!),
    film = useRef<THREE.Group>(null!),
    blanket = useRef<THREE.Group>(null!);
  const a = state.activity,
    active = a?.stage === 'doing',
    f = activityFraction(a);
  const cook = active && a.kind === 'cook',
    eat = active && a.kind === 'eat';
  const tea = active && a.kind === 'tea',
    tv = active && a.kind === 'tv';
  const wash = active && a.kind === 'wash',
    rest = active && a.kind === 'rest';
  useFrame((_, dt) => {
    time.current += Math.min(dt, 0.1) * state.speed;
    film.current.position.x = Math.sin(time.current * 0.45) * 0.45;
    blanket.current.scale.y = rest ? 1 + Math.sin(time.current * 1.6) * 0.018 : 1;
    food.current.scale.setScalar(eat ? Math.max(0.15, 1 - f * 0.85) : 1);
  });
  return (
    <group>
      {/* Work surfaces align with the actors' hand targets. */}
      <Box p={[-3.7, 1.052, -3.52]} s={[0.73, 0.035, 0.5]} c="#ba9067" />
      <group visible={!cook || f < 0.48}>
        <Ball p={[-3.83, 1.12, -3.57]} s={[0.11, 0.08, 0.1]} c="#d96f57" />
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            p={[-3.55 + i * 0.055, 1.09, -3.49]}
            s={[0.035, 0.04, 0.13]}
            c="#77a15f"
            r={0.009}
          />
        ))}
      </group>
      <group visible={cook && f >= 0.48}>
        <Bowl p={[-3.7, 1.075, -3.53]} c="#e7c38e" />
      </group>
      <Cylinder p={[-2.5, 1.09, -3.53]} r={0.25} h={0.025} c="#3b4f4b" />
      <Cylinder p={[-2.5, 1.13, -3.53]} r={0.24} r2={0.2} h={0.08} c="#576c67" />
      <Cylinder p={[-2.5, 1.177, -3.53]} r={0.21} h={0.008} c="#e7bd62" />
      <Box p={[-2.5, 1.12, -3.22]} s={[0.075, 0.055, 0.28]} c="#576c67" />
      {cook && f > 0.2 && f < 0.88 && (
        <>
          <mesh position={[-2.5, 1.087, -3.53]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.25, 24]} />
            <meshBasicMaterial color="#f2aa57" />
          </mesh>
          <Particles p={[-2.5, 1.2, -3.53]} time={time} />
        </>
      )}
      <Box p={[-5.4, 1.09, -3.49]} s={[0.3, 0.07, 0.31]} c="#e3ceb1" />
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-4.04 + i * 0.24, 1.04, -3.83]}>
          <Cylinder p={[0, 0.12, 0]} r={0.075} h={0.23} c={['#ad6652', '#d8ba7c', '#8ca68d'][i]} />
          <Cylinder p={[0, 0.25, 0]} r={0.075} h={0.03} c={wood} />
        </group>
      ))}
      <Box p={[-4.65, 0.68, -3.22]} s={[0.3, 0.34, 0.025]} c="#efdfb8" />
      <Box p={[-3.2, 0.85, -0.7]} s={[0.42, 0.008, 1.16]} c="#819ea3" r={0.01} />
      {[-3.72, -2.68].map((x, i) => (
        <group key={x}>
          <Box
            p={[x, 0.85, -0.67]}
            s={[0.44, 0.009, 0.68]}
            c={i ? '#d4e0d1' : '#e7c9be'}
            r={0.015}
          />
          <Cylinder p={[x, 0.868, -0.64]} r={0.205} h={0.025} />
          <group visible={!eat || (i === 1 && !a?.together)}>
            <Bowl p={[x, 0.88, -0.64]} food={state.meals > 0} />
          </group>
          {[-0.025, 0.025].map((z) => (
            <Box key={z} p={[x, 0.875, -0.37 + z]} s={[0.3, 0.018, 0.015]} c={wood} r={0.005} />
          ))}
          <Cup p={[x, 0.85, -1.14]} c={i ? '#bbd4d0' : '#e5b7a4'} />
        </group>
      ))}
      <Cylinder p={[-3.2, 0.88, -0.73]} r={0.23} h={0.03} />
      <group ref={food} position={[-3.2, 0.905, -0.73]} visible={state.meals > 0}>
        {[-0.1, 0, 0.1].map((x) => (
          <Box key={x} p={[x, 0.055, 0]} s={[0.085, 0.09, 0.24]} c="#e7bc61" r={0.02} />
        ))}
        <Ball p={[0.13, 0.045, 0.14]} s={[0.07, 0.04, 0.045]} c="#71995a" />
      </group>
      <Box p={[-1.68, 0.515, 1.77]} s={[1.52, 0.028, 0.64]} c="#8caa9e" r={0.04} />
      <group position={[-1.7, 0.535, 1.78]} visible={!tea || f > 0.38}>
        <Teapot />
      </group>
      {[-2.15, -1.15].map((x, i) => (
        <group key={x}>
          <Cylinder p={[x, 0.54, 1.72]} r={0.14} h={0.018} c="#eee7d4" />
          <group visible={!tea || (i === 0 ? f < 0.4 : !a?.together)}>
            <Cup p={[x, 0.55, 1.72]} c={i ? pink : white} />
          </group>
        </group>
      ))}
      <Cylinder p={[-1.68, 0.55, 2]} r={0.16} h={0.02} />
      {[-0.07, 0.06].map((x) => (
        <Ball key={x} p={[-1.68 + x, 0.58, 2]} s={[0.057, 0.025, 0.052]} c="#d7b177" />
      ))}
      <Particles p={[-1.7, 0.82, 1.78]} time={time} active={tea} />
      <group position={[-1.6, 1.06, 3.6]} visible={tv}>
        <group ref={film}>
          {[-0.035, 0.035].map((z) => (
            <group key={z}>
              <Ball p={[0, 0.24, z]} s={[0.24, 0.055, 0.012]} c="#fff6df" />
              <Ball p={[-0.1, 0.29, z]} s={[0.1, 0.08, 0.013]} c="#fff6df" />
            </group>
          ))}
        </group>
        {[-0.035, 0.035].map((z) => (
          <group key={z}>
            <Ball p={[0.58, 0.23, z]} s={[0.13, 0.13, 0.01]} c="#f2cf86" />
            <mesh position={[-0.3, -0.19, z]}>
              <circleGeometry args={[0.47, 3]} />
              <meshStandardMaterial color="#789e88" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.28, -0.19, z]}>
              <circleGeometry args={[0.42, 3]} />
              <meshStandardMaterial color="#a0b797" side={THREE.DoubleSide} />
            </mesh>
            <Box p={[0, -0.39, z]} s={[1.3, 0.035, 0.008]} c="#f7f1df" r={0} />
          </group>
        ))}
      </group>
      <Box p={[-2.83, 0.8, 0.64]} s={[0.3, 0.025, 0.7]} c="#d2b0bd" r={0.02} />
      <group visible={!tv} position={[-1.01, 0.55, 2.02]}>
        <Box s={[0.12, 0.045, 0.26]} c="#4a605c" />
        <Ball p={[0, 0.03, -0.065]} s={[0.022, 0.008, 0.022]} c={pink} />
      </group>
      <Cylinder p={[-5.4, 0.055, 3.15]} r={0.4} h={0.06} c="#aac4bb" />
      <Cylinder
        p={[-5.4, 0.55, 3.15]}
        r={0.29}
        h={0.012}
        c={active && a.kind === 'water' ? '#66594b' : '#99816a'}
      />
      <group position={[-4.6, 0.21, 3.55]} visible={!(active && a.kind === 'water')}>
        <WateringCan />
      </group>
      <Box p={[-5.55, 0.12, 1.95]} s={[0.62, 0.16, 0.55]} c="#9aac9b" />
      <group ref={blanket} position={[3.3, 0.79, -2.13]}>
        <Box s={[1.83, 0.05, 1.56]} c="#d5a6b4" r={0.02} />
      </group>
      <Box p={[1.65, 0.13, -1.5]} s={[0.68, 0.22, 0.65]} c="#a9bfbc" r={0.1} />
      <Box p={[2.7, 0.13, -0.4]} s={[0.72, 0.22, 0.72]} c="#aec3c2" r={0.1} />
      <Box p={[2.98, 0.09, 0.15]} s={[0.35, 0.06, 0.25]} c="#ad778a" />
      <Box p={[2.96, 0.145, 0.15]} s={[0.32, 0.04, 0.24]} c="#e2d4ad" />
      <group position={[4.75, 0.69, -2.99]}>
        <Cylinder p={[0, 0, 0]} r={0.1} h={0.04} c="#729c9b" />
        <Box p={[0, 0.15, 0]} s={[0.24, 0.26, 0.06]} c="#729c9b" />
        <Box p={[0, 0.15, 0.035]} s={[0.2, 0.2, 0.009]} c="#f7f0da" />
        <Box p={[0, 0.19, 0.042]} s={[0.015, 0.07, 0.006]} c="#546d68" r={0} />
        <Box p={[0.035, 0.15, 0.042]} s={[0.07, 0.015, 0.006]} c="#546d68" r={0} />
      </group>
      <group position={[0, -0.12, 0]}>
        <group position={[5.57, 1.45, 1.1]}>
          <Cylinder p={[0, 0.12, 0]} r={0.025} h={0.24} c="#879f9e" />
          <Box p={[-0.08, 0.23, 0]} s={[0.18, 0.04, 0.045]} c="#879f9e" />
        </group>
        <Particles p={[5.42, 1.65, 1.1]} time={time} mode="water" active={wash && f < 0.3} />
        <group position={[5.91, 1.94, 1.38]} rotation={[0, -Math.PI / 2, 0]}>
          <Box s={[0.8, 0.85, 0.055]} c="#a2b7ae" />
          <Box p={[0, 0, 0.032]} s={[0.7, 0.75, 0.015]} c="#d1e5e6" />
          <Box
            p={[-0.18, 0.08, 0.045]}
            s={[0.04, 0.45, 0.005]}
            c="#edf7f3"
            rotation={[0, 0, -0.4]}
          />
        </group>
        <Cylinder p={[5.65, 1.53, 1.72]} r={0.08} h={0.25} c="#90b6c1" />
        <Box p={[5.65, 1.675, 1.72]} s={[0.12, 0.035, 0.045]} c="#ece8dc" />
        <Cylinder p={[5.79, 1.47, 1.62]} r={0.065} h={0.15} c="#e2b19b" />
        {[-0.025, 0.025].map((x, i) => (
          <Box
            key={x}
            p={[5.79 + x, 1.63, 1.62]}
            s={[0.02, 0.26, 0.025]}
            c={i ? '#7fa6b3' : '#d69199'}
          />
        ))}
      </group>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[4, 1.05 + i * 0.075, 1.07]}
          s={[0.42, 0.065, 0.36]}
          c={i % 2 ? '#a7c8ca' : '#f4e7d2'}
          r={0.025}
        />
      ))}
    </group>
  );
}
