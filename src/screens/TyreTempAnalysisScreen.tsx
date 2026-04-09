import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Circle, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';

type Props = NativeStackScreenProps<any, 'TyreTempAnalysis'>;

// ── Types ─────────────────────────────────────────────────────────────────────

interface TyreSession {
  id: string;
  created_at: string;
  day: string;           // ISO date string YYYY-MM-DD — groups sessions by event day
  user_id: string | null;
  // Tier 1 mid temps
  tyre_temp_hot_fl_c: number | null;
  tyre_temp_hot_fr_c: number | null;
  tyre_temp_hot_rl_c: number | null;
  tyre_temp_hot_rr_c: number | null;
  // Tier 2 gradient temps
  tyre_temp_hot_fl_inner_c: number | null;
  tyre_temp_hot_fl_mid_c:   number | null;
  tyre_temp_hot_fl_outer_c: number | null;
  tyre_temp_hot_fr_inner_c: number | null;
  tyre_temp_hot_fr_mid_c:   number | null;
  tyre_temp_hot_fr_outer_c: number | null;
  tyre_temp_hot_rl_inner_c: number | null;
  tyre_temp_hot_rl_mid_c:   number | null;
  tyre_temp_hot_rl_outer_c: number | null;
  tyre_temp_hot_rr_inner_c: number | null;
  tyre_temp_hot_rr_mid_c:   number | null;
  tyre_temp_hot_rr_outer_c: number | null;
}

interface CornerTemps {
  inner: number;
  mid:   number;
  outer: number;
}

interface CornerSession {
  day:      string;
  isLatest: boolean;
  temps:    CornerTemps;
}

type Corner = 'fl' | 'fr' | 'rl' | 'rr';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCorner(s: TyreSession, c: Corner): CornerTemps | null {
  // Prefer Tier 2 gradient data; fall back to Tier 1 mid for all three
  const inner = s[`tyre_temp_hot_${c}_inner_c` as keyof TyreSession] as number | null;
  const mid   = s[`tyre_temp_hot_${c}_mid_c` as keyof TyreSession] as number | null;
  const outer = s[`tyre_temp_hot_${c}_outer_c` as keyof TyreSession] as number | null;
  // Only return when full gradient data exists — mid-only sessions are excluded
  // to avoid plotting misleading flat inner/mid/outer equal values
  if (inner == null || mid == null || outer == null) return null;
  return { inner, mid, outer };
}

function whisker(vals: number[]) {
  const s = [...vals].sort((a, b) => a - b);
  const n = s.length;
  return {
    min: s[0],
    max: s[n - 1],
    q1:  s[Math.floor(n * 0.25)],
    q3:  s[Math.floor(n * 0.75)],
    med: s[Math.floor(n * 0.5)],
  };
}

function innerOuterDelta(t: CornerTemps) { return t.inner - t.outer; }

interface BiasResult {
  label: string;
  color: string;
  text:  string;
}

function biasInfo(d: number): BiasResult {
  if (Math.abs(d) < 5) return {
    label: 'Balanced',
    color: colors.success,
    text:  'Even tyre contact across width.',
  };
  if (d > 0) return {
    label: `Inner +${Math.round(d)}°`,
    color: colors.danger,
    text:  'Inner edge overworked — too much negative camber for this track.',
  };
  return {
    label: `Outer +${Math.round(-d)}°`,
    color: '#378ADD',
    text:  'Outer edge overworked — not enough negative camber for this track.',
  };
}

interface NoteRow { tag: string; bias: BiasResult; text: string }

