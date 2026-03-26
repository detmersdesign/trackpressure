import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { ContextPill } from '../components/ContextPill';
import { useEvent } from '../hooks/useEventContext';

type Props = { navigation: NativeStackNavigationProp<any> };

function minutesAgo(isoString: string): string {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ago`;
}

export default function HomeScreen({ navigation }: Props) {
  const { openSession, clearOpenSession, activeEvent, setActiveTab } = useEvent();

  useEffect(() => {
      if (!openSession) {
        if (activeEvent) {
          navigation.replace('QuickLog', { mode: 'cold' });
        } else {
          setActiveTab('garage');
          navigation.navigate('GarageTab');
        }
      }
    }, [openSession, activeEvent]);

  async function handleDiscard() {
    await clearOpenSession();
  }

  if (!openSession) return null;

  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={typography.heading}>TrackPressure</Text>
          {activeEvent && (
            <View style={styles.pillRow}>
              <ContextPill label={activeEvent.track_config?.name ?? activeEvent.track.name} auto />
              <ContextPill label={activeEvent.tire_front.compound} auto={false} />
            </View>
          )}
        </View>

        {/* Open session banner */}
        {openSession ? (
          <View style={styles.banner}>
            <View style={styles.bannerHead}>
              <Text style={styles.bannerTitle}>Session awaiting hot data</Text>
              <Text style={styles.bannerTime}>{minutesAgo(openSession.saved_at)}</Text>
            </View>

            <Text style={styles.bannerSub}>
              {openSession.event.vehicle.make} {openSession.event.vehicle.model}
              {' · '}{openSession.event.tire_front.compound}
              {' · '}{openSession.event.track_config?.name ?? openSession.event.track.name}
            </Text>

            {/* Cold values and predictions */}
            <View style={styles.bannerDataRow}>
              <View style={styles.bannerDataChip}>
                <Text style={styles.bannerDataLabel}>Cold set</Text>
                <Text style={styles.bannerDataVal}>
                  F {openSession.cold_front_psi.toFixed(1)} · R {openSession.cold_rear_psi.toFixed(1)}
                </Text>
              </View>
              <View style={styles.bannerDataChip}>
                <Text style={styles.bannerDataLabel}>Predicted hot</Text>
                <Text style={[styles.bannerDataVal, { color: colors.warning }]}>
                  F {openSession.predicted_hot_fl.toFixed(1)} · R {openSession.predicted_hot_rl.toFixed(1)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={() => navigation.navigate('QuickLog', { mode: 'hot' })}
            >
              <Text style={styles.resumeBtnText}>Enter hot pressures →</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Main CTA */}
        <View style={styles.actions}>
          {openSession ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => navigation.navigate('EventSetup')}
              >
                <Text style={styles.actionBtnSecondaryText}>New session</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDestructive]}
                onPress={handleDiscard}
              >
                <Text style={styles.actionBtnDestructiveText}>Discard open session</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => navigation.navigate('EventSetup')}
            >
              <Text style={styles.actionBtnPrimaryText}>
                {activeEvent ? 'Log a session' : 'Set up event'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  pillRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginTop: spacing.sm,
  },

  // Open session banner
  banner: {
    backgroundColor: colors.warningSubtle,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.warning,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  bannerHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.warning,
  },
  bannerTime: {
    fontSize: 12,
    color: colors.warning,
    opacity: 0.8,
  },
  bannerSub: {
    fontSize: 12,
    color: colors.warning,
    opacity: 0.85,
    marginBottom: spacing.md,
  },
  bannerDataRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerDataChip: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  bannerDataLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  bannerDataVal: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  resumeBtn: {
    backgroundColor: colors.warning,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resumeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },

  // Action buttons
  actions: {
    gap: spacing.sm,
  },
  actionBtn: {
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: colors.accent,
  },
  actionBtnSecondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  actionBtnDestructive: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.danger,
  },
  actionBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  actionBtnSecondaryText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  actionBtnDestructiveText: {
    fontSize: 15,
    color: colors.danger,
  },
});
