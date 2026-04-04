import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { useEvent } from '../hooks/useEventContext';
import { supabase } from '../lib/supabase';
import {
  UserSettings, DEFAULT_SETTINGS,
  PressureUnit, TemperatureUnit, DistanceUnit,
} from '../types';

const SETTINGS_KEY = 'trackpressure:user_settings';

const { width, height } = Dimensions.get('window');
//console.log('Window dimensions:', width, height);
//console.log('Screen dimensions:', Dimensions.get('screen').width, Dimensions.get('screen').height);
const isTablet = Math.min(width, height) >= 720;
//console.log('isTablet:', isTablet);

type Props = { navigation: NativeStackNavigationProp<any> };

export default function SettingsScreen({ navigation }: Props) {
  const { setActiveTab, clearOpenSession, setActiveEvent } = useEvent();

  const [settings, setSettings]         = useState<UserSettings>(DEFAULT_SETTINGS);
  const [username, setUsername]          = useState('');
  const [email, setEmail]                = useState('');
  const [memberSince, setMemberSince]    = useState('');
  const [editingName, setEditingName]    = useState(false);
  const [newName, setNewName]            = useState('');
  const [savingName, setSavingName]      = useState(false);
  const [kelvinModal, setKelvinModal]    = useState(false);

  // ── Load settings + profile ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      // Load user settings from AsyncStorage
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        try { setSettings(JSON.parse(raw)); } catch {}
      }

      // Load profile from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? '');
        const created = new Date(user.created_at);
        setMemberSince(created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (profile?.username) setUsername(profile.username);
      }
    }
    load();
  }, []);

  // ── Save settings ─────────────────────────────────────────────────────────
  async function updateSetting<K extends keyof UserSettings>(
    key: K, value: UserSettings[K]
  ) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  }

  // ── Save display name ─────────────────────────────────────────────────────
  async function handleSaveName() {
    if (!newName.trim()) return;
    setSavingName(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_profiles')
        .update({ username: newName.trim() })
        .eq('id', user.id);
      setUsername(newName.trim());
    }
    setSavingName(false);
    setEditingName(false);
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await clearOpenSession();
            setActiveEvent(null);
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  // ── Unit selector helper ──────────────────────────────────────────────────
  function UnitSelector<T extends string>({
    label, options, value, onChange,
  }: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
  }) {
    return (
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{label}</Text>
        <View style={styles.segmentRow}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segment, value === opt.value && styles.segmentActive]}
              onPress={() => onChange(opt.value)}
            >
              <Text style={[
                styles.segmentText,
                value === opt.value && styles.segmentTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ── Toggle helper ─────────────────────────────────────────────────────────
  function ToggleRow({
    label, value, onChange,
  }: {
    label: string; value: boolean; onChange: (v: boolean) => void | Promise<void>;
  }) {
    return (
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>{label}</Text>
        <TouchableOpacity
          style={[styles.toggle, value && styles.toggleOn]}
          onPress={() => onChange(!value)}
        >
          <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={globalStyles.screen}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[typography.caption, { color: colors.accent }]}>← Garage</Text>
        </TouchableOpacity>
        <Text style={typography.subhead}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* Account */}
        <Text style={styles.sectionHead}>Account</Text>
        <View style={styles.group}>

          {/* Display name */}
          <View style={[styles.settingRow, { alignItems: 'flex-start' }]}>
            <Text style={styles.settingLabel}>Display name</Text>
            {editingName ? (
              <View style={{ flex: 1, gap: spacing.sm }}>
                <TextInput
                  style={styles.nameInput}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveName} disabled={savingName}>
                    <Text style={[typography.caption, { color: colors.accent, fontWeight: '500' }]}>
                      {savingName ? 'Saving…' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => { setNewName(username); setEditingName(true); }}
              >
                <Text style={[styles.settingValue, { color: colors.accent }]}>
                  {username || 'Set name'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.groupDivider} />

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValueMuted}>{email}</Text>
          </View>

          <View style={styles.groupDivider} />

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Member since</Text>
            <Text style={styles.settingValueMuted}>{memberSince}</Text>
          </View>
        </View>

        {/* Units */}
        <Text style={styles.sectionHead}>Units</Text>
        <View style={styles.group}>
          <UnitSelector
            label="Pressure"
            value={settings.pressure_unit}
            options={[
              { value: 'psi', label: 'PSI' },
              { value: 'bar', label: 'bar' },
              { value: 'kpa', label: 'kPa' },
            ]}
            onChange={v => updateSetting('pressure_unit', v as PressureUnit)}
          />
          <View style={styles.groupDivider} />
          <UnitSelector
            label="Temperature"
            value={settings.temperature_unit}
            options={[
              { value: 'f', label: '°F' },
              { value: 'c', label: '°C' },
              { value: 'k', label: 'K' },
            ]}
            onChange={v => {
              if (v === 'k') {
                setKelvinModal(true);
                return;
              }
              updateSetting('temperature_unit', v as TemperatureUnit);
            }}
          />
          <View style={styles.groupDivider} />
          <UnitSelector
            label="Distance"
            value={settings.distance_unit}
            options={[
              { value: 'mi', label: 'mi' },
              { value: 'km', label: 'km' },
            ]}
            onChange={v => updateSetting('distance_unit', v as DistanceUnit)}
          />
        </View>

        {/* Data entry */}
        <Text style={styles.sectionHead}>Data entry</Text>
        <View style={styles.group}>
          <ToggleRow
            label="Hot pressures visible by default"
            value={settings.hot_pressures_visible}
            onChange={v => updateSetting('hot_pressures_visible', v)}
          />
          <View style={styles.groupDivider} />
          <ToggleRow
            label="Log cold pressures per corner"
            value={settings.four_corner_cold}
            onChange={v => updateSetting('four_corner_cold', v)}
          />
          <View style={styles.groupDivider} />
          <ToggleRow
            label="Contribute to community data"
            value={settings.community_contributions}
            onChange={v => updateSetting('community_contributions', v)}
          />
        </View>

        {/* Pyrometer */}
        <Text style={styles.sectionHead}>Pyrometer</Text>
        <View style={styles.group}>
          <ToggleRow
            label="Log tire temperatures"
            value={settings.pyrometer_enabled}
            onChange={async v => {
              const updated = {
                ...settings,
                pyrometer_enabled:  v,
                pyrometer_gradient: v ? settings.pyrometer_gradient : false,
              };
              setSettings(updated);
              await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
            }}
          />
          {settings.pyrometer_enabled && (
            <>
              <View style={styles.groupDivider} />
              <View style={styles.subToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>
                    Tire gradient recording
                  </Text>
                  {!isTablet && !settings.pyrometer_gradient && (
                    <Text style={styles.subToggleNote}>Recommended for tablet</Text>
                  )}
                  {!isTablet && settings.pyrometer_gradient && (
                    <Text style={[styles.subToggleNote, { color: colors.warning }]}>
                      Enabled on phone — screen space limited
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.toggle, settings.pyrometer_gradient && styles.toggleOn]}
                  onPress={() => {
                    if (!isTablet && !settings.pyrometer_gradient) {
                      Alert.alert(
                        'Not recommended on phone',
                        'Tire gradient recording is designed for tablets. The screen layout will be cramped on a phone and data entry will be harder trackside. Enable anyway?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Enable anyway',
                            onPress: () => updateSetting('pyrometer_gradient', true),
                          },
                        ]
                      );
                    } else {
                      updateSetting('pyrometer_gradient', !settings.pyrometer_gradient);
                    }
                  }}
                >
                  <View style={[styles.toggleThumb, settings.pyrometer_gradient && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
        {settings.pyrometer_enabled && (
          <Text style={styles.sectionNote}>
            {settings.pyrometer_gradient && isTablet
              ? 'Gradient recording captures inner, mid and outer temps per corner on a single screen. Tablet required.'
              : 'When enabled, tire temperature entry replaces the standard hot pressure screen with a corner-by-corner flow capturing both pressure and temperature together.'}
          </Text>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Kelvin easter egg modal */}
      <Modal
        visible={kelvinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setKelvinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Are you a scientist?</Text>
            <Text style={styles.modalBody}>Sorry, no.</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => {
                setKelvinModal(false);
                updateSetting('temperature_unit', 'c');
              }}
            >
              <Text style={styles.modalBtnText}>Fine, use °C</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  container: { padding: spacing.lg, paddingBottom: 40 },
  sectionHead: {
    fontSize: 11, fontWeight: '500', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  group: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 0.5, borderColor: colors.border,
    overflow: 'hidden',
  },
  groupDivider: { height: 0.5, backgroundColor: colors.border, marginLeft: spacing.lg },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  settingLabel: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  settingValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  settingValueMuted: { fontSize: 13, color: colors.textMuted },
  nameInput: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.accent,
    padding: spacing.sm, fontSize: 14, color: colors.textPrimary,
  },
  segmentRow: {
    flexDirection: 'row', gap: 4,
  },
  segment: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.accentSubtle },
  segmentText: { fontSize: 12, color: colors.textMuted },
  segmentTextActive: { color: colors.accent, fontWeight: '500' },
  toggle: {
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: colors.bgHighlight,
    borderWidth: 0.5, borderColor: colors.border,
    justifyContent: 'center', padding: 2,
  },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleThumb: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.textMuted,
  },
  toggleThumbOn: {
    backgroundColor: '#000',
    alignSelf: 'flex-end',
  },
  sectionNote: {
    fontSize: 12, color: colors.textMuted, lineHeight: 18,
    marginTop: spacing.sm, paddingHorizontal: spacing.sm,
  },
  subToggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    paddingLeft: spacing.xl + spacing.sm,
  },
  subToggleRowDisabled: { opacity: 0.5 },
  subToggleNote: {
    fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 2,
  },
  signOutBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.dangerSubtle,
    borderRadius: radius.lg,
    borderWidth: 0.5, borderColor: colors.danger,
    paddingVertical: 14, alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '500', color: colors.danger },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl, padding: spacing.xl,
    borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center', width: '100%', maxWidth: 300,
  },
  modalTitle: { fontSize: 18, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.sm },
  modalBody: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.xl },
  modalBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 12, paddingHorizontal: spacing.xl, alignItems: 'center',
  },
  modalBtnText: { fontSize: 14, fontWeight: '600', color: '#000' },
});
