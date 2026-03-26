import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveEvent, PressureEntry, OpenSession } from '../types';

const OPEN_SESSION_KEY = 'trackpressure:open_session';

interface EventContextValue {
  activeEvent: ActiveEvent | null;
  setActiveEvent: (e: ActiveEvent | null) => void;

  // Bridges pre-session cold save to post-session hot entry.
  // Persisted to AsyncStorage — survives app backgrounding and screen lock.
  openSession: OpenSession | null;
  setOpenSession: (s: OpenSession | null) => Promise<void>;
  clearOpenSession: () => Promise<void>;

  lastEntry: Partial<PressureEntry> | null;
  setLastEntry: (e: Partial<PressureEntry> | null) => void;

  sessionCount: number;
  incrementSession: () => void;

  activeTab: 'log' | 'history' | 'garage';
  setActiveTab: (tab: 'log' | 'history' | 'garage') => void;
}

const EventContext = createContext<EventContextValue>({
  activeEvent: null,
  setActiveEvent: () => {},
  openSession: null,
  setOpenSession: async () => {},
  clearOpenSession: async () => {},
  lastEntry: null,
  setLastEntry: () => {},
  sessionCount: 0,
  incrementSession: () => {},
  activeTab: 'log',
  setActiveTab: () => {},
});

export function EventProvider({ children }: { children: ReactNode }) {
  const [activeEvent, setActiveEvent]      = useState<ActiveEvent | null>(null);
  const [openSession, setOpenSessionState] = useState<OpenSession | null>(null);
  const [lastEntry, setLastEntry]          = useState<Partial<PressureEntry> | null>(null);
  const [sessionCount, setSessionCount]    = useState(0);
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'garage'>('log');

  // On mount: rehydrate open session from AsyncStorage.
  // This is the mechanism that picks up a saved cold session when the
  // driver reopens the app after their track session.
  useEffect(() => {
    AsyncStorage.getItem(OPEN_SESSION_KEY).then(raw => {
      if (!raw) return;
      try {
        const parsed: OpenSession = JSON.parse(raw);
        setOpenSessionState(parsed);
        // Restore the active event so context pills and track name render
        // correctly on the re-entry banner without the user having to
        // go back through event setup.
        setActiveEvent(parsed.event);
      } catch {
        // Corrupted storage — discard silently
        AsyncStorage.removeItem(OPEN_SESSION_KEY);
      }
    });
  }, []);

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
        incrementSession: () => setSessionCount((n) => n + 1),
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export const useEvent = () => useContext(EventContext);
