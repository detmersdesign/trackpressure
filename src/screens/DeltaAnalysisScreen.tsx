import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Rect, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { isHotInRange } from '../lib/recommendations';
import { supabase } from '../lib/supabase';

const W = Dimensions.get('window').width - spacing.lg * 4 - 2;
const BAR_H = 28;
const BAR_GAP = 8;
const LABEL_W = 52;

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: { params?: { vehicleId?: string; tireId?: string; trackId?: string } };
};

export default function DeltaAnalysisScreen({ navigation, route }: Props) {
  const { activeEvent } = useEvent();
  const vehicleId = route?.params?.vehicleId ?? activeEvent?.vehicle.id;
  const tireId    = route?.params?.tireId    ?? activeEvent?.tire_front.id ?? '';
  const trackId   = route?.params?.trackId   ?? activeEvent?.track.id;
  const hasActiveEvent = !!activeEvent;
  const { displayPressure, pressureUnit } = useSettings();

  const [axle, setAxle]         = useState<'front' | 'rear'>('front');
  const [target, setTarget]     = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!tireId) return;
    supabase
      .from('tire_targets')
      .select('*')
      .eq('tire_id', tireId)
      .single()
      .then(({ data }) => { if (data) setTarget(data); });
  }, [tireId]);

  useEffect(() => {
    if (!vehicleId || !trackId) return;
    supabase
      .from('pressure_entries')
      .select('id, created_at, cold_front_psi, cold_rear_psi, hot_front_psi, hot_rear_psi, hot_fl_psi, hot_fr_psi, hot_rl_psi, hot_rr_psi')
      .eq('vehicle_id', vehicleId)
      .eq('tire_id', tireId)
      .eq('track_id', trackId)
      .or(`is_hidden.eq.false${currentUserId ? `,and(is_hidden.eq.true,user_id.eq.${currentUserId})` : ''}`)
      .eq('is_outlier', false)
      .not('hot_front_psi', 'is', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setSessions(data); });
  }, [vehicleId, tireId, trackId, currentUserId]);

  const sessionsWithHot = sessions;

  const deltas = sessionsWithHot.map(s => ({
    session: s,
    delta: axle === 'front'
      ? Math.round(((s.hot_front_psi ?? 0) - s.cold_front_psi) * 10) / 10
      : Math.round(((s.hot_rear_psi ?? 0) - s.cold_rear_psi) * 10) / 10,
    hotPsi: axle === 'front' ? s.hot_front_psi ?? 0 : s.hot_rear_psi ?? 0,
    coldPsi: axle === 'front' ? s.cold_front_psi : s.cold_rear_psi,
  }));

  const avgDelta = deltas.length
    ? Math.round(deltas.reduce((s, d) => s + d.delta, 0) / deltas.length * 10) / 10
    : 0;

  const maxDelta = Math.max(...deltas.map(d => d.delta), 8);

  const mean = avgDelta;
  const stddev = deltas.length > 1
    ? Math.round(Math.sqrt(deltas.reduce((s, d) => s + (d.delta - mean) ** 2, 0) / deltas.length) * 100) / 100
    : 0;

  const consistencyScore = stddev < 0.3 ? 'High' : stddev < 0.7 ? 'Medium' : 'Low';
  const consistencyColor = stddev < 0.3 ? colors.success : stddev < 0.7 ? colors.warning : colors.danger;

  const targetMin = target?.target_hot_min_psi;
  const targetMax = target?.target_hot_max_psi;

  const inRangeCount = target
    ? deltas.filter(d => isHotInRange(d.hotPsi, target)).length
    : 0;

  const chartW = W - LABEL_W - spacing.md;

  return (
    <SafeAreaView style={globalStyles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md }}>
          <Text style={[typography.caption, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        
        {!vehicleId || !trackId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            <Text style={[typography.body, { textAlign: 'center', color: colors.textMuted }]}>
              No session context available. Start an event or view delta analysis from History.
            </Text>
          </View>
        ) : (
          <>
            <Text style={typography.heading}>Cold → hot analysis</Text>
            <Text style={[typography.caption, { marginTop: 4 }]}>
              {activeEvent?.vehicle.model ?? ''}
              {activeEvent?.tire_front.compound ? ` · ${activeEvent.tire_front.compound}` : ''}
              {target ? ` · Target: ${displayPressure(target.target_hot_min_psi)}–${displayPressure(target.target_hot_max_psi)} ${pressureUnit()} hot` : ''}
            </Text>

            {/* Axle toggle */}
            <View style={styles.toggleRow}>
              {(['front', 'rear'] as const).map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.toggleBtn, axle === a && styles.toggleBtnActive]}
                  onPress={() => setAxle(a)}
                >
                  <Text style={[styles.toggleText, axle === a && styles.toggleTextActive]}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={typography.label}>Avg soak</Text>
                <Text style={styles.summaryVal}>
                  {avgDelta > 0 ? `+${displayPressure(avgDelta)}` : displayPressure(avgDelta)}
                </Text>
                <Text style={typography.caption}>{pressureUnit()}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={typography.label}>Consistency</Text>
                <Text style={[styles.summaryVal, { color: consistencyColor }]}>{consistencyScore}</Text>
                <Text style={typography.caption}>σ {stddev}</Text>
              </View>
              {target && (
                <View style={styles.summaryCard}>
                  <Text style={typography.label}>In target</Text>
                  <Text style={styles.summaryVal}>{inRangeCount}/{deltas.length}</Text>
                  <Text style={typography.caption}>sessions</Text>
                </View>
              )}
            </View>

            {/* Bar chart — one bar per session */}
            <Text style={globalStyles.sectionLabel}>Heat soak per session</Text>
            <View style={globalStyles.card}>
              <Svg
                width={W}
                height={deltas.length * (BAR_H + BAR_GAP) + 20}
              >
                {deltas.map((d, i) => {
                  const barW = (d.delta / maxDelta) * chartW;
                  const y = i * (BAR_H + BAR_GAP);
                  const inRange = target ? isHotInRange(d.hotPsi, target) : null;
                  const barColor = inRange === true ? colors.success
                    : inRange === false ? colors.warning
                    : colors.accent;
                  const dateStr = new Date(d.session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <G key={d.session.id}>
                      <SvgText x={0} y={y + BAR_H / 2 + 4}
                        fontSize={10} fill={colors.textMuted}>
                        {dateStr}
                      </SvgText>
                      <Rect
                        x={LABEL_W} y={y}
                        width={Math.max(barW, 2)} height={BAR_H}
                        rx={4} fill={barColor} opacity={0.8}
                      />
                      <SvgText
                        x={LABEL_W + Math.max(barW, 2) + 6}
                        y={y + BAR_H / 2 + 4}
                        fontSize={11} fill={colors.textSecondary}
                        fontFamily="monospace"
                      >
                        +{displayPressure(d.delta)}
                      </SvgText>
                      <SvgText
                        x={LABEL_W + Math.max(barW, 2) + 36}
                        y={y + BAR_H / 2 + 4}
                        fontSize={10} fill={colors.textMuted}
                      >
                        ({displayPressure(d.coldPsi)}→{displayPressure(d.hotPsi)})
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>

              {target && (
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                    <Text style={typography.caption}>Hot in target range</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                    <Text style={typography.caption}>Out of range</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Interpretation */}
            <Text style={globalStyles.sectionLabel}>What this means</Text>
            <View style={styles.interpretBox}>
              {stddev < 0.4 && (
                <Text style={styles.interpretText}>
                  Your heat soak delta is very consistent (σ = {stddev} {pressureUnit()}), which indicates you're warming the tires predictably each session. This makes your cold set data highly reliable for recommendations.
                </Text>
              )}
              {stddev >= 0.4 && stddev < 0.8 && (
                <Text style={styles.interpretText}>
                  Moderate variation in heat soak (σ = {stddev} {pressureUnit()}). This could reflect different driving intensity, session lengths, or ambient conditions. More sessions will help the recommendation engine account for this.
                </Text>
              )}
              {stddev >= 0.8 && (
                <Text style={styles.interpretText}>
                  Higher variation in heat soak (σ = {stddev} {pressureUnit()}) suggests the tires are reaching different temperatures between sessions. Check for consistent warm-up laps, and consider whether session type or traffic is influencing tire temp.
                </Text>
              )}
              {target && inRangeCount === deltas.length && (
                <Text style={[styles.interpretText, { marginTop: spacing.sm }]}>
                  All logged sessions had hot pressures in the target range — your cold set is well dialled in for these conditions.
                </Text>
              )}
              {target && inRangeCount < deltas.length && (
                <Text style={[styles.interpretText, { marginTop: spacing.sm }]}>
                  {deltas.length - inRangeCount} session(s) had hot pressures outside the target range. Review those sessions for unusual conditions or consider adjusting your cold set baseline.
                </Text>
              )}
            </View>

            {/* CTA */}
            {hasActiveEvent && (
              <TouchableOpacity
                style={styles.logBtn}
                onPress={() => navigation.navigate('QuickLog', { mode: 'cold' })}
              >
                <Text style={styles.logBtnText}>Log next session</Text>
              </TouchableOpacity>
            )}

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 40 },
  toggleRow: {
    flexDirection: 'row', gap: 8, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    alignItems: 'center', borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  toggleBtnActive: { backgroundColor: colors.accentSubtle, borderColor: colors.accent },
  toggleText: { fontSize: 14, color: colors.textSecondary },
  toggleTextActive: { color: colors.accent, fontWeight: '500' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  summaryCard: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.sm, alignItems: 'center',
  },
  summaryVal: {
    fontFamily: 'monospace', fontSize: 22,
    color: colors.textPrimary, marginVertical: 2,
  },
  legendRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  interpretBox: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md,
  },
  interpretText: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  logBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.xl,
  },
  logBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
});
