import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const SAVED_EMAIL_KEY = 'trackpressure_user_email';

export function useAuth() {
  const [session, setSession]         = useState<Session | null>(null);
  const [savedEmail, setSavedEmail]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    // Check existing session and saved email on mount
    async function initialize() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);

        const email = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
        setSavedEmail(email);
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    }

    initialize();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function sendMagicLink(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: 'trackpressure://',
        },
      });

      //console.log('signInWithOtp error:', error);
      if (error) return { error: error.message };

      // Save email locally for future re-authentication
      await AsyncStorage.setItem(SAVED_EMAIL_KEY, email);
      setSavedEmail(email);

      return { error: null };
    } catch (err) {
      //console.log('sendMagicLink caught error:', err);
      return { error: 'Failed to send magic link' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
    setSavedEmail(null);
    setSession(null);
  }

  return { session, savedEmail, loading, sendMagicLink, signOut };
}