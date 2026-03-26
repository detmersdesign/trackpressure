import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '../lib/theme';
import { useEvent } from '../hooks/useEventContext';

import HomeScreen              from '../screens/HomeScreen';
import EventSetupScreen        from '../screens/EventSetupScreen';
import QuickLogScreen          from '../screens/QuickLogScreen';
import ColdSavedScreen         from '../screens/ColdSavedScreen';
import ConfirmationScreen      from '../screens/ConfirmationScreen';
import HistoryScreen           from '../screens/HistoryScreen';
import DeltaAnalysisScreen     from '../screens/DeltaAnalysisScreen';
import GarageScreen            from '../screens/GarageScreen';
import SettingsScreen          from '../screens/SettingsScreen';
import EditGarageVehicleScreen    from '../screens/EditGarageVehicleScreen';
import ColdCornerEntryScreen    from '../screens/ColdCornerEntryScreen';
import HotCornerEntryScreen     from '../screens/HotCornerEntryScreen';
import CornerReviewScreen       from '../screens/CornerReviewScreen';

// ── Stack navigators ──────────────────────────────────────────────────────────

const LogStack = createNativeStackNavigator();
function LogStackNav() {
  return (
    <LogStack.Navigator screenOptions={{ headerShown: false }}>
      <LogStack.Screen name="Home"               component={HomeScreen} />
      <LogStack.Screen name="EventSetup"         component={EventSetupScreen} />
      <LogStack.Screen name="QuickLog"           component={QuickLogScreen} />
      <LogStack.Screen name="ColdCornerEntry"    component={ColdCornerEntryScreen} />
      <LogStack.Screen name="HotCornerEntry"     component={HotCornerEntryScreen} />
      <LogStack.Screen name="CornerReview"       component={CornerReviewScreen} getId={({ params }) => (params as any)?.mode} />
      <LogStack.Screen name="ColdSaved"          component={ColdSavedScreen} />
      <LogStack.Screen name="Confirmation"       component={ConfirmationScreen} />
      <LogStack.Screen name="Garage"             component={GarageScreen} />
    </LogStack.Navigator>
  );
}

const HistoryStack = createNativeStackNavigator();
function HistoryStackNav() {
  return (
    <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
      <HistoryStack.Screen name="History"           component={HistoryScreen} />
      <HistoryStack.Screen name="DeltaAnalysis"     component={DeltaAnalysisScreen} />
      <HistoryStack.Screen name="QuickLog"          component={QuickLogScreen} />
      <HistoryStack.Screen name="ColdCornerEntry"   component={ColdCornerEntryScreen} />
      <HistoryStack.Screen name="HotCornerEntry"    component={HotCornerEntryScreen} />
      <HistoryStack.Screen name="CornerReview"      component={CornerReviewScreen} getId={({ params }) => (params as any)?.mode}/>
      <HistoryStack.Screen name="ColdSaved"         component={ColdSavedScreen} />
      <HistoryStack.Screen name="Confirmation"      component={ConfirmationScreen} />
    </HistoryStack.Navigator>
  );
}

const GarageStack = createNativeStackNavigator();
function GarageStackNav() {
  return (
    <GarageStack.Navigator screenOptions={{ headerShown: false }}>
      <GarageStack.Screen name="Garage"              component={GarageScreen} />
      <GarageStack.Screen name="Settings"            component={SettingsScreen} />
      <GarageStack.Screen name="EditGarageVehicle"   component={EditGarageVehicleScreen} />
      <GarageStack.Screen name="EventSetup"          component={EventSetupScreen} />
      <GarageStack.Screen name="QuickLog"            component={QuickLogScreen} />
      <GarageStack.Screen name="ColdCornerEntry"     component={ColdCornerEntryScreen} />
      <GarageStack.Screen name="HotCornerEntry"      component={HotCornerEntryScreen} />
      <GarageStack.Screen name="CornerReview"        component={CornerReviewScreen} getId={({ params }) => (params as any)?.mode}/>
      <GarageStack.Screen name="ColdSaved"           component={ColdSavedScreen} />
      <GarageStack.Screen name="Confirmation"        component={ConfirmationScreen} />
    </GarageStack.Navigator>
  );
}

// ── Tab navigator ─────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const { activeTab, setActiveTab, activeEvent, openSession } = useEvent();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={({ navigation }) => (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => {
                if (!activeEvent && !openSession) {
                  setActiveTab('garage');
                  navigation.navigate('GarageTab');
                } else {
                  setActiveTab('log');
                  navigation.navigate('LogTab');
                }
              }}
            >
              <Text style={[styles.tabIcon, !activeEvent && !openSession && { opacity: 0.3 }]}>⊕</Text>
              <Text style={[
                styles.tabLabel,
                activeTab === 'log' && styles.tabLabelActive,
                !activeEvent && !openSession && { opacity: 0.3 },
              ]}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => { setActiveTab('history'); navigation.navigate('HistoryTab'); }}
            >
              <Text style={styles.tabIcon}>◈</Text>
              <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => {
                setActiveTab('garage');
                navigation.navigate('GarageTab');
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'GarageTab' }],
                  })
                );
              }}
            >
              <Text style={styles.tabIcon}>⬡</Text>
              <Text style={[styles.tabLabel, activeTab === 'garage' && styles.tabLabelActive]}>Garage</Text>
            </TouchableOpacity>
          </View>
        )}
      >
        <Tab.Screen name="LogTab"     component={LogStackNav} />
        <Tab.Screen name="HistoryTab" component={HistoryStackNav} />
        <Tab.Screen name="GarageTab"  component={GarageStackNav} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingBottom: 24,
    paddingTop: spacing.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 3,
  },
  tabIcon: {
    fontSize: 20,
    color: colors.textMuted,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  tabLabelActive: {
    color: colors.accent,
  },
});
