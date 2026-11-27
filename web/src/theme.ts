import type { GlobalThemeOverrides } from 'naive-ui';
import { COLORS } from './lib/tokens';

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: COLORS.ink,
    primaryColorHover: COLORS.inkHover,
    primaryColorPressed: COLORS.inkPressed,
    primaryColorSuppl: COLORS.ink,
    bodyColor: COLORS.canvas,
    cardColor: COLORS.paper,
    textColorBase: COLORS.base,
    borderColor: '#e3d9cc',
    errorColor: '#8c4a3a',
    fontFamily: '"Avenir Next", "PingFang SC", "Noto Sans SC", sans-serif',
  },
  Button: { borderRadiusMedium: '2px' },
  Input: { borderRadius: '2px' },
  Card: { borderRadius: '2px' },
};
