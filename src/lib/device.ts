// src/lib/device.ts
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
export const isTablet = Math.min(width, height) >= 768;