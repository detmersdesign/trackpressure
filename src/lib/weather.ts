import { WeatherData } from '../types';

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    // Open-Meteo: free, global, no API key required
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&temperature_unit=celsius&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weathercode;
    if (temp == null) return null;
    return {
      temp_c: Math.round(temp * 10) / 10,
      description: weatherCodeToDescription(code),
      source: 'open-meteo',
    };
  } catch {
    return null;
  }
}

function weatherCodeToDescription(code: number): string {
  if (code === 0) return 'clear sky';
  if (code <= 3) return 'partly cloudy';
  if (code <= 48) return 'foggy';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snowy';
  if (code <= 82) return 'rain showers';
  if (code <= 99) return 'thunderstorm';
  return 'unknown';
}
