import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  PanResponder, Dimensions, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors, typography, spacing, radius } from '../lib/theme';

type Props = NativeStackScreenProps<any, 'iOSImageCrop'>;

const SCREEN_W  = Dimensions.get('window').width;
// Frame fills screen width with small margin, locked 2:1
const FRAME_W   = SCREEN_W - 32;
const FRAME_H   = Math.round(FRAME_W / 2);
// Stage height — gives room above and below frame
const STAGE_H   = FRAME_H + 160;
const FRAME_X   = 16;  // left offset of frame
const FRAME_Y   = 80;  // top offset of frame within stage

export default function ImageCropScreen({ navigation, route }: Props) {
  const { imageUri, imageWidth, imageHeight } = route.params as {
    imageUri: string;
    imageWidth: number;
    imageHeight: number;
  };

  // Scale image to fill the stage at minimum, maintaining aspect ratio
  const imgRatio  = imageWidth / imageHeight;
  const initScale = Math.max(SCREEN_W / imageWidth, STAGE_H / imageHeight);
  const initW     = Math.round(imageWidth  * initScale);
  const initH     = Math.round(imageHeight * initScale);

  // Pan offset — how far the image is translated relative to stage
  // Clamped so image always covers the crop frame
  const [offset, setOffset] = useState({ x: Math.round((SCREEN_W - initW) / 2), y: Math.round((STAGE_H - initH) / 2) });
  const lastOffset = useRef(offset);
  const [processing, setProcessing] = useState(false);

  function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  }

  function clampedOffset(x: number, y: number) {
    // Image must cover the crop frame — right edge >= frame right, left edge <= frame left, etc.
    const maxX = FRAME_X;                          // image left can't go past frame left
    const minX = FRAME_X + FRAME_W - initW;       // image right can't go before frame right
    const maxY = FRAME_Y;
    const minY = FRAME_Y + FRAME_H - initH;
    return {
      x: clamp(x, minX, maxX),
      y: clamp(y, minY, maxY),
    };
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, gs) => {
        const next = clampedOffset(
          lastOffset.current.x + gs.dx,
          lastOffset.current.y + gs.dy,
        );
        setOffset(next);
      },
      onPanResponderRelease: (_, gs) => {
        lastOffset.current = clampedOffset(
          lastOffset.current.x + gs.dx,
          lastOffset.current.y + gs.dy,
        );
      },
    })
  ).current;

  const handleConfirm = useCallback(async () => {
    setProcessing(true);
    try {
      // Convert frame position back to source image coordinates
      const scale    = initScale;
      const originX  = Math.round((FRAME_X - offset.x) / scale);
      const originY  = Math.round((FRAME_Y - offset.y) / scale);
      const cropW    = Math.round(FRAME_W / scale);
      const cropH    = Math.round(FRAME_H / scale);

      // Clamp to image bounds
      const safeX = Math.max(0, Math.min(originX, imageWidth  - cropW));
      const safeY = Math.max(0, Math.min(originY, imageHeight - cropH));

      const ctx = ImageManipulator.manipulate(imageUri);
      ctx.crop({ originX: safeX, originY: safeY, width: cropW, height: cropH });
      ctx.resize({ width: 1024, height: 512 });
      const rendered    = await ctx.renderAsync();
      const manipulated = await rendered.saveAsync({ compress: 1, format: SaveFormat.PNG });

      // Return cropped URI to EditSilhouetteScreen via navigation
      // Call the callback passed from EditSilhouetteScreen then go back
      const onCropped = route.params?.onCropped as ((uri: string) => void) | undefined;
      if (onCropped) onCropped(manipulated.uri);
      navigation.goBack();
    } catch {
      setProcessing(false);
    }
  }, [offset, imageUri, imageWidth, imageHeight, initScale]);

  return (
    <SafeAreaView style={styles.screen}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[typography.caption, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={typography.subhead}>Crop photo</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Crop stage */}
      <View style={styles.stage} {...panResponder.panHandlers}>

        {/* Photo — positioned by pan offset */}
        <Image
          source={{ uri: imageUri }}
          style={[styles.photo, { width: initW, height: initH, left: offset.x, top: offset.y }]}
          resizeMode="cover"
        />

        {/* Dark overlays masking outside crop frame */}
        <View style={[styles.overlay, { top: 0, left: 0, right: 0, height: FRAME_Y }]} />
        <View style={[styles.overlay, { top: FRAME_Y + FRAME_H, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.overlay, { top: FRAME_Y, left: 0, width: FRAME_X, height: FRAME_H }]} />
        <View style={[styles.overlay, { top: FRAME_Y, right: 0, left: FRAME_X + FRAME_W, height: FRAME_H }]} />

        {/* Crop frame border */}
        <View style={styles.frame} pointerEvents="none">
          {/* Corner handles */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          {/* Rule of thirds grid */}
          <View style={[styles.gridH, { top: '33%' }]} />
          <View style={[styles.gridH, { top: '66%' }]} />
          <View style={[styles.gridV, { left: '33%' }]} />
          <View style={[styles.gridV, { left: '66%' }]} />
        </View>

      </View>

      {/* Hint */}
      <Text style={styles.hint}>Drag to reposition · locked 2:1</Text>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.confirmBtn, processing && { opacity: 0.6 }]}
          onPress={handleConfirm}
          disabled={processing}
        >
          {processing
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.confirmBtnText}>Use this crop</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.retakeBtn}
          onPress={() => navigation.goBack()}
          disabled={processing}
        >
          <Text style={styles.retakeBtnText}>Choose different photo</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#000' },
  topBar:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: '#1E1E1E',
  },
  stage: {
    width: SCREEN_W, height: STAGE_H,
    overflow: 'hidden', backgroundColor: '#000',
  },
  photo: { position: 'absolute' },
  overlay: {
    position: 'absolute', backgroundColor: 'rgba(0,0,0,0.62)',
  },
  frame: {
    position: 'absolute',
    top: FRAME_Y, left: FRAME_X,
    width: FRAME_W, height: FRAME_H,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  corner: {
    position: 'absolute', width: 18, height: 18,
    borderColor: '#FFFFFF', borderStyle: 'solid',
  },
  cornerTL: { top: -1,  left: -1,  borderTopWidth: 3, borderLeftWidth: 3, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -1,  right: -1, borderTopWidth: 3, borderRightWidth: 3, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -1, left: -1,  borderBottomWidth: 3, borderLeftWidth: 3, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderTopWidth: 0, borderLeftWidth: 0 },
  gridH: { position: 'absolute', left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.25)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.25)' },
  hint: {
    fontSize: 12, color: '#555', textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  actions: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
    paddingTop: spacing.sm, gap: spacing.sm,
  },
  confirmBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
  retakeBtn: {
    borderWidth: 0.5, borderColor: '#2A2A2A',
    borderRadius: radius.lg, paddingVertical: 12, alignItems: 'center',
  },
  retakeBtnText: { fontSize: 13, color: '#555' },
});
