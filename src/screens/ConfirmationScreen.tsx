import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { DeltaBadge } from '../components/DeltaBadge';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { isHotInRange } from '../lib/recommendations';
import { supabase } from '../lib/supabase';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function ConfirmationScreen({ navigation }: Props) {
  const { activeEvent, lastEntry, sessionCount, setActiveTab } = useEvent();
  const { displayPressure, pressureUnit, displayTemp, tempUnit, settings } = useSettings();
  //console.log('pressure unit:', pressureUnit());
  const [target, setTarget]       = useState<any>(null);
  const [commSessions, setCommSessions] = useState<any[]>([]);

  const vehicle = activeEvent?.vehicle;
  const tireId  = activeEvent?.tire_front.id ?? '';

  useEffect(() => {
    if (!tireId) return;

    // Fetch tire target
    supabase
      .from('tire_targets')
      .select('*')
      .eq('tire_id', tireId)
      .single()
      .then(({ data }) => { if (data) setTarget(data); });

    // Fetch community sessions for this vehicle/tire/track
    if (activeEvent) {
      supabase
        .from('pressure_entries')
        .select('cold_front_psi, cold_rear_psi')
        .eq('vehicle_id', activeEvent.vehicle.id)
        .eq('tire_id', activeEvent.tire_front.id)
        .eq('track_id', activeEvent.track.id)
        .eq('is_hidden', false)
        .eq('is_outlier', false)
        .then(({ data }) => { if (data) setCommSessions(data); });
    }
  }, [tireId, activeEvent?.vehicle.id]);

  const coldF = lastEntry?.cold_front_psi ?? 0;
  const coldR = lastEntry?.cold_rear_psi  ?? 0;

  // Four-corner hot values (preferred path)
  const hotFL = lastEntry?.hot_fl_psi;
  const hotFR = lastEntry?.hot_fr_psi;
  const hotRL = lastEntry?.hot_rl_psi;
  const hotRR = lastEntry?.hot_rr_psi;

  // Legacy averaged values — present when corners are also present
  const hotFrontAvg = lastEntry?.hot_front_psi;
  const hotRearAvg  = lastEntry?.hot_rear_psi;

  const hasCornerData = hotFL !== undefined || hotFR !== undefined;
  const hasHotData    = hasCornerData || hotFrontAvg !== undefined;

  const oemF = vehicle?.oem_pressure_front ?? 0;
  const oemR = vehicle?.oem_pressure_rear  ?? 0;

  // Community averages from mock data
  const commCount = commSessions.length;
  const commAvgF = commCount > 0 ? Math.round(commSessions.reduce((s, e) => s + e.cold_front_psi, 0) / commCount * 10) / 10 : 0;
  const commAvgR = commCount > 0 ? Math.round(commSessions.reduce((s, e) => s + e.cold_rear_psi,  0) / commCount * 10) / 10 : 0;
  const commMinF = commCount > 0 ? Math.min(...commSessions.map(s => s.cold_front_psi)) : coldF;
  const commMaxF = commCount > 0 ? Math.max(...commSessions.map(s => s.cold_front_psi)) : coldF;
  const commMinR = commCount > 0 ? Math.min(...commSessions.map(s => s.cold_rear_psi))  : coldR;
  const commMaxR = commCount > 0 ? Math.max(...commSessions.map(s => s.cold_rear_psi))  : coldR;

  // Per-corner range checks
  function cornerInRange(psi: number | undefined): boolean | null {
    if (!target || psi === undefined) return null;
    return isHotInRange(psi, target);
  }

  // ── Tyre temperature data ─────────────────────────────────────────────────
  const hasTier1Temps = settings.pyrometer_enabled && !settings.pyrometer_gradient && (
    lastEntry?.tyre_temp_hot_fl_c != null || lastEntry?.tyre_temp_hot_fr_c != null
  );
  const hasTier2Temps = settings.pyrometer_enabled && settings.pyrometer_gradient && (
    lastEntry?.tyre_temp_hot_fl_mid_c != null || lastEntry?.tyre_temp_hot_fr_mid_c != null
  );
  const hotTempFL = hasTier1Temps ? lastEntry?.tyre_temp_hot_fl_c : hasTier2Temps ? lastEntry?.tyre_temp_hot_fl_mid_c : undefined;
  const hotTempFR = hasTier1Temps ? lastEntry?.tyre_temp_hot_fr_c : hasTier2Temps ? lastEntry?.tyre_temp_hot_fr_mid_c : undefined;
  const hotTempRL = hasTier1Temps ? lastEntry?.tyre_temp_hot_rl_c : hasTier2Temps ? lastEntry?.tyre_temp_hot_rl_mid_c : undefined;
  const hotTempRR = hasTier1Temps ? lastEntry?.tyre_temp_hot_rr_c : hasTier2Temps ? lastEntry?.tyre_temp_hot_rr_mid_c : undefined;
  const tempFLInner = lastEntry?.tyre_temp_hot_fl_inner_c;
  const tempFLOuter = lastEntry?.tyre_temp_hot_fl_outer_c;
  const tempFRInner = lastEntry?.tyre_temp_hot_fr_inner_c;
  const tempFROuter = lastEntry?.tyre_temp_hot_fr_outer_c;
  const tempRLInner = lastEntry?.tyre_temp_hot_rl_inner_c;
  const tempRLOuter = lastEntry?.tyre_temp_hot_rl_outer_c;
  const tempRRInner = lastEntry?.tyre_temp_hot_rr_inner_c;
  const tempRROuter = lastEntry?.tyre_temp_hot_rr_outer_c;
  const allMidTemps = [hotTempFL, hotTempFR, hotTempRL, hotTempRR].filter((t): t is number => t != null);
  const globalTempAvg = allMidTemps.length > 0 ? allMidTemps.reduce((a,b) => a+b, 0) / allMidTemps.length : null;

  function tempToColor(tempC: number | null | undefined, avg: number | null, scale = 6): string {
    if (tempC == null || avg == null) return '#252525';
    const temp    = settings.temperature_unit === 'f' ? tempC * 9/5 + 32 : tempC;
    const avgDisp = settings.temperature_unit === 'f' ? avg  * 9/5 + 32 : avg;
    const sf      = settings.temperature_unit === 'f' ? scale * 1.8 : scale;
    const ratio   = Math.max(0, Math.min(1, 0.5 + (temp - avgDisp) / (sf * 2)));
    if (ratio < 0.45) { const t = ratio/0.45; return `rgb(${Math.round(40+t*50)},${Math.round(95+t*80)},220)`; }
    if (ratio < 0.55) return `rgb(210,210,200)`;
    const t = (ratio-0.55)/0.45;
    return `rgb(${Math.round(220+t*35)},${Math.round(220-t*220)},${Math.round(210-t*210)})`;
  }

  function fmtTemp(c: number | null | undefined): string {
    if (c == null) return '—';
      const converted = settings.temperature_unit === 'f' ? c * 9/5 + 32 : c;
      return `${Math.round(converted)}${tempUnit()}`;
    }

  // Axle spread (FL vs FR, RL vs RR)
  const frontSpread = (hotFL !== undefined && hotFR !== undefined)
    ? Math.abs(Math.round((hotFL - hotFR) * 10) / 10)
    : null;
  const rearSpread = (hotRL !== undefined && hotRR !== undefined)
    ? Math.abs(Math.round((hotRL - hotRR) * 10) / 10)
    : null;

  // Heat soak per axle
  const frontSoak = hotFrontAvg !== undefined
    ? Math.round((hotFrontAvg - coldF) * 10) / 10
    : null;
  const rearSoak = hotRearAvg !== undefined
    ? Math.round((hotRearAvg - coldR) * 10) / 10
    : null;

  function barPercent(val: number, min: number, max: number): number {
    return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  function generateInsight(): string | null {
    if (!target) return null;
    const avg = hotFrontAvg;
    if (avg && avg > target.target_hot_max_psi + 1) {
      return `Front average ran ${displayPressure(avg - target.target_hot_max_psi)} ${pressureUnit()} above the ${activeEvent?.tire_front.compound} target. Consider dropping cold set by 1–2 ${pressureUnit()} next session.`;
    }
    if (avg && avg < target.target_hot_min_psi - 1) {
      return `Front average was ${displayPressure(target.target_hot_min_psi - avg)} ${pressureUnit()} below the ${activeEvent?.tire_front.compound} target. The tire may not be fully up to temperature, or try adding 1–1.5 ${pressureUnit()} cold.`;
    }
    if (frontSpread !== null && frontSpread > 1.5) {
      return `Front left/right spread is ${displayPressure(frontSpread)} ${pressureUnit()} — larger than typical. Check camber settings or tire condition if this persists.`;
    }
    if (rearSpread !== null && rearSpread > 1.5) {
      return `Rear left/right spread is ${displayPressure(rearSpread)} ${pressureUnit()} — worth monitoring across sessions.`;
    }
    if (avg && cornerInRange(avg)) {
      return `Hot pressures landed in the ${activeEvent?.tire_front.compound} target range — cold set looks well matched to conditions today.`;
    }
    return `${commCount} sessions logged for this setup at ${activeEvent?.track.name}. Logging hot pressures next session will unlock personalised recommendations.`;
  }

  const insight = generateInsight();

  return (
    <SafeAreaView style={globalStyles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Check row */}
        <View style={styles.checkRow}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.subhead, { fontWeight: '600' }]}>Session {sessionCount} logged</Text>
            <Text style={typography.caption}>
              {activeEvent?.track_config?.name ?? activeEvent?.track.name} · {timeStr}
            </Text>
          </View>
        </View>

        {/* Cold comparison grid — unchanged */}
        <Text style={globalStyles.sectionLabel}>Cold pressures vs reference</Text>
        <View style={styles.compGrid}>
          <View style={[globalStyles.card, { flex: 1, marginRight: spacing.sm }]}>
            <Text style={[typography.label, { marginBottom: spacing.sm }]}>Front ({pressureUnit()})</Text>
            <View style={styles.compRow}>
              <Text style={styles.compRowLabel}>You</Text>
              <Text style={styles.compRowVal}>{displayPressure(coldF)}</Text>
            </View>
            <View style={styles.compRow}>
              <Text style={[styles.compRowLabel, { color: colors.textMuted }]}>OEM</Text>
              <Text style={[styles.compRowVal, { fontSize: 14, color: colors.textSecondary }]}>{displayPressure(oemF)}</Text>
            </View>
            <View style={styles.compRow}>
              <Text style={[styles.compRowLabel, { color: colors.textMuted }]}>Comm.</Text>
              <Text style={[styles.compRowVal, { fontSize: 14, color: colors.textSecondary }]}>{displayPressure(commAvgF)}</Text>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <DeltaBadge value={Math.round((parseFloat(displayPressure(coldF)) - parseFloat(displayPressure(oemF))) * 100) / 100} label="vs OEM" size="sm" />
            </View>
          </View>
          <View style={[globalStyles.card, { flex: 1 }]}>
            <Text style={[typography.label, { marginBottom: spacing.sm }]}>Rear ({pressureUnit()})</Text>
            <View style={styles.compRow}>
              <Text style={styles.compRowLabel}>You</Text>
              <Text style={styles.compRowVal}>{displayPressure(coldR)}</Text>
            </View>
            <View style={styles.compRow}>
              <Text style={[styles.compRowLabel, { color: colors.textMuted }]}>OEM</Text>
              <Text style={[styles.compRowVal, { fontSize: 14, color: colors.textSecondary }]}>{displayPressure(oemR)}</Text>
            </View>
            <View style={styles.compRow}>
              <Text style={[styles.compRowLabel, { color: colors.textMuted }]}>Comm.</Text>
              <Text style={[styles.compRowVal, { fontSize: 14, color: colors.textSecondary }]}>{displayPressure(commAvgR)}</Text>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <DeltaBadge value={Math.round((parseFloat(displayPressure(coldR)) - parseFloat(displayPressure(oemR))) * 100) / 100} label="vs OEM" size="sm" />
            </View>
          </View>
        </View>

        {/* Four-corner hot readings */}
        {hasCornerData && (
          <>
            <Text style={globalStyles.sectionLabel}>Hot pressures — four corners</Text>

            {/* Car-oriented 2×2 grid */}
            <Text style={[typography.caption, { textAlign: 'center', color: colors.textMuted, marginBottom: spacing.sm }]}>
              Front of car ↑
            </Text>
            <View style={styles.cornerGrid}>
              {([
                { key: 'fl', label: 'Front left',  val: hotFL, midTemp: hotTempFL, innerTemp: tempFLInner, outerTemp: tempFLOuter, isLeft: true  },
                { key: 'fr', label: 'Front right', val: hotFR, midTemp: hotTempFR, innerTemp: tempFRInner, outerTemp: tempFROuter, isLeft: false },
                { key: 'rl', label: 'Rear left',   val: hotRL, midTemp: hotTempRL, innerTemp: tempRLInner, outerTemp: tempRLOuter, isLeft: true  },
                { key: 'rr', label: 'Rear right',  val: hotRR, midTemp: hotTempRR, innerTemp: tempRRInner, outerTemp: tempRROuter, isLeft: false },
              ] as { key: string; label: string; val: number | undefined; midTemp: number | null | undefined; innerTemp: number | null | undefined; outerTemp: number | null | undefined; isLeft: boolean }[]).map(({ key, label, val, midTemp, innerTemp, outerTemp, isLeft }) => {
                const inRange  = cornerInRange(val);
                const midColor = tempToColor(midTemp, globalTempAvg);
                const leftTemp  = isLeft ? outerTemp : innerTemp;
                const rightTemp = isLeft ? innerTemp : outerTemp;
                const leftColor  = tempToColor(leftTemp,  globalTempAvg);
                const rightColor = tempToColor(rightTemp, globalTempAvg);
                return (
                  <View key={key} style={styles.cornerBox}>
                    <Text style={styles.cornerLabel}>{label}</Text>
                    <View style={styles.cornerPsiRow}>
                      <Text style={styles.cornerVal}>
                        {val !== undefined ? displayPressure(val) : '—'}
                      </Text>
                      {inRange !== null && (
                        <View style={[styles.cornerBadge, inRange ? styles.cornerBadgeGood : styles.cornerBadgeBad]}>
                          <Text style={[styles.cornerBadgeText, inRange ? styles.cornerBadgeTextGood : styles.cornerBadgeTextBad]}>
                            {inRange ? 'in range' : 'out of range'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {hasTier1Temps && midTemp != null && (
                      <Text style={styles.cornerTempText}>{fmtTemp(midTemp)}</Text>
                    )}
                    {hasTier2Temps && midTemp != null && (
                      <View style={styles.cornerTempRow}>
                        <Text style={styles.cornerTempText}>{fmtTemp(leftTemp)}</Text>
                        <Text style={styles.cornerTempText}>{fmtTemp(midTemp)}</Text>
                        <Text style={styles.cornerTempText}>{fmtTemp(rightTemp)}</Text>
                      </View>
                    )}
                    <View style={styles.cornerBar}>
                      {hasTier2Temps && midTemp != null ? (
                        <View style={[styles.cornerBarSegment, { flex: 1, backgroundColor: leftColor }]} />
                      ) : null}
                      <View style={[
                        hasTier2Temps && midTemp != null ? styles.cornerBarSegment : styles.cornerBarFull,
                        { flex: 1, backgroundColor: midColor },
                      ]} />
                      {hasTier2Temps && midTemp != null ? (
                        <View style={[styles.cornerBarSegment, { flex: 1, backgroundColor: rightColor }]} />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Axle diagnostics */}
            <View style={styles.diagRow}>
              {frontSpread !== null && (
                <View style={styles.diagChip}>
                  <Text style={styles.diagLabel}>Front spread</Text>
                  <Text style={[
                    styles.diagVal,
                    frontSpread <= 0.5 ? styles.diagGood : frontSpread <= 1.5 ? styles.diagWarn : styles.diagBad,
                  ]}>
                    {displayPressure(frontSpread)} {pressureUnit()}
                  </Text>
                  <Text style={styles.diagSub}>FL vs FR</Text>
                </View>
              )}
              {rearSpread !== null && (
                <View style={styles.diagChip}>
                  <Text style={styles.diagLabel}>Rear spread</Text>
                  <Text style={[
                    styles.diagVal,
                    rearSpread <= 0.5 ? styles.diagGood : rearSpread <= 1.5 ? styles.diagWarn : styles.diagBad,
                  ]}>
                    {displayPressure(rearSpread)} {pressureUnit()}
                  </Text>
                  <Text style={styles.diagSub}>RL vs RR</Text>
                </View>
              )}
              {frontSoak !== null && (
                <View style={styles.diagChip}>
                  <Text style={styles.diagLabel}>Front soak</Text>
                  <Text style={styles.diagVal}>+{displayPressure(frontSoak)}</Text>
                  <Text style={styles.diagSub}>avg heat rise</Text>
                </View>
              )}
              {rearSoak !== null && (
                <View style={styles.diagChip}>
                  <Text style={styles.diagLabel}>Rear soak</Text>
                  <Text style={styles.diagVal}>+{displayPressure(rearSoak)}</Text>
                  <Text style={styles.diagSub}>avg heat rise</Text>
                </View>
              )}
            </View>

            {/* Target range summary */}
            {target && (
              <View style={[globalStyles.card, { marginTop: 0 }]}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Target: {displayPressure(target.target_hot_min_psi)}–{displayPressure(target.target_hot_max_psi)} {pressureUnit()} ({activeEvent?.tire_front.compound})
                </Text>
              </View>
            )}
          </>
        )}

        {/* Fallback: legacy averaged hot display (cold-only sessions or pre-corner data) */}
        {!hasCornerData && hasHotData && target && (
          <>
            <Text style={globalStyles.sectionLabel}>Hot vs target range</Text>
            <View style={globalStyles.card}>
              {hotFrontAvg !== undefined && (
                <View style={[styles.compRow, { marginBottom: 8 }]}>
                  <Text style={styles.compRowLabel}>Front avg hot</Text>
                  <Text style={[styles.compRowVal, { fontSize: 15 }]}>{displayPressure(hotFrontAvg)} {pressureUnit()}</Text>
                  <View style={styles.rangePillWrap}>
                    <View style={[styles.rangePill, cornerInRange(hotFrontAvg) ? styles.rangePillGood : styles.rangePillBad]}>
                      <Text style={[styles.rangePillText, cornerInRange(hotFrontAvg) ? styles.rangePillTextGood : styles.rangePillTextBad]}>
                        {cornerInRange(hotFrontAvg) ? 'in range' : 'out of range'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              {hotRearAvg !== undefined && (
                <View style={styles.compRow}>
                  <Text style={styles.compRowLabel}>Rear avg hot</Text>
                  <Text style={[styles.compRowVal, { fontSize: 15 }]}>{displayPressure(hotRearAvg)} {pressureUnit()}</Text>
                  <View style={styles.rangePillWrap}>
                    <View style={[styles.rangePill, cornerInRange(hotRearAvg) ? styles.rangePillGood : styles.rangePillBad]}>
                      <Text style={[styles.rangePillText, cornerInRange(hotRearAvg) ? styles.rangePillTextGood : styles.rangePillTextBad]}>
                        {cornerInRange(hotRearAvg) ? 'in range' : 'out of range'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              <Text style={[typography.caption, { marginTop: spacing.sm }]}>
                Target: {displayPressure(target.target_hot_min_psi)}–{displayPressure(target.target_hot_max_psi)} {pressureUnit()} ({activeEvent?.tire_front.compound})
              </Text>
            </View>
          </>
        )}

        {/* Community range bars — cold pressures */}
        <Text style={globalStyles.sectionLabel}>Community range — {commCount} sessions</Text>
        <View style={globalStyles.card}>
          {[
            { label: 'Front', val: coldF, min: commMinF, max: commMaxF, range: `${displayPressure(commMinF)}–${displayPressure(commMaxF)}` },
            { label: 'Rear',  val: coldR, min: commMinR, max: commMaxR, range: `${displayPressure(commMinR)}–${displayPressure(commMaxR)}` },
          ].map(({ label, val, min, max, range }) => (
            <View key={label} style={styles.barRow}>
              <Text style={[typography.caption, { width: 36 }]}>{label}</Text>
              <View style={styles.barWrap}>
                <View style={[styles.barFill, {
                  marginLeft: `${((min - (min * 0.95)) / ((max * 1.05) - (min * 0.95))) * 100}%`,
                  width: `${((max - min) / ((max * 1.05) - (min * 0.95))) * 100}%`,
                }]} />
                <View style={[styles.barMarker, {
                  left: `${barPercent(val, min * 0.95, max * 1.05)}%`,
                }]} />
              </View>
              <Text style={[typography.caption, { width: 52, textAlign: 'right' }]}>{range}</Text>
            </View>
          ))}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.accent }]} />
              <Text style={typography.caption}>Community</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendMarker} />
              <Text style={typography.caption}>Your reading</Text>
            </View>
          </View>
        </View>

        {/* Insight */}
        {insight && (
          <View style={styles.insightBox}>
            <Text style={styles.insightText}>{insight}</Text>
            <Text style={[typography.caption, { color: colors.accent, marginTop: 6 }]}>
              Based on {commCount} sessions · {activeEvent?.tire_front.compound} at {activeEvent?.track.name}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => {
              setActiveTab('history');
              navigation.navigate('HistoryTab');
            }}
          >
            <Text style={styles.actionBtnSecondaryText}>Finish Event</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => navigation.navigate('QuickLog', { mode: 'cold' })}
          >
            <Text style={styles.actionBtnPrimaryText}>Next session</Text>
          </TouchableOpacity>
        </View>

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

  // Cold comparison
  compGrid: { flexDirection: 'row' },
  compRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  compRowLabel: { ...typography.caption, flex: 1 },
  compRowVal: { fontFamily: 'monospace', fontSize: 17, color: colors.textPrimary },

  // Four-corner grid
  cornerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  cornerBox: {
    width: '47%', backgroundColor: colors.bgCard,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md, alignItems: 'center',
  },
  cornerPsiRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, marginBottom: 3,
  },
  cornerLabel: {
    fontSize: 10, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginBottom: 3, textAlign: 'center',
  },
  cornerVal: { fontSize: 22, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  cornerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  cornerBadgeGood: { backgroundColor: colors.successSubtle },
  cornerBadgeBad:  { backgroundColor: colors.dangerSubtle },
  cornerBadgeText: { fontSize: 10, fontWeight: '600' },
  cornerBadgeTextGood: { color: colors.success },
  cornerBadgeTextBad:  { color: colors.danger },
  cornerTempText: { fontSize: 11, color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  cornerTempRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 2 },
  cornerBar: {
    width: '100%', height: 5, borderRadius: 3,
    flexDirection: 'row', marginTop: 6,
    overflow: 'hidden', backgroundColor: '#252525',
  },
  cornerBarFull: { borderRadius: 3 },
  cornerBarSegment: {},

  // Axle diagnostics
  diagRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  diagChip: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md, alignItems: 'center',
  },
  diagLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  diagVal: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  diagSub: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  diagGood: { color: colors.success },
  diagWarn: { color: colors.warning },
  diagBad:  { color: colors.danger },

  // Legacy hot range pill
  rangePillWrap: { marginLeft: 8 },
  rangePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 0.5 },
  rangePillGood: { backgroundColor: colors.successSubtle, borderColor: colors.success },
  rangePillBad:  { backgroundColor: colors.dangerSubtle,  borderColor: colors.danger },
  rangePillText: { fontSize: 11, fontWeight: '600' },
  rangePillTextGood: { color: colors.success },
  rangePillTextBad:  { color: colors.danger },

  // Community bars
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  barWrap: {
    flex: 1, height: 8, backgroundColor: colors.bgHighlight,
    borderRadius: 4, overflow: 'visible', position: 'relative',
  },
  barFill: { position: 'absolute', height: 8, backgroundColor: colors.accent, borderRadius: 4, opacity: 0.5 },
  barMarker: {
    position: 'absolute', top: -2, width: 3, height: 12,
    backgroundColor: colors.textPrimary, borderRadius: 2,
  },
  legendRow: { flexDirection: 'row', gap: spacing.lg, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 4, borderRadius: 2 },
  legendMarker: { width: 3, height: 10, backgroundColor: colors.textPrimary, borderRadius: 1 },

  // Insight
  insightBox: {
    backgroundColor: colors.accentSubtle, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.borderActive,
    padding: spacing.md, marginTop: spacing.lg,
  },
  insightText: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },

  // Actions
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  actionBtn: { flex: 1, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: colors.accent },
  actionBtnSecondary: { backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.border },
  actionBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#000' },
  actionBtnSecondaryText: { fontSize: 15, color: colors.textSecondary },
});
