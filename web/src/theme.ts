import type { GlobalThemeOverrides } from 'naive-ui';

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3d6b58',
    primaryColorHover: '#4f7d69',
    primaryColorPressed: '#315746',
    primaryColorSuppl: '#3d6b58',
    bodyColor: '#f3f0e8',
    cardColor: '#fffcf7',
    textColorBase: '#24302c',
    borderColor: '#e3d9cc',
    errorColor: '#8c4a3a',
    fontFamily: '"Avenir Next", "PingFang SC", "Noto Sans SC", sans-serif',
  },
  Button: { borderRadiusMedium: '2px' },
  Input: { borderRadius: '2px' },
  Card: { borderRadius: '2px' },
};