function buildNotes(sessions: CornerSession[]): NoteRow[] {
  if (sessions.length === 0) return [];
  const days = [...new Set(sessions.map(s => s.day))].sort();
  const latestDay   = days[days.length - 1];
  const todaySessions  = sessions.filter(s => s.day === latestDay);
  const priorSessions  = sessions.filter(s => s.day !== latestDay);
  const latest = todaySessions[todaySessions.length - 1];
  const rows: NoteRow[] = [];

  // Last session
  const latestDelta = innerOuterDelta(latest.temps);
  rows.push({
    tag:  'Last',
    bias: biasInfo(latestDelta),
    text: biasInfo(latestDelta).text,
  });

  // Within-day trend
  if (todaySessions.length > 1) {
    const firstDelta = innerOuterDelta(todaySessions[0].temps);
    const dayChange  = latestDelta - firstDelta;
    let dayText: string;
    if (Math.abs(dayChange) < 3) {
      dayText = 'Consistent across today\'s sessions.';
    } else if (dayChange > 0) {
      dayText = `Inner bias grew ${Math.round(dayChange)}° through the day — tyre loading inward.`;
    } else {
      dayText = `Inner bias reduced ${Math.round(-dayChange)}° through the day — tyre settling in.`;
    }
    rows.push({ tag: 'Today', bias: biasInfo(latestDelta), text: dayText });
  }

  // Event vs history
  if (priorSessions.length >= 2) {
    const avgToday = todaySessions.reduce((a, s) => a + innerOuterDelta(s.temps), 0) / todaySessions.length;
    const avgPrior = priorSessions.reduce((a, s)  => a + innerOuterDelta(s.temps), 0) / priorSessions.length;
    const change   = avgToday - avgPrior;
    let vsColor: string;
    let vsLabel: string;
    let vsText:  string;
    if (Math.abs(change) < 3) {
      vsColor = colors.textMuted;
      vsLabel = 'Stable';
      vsText  = 'Similar to previous events — no change in pattern.';
    } else if (change > 0) {
      vsColor = colors.danger;
      vsLabel = 'Getting worse';
      vsText  = `${Math.round(change)}° more inner bias vs past events — camber worth reviewing before next visit.`;
    } else {
      vsColor = colors.success;
      vsLabel = 'Improving';
      vsText  = `${Math.round(-change)}° less inner bias vs past events — setup change is working.`;
    }
    rows.push({ tag: 'Trend', bias: { label: vsLabel, color: vsColor, text: vsText }, text: vsText });
  }

  return rows;
}

// ── Corner chart ──────────────────────────────────────────────────────────────

const CHART_W = 260;
const CHART_H = 280;
const PAD_L   = 28;
const PAD_B   = 22;
const PLOT_W  = CHART_W - PAD_L - 8;
const PLOT_H  = CHART_H - PAD_B - 8;

interface CornerChartProps {
  corner:       Corner;
  sessions:     CornerSession[];
  communityData: { inner: number[]; mid: number[]; outer: number[] } | null;
  showCommunity: boolean;
  displayTemp:  (c: number) => string;
  tempUnit:     () => string;
}

