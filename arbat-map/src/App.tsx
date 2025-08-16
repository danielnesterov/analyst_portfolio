import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './index.css'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Fuse from 'fuse.js'

// Quick fix for default icon paths in Leaflet + Vite
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

interface Poi {
  id: string
  title: string
  subtitle: string
  lat: number
  lon: number
  image?: string
  summary?: string
}

function FlyTo({ center }: { center: LatLngExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.flyTo(center, 17, { duration: 0.6 })
    }
  }, [center, map])
  return null
}

function useFavorites() {
  const storageKey = 'arbat:favorites'
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(favorites))
  }, [favorites])
  const toggle = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const isFavorite = (id: string) => favorites.includes(id)
  return { favorites, toggle, isFavorite }
}

export default function App() {
  const [pois, setPois] = useState<Poi[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Poi | null>(null)
  const [center, setCenter] = useState<LatLngExpression | null>([55.7496, 37.5901])
  const { favorites, toggle, isFavorite } = useFavorites()
  const searchRef = useRef<HTMLInputElement>(null)
  const [listOpen, setListOpen] = useState(false)
  const [listMode, setListMode] = useState<'all' | 'fav'>('all')

  useEffect(() => {
    fetch('/pois.json').then((r) => r.json()).then((data: Poi[]) => setPois(data))
  }, [])

  const fuse = useMemo(() => new Fuse(pois, { keys: ['title', 'subtitle', 'summary'], threshold: 0.3 }), [pois])
  const suggestions = useMemo(() => {
    if (!query.trim()) return [] as Poi[]
    return fuse.search(query).slice(0, 8).map((r) => r.item)
  }, [fuse, query])

  const handleSelect = (poi: Poi) => {
    setSelected(poi)
    setCenter([poi.lat, poi.lon])
    setQuery('')
    setListOpen(false)
  }

  const listData = useMemo(() => {
    const base = listMode === 'fav' ? pois.filter((p) => favorites.includes(p.id)) : pois
    return base
  }, [pois, favorites, listMode])

  const bounds: LatLngBoundsExpression = [
    [55.746, 37.581], // SW
    [55.753, 37.596]  // NE
  ]

  return (
    <div id="app">
      <div className="map-container">
        <MapContainer center={[55.7496, 37.5901]} zoom={16} scrollWheelZoom={true} zoomControl={true} style={{ width: '100%', height: '100%' }} maxBounds={bounds} maxBoundsViscosity={1.0}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pois.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lon]} eventHandlers={{ click: () => handleSelect(p) }}>
              <Popup>
                <div style={{ maxWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{p.subtitle}</div>
                </div>
              </Popup>
            </Marker>
          ))}
          <FlyTo center={center} />
        </MapContainer>

        <div className="search-bar">
          <input
            ref={searchRef}
            className="search-input"
            placeholder="Поиск по названию или адресу"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="fav-button" onClick={() => setListOpen(true)}>Список</button>
        </div>
        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((s) => (
              <div key={s.id} className="suggestion-item" onClick={() => handleSelect(s)}>
                <div className="poi-title">{s.title}</div>
                <div className="poi-subtitle">{s.subtitle}</div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="poi-card">
            {selected.image && <img src={selected.image} alt={selected.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/vite.svg' }} />}
            <div>
              <div className="poi-title">{selected.title}</div>
              <div className="poi-subtitle">{selected.subtitle}</div>
              {selected.summary && <div className="poi-summary">{selected.summary}</div>}
            </div>
            <button className="fav-button" onClick={() => toggle(selected.id)}>
              {isFavorite(selected.id) ? '★ Удалить' : '☆ В избранное'}
            </button>
          </div>
        )}

        {listOpen && (
          <div className="list-panel">
            <div className="list-header">
              <div className={`chip ${listMode === 'all' ? 'active' : ''}`} onClick={() => setListMode('all')}>Все</div>
              <div className={`chip ${listMode === 'fav' ? 'active' : ''}`} onClick={() => setListMode('fav')}>Избранное ({favorites.length})</div>
              <button className="close-btn" onClick={() => setListOpen(false)}>Закрыть</button>
            </div>
            <div className="list-content">
              {listData.length === 0 && (
                <div style={{ padding: 12, color: '#666' }}>Нет объектов</div>
              )}
              {listData.map((p) => (
                <div key={p.id} className="list-item">
                  {p.image && <img src={p.image} alt={p.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/vite.svg' }} />}
                  <div onClick={() => handleSelect(p)} style={{ cursor: 'pointer' }}>
                    <div className="poi-title">{p.title}</div>
                    <div className="poi-subtitle">{p.subtitle}</div>
                    {p.summary && <div className="poi-summary">{p.summary}</div>}
                  </div>
                  <button className="fav-button" onClick={() => toggle(p.id)}>
                    {isFavorite(p.id) ? '★' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
