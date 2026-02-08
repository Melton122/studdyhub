// utils/responsive.js
import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Based on iPhone 12 Pro scale
const scale = SCREEN_WIDTH / 390;

export function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
}

export const isWeb = Platform.OS === 'web';
export const isMobile = Platform.OS !== 'web';

// Responsive layout
export const layout = {
  small: SCREEN_WIDTH < 375,
  medium: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 768,
  large: SCREEN_WIDTH >= 768,
  tablet: SCREEN_WIDTH >= 768,
  phone: SCREEN_WIDTH < 768,
};

// Grid system
export const grid = {
  container: {
    width: '100%',
    maxWidth: layout.large ? 1200 : '100%',
    marginHorizontal: 'auto',
  },
  row: {
    flexDirection: layout.phone ? 'column' : 'row',
    flexWrap: 'wrap',
  },
  col: (size) => ({
    width: layout.phone ? '100%' : `${(size / 12) * 100}%`,
    paddingHorizontal: 8,
  }),
};