import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, radius } from '../lib/theme';

// ── TabletNumPad ──────────────────────────────────────────────────────────────
// Variant of NumPad designed for tablet use in HotGradientEntryScreen.
// Differences from NumPad:
//   - Replaces '.' key with 'Done' confirm key (mid temps are whole numbers)
//   - Replaces '⌫' with a labelled 'Del' key
//   - Larger hit targets and font sizes for tablet
//   - Done key styled in success green to draw attention
//   - Width calculated from window so it works in any tablet orientation

interface Props {
  onPress:   (key: string) => void;
  onConfirm: () => void;
}

const W = Dimensions.get('window').width;

// 3×4 grid: 1–9, Del, 0, Done
const KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','Done'];

export function TabletNumPad({ onPress, onConfirm }: Props) {
  function handlePress(key: string) {
    if (key === 'Done') { onConfirm(); return; }
    onPress(key);
  }

  return (
    <View style={styles.grid}>
      {KEYS.map(key => {
        const isDone = key === 'Done';
        const isDel  = key === '⌫';
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.key,
              isDone && styles.keyDone,
              isDel  && styles.keyDel,
            ]}
            onPress={() => handlePress(key)}
            activeOpacity={0.6}
          >
            <Text style={[
              styles.keyText,
              isDone && styles.keyTextDone,
              isDel  && styles.keyTextDel,
            ]}>
              {key}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const KEY_W = W / 3;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  key: {
    width: KEY_W,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: colors.border,
  },
  keyDel: {
    backgroundColor: colors.bgHighlight,
  },
  keyDone: {
    backgroundColor: colors.successSubtle,
    borderColor: colors.success,
    borderWidth: 0.5,
  },
  keyText: {
    fontSize: 26,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  keyTextDel: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  keyTextDone: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
    fontFamily: undefined,
    letterSpacing: 0.3,
  },
});
