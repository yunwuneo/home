import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Ball, Cylinder, Cup, type V3 } from './ScenePrimitives';
import type { ActivityKind, PlaceId, State } from './types';

function Sign({
  text,
  p,
  color = '#365c60',
  width = 2.8,
}: {
  text: string;
  p: V3;
  color?: string;
  width?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 768, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 82, 720);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={p}>
      <planeGeometry args={[width, width / 4.8]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
function Spot({
  kind,
  onSelect,
  children,
}: {
  kind: ActivityKind;
  onSelect: (kind: ActivityKind) => void;
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
function Shell({
  floor,
  wall,
  title,
  accent,
}: {
  floor: string;
  wall: string;
  title: string;
  accent: string;
}) {
  return (
    <>
      <Box p={[0, -0.25, 0]} s={[12, 0.5, 8]} c={floor} r={0.12} />
      <Box p={[0, 1.65, -4]} s={[12, 3.3, 0.15]} c={wall} />
      <Box p={[-6, 1.65, 0]} s={[0.15, 3.3, 8]} c={wall} />
      <Box p={[0, 2.65, -3.88]} s={[11.7, 0.8, 0.04]} c={accent} />
      <Sign text={title} p={[0, 2.65, -3.84]} width={4.4} color={accent} />
      {[-4, -2, 0, 2, 4].map((x) => (
        <Box key={x} p={[x, 0.015, 0]} s={[0.018, 0.006, 7.9]} c="#ffffff" r={0} />
      ))}
    </>
  );
}
function Tree({ p, small = false }: { p: V3; small?: boolean }) {
  return (
    <group position={p} scale={small ? 0.5 : 1}>
      <Cylinder p={[0, 0.6, 0]} r={0.13} h={1.2} c="#a38e76" />
      <Ball p={[0, 1.8, 0]} s={[0.85, 1.1, 0.8]} c="#83b99b" />
      <Ball p={[-0.4, 1.4, 0.2]} s={[0.65, 0.75, 0.6]} c="#599d7a" />
      <Ball p={[0.4, 1.65, 0.2]} s={[0.55, 0.8, 0.6]} c="#a7c988" />
    </group>
  );
}
function Chair({
  p,
  color = '#658d9c',
  rotation = 0,
}: {
  p: V3;
  color?: string;
  rotation?: number;
}) {
  return (
    <group position={p} rotation={[0, rotation, 0]}>
      <Box p={[0, 0.4, 0]} s={[0.8, 0.16, 0.75]} c={color} r={0.08} />
      <Box p={[0, 0.78, -0.29]} s={[0.8, 0.7, 0.15]} c={color} r={0.08} />
      {[-0.28, 0.28].flatMap((x) =>
        [-0.25, 0.25].map((z) => (
          <Box key={`${x}${z}`} p={[x, 0.18, z]} s={[0.055, 0.36, 0.055]} c="#687880" />
        )),
      )}
    </group>
  );
}
function Market({ onSelect }: { onSelect: (k: ActivityKind) => void }) {
  return (
    <>
      <Shell floor="#e5eceb" wall="#f5f7f4" title="青禾超市 · FRESH MARKET" accent="#4e897c" />
      <Spot kind="shop" onSelect={onSelect}>
        {[-4.6, -2.3, 0, 2.3, 4.6].map((x, i) => (
          <group key={x}>
            <Box p={[x, 1.08, -3.3]} s={[2, 2.05, 0.9]} c="#aec6c5" />
            <Box p={[x, 1.15, -2.82]} s={[1.84, 1.7, 0.04]} c="#d6e9e8" />
            {[0.55, 1.15, 1.75].map((y) => (
              <group key={y}>
                <Box p={[x, y - 0.12, -2.8]} s={[1.9, 0.04, 0.4]} c="#ffffff" />
                {[-0.6, -0.2, 0.2, 0.6].map((dx, j) => (
                  <Box
                    key={dx}
                    p={[x + dx, y + 0.05, -2.85]}
                    s={[0.24, 0.3, 0.24]}
                    c={['#e6b65e', '#e3a199', '#85b2a0', '#99b4d1'][(i + j) % 4]}
                  />
                ))}
              </group>
            ))}
          </group>
        ))}
        {[-3.5, 2.7].map((x, i) => (
          <group key={x}>
            <Box p={[x, 0.4, -0.55]} s={[i ? 1.8 : 2.2, 0.8, 2.5]} c="#71968a" />
            {[-1.2, -0.5, 0.2].map((z, j) => (
              <group key={z}>
                <Box p={[x, 0.87, z]} s={[i ? 1.65 : 2, 0.14, 0.64]} c="#c5ad85" />
                {[-0.55, -0.18, 0.18, 0.55].map((dx, k) => (
                  <Ball
                    key={dx}
                    p={[x + dx, 1.03, z]}
                    s={[0.16, 0.17, 0.18]}
                    c={['#d67d69', '#edc25f', '#82ae67'][(j + i + (k % 2)) % 3]}
                  />
                ))}
              </group>
            ))}
            <Sign text={i ? '当季蔬果' : '今日新鲜'} p={[x, 0.48, 0.72]} width={1.4} />
          </group>
        ))}
        <Box p={[-3.5, 0.5, 2.8]} s={[2.6, 1, 1.4]} c="#cf8580" />
        <Box p={[-3.5, 1.04, 2.8]} s={[2.7, 0.08, 1.5]} c="#f7f7f3" />
        <Box p={[-3.8, 1.3, 2.75]} s={[0.55, 0.42, 0.06]} c="#466468" />
        <Sign text="CHECK OUT" p={[-3.5, 0.55, 3.51]} width={1.9} color="#bb706c" />
      </Spot>
      <Tree p={[5.2, 0, 2.7]} small />
    </>
  );
}
function Film({ speed }: { speed: number }) {
  const moving = useRef<THREE.Group>(null!);
  const time = useRef(0);
  useFrame((_, dt) => {
    time.current += Math.min(dt, 0.1) * speed;
    moving.current.position.x = Math.sin(time.current * 0.25) * 1.8;
    moving.current.position.y = Math.sin(time.current * 0.4) * 0.18;
  });
  return (
    <group position={[0, 1.85, -3.65]}>
      <Box s={[7, 2.9, 0.16]} c="#333b48" />
      <Box p={[0, 0, 0.1]} s={[6.65, 2.6, 0.02]} c="#a4cee0" />
      <Ball p={[2.1, 0.7, 0.14]} s={[0.32, 0.32, 0.015]} c="#fff0ab" />
      {[-2.2, -0.75, 0.75, 2.2].map((x, i) => (
        <Ball
          key={x}
          p={[x, -0.85, 0.15]}
          s={[1.05, 0.34 + i * 0.035, 0.025]}
          c={i % 2 ? '#679f98' : '#8ebbad'}
        />
      ))}
      <group ref={moving}>
        <Box p={[0, -0.2, 0.22]} s={[1.25, 0.08, 0.04]} c="#f7f7ed" />
        <mesh position={[0.08, 0.13, 0.22]}>
          <coneGeometry args={[0.38, 0.6, 3]} />
          <meshBasicMaterial color="#f9f5db" />
        </mesh>
      </group>
    </group>
  );
}
function Cinema({ state, onSelect }: { state: State; onSelect: (k: ActivityKind) => void }) {
  return (
    <>
      <Shell floor="#666c7c" wall="#858b9d" title="星光 · CINEMA 01" accent="#645d7d" />
      <Spot kind="movie" onSelect={onSelect}>
        <Film speed={state.speed} />
        {[-1.4, 0.5, 2.3].flatMap((z) =>
          [-3, -1.5, 0, 1.5].map((x) => (
            <group key={`${x}${z}`} position={[x, 0, z]} rotation={[0, Math.PI, 0]}>
              <Chair p={[0, 0, 0]} color="#b77689" />
              {[-0.5, 0.5].map((dx) => (
                <Box key={dx} p={[dx, 0.52, 0]} s={[0.16, 0.15, 0.8]} c="#765a73" />
              ))}
            </group>
          )),
        )}
      </Spot>
      {[-2, -0.1, 1.7, 3.3].map((z) => (
        <Box key={z} p={[3, 0.04, z]} s={[0.09, 0.03, 0.6]} c="#f9dfad" />
      ))}
      <Sign text="EXIT →" p={[4.6, 1.9, -3.85]} width={1.4} color="#4b9382" />
      <pointLight position={[0, 2, -2.5]} color="#b4dcf7" intensity={9} distance={9} />
    </>
  );
}
function Office({ onSelect }: { onSelect: (k: ActivityKind) => void }) {
  return (
    <>
      <Shell floor="#dce4ec" wall="#f1f4f7" title="晴川 · WORK & LIFE" accent="#6c96b0" />
      <Spot kind="work" onSelect={onSelect}>
        {[-2.65, 2.45].flatMap((x) =>
          [-2.1, 0.8].map((z) => (
            <group key={`${x}${z}`}>
              <Box p={[x, 0.82, z]} s={[2.5, 0.12, 1.2]} c="#f7faf9" />
              {[-1, 1].map((dx) => (
                <Box key={dx} p={[x + dx, 0.4, z]} s={[0.08, 0.8, 1]} c="#718b9a" />
              ))}
              <Box p={[x, 1.23, z - 0.25]} s={[1.1, 0.64, 0.07]} c="#526674" />
              <Box p={[x, 1.23, z - 0.205]} s={[0.99, 0.53, 0.02]} c="#bbdce6" />
              {[-0.12, 0.03, 0.18].map((dy) => (
                <Box
                  key={dy}
                  p={[x - 0.1, 1.23 + dy, z - 0.19]}
                  s={[0.62, 0.035, 0.008]}
                  c="#ffffff"
                />
              ))}
              <Box p={[x, 0.93, z + 0.22]} s={[0.75, 0.05, 0.23]} c="#b4c5cc" />
              <Cylinder p={[x, 1, z - 0.25]} r={0.035} h={0.3} c="#526674" />
              <Cup p={[x + 0.85, 0.89, z + 0.12]} c="#d9968a" />
              {x < 0 && z < 0 ? (
                <>
                  <Chair p={[x - 0.35, 0, z + 1.1]} rotation={Math.PI} />
                  <Chair p={[x + 0.65, 0, z + 1.1]} rotation={Math.PI} />
                </>
              ) : (
                <Chair p={[x, 0, z + 0.95]} rotation={Math.PI} />
              )}
            </group>
          )),
        )}
      </Spot>
      <Box p={[-5.15, 1, -1.65]} s={[1, 2, 4.3]} c="#b2c4cf" />
      {[0.5, 1.2, 1.8].map((y) => (
        <Box key={y} p={[-4.62, y, -1.65]} s={[0.08, 0.05, 4]} c="#f6faf8" />
      ))}
      <Tree p={[5.1, 0, -2.7]} small />
      <Tree p={[5.1, 0, 2.8]} small />
    </>
  );
}
function Cafe({ onSelect }: { onSelect: (k: ActivityKind) => void }) {
  return (
    <>
      <Shell floor="#e7ded2" wall="#f3ece4" title="转角 · COFFEE & CAKE" accent="#b47b64" />
      <Box p={[0, 0.55, -3.25]} s={[10.7, 1.1, 1.2]} c="#81a69c" />
      <Box p={[0, 1.13, -3.25]} s={[10.9, 0.12, 1.25]} c="#f5f3e9" />
      <Box p={[-2, 1.5, -3.25]} s={[1.5, 0.7, 0.8]} c="#8499a2" />
      <Box p={[-2, 1.5, -2.83]} s={[1.3, 0.4, 0.03]} c="#394e58" />
      {[0, 0.5, 1].map((x) => (
        <Cup key={x} p={[x, 1.19, -3.1]} />
      ))}
      <Spot kind="coffee" onSelect={onSelect}>
        {[-3, 2.5].flatMap((x) =>
          [-0.9, 2.2].map((z) => (
            <group key={`${x}${z}`}>
              <Cylinder p={[x, 0.78, z]} r={0.7} h={0.1} c="#d5b38d" />
              <Cylinder p={[x, 0.4, z]} r={0.07} h={0.8} c="#71877e" />
              <Cylinder p={[x, 0.06, z]} r={0.43} h={0.09} c="#71877e" />
              <Chair p={[x - 0.95, 0, z]} color="#d3a189" rotation={Math.PI / 2} />
              <Chair p={[x + 0.95, 0, z]} color="#8fae9e" rotation={-Math.PI / 2} />
              <Cup p={[x - 0.3, 0.84, z]} />
              <Cup p={[x + 0.3, 0.84, z]} c="#e5b4a3" />
              <Cylinder p={[x, 0.87, z + 0.25]} r={0.17} h={0.08} c="#e9cb8e" />
              <Ball p={[x, 0.94, z + 0.25]} s={[0.07, 0.06, 0.07]} c="#cd766f" />
            </group>
          )),
        )}
      </Spot>
      <Tree p={[5.1, 0, -1.6]} small />
    </>
  );
}
function River({ speed }: { speed: number }) {
  const waves = useRef<THREE.Group>(null!);
  const phase = useRef(0);
  useFrame((_, dt) => {
    phase.current += Math.min(dt, 0.1) * speed;
    waves.current.position.z = Math.sin(phase.current * 0.6) * 0.17;
  });
  return (
    <>
      <Box p={[4.4, -0.04, 0]} s={[3.2, 0.2, 8]} c="#81bccc" />
      <group ref={waves}>
        {Array.from({ length: 18 }, (_, i) => (
          <Box
            key={i}
            p={[3.2 + (i % 3) * 0.85, 0.07, -3.5 + Math.floor(i / 3) * 1.35]}
            s={[0.45, 0.01, 0.035]}
            c="#c7e7e8"
            r={0}
          />
        ))}
      </group>
    </>
  );
}
function Park({ state, onSelect }: { state: State; onSelect: (k: ActivityKind) => void }) {
  return (
    <>
      <Box p={[0, -0.25, 0]} s={[12, 0.5, 8]} c="#acd0a0" r={0.14} />
      <Box p={[0.4, 0.02, 0]} s={[3.7, 0.08, 8]} c="#e6e2d5" />
      <Box p={[-2.3, 0.02, -0.1]} s={[4.6, 0.08, 1.3]} c="#e6e2d5" />
      <River speed={state.speed} />
      {[-3, -1, 1, 3].map((z) => (
        <group key={z}>
          <Cylinder p={[2.65, 0.46, z]} r={0.045} h={0.85} c="#e5eee6" />
          <Box p={[2.65, 0.74, z]} s={[0.055, 0.06, 2]} c="#e5eee6" />
        </group>
      ))}
      <Tree p={[-4, 0, -2]} />
      <Tree p={[-4, 0, 2.2]} />
      <Spot kind="stroll" onSelect={onSelect}>
        <Box p={[0, 0.46, -2.4]} s={[3, 0.13, 0.75]} c="#b49b7b" />
        <Box p={[0, 0.86, -2.7]} s={[3, 0.7, 0.1]} c="#b49b7b" />
        {[-1.1, 1.1].map((x) => (
          <Box key={x} p={[x, 0.22, -2.4]} s={[0.09, 0.44, 0.6]} c="#587b72" />
        ))}
        <Cylinder p={[-2.4, 0.7, 1.5]} r={0.06} h={1.4} c="#668b81" />
        <Sign text="河畔步道 →" p={[-2.4, 1.3, 1.5]} width={1.5} />
      </Spot>
      {[-5.3, -2.4].flatMap((x) =>
        [-3.3, 3.3].map((z) => (
          <group key={`${x}${z}`}>
            <Ball p={[x, 0.16, z]} s={[0.4, 0.22, 0.4]} c="#74aa7b" />
            {[-0.18, 0, 0.18].map((dx) => (
              <Ball
                key={dx}
                p={[x + dx, 0.35, z]}
                s={[0.09, 0.09, 0.09]}
                c={dx ? '#edcf84' : '#d992a0'}
              />
            ))}
          </group>
        )),
      )}
    </>
  );
}
export default function Places({
  location,
  state,
  onSelect,
}: {
  location: PlaceId;
  state: State;
  onSelect: (kind: ActivityKind) => void;
}) {
  if (location === 'market') return <Market onSelect={onSelect} />;
  if (location === 'cinema') return <Cinema state={state} onSelect={onSelect} />;
  if (location === 'office') return <Office onSelect={onSelect} />;
  if (location === 'cafe') return <Cafe onSelect={onSelect} />;
  return <Park state={state} onSelect={onSelect} />;
}