function CornerChart({ corner, sessions, communityData, showCommunity, displayTemp, tempUnit }: CornerChartProps) {
  const isLeft = corner === 'fl' || corner === 'rl';

  // Column layout mirrors car orientation
  const zones: Array<{ z: keyof CornerTemps; x: number; lbl: string }> = isLeft
    ? [{ z: 'outer', x: PAD_L + PLOT_W * 0.15, lbl: 'outer' },
       { z: 'mid',   x: PAD_L + PLOT_W * 0.5,  lbl: 'mid'   },
       { z: 'inner', x: PAD_L + PLOT_W * 0.85, lbl: 'inner' }]
    : [{ z: 'inner', x: PAD_L + PLOT_W * 0.15, lbl: 'inner' },
       { z: 'mid',   x: PAD_L + PLOT_W * 0.5,  lbl: 'mid'   },
       { z: 'outer', x: PAD_L + PLOT_W * 0.85, lbl: 'outer' }];

  const centreZoneX = isLeft ? zones[2].x : zones[0].x;

  const allVals = sessions.flatMap(s => [s.temps.inner, s.temps.mid, s.temps.outer]);
  if (showCommunity && communityData) {
    allVals.push(...communityData.inner, ...communityData.mid, ...communityData.outer);
  }
  if (allVals.length === 0) return null;
  const minT = Math.min(...allVals) - 6;
  const maxT = Math.max(...allVals) + 6;

  function toY(t: number) {
    return 8 + (1 - (t - minT) / (maxT - minT)) * PLOT_H;
  }

  const n = sessions.length;

  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => {
        const t = minT + f * (maxT - minT);
        const y = toY(t);
        return (
          <React.Fragment key={f}>
            <Line x1={PAD_L} x2={CHART_W - 8} y1={y} y2={y} stroke={colors.border} strokeWidth={0.5} />
            <SvgText x={PAD_L - 3} y={y + 3} fontSize={9} fill={colors.textMuted} textAnchor="end">
              {Math.round(parseFloat(displayTemp(t)))}°
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Column axes and labels */}
      {zones.map(({ x, lbl }) => (
        <React.Fragment key={lbl}>
          <Line x1={x} y1={6} x2={x} y2={CHART_H - PAD_B} stroke={colors.border} strokeWidth={0.5} />
          <SvgText x={x} y={CHART_H - 4} fontSize={10} fill={colors.textMuted} textAnchor="middle">{lbl}</SvgText>
        </React.Fragment>
      ))}

      {/* Car centre indicator */}
      <SvgText x={centreZoneX} y={5} fontSize={9} fill={colors.textMuted} textAnchor="middle" opacity={0.6}>
        ← ctr
      </SvgText>

      {/* Community whisker bars */}
      {showCommunity && communityData && zones.map(({ z, x }) => {
        const w = whisker(communityData[z]);
        const yMin = toY(w.min), yMax = toY(w.max);
        const yQ1  = toY(w.q1),  yQ3  = toY(w.q3);
        const yMed = toY(w.med);
        const bw = 10;
        return (
          <React.Fragment key={`comm-${z}`}>
            <Line x1={x} y1={yMin} x2={x} y2={yMax} stroke={colors.warning} strokeWidth={1} opacity={0.4} />
            <Line x1={x - bw/2} y1={yMin} x2={x + bw/2} y2={yMin} stroke={colors.warning} strokeWidth={1} opacity={0.5} />
            <Line x1={x - bw/2} y1={yMax} x2={x + bw/2} y2={yMax} stroke={colors.warning} strokeWidth={1} opacity={0.5} />
            <Rect x={x - bw/2} y={yQ3} width={bw} height={yQ1 - yQ3} rx={2} fill={colors.warning} opacity={0.18} />
            <Line x1={x - bw/2} y1={yMed} x2={x + bw/2} y2={yMed} stroke={colors.warning} strokeWidth={1.5} opacity={0.6} />
          </React.Fragment>
        );
      })}

      {/* Personal session dots — fading with age */}
      {sessions.map((s, i) => {
        const age     = i / Math.max(n - 1, 1);
        const opacity = 0.12 + age * 0.78;
        const r       = 2 + age * 2.5;
        const fill    = s.isLatest ? colors.textPrimary : colors.textMuted;
        return zones.map(({ z, x }) => (
          <Circle key={`${i}-${z}`} cx={x} cy={toY(s.temps[z])} r={r} fill={fill} opacity={opacity} />
        ));
      })}

      {/* Latest session connecting line */}
      {sessions.length > 0 && (() => {
        const latest = sessions[n - 1];
        const pts = zones.map(({ z, x }) => `${x},${toY(latest.temps[z])}`).join(' ');
        return <Polyline points={pts} fill="none" stroke={colors.textPrimary} strokeWidth={1.2} opacity={0.5} />;
      })()}

    </Svg>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const CORNERS: Corner[] = ['fl', 'fr', 'rl', 'rr'];
const CORNER_LABELS: Record<Corner, string> = {
  fl: 'Front left', fr: 'Front right', rl: 'Rear left', rr: 'Rear right',
};

export default function TyreTempAnalysisScreen({ navigation, route }: Props) {
  const { vehicleId, tireId, trackId } = route.params ?? {};
  const { displayTemp, tempUnit, settings } = useSettings();

  const [loading,       setLoading]       = useState(true);
  const [sessions,      setSessions]      = useState<TyreSession[]>([]);
  const [showCommunity, setShowCommunity] = useState(true);
  const [trackMode,     setTrackMode]     = useState<'single' | 'all'>('single');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id ?? null));
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [trackMode]);

  async function fetchSessions() {
    setLoading(true);
    let query = supabase
      .from('pressure_entries')
      .select(`
        id, created_at, user_id,
        tyre_temp_hot_fl_c, tyre_temp_hot_fr_c,
        tyre_temp_hot_rl_c, tyre_temp_hot_rr_c,
        tyre_temp_hot_fl_inner_c, tyre_temp_hot_fl_mid_c, tyre_temp_hot_fl_outer_c,
        tyre_temp_hot_fr_inner_c, tyre_temp_hot_fr_mid_c, tyre_temp_hot_fr_outer_c,
        tyre_temp_hot_rl_inner_c, tyre_temp_hot_rl_mid_c, tyre_temp_hot_rl_outer_c,
        tyre_temp_hot_rr_inner_c, tyre_temp_hot_rr_mid_c, tyre_temp_hot_rr_outer_c
      `)
      .eq('vehicle_id', vehicleId)
      .eq('tire_id', tireId)
      .not('tyre_temp_hot_fl_c', 'is', null)
      .eq('is_outlier', false)
      .order('created_at', { ascending: true });

    if (trackMode === 'single') {
      query = query.eq('track_id', trackId);
    }

    const { data } = await query;
    if (data) {
      const tagged = (data as any[]).map(row => ({
        ...row,
        day: row.created_at.slice(0, 10),
      })) as TyreSession[];
      setSessions(tagged);
    }
    setLoading(false);
  }

  // Build per-corner session arrays
  function cornerSessions(c: Corner): CornerSession[] {
    const personal = sessions.filter(s => s.user_id === currentUserId);
    return personal
      .map((s, i) => {
        const temps = extractCorner(s, c);
        if (!temps) return null;
        return {
          day:      s.day,
          isLatest: i === personal.length - 1,
          temps,
        };
      })
      .filter(Boolean) as CornerSession[];
  }

  // Community whisker data — aggregate all non-personal sessions
  function communityWhisker(c: Corner) {
    const comm = sessions.filter(s => s.user_id !== currentUserId);
    if (comm.length === 0) return null;
    const inner: number[] = [], mid: number[] = [], outer: number[] = [];
    comm.forEach(s => {
      const t = extractCorner(s, c);
      if (t) { inner.push(t.inner); mid.push(t.mid); outer.push(t.outer); }
    });
    if (inner.length === 0) return null;
    return { inner, mid, outer };
  }

  const hasData = sessions.some(s => s.user_id === currentUserId);

  return (
    <SafeAreaView style={globalStyles.screen}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[typography.caption, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={typography.subhead}>Tire temperature history</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Controls */}
      <View style={styles.controlRow}>
        <View style={styles.togWrap}>
          <TouchableOpacity
            style={[styles.tog, trackMode === 'single' && styles.togActive]}
            onPress={() => setTrackMode('single')}
          >
            <Text style={[styles.togText, trackMode === 'single' && styles.togTextActive]}>This track</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tog, trackMode === 'all' && styles.togActive]}
            onPress={() => setTrackMode('all')}
          >
            <Text style={[styles.togText, trackMode === 'all' && styles.togTextActive]}>All tracks</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.commBtn, showCommunity && styles.commBtnOn]}
          onPress={() => setShowCommunity(v => !v)}
        >
          <Text style={[styles.commBtnText, showCommunity && styles.commBtnTextOn]}>
            {showCommunity ? 'Community on' : 'Community off'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[typography.caption, { marginTop: spacing.sm, color: colors.textMuted }]}>
            Loading tire data…
          </Text>
        </View>
      ) : !hasData ? (
        <View style={styles.loadingWrap}>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            No pyrometer data recorded for this setup yet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* 2×2 corner quadrant */}
          <View style={styles.quad}>
            {CORNERS.map(c => {
              const cSessions = cornerSessions(c);
              const commData  = showCommunity ? communityWhisker(c) : null;
              const notes     = buildNotes(cSessions);
              const isLeft    = c === 'fl' || c === 'rl';

              return (
                <View key={c} style={[styles.quadrant, !isLeft && styles.quadrantRight]}>
                  <Text style={styles.cornerLabel}>{CORNER_LABELS[c]}</Text>

                  {cSessions.length === 0 ? (
                    <View style={styles.noDataPlaceholder}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>No temp data</Text>
                    </View>
                  ) : (
                    <CornerChart
                      corner={c}
                      sessions={cSessions}
                      communityData={commData}
                      showCommunity={showCommunity}
                      displayTemp={displayTemp}
                      tempUnit={tempUnit}
                    />
                  )}

                  {notes.length > 0 && (
                    <View style={styles.noteCard}>
                      {notes.map((row, i) => (
                        <View key={row.tag} style={[styles.noteRow, i < notes.length - 1 && styles.noteRowBorder]}>
                          <Text style={styles.noteTag}>{row.tag}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.noteBias, { color: row.bias.color }]}>{row.bias.label}</Text>
                            <Text style={styles.noteText}>{row.text}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textPrimary }]} />
              <Text style={typography.caption}>Latest session</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textMuted, opacity: 0.5 }]} />
              <Text style={typography.caption}>Personal history</Text>
            </View>
            {showCommunity && (
              <View style={styles.legendItem}>
                <View style={[styles.legendWhisker]} />
                <Text style={typography.caption}>Community range</Text>
              </View>
            )}
          </View>

        </ScrollView>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  controlRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  togWrap: {
    flexDirection: 'row', gap: 0, backgroundColor: colors.bgHighlight,
    borderRadius: radius.md, padding: 3,
    borderWidth: 0.5, borderColor: colors.border,
  },
  tog: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.sm },
  togActive: { backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.border },
  togText: { fontSize: 13, color: colors.textMuted },
  togTextActive: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  commBtn: {
    marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.border,
  },
  commBtnOn:     { borderColor: colors.warning },
  commBtnText:   { fontSize: 13, color: colors.textMuted },
  commBtnTextOn: { fontSize: 13, color: colors.warning },
  loadingWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },
  container: { padding: spacing.md, paddingBottom: 40 },
  quad: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    overflow: 'hidden',
  },
  quadrant: {
    width: '50%',
    padding: spacing.sm,
    borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.border,
  },
  quadrantRight: { borderRightWidth: 0 },
  cornerLabel: {
    fontSize: 13, fontWeight: '500', color: colors.textPrimary,
    textAlign: 'center', marginBottom: 6,
  },
  noDataPlaceholder: {
    height: 200, alignItems: 'center', justifyContent: 'center',
  },
  noteCard: {
    marginTop: 5, backgroundColor: colors.bgHighlight,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    overflow: 'hidden',
  },
  noteRow: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    padding: 6,
  },
  noteRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  noteTag: {
    fontSize: 10, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.4, width: 40, flexShrink: 0, paddingTop: 1,
  },
  noteBias: { fontSize: 12, fontWeight: '500' },
  noteText: { fontSize: 11, color: colors.textMuted, lineHeight: 15, marginTop: 1 },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
    marginTop: spacing.md, paddingHorizontal: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendWhisker: {
    width: 14, height: 10, borderWidth: 1, borderColor: colors.warning,
    opacity: 0.6, borderRadius: 1,
  },
});
