import { createTheme } from '@mui/material/styles';

// Midnight Obsidian & Electric Signal Blue design system (matching reference UI).
export const tokens = {
  canvas: '#0B0E14',          // Deepest midnight obsidian
  sidebar: '#0E121A',         // Distinct dark navy rail
  surface1: '#141A26',        // Primary container / row surface
  surface2: '#1C2436',        // Elevated card / hover state
  surfaceElevated: '#242F45', // Dialogs, floating modals, context menus
  ink: '#F5F7FA',             // Crisp white text
  inkSecondary: '#9AA5B8',    // Slate blue-gray secondary text
  inkMuted: '#627086',        // Muted captions and metadata
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineSoft: 'rgba(255, 255, 255, 0.05)',
  accentBlue: '#1E86FF',      // Electric cloud blue
  accentBlueHover: '#3896FF',
  folderGold: '#FFB020',      // Reference golden folder color
  focusRing: 'rgba(30, 134, 255, 0.25)',
  selectionBg: 'rgba(30, 134, 255, 0.12)',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
};

export const gradients = {
  blue: 'linear-gradient(135deg, #1E86FF 0%, #0062D6 100%)',
  folder: 'linear-gradient(135deg, #FFC043 0%, #FF9800 100%)',
  uploadCard: 'linear-gradient(135deg, #1E86FF 0%, #1565C0 100%)',
};

const display = "'Mona Sans Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const body = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const bodyFeatures = "'cv01' 1, 'cv05' 1, 'cv09' 1, 'cv11' 1, 'ss03' 1, 'ss07' 1, 'dlig' 1";

