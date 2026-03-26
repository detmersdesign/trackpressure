import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// ── Silhouette PNG assets ─────────────────────────────────────────────────────
// All PNGs: white silhouette on transparent background, 800×200px recommended
// Place files in: assets/silhouettes/
// As you source artwork for each category, replace the generic placeholder

const SILHOUETTE_IMAGES: Record<string, any> = {
  sports_racer:            require('../../assets/silhouettes/sports_racer.png'),
  formula:                 require('../../assets/silhouettes/formula.png'),
  modern_coupe:            require('../../assets/silhouettes/generic.png'),
  roadster:                require('../../assets/silhouettes/generic.png'),
  muscle:                  require('../../assets/silhouettes/generic.png'),
  vintage_british:         require('../../assets/silhouettes/generic.png'),
  vintage_european:        require('../../assets/silhouettes/-side-profile-silhouette-of-a-1970s-porsche-911--w.png'),
  vintage_german_japanese: require('../../assets/silhouettes/-side-profile-silhouette-of-a-datsun-240z--white-o.png'),
  generic:                 require('../../assets/silhouettes/generic.png'),
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  category?: string;
  height?: number;
}

export function VehicleSilhouette({ category, height = 90 }: Props) {
  const source = SILHOUETTE_IMAGES[category ?? 'generic']
    ?? SILHOUETTE_IMAGES.generic;

  return (
    <View style={[styles.banner, { height }]}>
      <Image
        source={source}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: '#0D0D0D',
    borderTopWidth: 0.5,
    borderTopColor: '#2E2E2E',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
