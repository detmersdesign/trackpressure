import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { fetchWeather } from '../lib/weather';
import { findNearbyTracks, TrackMatch } from '../lib/gps';
import { WeatherData, Track } from '../types';
import { supabase } from '../lib/supabase';

export function useLocationAndWeather() {
  const [weather, setWeather]           = useState<WeatherData | null>(null);
  const [nearbyTracks, setNearbyTracks] = useState<TrackMatch[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [allTracksSorted, setAllTracksSorted] = useState<Track[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;

        const { latitude, longitude } = loc.coords;

        // Fetch tracks, weather in parallel
        const [wx, tracksRes, configsRes] = await Promise.all([
          fetchWeather(latitude, longitude),
          supabase.from('tracks').select('*'),
          supabase.from('track_configurations').select('*'),
        ]);

        if (cancelled) return;

        // Attach configurations to tracks
        const configs = configsRes.data ?? [];
        const tracks: Track[] = (tracksRes.data ?? []).map((track: any) => ({
          ...track,
          configurations: configs.filter((c: any) => c.track_id === track.id),
        }));

        // Use each track's own radius_meters for proximity check
        const matches: TrackMatch[] = tracks.flatMap((track) => {
          const radiusKm = (track.radius_meters ?? 5000) / 1000;
          const results = findNearbyTracks(latitude, longitude, [track], radiusKm);
          return results;
        }).sort((a, b) => a.distanceKm - b.distanceKm);

        const sorted = [...tracks].sort((a, b) => {
  const distA = Math.hypot(a.latitude - latitude, a.longitude - longitude);
  const distB = Math.hypot(b.latitude - latitude, b.longitude - longitude);
  return distA - distB;
});

      if (!cancelled) {
        setWeather(wx);
        setNearbyTracks(matches);
        setAllTracksSorted(sorted);
        setLoading(false);
      }
      } catch (err) {
        if (!cancelled) {
          setLocationError('Could not get location');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { weather, nearbyTracks, allTracksSorted, locationError, loading };
}