import { useEffect, useRef, useState } from 'react';
import {
  Home,
  ShoppingBasket,
  Clapperboard,
  Building2,
  Coffee,
  Trees,
  X,
  ArrowUpRight,
  MapPin,
  Navigation,
} from 'lucide-react';
import { PLACES } from '../shared/places.mjs';
import type { PlaceId } from './types';

const icons = {
  home: Home,
  market: ShoppingBasket,
  cinema: Clapperboard,
  office: Building2,
  cafe: Coffee,
  park: Trees,
};
export default function CityMap({
  current,
  onClose,
  onTravel,
  busy,
}: {
  current: PlaceId;
  onClose: () => void;
  onTravel: (id: PlaceId) => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<PlaceId>(current);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  const place = PLACES[selected];
  const Icon = icons[selected];
  return (
    <dialog
      ref={dialog}
      className="city-dialog"
      aria-labelledby="map-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !busy) onClose();
      }}
    >
      <div className="city-header">
        <div>
          <span className="eyebrow">OUR LITTLE TOWN</span>
          <h2 id="map-title">日常生活地图</h2>
        </div>
        <button
          className="icon-button"
          aria-label="关闭地图"
          title="关闭地图"
          onClick={onClose}
          disabled={busy}
        >
          <X size={21} />
        </button>
      </div>
      <div className="town-map" aria-label="城镇地点">
        <div className="map-river" />
        <div className="map-bank" />
        <div className="map-road horizontal" />
        <div className="map-road vertical" />
        <div className="map-road riverside" />
        <span className="map-street street-one">生活街</span>
        <span className="map-street street-two">晴川路</span>
        <span className="map-water-label">晴 川 河</span>
        <span className="map-north">
          <Navigation size={16} />N
        </span>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <span
            key={i}
            className="map-tree"
            style={{ left: `${9 + (i % 4) * 23}%`, top: `${i < 4 ? 9 : 89}%` }}
          >
            <Trees size={i % 2 ? 20 : 27} />
          </span>
        ))}
        {(Object.entries(PLACES) as [PlaceId, typeof PLACES.home][]).map(([id, p]) => {
          const PlaceIcon = icons[id];
          return (
            <button
              key={id}
              className={`map-place ${selected === id ? 'selected' : ''} ${current === id ? 'current' : ''}`}
              style={
                { left: `${p.x}%`, top: `${p.y}%`, '--place-color': p.color } as React.CSSProperties
              }
              aria-label={p.name}
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
              disabled={busy}
            >
              <span className={`map-building building-${id}`}>
                <PlaceIcon size={27} />
              </span>
              <strong>{p.name}</strong>
              <small>{current === id ? '我们在这里' : p.district}</small>
            </button>
          );
        })}
      </div>
      <div className="map-destination">
        <Icon size={27} style={{ color: place.color }} />
        <div>
          <h3>{place.name}</h3>
          <p>{place.subtitle}</p>
        </div>
        <button
          className="primary"
          disabled={busy || selected === current}
          onClick={() => onTravel(selected)}
        >
          {selected === current ? (
            <>
              <MapPin size={16} />
              当前地点
            </>
          ) : (
            <>
              一起出发
              <ArrowUpRight size={16} />
            </>
          )}
        </button>
      </div>
    </dialog>
  );
}
