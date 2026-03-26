import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, ActivityIndicator, Alert,
  Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { supabase } from '../lib/supabase';
import { GarageVehicle, GarageTireSet, Tire, Vehicle } from '../types';
import { VehicleSilhouette } from '../components/VehicleSilhouette';

const SCREEN_W = Dimensions.get('window').width;

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: { params?: { focusCardIndex?: number; openTyreDropdown?: boolean } };
};

export default function GarageScreen({ navigation, route }: Props) {
  const { setActiveEvent, activeEvent, setActiveTab } = useEvent();

  const [garageVehicles, setGarageVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading]               = useState(true);
  const [currentIndex, setCurrentIndex]     = useState(0);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedTireSetIds, setSelectedTireSetIds] = useState<Record<string, string>>({});
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  // ── Fetch garage vehicles ─────────────────────────────────────────────────
  const fetchGarage = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [vehiclesRes, tiresRes, garageRes] = await Promise.all([
      supabase.from('vehicles').select('*'),
      supabase.from('tires').select('*'),
      supabase
        .from('garage_vehicles')
        .select(`
          id, user_id, vehicle_id, nickname, notes, user_year, display_order, created_at,
          garage_tire_sets (
            id, garage_vehicle_id, name,
            tire_front_id, tire_rear_id,
            is_default, notes, created_at
          )
        `)
        .eq('user_id', userId)
        .order('display_order', { ascending: true }),
    ]);

    const dbVehicles = vehiclesRes.data ?? [];
    const dbTires    = tiresRes.data    ?? [];
    const { data, error } = garageRes;

    if (!error && data) {
      const enriched = (data as any[]).map(gv => ({
        ...gv,
        vehicle: dbVehicles.find((v: any) => v.id === gv.vehicle_id),
        tire_sets: (gv.garage_tire_sets ?? []).map((ts: any) => ({
          ...ts,
          tire_front: dbTires.find((t: any) => t.id === ts.tire_front_id),
          tire_rear:  dbTires.find((t: any) => t.id === ts.tire_rear_id),
        })),
      })) as GarageVehicle[];

      setGarageVehicles(enriched);

      // Default tyre set selection
      const defaults: Record<string, string> = {};
      enriched.forEach(gv => {
        const defaultSet = gv.tire_sets?.find(ts => ts.is_default) ?? gv.tire_sets?.[0];
        if (defaultSet) defaults[gv.id] = defaultSet.id;
      });
      setSelectedTireSetIds(prev => ({ ...defaults, ...prev }));
    }
    setLoading(false);
  }, [userId]);

useEffect(() => { fetchGarage(); }, [fetchGarage]);

const [settingsVersion, setSettingsVersion] = useState(0);
const { displayPressure, pressureUnit } = useSettings(settingsVersion);

useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    fetchGarage();
    setSettingsVersion(v => v + 1);
  });
  return unsubscribe;
}, [navigation, fetchGarage]);

  // ── Handle nav params (focus card / open dropdown) ────────────────────────
  useEffect(() => {
    const focusIdx  = route?.params?.focusCardIndex;
    const openTyres = route?.params?.openTyreDropdown;

    if (focusIdx !== undefined && garageVehicles.length > focusIdx) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: focusIdx, animated: true });
        setCurrentIndex(focusIdx);
        if (openTyres && garageVehicles[focusIdx]) {
          setOpenDropdownId(garageVehicles[focusIdx].id);
        }
      }, 100);
    }
  }, [route?.params, garageVehicles]);

  // ── Start event ───────────────────────────────────────────────────────────
  function handleStartEvent(gv: GarageVehicle) {
    const vehicle = gv.vehicle;
    if (!vehicle) { Alert.alert('Vehicle data missing'); return; }

    const tireSetId = selectedTireSetIds[gv.id];
    const tireSet   = gv.tire_sets?.find(ts => ts.id === tireSetId) ?? gv.tire_sets?.[0];
    if (!tireSet?.tire_front || !tireSet?.tire_rear) {
      Alert.alert('Please add a tyre set to this car first');
      return;
    }

    // Store selected garage vehicle index for "Change tyres" back-nav
    navigation.navigate('EventSetup', {
      vehicle,
      tireFront:        tireSet.tire_front,
      tireRear:         tireSet.tire_rear,
      tireSetName:      tireSet.name,
      garageCardIndex:  currentIndex,
    });
  }

  function vehicleYearDisplay(v: Vehicle, userYear?: number): string {
    if (userYear) return `${userYear}`;
    if (v.year_end) return `${v.year_start}–${v.year_end}`;
    return `${v.year_start}`;
  }

  // ── Render card ───────────────────────────────────────────────────────────
  function renderCard({ item: gv }: { item: GarageVehicle }) {
    const vehicle       = gv.vehicle;
    const tireSets      = gv.tire_sets ?? [];
    const selectedTsId  = selectedTireSetIds[gv.id];
    const selectedTs    = tireSets.find(ts => ts.id === selectedTsId) ?? tireSets[0];
    const ddOpen        = openDropdownId === gv.id;

    return (
      <View style={styles.cardWrapper}>
        <View style={styles.card}>

          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              {gv.nickname && (
                <Text style={styles.nickname}>{gv.nickname}</Text>
              )}
              <Text style={gv.nickname ? styles.vehicleDetail : styles.nickname}>
                {vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.trim}` : ''}
                {gv.user_year ? ` - ${gv.user_year}` : ''}
              </Text>
              {vehicle && (
                <Text style={styles.vehicleDetail}>
                  {vehicle.chassis_code ?? vehicle.model} · {vehicle.year_start}
                  {vehicle.year_end ? `–${vehicle.year_end}` : ''}
                </Text>
              )}
            </View>
          </View>

          {/* OEM reference */}
          <View style={styles.oemRow}>
            <Text style={styles.oemLabel}>OEM ref</Text>
            <Text style={styles.oemVal}>
              F {vehicle ? displayPressure(vehicle.oem_pressure_front) : '—'} · R {vehicle ? displayPressure(vehicle.oem_pressure_rear) : '—'} {pressureUnit()}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Tyre set dropdown */}
          <Text style={styles.sectionLabel}>Tyre set</Text>
          {tireSets.length === 0 ? (
            <TouchableOpacity
              style={styles.addTyrePrompt}
              onPress={() => navigation.navigate('EditGarageVehicle', { garageVehicle: gv })}
            >
              <Text style={styles.addTyrePromptText}>+ Add tyre set</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.dropdown, ddOpen && styles.dropdownOpen]}
                onPress={() => setOpenDropdownId(ddOpen ? null : gv.id)}
              >
                <Text style={styles.dropdownVal}>
                  {selectedTs
                    ? selectedTs.name
                    : 'Select tyre set'}
                </Text>
                <Text style={styles.dropdownArrow}>{ddOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {ddOpen && (
                <View style={styles.dropdownOptions}>
                  {tireSets.map(ts => (
                    <TouchableOpacity
                      key={ts.id}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedTireSetIds(prev => ({ ...prev, [gv.id]: ts.id }));
                        setOpenDropdownId(null);
                      }}
                    >
                      <Text style={[
                        styles.dropdownOptionText,
                        ts.id === selectedTsId && styles.dropdownOptionSelected,
                      ]}>
                        {ts.name}
                      </Text>
                      {ts.id === selectedTsId && (
                        <Text style={{ color: colors.accent, fontSize: 12 }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Notes */}
          {gv.notes ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Notes</Text>
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{gv.notes}</Text>
              </View>
            </>
          ) : null}

          {/* Actions */}
          <VehicleSilhouette category={vehicle?.silhouette_category} height={200} />

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => handleStartEvent(gv)}
          >
            <Text style={styles.startBtnText}>Start event →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editBtn, { marginTop: spacing.sm, borderColor: colors.accent }]}
            onPress={() => {
              const defaultTireSet = gv.tire_sets?.find(ts => ts.is_default) ?? gv.tire_sets?.[0];
              setActiveTab('history');
              navigation.navigate('HistoryTab', {
                screen: 'History',
                params: {
                  vehicleId: gv.vehicle_id,
                  tireId:    defaultTireSet?.tire_front_id ?? '',
                },
              });
            }}
          >
            <Text style={[styles.editBtnText, { color: colors.accent }]}>View history</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditGarageVehicle', { garageVehicle: gv })}
          >
            <Text style={styles.editBtnText}>Edit car</Text>
          </TouchableOpacity>

        </View>
      </View>
    );
  }

  // ── Add vehicle card (last swipe) ─────────────────────────────────────────
  function renderAddCard() {
    return (
      <View style={styles.cardWrapper}>
        <View style={[styles.card, styles.addCard]}>
          <Text style={styles.addCardTitle}>Add a car</Text>
          <Text style={styles.addCardSub}>
            Search the vehicle catalog to add your next car to the garage
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.startBtnText}>+ Add vehicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const allItems = [...garageVehicles, { id: '__add__' } as any];

  return (
    <SafeAreaView style={globalStyles.screen}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={typography.heading}>Garage</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.gearIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : garageVehicles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Welcome to TrackPressure</Text>
          <Text style={styles.emptySubtitle}>
            Add your first car to get started logging tyre pressures
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.startBtnText}>+ Add your first car</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={allItems}
            keyExtractor={item => item.id}
            extraData={settingsVersion}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={SCREEN_W}
            decelerationRate="fast"
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setCurrentIndex(idx);
            }}
            renderItem={({ item }) =>
              item.id === '__add__' ? renderAddCard() : renderCard({ item })
            }
            getItemLayout={(_, index) => ({
              length: SCREEN_W, offset: SCREEN_W * index, index,
            })}
          />

          {/* Pagination dots */}
          <View style={styles.dotsRow}>
            {allItems.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        </>
      )}

      {/* Add vehicle modal */}
      <AddVehicleModal
        visible={addModalVisible}
        userId={userId}
        onClose={() => setAddModalVisible(false)}
        onAdded={() => { setAddModalVisible(false); fetchGarage(); }}
      />

    </SafeAreaView>
  );
}

// ── Add Vehicle Modal ─────────────────────────────────────────────────────────

function AddVehicleModal({
  visible, userId, onClose, onAdded,
}: {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving]     = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [userYear, setUserYear] = useState('');
  const userYearRef = useRef<TextInput>(null);

  useEffect(() => {
    supabase
      .from('vehicles')
      .select('*')
      .order('make', { ascending: true })
      .then(({ data }) => {
        if (data) setVehicles(data as Vehicle[]);
      });
  }, []);

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase().trim();
    const yearTyped = parseInt(q);
    if (!isNaN(yearTyped)) {
      const inRange = yearTyped >= parseInt(`${v.year_start}`) &&
        yearTyped <= parseInt(`${v.year_end ?? v.year_start}`);
      if (inRange) return true;
    }
    return `${v.year_start} ${v.make} ${v.model} ${v.trim}`
      .toLowerCase()
      .includes(q);
  });

  async function handleSave() {
    if (!selected || !userId) return;

    const parsedYear = parseInt(userYear);
    if (userYear && (!isNaN(parsedYear))) {
      const validStart = parseInt(`${selected.year_start}`);
      const validEnd   = parseInt(`${selected.year_end ?? selected.year_start}`);
      if (parsedYear < validStart || parsedYear > validEnd) {
        Alert.alert(
          'Invalid year',
          `Please enter a year between ${validStart} and ${validEnd} for this vehicle.`,
          [{ text: 'OK', onPress: () => userYearRef.current?.focus() }]
        );
        return;
      }
    }

    setSaving(true);
    const parsedYearFinal = parseInt(userYear);
    const { error } = await supabase
      .from('garage_vehicles')
      .insert({
        user_id:       userId,
        vehicle_id:    selected.id,
        nickname:      nickname.trim() || null,
        user_year:     !isNaN(parsedYearFinal) ? parsedYearFinal : null,
        display_order: 999,
      });

    setSaving(false);
    if (!error) {
      setSearch(''); setSelected(null); setNickname(''); setUserYear('');
      onAdded();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[globalStyles.screen, { padding: spacing.lg }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <Text style={typography.heading}>Add a car</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search make, model, year…"
          placeholderTextColor={colors.textMuted}
        />

        <ScrollView style={{ flex: 1 }}>
          {filtered.map(v => (
            <TouchableOpacity
              key={v.id}
              style={[styles.vehicleOption, selected?.id === v.id && styles.vehicleOptionSelected]}
              onPress={() => setSelected(v)}
            >
              <Text style={[
                styles.vehicleOptionText,
                selected?.id === v.id && { color: colors.accent },
              ]}>
                {v.year_end ? `${v.year_start}–${v.year_end}` : `${v.year_start}`} {v.make} {v.model} {v.trim}
              </Text>
              <Text style={styles.vehicleOptionSub}>
                OEM {v.oem_pressure_front} / {v.oem_pressure_rear} PSI
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selected && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { marginBottom: spacing.sm }]}>
              Nickname (optional)
            </Text>
            <TextInput
              style={styles.searchInput}
              value={nickname}
              onChangeText={setNickname}
              placeholder="e.g. Track GT3"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[typography.caption, { marginBottom: spacing.sm, marginTop: spacing.sm }]}>
              Your year (optional)
            </Text>
            <TextInput
              ref={userYearRef}
              style={styles.searchInput}
              value={userYear}
              onChangeText={setUserYear}
              placeholder={`e.g. ${selected.year_start}-${selected.year_end}`}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={4}
            />
            <TouchableOpacity
              style={[styles.startBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.startBtnText}>
                {saving ? 'Adding…' : `Add ${selected.make} ${selected.model}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  gearIcon: { fontSize: 20, color: colors.textSecondary },
  cardWrapper: {
    width: SCREEN_W,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  nickname: {
    fontSize: 22, fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  vehicleDetail: { ...typography.caption, color: colors.textSecondary },
  oemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  oemLabel: { ...typography.caption, color: colors.textMuted },
  oemVal: { fontSize: 12, color: colors.textSecondary, fontVariant: ['tabular-nums'] as any },
  divider: { height: 0.5, backgroundColor: colors.border, marginVertical: spacing.sm },
  sectionLabel: {
    fontSize: 10, fontWeight: '500', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  dropdown: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dropdownOpen: { borderColor: colors.accent },
  dropdownVal: { fontSize: 13, color: colors.textPrimary, fontWeight: '500', flex: 1 },
  dropdownArrow: { fontSize: 10, color: colors.textMuted },
  dropdownOptions: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.accent,
    overflow: 'hidden', marginBottom: spacing.sm,
  },
  dropdownOption: {
    padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dropdownOptionText: { fontSize: 13, color: colors.textSecondary },
  dropdownOptionSelected: { color: colors.accent, fontWeight: '500' },
  addTyrePrompt: {
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.accent,
    borderStyle: 'dashed', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addTyrePromptText: { fontSize: 13, color: colors.accent },
  notesBox: {
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.sm, padding: spacing.sm,
  },
  notesText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 14,
    alignItems: 'center', marginTop: spacing.md,
  },
  startBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
  editBtn: {
    borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: 10,
    alignItems: 'center', marginTop: spacing.sm,
  },
  editBtnText: { fontSize: 13, color: colors.textSecondary },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent },
  addCardTitle: { fontSize: 20, fontWeight: '500', color: colors.textPrimary },
  addCardSub: { ...typography.caption, textAlign: 'center', color: colors.textMuted, maxWidth: 220 },
  searchInput: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md, fontSize: 14, color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  vehicleOption: {
    padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
    borderRadius: radius.sm,
  },
  vehicleOptionSelected: { backgroundColor: colors.accentSubtle },
  vehicleOptionText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  vehicleOptionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 20, fontWeight: '500',
    color: colors.textPrimary, textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14, color: colors.textMuted,
    textAlign: 'center', lineHeight: 20, maxWidth: 260,
  },
});
