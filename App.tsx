import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-gesture-handler';
import { EventProvider } from './src/hooks/useEventContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import { useAuth } from './src/hooks/useAuth';
import { colors } from './src/lib/theme';
import * as Linking from 'expo-linking';
import { supabase } from './src/lib/supabase';

function Root() {
  const { session, savedEmail, loading, sendMagicLink } = useAuth();
  useEffect(() => {
      // Handle deep link when app is already open
      const subscription = Linking.addEventListener('url', ({ url }) => {
        if (url) {
          const { queryParams } = Linking.parse(url);
          if (queryParams?.access_token || queryParams?.code) {
            supabase.auth.exchangeCodeForSession(url);
          }
        }
      });

      // Handle deep link when app opens from closed state
      Linking.getInitialURL().then((url) => {
        if (url) {
          const { queryParams } = Linking.parse(url);
          if (queryParams?.access_token || queryParams?.code) {
            supabase.auth.exchangeCodeForSession(url);
          }
        }
      });

      return () => subscription.remove();
    }, []);
  
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        savedEmail={savedEmail}
        onSendLink={sendMagicLink}
      />
    );
  }

  return (
    <EventProvider>
      <AppNavigator />
    </EventProvider>
  );
}

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <Root />
    </>
  );
}