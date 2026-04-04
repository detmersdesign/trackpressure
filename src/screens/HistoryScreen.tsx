import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { DeltaBadge } from '../components/DeltaBadge';
import { useEvent } from '../hooks/useEventContext';
import { computeRecommendation } from '../lib/recommendations';
import { supabase } from '../lib/supabase';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useLocationAndWeather } from '../hooks/useLocationAndWeather';
import { useSettings } from '../hooks/useSettings';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  created_at: string;
  ambient_temp_c: number | null;
  session_type: string;
  cold_front_psi: number;
  cold_rear_psi: number;
  hot_front_psi: number | null;
  hot_rear_psi: number | null;
  hot_fl_psi: number | null;
  hot_fr_psi: number | null;
  hot_rl_psi: number | null;
  hot_rr_psi: number | null;
  signal_score: number | null;
  user_id: string | null;
  track_id?: string;
  track_name?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'personal' | 'hot_only';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'personal', label: 'My sessions' },
  { key: 'hot_only', label: 'Hot logged' },
];

const SESSION_TYPE_LABELS: Record<string, string> = {
  hpde: 'HPDE', time_attack: 'Time attack', club_race: 'Club race',
  practice: 'Practice', qualifying: 'Qualifying', race: 'Race',
};

const W = Dimensions.get('window').width - spacing.lg * 4 - 2;
const CHART_H = 140;
const PAD = { left: 30, right: 10, top: 10, bottom: 28 };

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: { params?: { vehicleId?: string; tireId?: string; trackId?: string } };
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistoryScreen({ navigation, route }: Props) {
  const { activeEvent, setActiveTab } = useEvent();
  const { weather } = useLocationAndWeather();
  const { displayPressure, pressureUnit, displayTemp, tempUnit, settings } = useSettings();

  const [filter, setFilter]             = useState<FilterKey>('all');
  const [trackView, setTrackView]       = useState<'all' | 'single'>('single');
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [loading, setLoading]           = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [availableTracks, setAvailableTracks] = useState<{ id: string; name: string }[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | undefined>(undefined);
  const [trackDropdownOpen, setTrackDropdownOpen] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [tireLabel, setTireLabel]       = useState('');

  // ── Resolve context ────────────────────────────────────────────────────────
  const vehicleId = route?.params?.vehicleId ?? activeEvent?.vehicle.id;
  const tireId    = route?.params?.tireId    ?? activeEvent?.tire_front.id;
  const trackId   = route?.params?.trackId   ?? activeEvent?.track.id;

  useEffect(() => {
    if (activeEvent) {
      setVehicleLabel(activeEvent.vehicle.model);
      setTireLabel(activeEvent.tire_front.compound);
      return;
    }
    if (!vehicleId || !tireId) return;

    Promise.all([
      supabase.from('vehicles').select('make, model').eq('id', vehicleId).single(),
      supabase.from('tires').select('compound').eq('id', tireId).single(),
    ]).then(([vehicleRes, tireRes]) => {
      if (vehicleRes.data) setVehicleLabel(`${vehicleRes.data.make} ${vehicleRes.data.model}`);
      if (tireRes.data)    setTireLabel(tireRes.data.compound);
    });
  }, [vehicleId, tireId, activeEvent]);
  const trackLabel   = trackView === 'single'
    ? (availableTracks.find(t => t.id === selectedTrackId)?.name ?? 'Track')
    : 'All tracks';

  const ambientTodayC = weather?.temp_c ?? 20;
  const ambientToday  = settings.temperature_unit === 'f'
    ? ambientTodayC * 9/5 + 32
    : ambientTodayC;

  // ── Guard: no context ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!vehicleId && !tireId) {
      Alert.alert(
        'Select a car first',
        'Select a car from your garage to view history.',
        [
          {
            text: 'Go to Garage',
            onPress: () => {
              setActiveTab('garage');
              navigation.navigate('GarageTab');
            },
          },
        ]
      );
    }
  }, [vehicleId, tireId]);

  // ── Fetch current user ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
  }, []);

  // ── Fetch available tracks for this car/tire combo ─────────────────────────
  useEffect(() => {
    if (!vehicleId || !tireId) return;

    supabase
      .from('pressure_entries')
      .select('track_id, tracks (name)')
      .eq('vehicle_id', vehicleId)
      .eq('tire_id', tireId)
      .or(`is_hidden.eq.false${currentUserId ? `,and(is_hidden.eq.true,user_id.eq.${currentUserId})` : ''}`)
      .then(({ data }) => {
        if (!data) return;
        const seen = new Map<string, string>();
        data.forEach((row: any) => {
          if (row.track_id && row.tracks?.name) {
            seen.set(row.track_id, row.tracks.name);
          }
        });
        const tracks = Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
        setAvailableTracks(tracks);

        if (!selectedTrackId) {
          const preferred = trackId && tracks.find(t => t.id === trackId);
          setSelectedTrackId(preferred ? preferred.id : tracks[0]?.id);
        }
      });
  }, [vehicleId, tireId, currentUserId]);

  // ── Fetch sessions ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vehicleId || !tireId) {
      setLoading(false);
      return;
    }

    async function fetchSessions() {
      setLoading(true);

      let query = supabase
        .from('pressure_entries')
        .select(`
          id, created_at, ambient_temp_c, session_type,
          cold_front_psi, cold_rear_psi,
          hot_front_psi, hot_rear_psi,
          hot_fl_psi, hot_fr_psi, hot_rl_psi, hot_rr_psi,
          signal_score, user_id, track_id,
          tracks (name)
        `)
        .eq('vehicle_id', vehicleId)
        .eq('tire_id', tireId)
        .or(`is_hidden.eq.false${currentUserId ? `,and(is_hidden.eq.true,user_id.eq.${currentUserId})` : ''}`)
        .eq('is_outlier', false)
        .order('created_at', { ascending: false });

      if (selectedTrackId && trackView === 'single') {
        query = query.eq('track_id', selectedTrackId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const mapped = (data as any[]).map(s => ({
          ...s,
          track_name: s.tracks?.name ?? null,
        }));
        setSessions(mapped as Session[]);
      }
      setLoading(false);
    }

    fetchSessions();
  }, [vehicleId, tireId, selectedTrackId, trackView, currentUserId]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const personalSessions = sessions.filter(s => s.user_id === currentUserId);

  const filteredSessions = sessions.filter(s => {
    if (filter === 'personal') return s.user_id === currentUserId;
    if (filter === 'hot_only') return s.hot_front_psi != null;
    return true;
  });

  const forRecommendation = sessions.map(s => ({
    cold_front_psi: s.cold_front_psi,
    cold_rear_psi:  s.cold_rear_psi,
    ambient_temp_c: s.ambient_temp_c ?? ambientToday,
    signal_score:   s.signal_score ?? 1.0,
  }));

  const personalForRec = forRecommendation.filter((_, i) =>
    sessions[i].user_id === currentUserId
  );

  const recommendation = sessions.length > 0 && trackView === 'single'
    ? computeRecommendation(personalForRec as any, forRecommendation as any, ambientToday)
    : null;

  // ── Scatter chart — single track only ─────────────────────────────────────

  const chartSessions = sessions.filter(s => s.ambient_temp_c != null);
  const hasChartData  = chartSessions.length >= 2 && trackView === 'single';

  const temps  = chartSessions.map(s => {
    const c = s.ambient_temp_c!;
    return settings.temperature_unit === 'f' ? c * 9/5 + 32 : c;
  });
  const fronts = chartSessions.map(s => s.cold_front_psi);

  const minT = hasChartData ? Math.min(...temps)  - 2 : 10;
  const maxT = hasChartData ? Math.max(...temps)  + 2 : 40;
  const minP = hasChartData ? Math.min(...fronts) - 1 : 28;
  const maxP = hasChartData ? Math.max(...fronts) + 1 : 38;

  const chartW = W - PAD.left - PAD.right;
  const chartH = CHART_H - PAD.top - PAD.bottom;

  function toX(t: number) { return PAD.left + ((t - minT) / (maxT - minT)) * chartW; }
  function toY(p: number) { return PAD.top + chartH - ((p - minP) / (maxP - minP)) * chartH; }

  let slope = 0; let intercept = 0;
  if (hasChartData) {
    const n     = temps.length;
    const sumX  = temps.reduce((a, b) => a + b, 0);
    const sumY  = fronts.reduce((a, b) => a + b, 0);
    const sumXY = temps.reduce((a, t, i) => a + t * fronts[i], 0);
    const sumX2 = temps.reduce((a, t) => a + t * t, 0);
    slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    intercept = (sumY - slope * sumX) / n;
  }

  const trendX1 = toX(minT); const trendY1 = toY(slope * minT + intercept);
  const trendX2 = toX(maxT); const trendY2 = toY(slope * maxT + intercept);
  const todayX  = toX(ambientToday);
  const todayY  = toY(slope * ambientToday + intercept);

  // ── Render ─────────────────────────────────────────────────────────────────

    if (!vehicleId || !tireId) {
      return (
        <SafeAreaView style={globalStyles.screen}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            <Text style={typography.subhead}>No tire set selected</Text>
            <Text style={[typography.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
              Go to your garage and select a tire set to view session history.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={globalStyles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text style={[typography.heading, { marginBottom: 4 }]}>
          {trackLabel}
        </Text>
        <Text style={typography.caption}>
          {vehicleLabel}{tireLabel ? ` · ${tireLabel}` : ''}
        </Text>

        {/* All tracks / Single track toggle */}
        <View style={styles.toggleWrap}>
          <TouchableOpacity
            style={[styles.toggleOpt, trackView === 'all' && styles.toggleOptActive]}
            onPress={() => setTrackView('all')}
          >
            <Text style={[styles.toggleText, trackView === 'all' && styles.toggleTextActive]}>
              All tracks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOpt, trackView === 'single' && styles.toggleOptActive]}
            onPress={() => setTrackView('single')}
          >
            <Text style={[styles.toggleText, trackView === 'single' && styles.toggleTextActive]}>
              Single track
            </Text>
          </TouchableOpacity>
        </View>

        {/* Track dropdown — single track only */}
        {trackView === 'single' && availableTracks.length > 0 && (
          <View style={{ marginBottom: spacing.sm }}>
            <TouchableOpacity
              style={styles.trackDropdown}
              onPress={() => setTrackDropdownOpen(!trackDropdownOpen)}
            >
              <Text style={styles.trackDropdownVal}>
                {availableTracks.find(t => t.id === selectedTrackId)?.name ?? 'Select track'}
              </Text>
              <Text style={styles.trackDropdownArrow}>
                {trackDropdownOpen ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {trackDropdownOpen && (
              <View style={styles.trackDropdownOptions}>
                {availableTracks.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.trackDropdownOption}
                    onPress={() => {
                      setSelectedTrackId(t.id);
                      setTrackDropdownOpen(false);
                    }}
                  >
                    <Text style={[
                      styles.trackDropdownOptionText,
                      selectedTrackId === t.id && styles.trackDropdownOptionActive,
                    ]}>
                      {t.name}
                    </Text>
                    {selectedTrackId === t.id && (
                      <Text style={{ color: colors.accent, fontSize: 12 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Recommendation card — single track only */}
        {recommendation && (
          <>
            <Text style={globalStyles.sectionLabel}>
              Recommended for today · {displayTemp(ambientTodayC)}{tempUnit()}
            </Text>
            <View style={[globalStyles.card, styles.recCard]}>
              <View>
                <Text style={styles.recTitle}>Suggested cold {pressureUnit()}</Text>
                <Text style={styles.recBasis}>
                  {recommendation.personal_weight}% your history
                  {'\n'}{recommendation.community_weight}% community
                </Text>
              </View>
              <View style={styles.recPressures}>
                <View style={styles.recP}>
                  <Text style={styles.recLabel}>F</Text>
                  <Text style={styles.recVal}>{displayPressure(recommendation.cold_front_psi)}</Text>
                </View>
                <Text style={styles.recSep}>/</Text>
                <View style={styles.recP}>
                  <Text style={styles.recLabel}>R</Text>
                  <Text style={styles.recVal}>{displayPressure(recommendation.cold_rear_psi)}</Text>
                </View>
                <Text style={[typography.caption, {
                  alignSelf: 'flex-end', marginBottom: 4, marginLeft: 4,
                }]}></Text>
              </View>
            </View>
          </>
        )}

        {/* Scatter chart — single track only */}
        {hasChartData && (
          <>
            <Text style={globalStyles.sectionLabel}>Ambient temp vs cold pressure</Text>
            <View style={globalStyles.card}>
              <Svg width={W} height={CHART_H}>
                {[minP, minP + (maxP - minP) / 2, maxP].map(p => (
                  <Line key={p}
                    x1={PAD.left} y1={toY(p)}
                    x2={PAD.left + chartW} y2={toY(p)}
                    stroke={colors.border} strokeWidth={0.5}
                  />
                ))}
                {[minP, minP + (maxP - minP) / 2, maxP].map(p => (
                  <SvgText key={`yl${p}`}
                    x={PAD.left - 4} y={toY(p) + 4}
                    fontSize={9} fill={colors.textMuted} textAnchor="end">
                    {displayPressure(p)}
                  </SvgText>
                ))}
                {[minT + 2, ambientToday, maxT - 2]
                  .filter((t, i, arr) => arr.indexOf(t) === i)
                  .map((t, i) => (
                    <SvgText key={`xl${i}`}
                      x={toX(t)} y={CHART_H - 4}
                      fontSize={9} fill={colors.textMuted} textAnchor="middle">
                      {Math.round(t)}{tempUnit()}
                    </SvgText>
                  ))}
                <Line
                  x1={trendX1} y1={trendY1} x2={trendX2} y2={trendY2}
                  stroke={colors.accent} strokeWidth={1.5}
                  strokeDasharray="4,3" opacity={0.7}
                />
                {chartSessions.map(s => {
                  const tDisplay = settings.temperature_unit === 'f'
                    ? s.ambient_temp_c! * 9/5 + 32
                    : s.ambient_temp_c!;
                  return (
                    <Circle key={s.id}
                      cx={toX(tDisplay)}
                      cy={toY(s.cold_front_psi)}
                      r={4}
                      fill={s.user_id === currentUserId ? colors.accent : colors.textMuted}
                      opacity={0.85}
                    />
                  );
                })}
                <Circle cx={todayX} cy={todayY} r={6} fill={colors.purple} opacity={0.9} />
                <SvgText x={todayX + 8} y={todayY + 4} fontSize={9} fill={colors.purple}>
                  today
                </SvgText>
              </Svg>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                  <Text style={typography.caption}>Your sessions</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
                  <Text style={typography.caption}>Community</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.purple }]} />
                  <Text style={typography.caption}>Today ({displayTemp(ambientTodayC)}{tempUnit()})</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Session list */}
        <Text style={globalStyles.sectionLabel}>Sessions</Text>
        <View style={styles.filterRow}>
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, filter === key && styles.filterChipActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : filteredSessions.length === 0 ? (
          <Text style={[typography.caption, { marginTop: spacing.lg, color: colors.textMuted }]}>
            {sessions.length === 0
              ? 'No sessions logged yet for this setup.'
              : 'No sessions match this filter.'}
          </Text>
        ) : (
          filteredSessions.map(session => {
            const hotDelta = session.hot_front_psi != null
              ? Math.round((parseFloat(displayPressure(session.hot_front_psi)) - parseFloat(displayPressure(session.cold_front_psi))) * 100) / 100
              : null;
            const isPersonal = session.user_id === currentUserId;

            return (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionRow}
                onPress={() => navigation.navigate('DeltaAnalysis')}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.sessionDot,
                  { backgroundColor: isPersonal ? colors.accent : colors.textMuted },
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { fontWeight: '500' }]}>
                    {new Date(session.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                    {' · '}{SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}
                    {session.ambient_temp_c != null ? ` · ${displayTemp(session.ambient_temp_c)}${tempUnit()}` : ''}
                  </Text>
                  <Text style={typography.caption}>
                    {trackView === 'all' && session.track_name
                      ? `${session.track_name}\n`
                      : ''}
                    Cold {displayPressure(session.cold_front_psi)} / {displayPressure(session.cold_rear_psi)}
                    {session.hot_front_psi != null
                      ? ` · Hot ${displayPressure(session.hot_front_psi)} / ${displayPressure(session.hot_rear_psi!)}`
                      : ''}
                    {!isPersonal ? ' · community' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 14, color: colors.textPrimary }}>
                    {displayPressure(session.cold_front_psi)} / {displayPressure(session.cold_rear_psi)}
                  </Text>
                  {hotDelta !== null && (
                    <DeltaBadge value={hotDelta} label="soak" size="sm" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Delta analysis — single track only */}
        {trackView === 'single' && selectedTrackId && (
          <TouchableOpacity
            style={styles.analysisBtn}
            onPress={() => navigation.navigate('DeltaAnalysis', {
              vehicleId: vehicleId,
              tireId:    tireId,
              trackId:   selectedTrackId,
            })}
          >
            <Text style={styles.analysisBtnText}>Cold → hot delta analysis →</Text>
          </TouchableOpacity>
        )}

        {/* Session count summary */}
        {!loading && sessions.length > 0 && (
          <Text style={[typography.caption, {
            textAlign: 'center', marginTop: spacing.md, color: colors.textMuted,
          }]}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} ·{' '}
            {personalSessions.length} yours
            {' · '}{sessions.length - personalSessions.length} community
          </Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 40 },

  // Toggle
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  toggleOpt: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  toggleOptActive: { backgroundColor: colors.accentSubtle },
  toggleText: { fontSize: 13, color: colors.textSecondary },
  toggleTextActive: { color: colors.accent, fontWeight: '500' },

  // Track dropdown
  trackDropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.accent,
    padding: spacing.md, marginTop: spacing.sm,
  },
  trackDropdownVal: { fontSize: 13, color: colors.accent, fontWeight: '500', flex: 1 },
  trackDropdownArrow: { fontSize: 10, color: colors.accent },
  trackDropdownOptions: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.accent,
    overflow: 'hidden', marginTop: 4,
  },
  trackDropdownOption: {
    padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  trackDropdownOptionText: { fontSize: 13, color: colors.textSecondary },
  trackDropdownOptionActive: { color: colors.accent, fontWeight: '500' },

  // Recommendation
  recCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recTitle: { ...typography.body, fontWeight: '500' },
  recBasis: { ...typography.caption, marginTop: 2, maxWidth: 180 },
  recPressures: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  recP: { alignItems: 'center'},
  recLabel: { ...typography.caption, marginBottom: 2 },
  recVal: { fontFamily: 'monospace', fontSize: 20, color: colors.textPrimary },
  recSep: { fontFamily: 'monospace', fontSize: 20, color: colors.textMuted, marginHorizontal: 2 },

  // Chart
  chartLegend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 0.5,
    borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  filterChipActive: { backgroundColor: colors.accentSubtle, borderColor: colors.accent },
  filterText: { fontSize: 13, color: colors.textSecondary },
  filterTextActive: { color: colors.accent, fontWeight: '500' },

  // Sessions
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  // Analysis button
  analysisBtn: {
    marginTop: spacing.xl, paddingVertical: 14,
    borderRadius: radius.lg, alignItems: 'center',
    borderWidth: 0.5, borderColor: colors.accent,
    backgroundColor: colors.accentSubtle,
  },
  analysisBtnText: { fontSize: 14, fontWeight: '500', color: colors.accent },
});
