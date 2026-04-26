import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Image,
  StyleSheet, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, radius } from '../lib/theme';

// ── Config — update these two values each release ─────────────────────────────

// Bump this string whenever you want the modal to show again.
// Recommend matching your app version e.g. '1.4', '1.5' etc.
const WHATS_NEW_VERSION = '1.3.1';

// Set to true to include the feature screenshot, false to hide the image slot.
const SHOW_IMAGE = true;

// The image asset — replace whats_new.jpg with any screenshot before building.
// When SHOW_IMAGE is false this line is never evaluated.
const WHATS_NEW_IMAGE = require('../../assets/whats_new.jpg');

// ── Storage key — do not change ───────────────────────────────────────────────
const STORAGE_KEY = 'trackpressure:last_seen_version';

// ── Bullet items — edit freely each release ───────────────────────────────────
const BULLETS: { text: string; icon: 'edit' | 'history' | 'keyboard' | 'chart' }[] = [
  { icon: 'edit',    text: 'Log notes right after each session while details are still fresh' },
  { icon: 'history', text: 'View and edit from session history — always private, never shared' },
];

// ── Icon shapes ───────────────────────────────────────────────────────────────

function EditIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconInner}>
        {/* Pencil shape via nested views */}
        <Text style={styles.iconText}>✎</Text>
      </View>
    </View>
  );
}

function HistoryIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconInner}>
        <Text style={styles.iconText}>≡</Text>
      </View>
    </View>
  );
}

function ChartIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconInner}>
        <Text style={styles.iconText}>↗</Text>
      </View>
    </View>
  );
}

function KeyboardIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconInner}>
        <Text style={styles.iconText}>⌨</Text>
      </View>
    </View>
  );
}

function BulletIcon({ type }: { type: typeof BULLETS[0]['icon'] }) {
  switch (type) {
    case 'edit':     return <EditIcon />;
    case 'history':  return <HistoryIcon />;
    case 'chart':    return <ChartIcon />;
    case 'keyboard': return <KeyboardIcon />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(last => {
      if (last !== WHATS_NEW_VERSION) {
        setVisible(true);
        AsyncStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
      }
    });
  }, []);

  function dismiss() {
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={dismiss}
      >
        {/* Inner touchable prevents overlay dismiss when tapping the card */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.card}>

            {/* Accent bar */}
            <View style={styles.accentBar} />

            {/* Feature image — hidden when SHOW_IMAGE is false */}
            {SHOW_IMAGE && (
              <Image
                source={WHATS_NEW_IMAGE}
                style={styles.image}
                resizeMode="cover"
              />
            )}

            <View style={styles.body}>

              {/* Title */}
              <Text style={styles.title}>Driver notes, everywhere</Text>

              {/* Description */}
              <Text style={styles.desc}>
                Your sessions now have a notes field — add observations while they're fresh and revisit them any time.
              </Text>

              {/* Bullets */}
              <View style={styles.bullets}>
                {BULLETS.map((b, i) => (
                  <View key={i} style={styles.bullet}>
                    <BulletIcon type={b.icon} />
                    <Text style={styles.bulletText}>{b.text}</Text>
                  </View>
                ))}
              </View>

              {/* Dismiss button */}
              <TouchableOpacity style={styles.btn} onPress={dismiss} activeOpacity={0.82}>
                <Text style={styles.btnText}>Go race</Text>
              </TouchableOpacity>

              <Text style={styles.hint}>Won't appear again</Text>

            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_WIDTH = Math.min(Dimensions.get('window').width - 48, 320);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    backgroundColor: colors.accent,
  },
  image: {
    width: '100%',
    height: 148,
  },
  body: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
    lineHeight: 23,
  },
  desc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  bullets: {
    gap: 10,
    marginBottom: spacing.lg,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.bgHighlight,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 12,
    color: colors.accent,
    lineHeight: 14,
  },
  bulletText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    flex: 1,
    paddingTop: 4,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  hint: {
    textAlign: 'center',
    marginTop: 9,
    fontSize: 10,
    color: colors.textMuted,
    opacity: 0.5,
  },
});
