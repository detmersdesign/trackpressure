import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { useLocationAndWeather } from '../hooks/useLocationAndWeather';
import { CommonActions } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function ColdSavedScreen({ navigation }: Props) {
  const { openSession, setOpenSession, setActiveTab, clearOpenSession, setActiveEvent } = useEvent();
  const { weather } = useLocationAndWeather();
  const { displayPressure, pressureUnit, settings } = useSettings();

  // All hooks must run before any early return
  useEffect(() => {
    if (!openSession || weather?.temp_c === undefined) return;
    if (openSession.ambient_session_start !== undefined) return;
    setOpenSession({
      ...openSession,
      ambient_session_start: weather.temp_c,
    });
  }, [weather?.temp_c]);

  // Guard after hooks — assign to non-null alias for TypeScript
  if (!openSession) return null;
  const session = openSession;

  const timeStr = new Date(session.saved_at)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const corners = [
    { label: 'Front left',  val: session.predicted_hot_fl },
    { label: 'Front right', val: session.predicted_hot_fr },
    { label: 'Rear left',   val: session.predicted_hot_rl },
    { label: 'Rear right',  val: session.predicted_hot_rr },
  ];

  return (
    <SafeAreaView style={globalStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* Check row */}
        <View style={styles.checkRow}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.subhead, { fontWeight: '600' }]}>
              Cold pressures saved
            </Text>
            <Text style={typography.caption}>
              {session.event.track_config?.name ?? session.event.track.name}
              {' · '}{timeStr}
            </Text>
          </View>
        </View>

        {/* Saved cold set */}
        <Text style={globalStyles.sectionLabel}>Saved cold set</Text>
        {session.cold_fl_psi !== undefined ? (
          <>
            <Text style={[typography.caption, {
              textAlign: 'center', color: colors.textMuted, marginBottom: spacing.sm,
            }]}>
              Front of car ↑
            </Text>
            <View style={styles.coldCornerGrid}>
              {([
                { label: 'Front left',  val: session.cold_fl_psi },
                { label: 'Front right', val: session.cold_fr_psi },
                { label: 'Rear left',   val: session.cold_rl_psi },
                { label: 'Rear right',  val: session.cold_rr_psi },
              ] as { label: string; val: number | undefined }[]).map(({ label, val }) => (
                <View key={label} style={styles.coldCornerBox}>
                  <Text style={styles.coldCornerLabel}>{label}</Text>
                  <Text style={styles.coldVal}>
                    {val !== undefined ? displayPressure(val) : '—'}
                  </Text>
                  <Text style={[typography.caption, { marginTop: 4 }]}>
                    {pressureUnit()} cold
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.coldGrid}>
            <View style={[globalStyles.card, { flex: 1, marginRight: spacing.sm }]}>
              <Text style={[typography.label, { marginBottom: spacing.sm }]}>Front axle</Text>
              <Text style={styles.coldVal}>
                {displayPressure(session.cold_front_psi)}
              </Text>
              <Text style={[typography.caption, { marginTop: 4 }]}>
                {pressureUnit()} cold · both sides
              </Text>
            </View>
            <View style={[globalStyles.card, { flex: 1 }]}>
              <Text style={[typography.label, { marginBottom: spacing.sm }]}>Rear axle</Text>
              <Text style={styles.coldVal}>
                {displayPressure(session.cold_rear_psi)}
              </Text>
              <Text style={[typography.caption, { marginTop: 4 }]}>
                {pressureUnit()} cold · both sides
              </Text>
            </View>
          </View>
        )}

        {/* Predicted hot — four corners */}
        <Text style={globalStyles.sectionLabel}>Predicted hot pressures</Text>
        <Text style={[typography.caption, {
          textAlign: 'center', color: colors.textMuted,
          marginBottom: spacing.sm,
        }]}>
          Front of car ↑
        </Text>
        <View style={styles.cornerGrid}>
          {corners.map(({ label, val }) => (
            <View key={label} style={styles.cornerBox}>
              <Text style={styles.cornerLabel}>{label}</Text>
              <View style={styles.cornerValRow}>
                <Text style={styles.cornerVal}>{displayPressure(val)}</Text>
                <Text style={styles.cornerSub}>{pressureUnit()} predicted</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
          Estimate based on ambient · rounded to 0.5 {pressureUnit()}
        </Text>

        {/* Return prompt */}
        <View style={styles.promptBox}>
          <Text style={styles.promptText}>
            Have Fun Driving — Come back and log hot data while the tires are still warm.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => settings.pyrometer_enabled
              ? navigation.navigate('ColdCornerEntry')
              : navigation.navigate('QuickLog', { mode: 'cold' })
            }
          >
            <Text style={styles.actionBtnSecondaryText}>Next session</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => {
              if (settings.pyrometer_gradient) {
                navigation.navigate('HotGradientEntry');
              } else if (settings.pyrometer_enabled) {
                navigation.navigate('HotCornerEntry');
              } else {
                navigation.navigate('QuickLog', { mode: 'hot' });
              }
            }}
          >
            <Text style={styles.actionBtnPrimaryText}>Enter hot now</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.finishBtn}
          onPress={async () => {
            // Save cold-only entry before clearing session
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('pressure_entries').insert({
              user_id:        user?.id,
              vehicle_id:     session.event.vehicle.id,
              tire_id:        session.event.tire_front.id,
              track_id:       session.event.track.id,
              session_type:   session.event.session_type,
              cold_front_psi: session.cold_front_psi,
              cold_rear_psi:  session.cold_rear_psi,
              cold_fl_psi:    session.cold_fl_psi    ?? null,
              cold_fr_psi:    session.cold_fr_psi    ?? null,
              cold_rl_psi:    session.cold_rl_psi    ?? null,
              cold_rr_psi:    session.cold_rr_psi    ?? null,
              ambient_temp_c: session.ambient_session_start ?? session.ambient_temp_c,
              ambient_source: session.ambient_source as 'auto' | 'manual',
              is_hidden:      session.is_hidden ?? false,
              signal_score:   0.5,
              created_at: session.historic_date ?? new Date().toISOString(),
            });
            setActiveTab('garage');
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'GarageTab' }],
              })
            );
            setTimeout(async () => {
              await clearOpenSession();
              setActiveEvent(null);
            }, 100);
          }}
        >
          <Text style={styles.finishBtnText}>Finish event</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 40 },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginBottom: spacing.sm,
  },
  checkCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.successSubtle,
    borderWidth: 0.5, borderColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: colors.success, fontSize: 16, fontWeight: '700' },

  coldGrid: { flexDirection: 'row', marginBottom: spacing.sm },
  coldCornerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm,
  },
  coldCornerBox: {
    width: '47%', backgroundColor: colors.bgCard,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md,
  },
  coldCornerLabel: {
    fontSize: 10, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3,
  },
  coldVal: {
    fontFamily: 'monospace',
    fontSize: 28, fontWeight: '500',
    color: colors.textPrimary,
  },

  cornerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  cornerBox: {
    width: '47%',
    backgroundColor: colors.warningSubtle,
    borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.warning,
    padding: spacing.md,
  },
  cornerLabel: {
    fontSize: 10, color: colors.warning, opacity: 0.8,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginBottom: 3,
  },
  cornerVal: {
    fontSize: 24, fontWeight: '500',
    color: colors.warning,
    fontVariant: ['tabular-nums'] as any,
  },
  cornerValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  cornerSub: {
    fontSize: 10,
    color: colors.warning,
    opacity: 0.7,
    marginBottom: 2,
  },

  promptBox: {
    backgroundColor: colors.accentSubtle,
    borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.borderActive,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  promptText: {
    fontSize: 13, color: colors.textPrimary, lineHeight: 20,
  },

  actionRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl,
  },
  actionBtn: {
    flex: 1, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center',
  },
  actionBtnPrimary: { backgroundColor: colors.accent },
  actionBtnSecondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5, borderColor: colors.border,
  },
  actionBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#000' },
  actionBtnSecondaryText: { fontSize: 15, color: colors.textSecondary },
  finishBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  finishBtnText: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
