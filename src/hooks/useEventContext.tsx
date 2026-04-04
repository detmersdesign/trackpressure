import React, {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { ActiveEvent, PressureEntry, OpenSession, Track, WeatherData } from '../types';
import { fetchWeather } from '../lib/weather';
import { findNearbyTracks, TrackMatch } from '../lib/gps';
import { supabase } from '../lib/supabase';

const OPEN_SESSION_KEY  = 'trackpressure:open_session';
const LOCATION_STALE_MS = 5 * 60 * 1000; // 5 minutes

// ── Context interface ─────────────────────────────────────────────────────────

interface EventContextValue {
  activeEvent:    ActiveEvent | null;
  setActiveEvent: (e: ActiveEvent | null) => void;

  openSession:      OpenSession | null;
  setOpenSession:   (s: OpenSession | null) => Promise<void>;
  clearOpenSession: () => Promise<void>;

  lastEntry:    Record<string, any> | null;
  setLastEntry: (e: Record<string, any> | null) => void;

  sessionCount:     number;
  incrementSession: () => void;

  activeTab:    'log' | 'history' | 'garage';
  setActiveTab: (tab: 'log' | 'history' | 'garage') => void;

  // ── Location & weather (prefetched from garage) ───────────────────────────
  weather:          WeatherData | null;
  nearbyTracks:     TrackMatch[];
  allTracksSorted:  Track[];
  locationLoading:  boolean;
  locationAge:      number | null;
  prefetchLocation: () => void;
}

// ── Default context ───────────────────────────────────────────────────────────

const EventContext = createContext<EventContextValue>({
  activeEvent:      null,
  setActiveEvent:   () => {},
  openSession:      null,
  setOpenSession:   async () => {},
  clearOpenSession: async () => {},
  lastEntry:        null,
  setLastEntry:     () => {},
  sessionCount:     0,
  incrementSession: () => {},
  activeTab:        'log',
  setActiveTab:     () => {},
  weather:          null,
  nearbyTracks:     [],
  allTracksSorted:  [],
  locationLoading:  false,
  locationAge:      null,
  prefetchLocation: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function EventProvider({ children }: { children: ReactNode }) {
  const [activeEvent,     setActiveEvent]     = useState<ActiveEvent | null>(null);
  const [openSession,     setOpenSessionState] = useState<OpenSession | null>(null);
  const [lastEntry,       setLastEntry]       = useState<Partial<PressureEntry> | null>(null);
  const [sessionCount,    setSessionCount]    = useState(0);
  const [activeTab,       setActiveTab]       = useState<'log' | 'history' | 'garage'>('log');

  // Location & weather
  const [weather,         setWeather]         = useState<WeatherData | null>(null);
  const [nearbyTracks,    setNearbyTracks]    = useState<TrackMatch[]>([]);
  const [allTracksSorted, setAllTracksSorted] = useState<Track[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationAge,     setLocationAge]     = useState<number | null>(null);

  // ── Rehydrate open session from AsyncStorage on mount ────────────────────
  useEffect(() => {
    AsyncStorage.getItem(OPEN_SESSION_KEY).then(raw => {
      if (!raw) return;
      try {
        const parsed: OpenSession = JSON.parse(raw);
        setOpenSessionState(parsed);
        setActiveEvent(parsed.event);
      } catch {
        AsyncStorage.removeItem(OPEN_SESSION_KEY);
      }
    });
  }, []);

  // ── Open session helpers ──────────────────────────────────────────────────
  async function setOpenSession(s: OpenSession | null) {
    setOpenSessionState(s);
    if (s) {
      await AsyncStorage.setItem(OPEN_SESSION_KEY, JSON.stringify(s));
    } else {
      await AsyncStorage.removeItem(OPEN_SESSION_KEY);
    }
  }

  async function clearOpenSession() {
    setOpenSessionState(null);
    await AsyncStorage.removeItem(OPEN_SESSION_KEY);
  }

  // ── Location prefetch ─────────────────────────────────────────────────────
  // Called from GarageScreen on mount. No-op if data is less than 5 minutes
  // old. All screens that previously called useLocationAndWeather directly
  // now read instantly from this shared context state.
  const prefetchLocation = useCallback(async () => {
    if (locationAge && (Date.now() - locationAge) < LOCATION_STALE_MS) return;
    setLocationLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      const [wx, tracksRes, configsRes] = await Promise.all([
        fetchWeather(latitude, longitude),
        supabase.from('tracks').select('*'),
        supabase.from('track_configurations').select('*'),
      ]);

      const configs = configsRes.data ?? [];
      const tracks: Track[] = (tracksRes.data ?? []).map((track: any) => ({
        ...track,
        configurations: configs.filter((c: any) => c.track_id === track.id),
      }));

      const matches: TrackMatch[] = tracks.flatMap(track => {
        const radiusKm = (track.radius_meters ?? 5000) / 1000;
        return findNearbyTracks(latitude, longitude, [track], radiusKm);
      }).sort((a, b) => a.distanceKm - b.distanceKm);

      const sorted = [...tracks].sort((a, b) => {
        const distA = Math.hypot(a.latitude - latitude, a.longitude - longitude);
        const distB = Math.hypot(b.latitude - latitude, b.longitude - longitude);
        return distA - distB;
      });

      setWeather(wx);
      setNearbyTracks(matches);
      setAllTracksSorted(sorted);
      setLocationAge(Date.now());
    } catch {
      // Fail silently — EventSetupScreen handles missing location gracefully
    }

    setLocationLoading(false);
  }, [locationAge]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <EventContext.Provider
      value={{
        activeEvent,
        setActiveEvent,
        openSession,
        setOpenSession,
        clearOpenSession,
        lastEntry,
        setLastEntry,
        sessionCount,
        incrementSession: () => setSessionCount(n => n + 1),
        activeTab,
        setActiveTab,
        weather,
        nearbyTracks,
        allTracksSorted,
        locationLoading,
        locationAge,
        prefetchLocation,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export const useEvent = () => useContext(EventContext);
