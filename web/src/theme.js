import { createTheme } from '@mui/material/styles';

// Tier-1 First-Party Cloud Storage Design Tokens (Linear/Apple/Framer grade).
export const tokens = {
  canvas: '#0A0B0D',         // Deep obsidian background
  sidebar: '#0F1013',        // Distinct navigation rail surface
  surface1: '#15171C',       // Primary container / row surface
  surface2: '#1D2027',       // Elevated card / hover state
  surfaceElevated: '#262A34',// Dialogs, popovers, menus
  ink: '#F5F6F8',            // Pure white primary text
  inkSecondary: '#9DA3AE',   // Crisp secondary text
  inkMuted: '#686E7B',       // Muted captions and metadata
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineSoft: 'rgba(255, 255, 255, 0.04)',
  accentBlue: '#0084FF',     // Tier-1 signal blue for focus, active, selection
  accentBlueHover: '#1A90FF',
  focusRing: 'rgba(0, 132, 255, 0.25)',
  selectionBg: 'rgba(0, 132, 255, 0.10)',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
};

export const gradients = {
  violet: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #8B5CF6 100%)',
  blue: 'linear-gradient(135deg, #0066CC 0%, #0084FF 100%)',
};

const display = "'Mona Sans Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const body = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const bodyFeatures = "'cv01' 1, 'cv05' 1, 'cv09' 1, 'cv11' 1, 'ss03' 1, 'ss07' 1, 'dlig' 1";

const lightEdge = (alpha = 0.08, drop = '0 12px 32px rgba(0,0,0,0.45)') =>
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
    surface3: tokens.surface2,
    signal: tokens.accentBlue,
    signalSoft: tokens.focusRing,
    dangerSoft: 'rgba(255,69,58,0.12)',
    successSoft: 'rgba(48,209,88,0.12)',
    steel: tokens.inkSecondary,
  },
  shape: { borderRadius: 10 },
  spacing: 6,
  typography: {
    fontFamily: body,
    h1: {
      fontFamily: display,
      fontWeight: 600,
      fontSize: 48,
      lineHeight: 1.1,
      letterSpacing: '-0.03em',
    },
    h2: {
      fontFamily: display,
      fontWeight: 600,
      fontSize: 28,
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
      fontSize: 15,
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
      letterSpacing: '0.01em',
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
      fontSize: 15,
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
      fontWeight: 500,
      fontSize: 13.5,
      lineHeight: 1.0,
      letterSpacing: '-0.01em',
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
          backgroundColor: 'rgba(0,132,255,0.35)',
        },
        ':focus-visible': {
          outline: `2px solid ${tokens.accentBlue}`,
          outlineOffset: 2,
        },
        'input:focus-visible, textarea:focus-visible': {
          outline: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 500,
          transition: 'all 140ms ease-out',
          '&:active': { transform: 'scale(0.98)' },
        },
        sizeSmall: { padding: '5px 11px', fontSize: 12.5 },
        contained: {
          backgroundColor: tokens.ink,
          color: '#0A0B0D',
          fontWeight: 600,
          '&:hover': { backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(255,255,255,0.15)' },
          '&:disabled': {
            backgroundColor: 'rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.35)',
          },
        },
        containedPrimary: {
          backgroundColor: tokens.accentBlue,
          color: '#FFFFFF',
          fontWeight: 600,
          '&:hover': { backgroundColor: tokens.accentBlueHover, boxShadow: '0 4px 12px rgba(0,132,255,0.3)' },
          '&:disabled': {
            backgroundColor: 'rgba(0,132,255,0.25)',
            color: 'rgba(255,255,255,0.35)',
          },
        },
        containedError: {
          backgroundColor: tokens.danger,
          color: '#FFFFFF',
          fontWeight: 600,
          '&:hover': { backgroundColor: '#FF5C52', boxShadow: '0 4px 12px rgba(255,69,58,0.3)' },
        },
        outlined: {
          backgroundColor: 'rgba(255,255,255,0.03)',
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderColor: 'rgba(255,255,255,0.16)',
          },
          '&:disabled': { color: 'rgba(255,255,255,0.3)' },
        },
        outlinedPrimary: {
          backgroundColor: 'rgba(0,132,255,0.08)',
          color: tokens.accentBlue,
          border: '1px solid rgba(0,132,255,0.25)',
          '&:hover': {
            backgroundColor: 'rgba(0,132,255,0.15)',
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
          borderRadius: 14,
        },
        outlined: {
          border: `1px solid ${tokens.hairline}`,
          boxShadow: lightEdge(0.04),
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surfaceElevated,
          backgroundImage: 'none',
          borderRadius: 16,
          border: `1px solid ${tokens.hairline}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' } },
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
          borderRadius: 9,
          color: tokens.ink,
          fontSize: 13.5,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.hairline,
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
        root: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 100, height: 4, overflow: 'hidden' },
        bar: {
          background: 'linear-gradient(90deg, #0084FF 0%, #00B4D8 100%)',
          borderRadius: 100,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surfaceElevated,
          backgroundImage: 'none',
          borderRadius: 12,
          border: `1px solid ${tokens.hairline}`,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 13,
          color: tokens.ink,
          borderRadius: 6,
          margin: '2px 6px',
          padding: '6px 10px',
          '&.Mui-selected': { backgroundColor: 'rgba(0,132,255,0.14)' },
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
          padding: '10px 16px',
        },
        head: {
          color: tokens.inkMuted,
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          borderBottom: `1px solid ${tokens.hairline}`,
          backgroundColor: tokens.surface1,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.surfaceElevated,
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        },
      },
    },
  },
});

export default theme;
