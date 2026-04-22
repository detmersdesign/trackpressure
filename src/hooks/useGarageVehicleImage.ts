import { useState, useEffect } from 'react';
import { Directory, File, Paths } from 'expo-file-system/next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GarageVehicle } from '../types';

const CACHE_DIR_PATH  = `${Paths.document.uri}garage-silhouettes/`;
const TIMESTAMP_KEY   = (id: string) => `garage_silhouette_ts:${id}`;

// Include timestamp in filename so each upload gets a unique local path,
// bypassing React Native's image cache entirely on updates.
function getCacheFile(garageVehicleId: string, timestamp?: string | null): File {
  const ts = timestamp ? `_${timestamp.replace(/[^a-zA-Z0-9]/g, '')}` : '';
  return new File(CACHE_DIR_PATH, `${garageVehicleId}${ts}.png`);
}

export function useGarageVehicleImage(garageVehicle: GarageVehicle | null) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!garageVehicle?.custom_silhouette_url) {
      setLocalUri(null);
      return;
    }
    loadImage(garageVehicle);
  }, [garageVehicle?.id, garageVehicle?.custom_silhouette_url]);

  async function loadImage(gv: GarageVehicle) {
    if (!gv.custom_silhouette_url) return;
    setLoading(true);
    try {
      const dir = new Directory(CACHE_DIR_PATH);
      if (!dir.exists) dir.create();

      const serverTs  = gv.custom_silhouette_updated_at ?? null;
      const cacheFile = getCacheFile(gv.id, serverTs);
      const storedTs  = await AsyncStorage.getItem(TIMESTAMP_KEY(gv.id));

      // Cache hit — timestamped file exists, no re-download needed
      // Serve remote URL directly — timestamp in URL busts RN image cache
      if (cacheFile.exists && storedTs === serverTs) {
        setLocalUri(gv.custom_silhouette_url);
        setLoading(false);
        return;
      }

      // Cache miss — download fresh and store with timestamp in filename
      // Strip ?t= query string to get clean storage URL for download
      const response = await fetch(gv.custom_silhouette_url.split('?')[0]);
      if (!response.ok) throw new Error('Download failed');
      const blob   = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Delete any old timestamped files for this vehicle before writing new
      try {
        dir.list().forEach((f: Directory | File) => {
          if (f instanceof File && f.name?.startsWith(gv.id)) f.delete();
        });
      } catch {}

      cacheFile.write(atob(base64) as unknown as string);
      await AsyncStorage.setItem(TIMESTAMP_KEY(gv.id), serverTs ?? new Date().toISOString());
      // Serve remote URL — timestamp in URL ensures RN uses fresh image
      setLocalUri(gv.custom_silhouette_url);
    } catch {
      // Fall back to remote URL if cache fails
      setLocalUri(gv.custom_silhouette_url ?? null);
    }
    setLoading(false);
  }

  async function clearCache(garageVehicleId: string) {
    try {
      const dir = new Directory(CACHE_DIR_PATH);
      if (dir.exists) {
        dir.list().forEach((f: Directory | File) => {
          if (f instanceof File && f.name?.startsWith(garageVehicleId)) f.delete();
        });
      }
      await AsyncStorage.removeItem(TIMESTAMP_KEY(garageVehicleId));
    } catch {}
    setLocalUri(null);
  }

  return { localUri, loading, clearCache };
}