const lightEdge = (alpha = 0.08, drop = '0 12px 32px rgba(0,0,0,0.5)') =>
  `inset 0 1px 0 rgba(255,255,255,${alpha}), ${drop}`;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: tokens.accentBlue },
    background: { default: tokens.canvas, paper: tokens.surface1 },
    divider: tokens.hairline,
    text: {
      primary: tokens.ink,
      secondary: tokens.inkSecondary,
      disabled: tokens.inkMuted,
    },
    success: { main: tokens.success },
    error: { main: tokens.danger },
    warning: { main: tokens.warning },
    info: { main: tokens.accentBlue },
    canvas: tokens.canvas,
    sidebar: tokens.sidebar,
    surface1: tokens.surface1,
    surface2: tokens.surface2,
    surfaceElevated: tokens.surfaceElevated,
    ink: tokens.ink,
    inkSecondary: tokens.inkSecondary,
    inkMuted: tokens.inkMuted,
    hairline: tokens.hairline,
    hairlineSoft: tokens.hairlineSoft,
    focusRing: tokens.focusRing,
    accentBlue: tokens.accentBlue,
    selectionBg: tokens.selectionBg,
    folderGold: tokens.folderGold,
    surface3: tokens.surface2,
    signal: tokens.accentBlue,
    signalSoft: tokens.focusRing,
    dangerSoft: 'rgba(255,69,58,0.12)',
    successSoft: 'rgba(48,209,88,0.12)',
    steel: tokens.inkSecondary,
  },
  shape: { borderRadius: 14 },
  spacing: 6,
  typography: {
    fontFamily: body,
    h1: {
      fontFamily: display,
      fontWeight: 600,
      fontSize: 40,
      lineHeight: 1.15,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontFamily: display,
      fontWeight: 600,
      fontSize: 26,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 600,
      fontSize: 20,
      lineHeight: 1.25,
      letterSpacing: '-0.015em',
      fontFeatureSettings: bodyFeatures,
    },
    h4: {
      fontWeight: 600,
      fontSize: 18,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
      fontFeatureSettings: bodyFeatures,
    },
    h5: {
      fontWeight: 600,
      fontSize: 16,
      lineHeight: 1.35,
      letterSpacing: '-0.01em',
      fontFeatureSettings: bodyFeatures,
    },
    h6: {
      fontWeight: 600,
      fontSize: 14.5,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
      fontFeatureSettings: bodyFeatures,
    },
    body1: {
      fontWeight: 400,
      fontSize: 14,
      lineHeight: 1.5,
      letterSpacing: '-0.005em',
      fontFeatureSettings: bodyFeatures,
    },
    body2: {
      fontWeight: 400,
      fontSize: 13,
      lineHeight: 1.45,
      letterSpacing: '-0.005em',
      fontFeatureSettings: bodyFeatures,
    },
    caption: {
      fontWeight: 500,
      fontSize: 12,
      lineHeight: 1.3,
      letterSpacing: '0.005em',
      fontFeatureSettings: bodyFeatures,
    },
    overline: {
      fontWeight: 600,
      fontSize: 11,
      lineHeight: 1.2,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      fontFeatureSettings: bodyFeatures,
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: 14.5,
      lineHeight: 1.35,
      letterSpacing: '-0.01em',
      fontFeatureSettings: bodyFeatures,
    },
    subtitle2: {
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: '-0.005em',
      fontFeatureSettings: bodyFeatures,
    },
    button: {
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1.0,
      letterSpacing: '-0.005em',
      textTransform: 'none',
      fontFeatureSettings: bodyFeatures,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.canvas,
          color: tokens.ink,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '::selection': {
          backgroundColor: 'rgba(30,134,255,0.35)',
        },
        'button:focus-visible, [role="button"]:focus-visible, a:focus-visible': {
          outline: `2px solid ${tokens.accentBlue}`,
          outlineOffset: 2,
        },
        'main, [tabindex="-1"], input:focus-visible, textarea:focus-visible, div:focus': {
          outline: 'none !important',
          boxShadow: 'none !important',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '8px 16px',
          fontWeight: 600,
          transition: 'all 140ms ease-out',
          '&:active': { transform: 'scale(0.98)' },
        },
        sizeSmall: { padding: '5px 12px', fontSize: 12.5 },
        contained: {
          backgroundColor: tokens.ink,
          color: '#0B0E14',
          fontWeight: 600,
          '&:hover': { backgroundColor: '#FFFFFF', boxShadow: '0 2px 10px rgba(255,255,255,0.2)' },
          '&:disabled': {
            backgroundColor: 'rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.35)',
          },
        },
        containedPrimary: {
          backgroundColor: tokens.accentBlue,
          color: '#FFFFFF',
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(30,134,255,0.35)',
          '&:hover': {
            backgroundColor: tokens.accentBlueHover,
            boxShadow: '0 6px 20px rgba(30,134,255,0.45)',
          },
          '&:disabled': {
            backgroundColor: 'rgba(30,134,255,0.25)',
            color: 'rgba(255,255,255,0.35)',
          },
        },
        containedError: {
          backgroundColor: tokens.danger,
          color: '#FFFFFF',
          fontWeight: 600,
          '&:hover': { backgroundColor: '#FF5C52', boxShadow: '0 4px 14px rgba(255,69,58,0.35)' },
        },
        outlined: {
          backgroundColor: 'rgba(255,255,255,0.03)',
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderColor: 'rgba(255,255,255,0.18)',
          },
          '&:disabled': { color: 'rgba(255,255,255,0.3)' },
        },
        outlinedPrimary: {
          backgroundColor: 'rgba(30,134,255,0.08)',
          color: tokens.accentBlue,
          border: '1px solid rgba(30,134,255,0.28)',
          '&:hover': {
            backgroundColor: 'rgba(30,134,255,0.16)',
            borderColor: tokens.accentBlue,
          },
        },
        outlinedError: {
          color: tokens.danger,
          borderColor: 'rgba(255,69,58,0.3)',
          '&:hover': {
            backgroundColor: 'rgba(255,69,58,0.1)',
            borderColor: tokens.danger,
          },
        },
        text: {
          color: tokens.inkSecondary,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)', color: tokens.ink },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          color: tokens.inkSecondary,
          transition: 'all 120ms ease-out',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.07)', color: tokens.ink },
          '&:active': { transform: 'scale(0.94)' },
          '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)' },
        },
        sizeSmall: { padding: 6 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          backgroundImage: 'none',
          borderRadius: 16,
        },
        outlined: {
          border: `1px solid ${tokens.hairlineSoft}`,
          boxShadow: lightEdge(0.04),
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surfaceElevated,
          backgroundImage: 'none',
          borderRadius: 18,
          border: `1px solid ${tokens.hairline}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { padding: '20px 24px 12px', fontWeight: 600, fontSize: 18, letterSpacing: '-0.015em' },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '12px 24px' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '16px 24px 20px', borderTop: `1px solid ${tokens.hairlineSoft}` } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          borderRadius: 10,
          color: tokens.ink,
          fontSize: 13.5,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.hairlineSoft,
            transition: 'border-color 140ms ease, box-shadow 140ms ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.18)',
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px ${tokens.focusRing}`,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.accentBlue,
          },
        },
        input: { padding: '9px 13px' },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: tokens.inkMuted,
          '&.Mui-checked': { color: tokens.accentBlue },
          '&.MuiCheckbox-indeterminate': { color: tokens.accentBlue },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 100, height: 6, overflow: 'hidden' },
        bar: {
          background: 'linear-gradient(90deg, #1E86FF 0%, #00C6FF 100%)',
          borderRadius: 100,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surfaceElevated,
          backgroundImage: 'none',
          borderRadius: 14,
          border: `1px solid ${tokens.hairline}`,
          boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 13,
          color: tokens.ink,
          borderRadius: 8,
          margin: '2px 6px',
          padding: '7px 12px',
          '&.Mui-selected': { backgroundColor: 'rgba(30,134,255,0.16)' },
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: tokens.hairlineSoft,
          color: tokens.ink,
          fontSize: 13,
          padding: '11px 16px',
        },
        head: {
          color: tokens.inkMuted,
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          borderBottom: `1px solid ${tokens.hairlineSoft}`,
          backgroundColor: 'transparent',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.surfaceElevated,
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          borderRadius: 8,
          fontSize: 11.5,
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        },
      },
    },
  },
});

export default theme;
