import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, radius } from '../lib/theme';

interface Props {
  onPress: (key: string) => void;
}

const KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

export function NumPad({ onPress }: Props) {
  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <TouchableOpacity
          key={key}
          style={[styles.key, key === '⌫' && styles.keyDel]}
          onPress={() => onPress(key)}
          activeOpacity={0.6}
        >
          <Text style={[styles.keyText, key === '⌫' && styles.keyDelText]}>{key}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  key: {
    width: Dimensions.get('window').width / 3,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: colors.border,
  },
  keyDel: {
    backgroundColor: colors.bgHighlight,
  },
  keyText: {
    fontSize: 24,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  keyDelText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
});
