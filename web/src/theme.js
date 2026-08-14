import { createTheme } from '@mui/material/styles';

/**
 * Dark Matter Theme Tokens
 * A cold, dark & frosty Discord-inspired theme.
 */
export const tokens = {
  // Background surfaces
  bgSolidDarker: '#0C0E12',    // Canvas background
  bgSolidDark: '#101218',      // Sidebar & dialog backdrop
  bgSolid: '#161921',          // Surface 1 (cards, panels)
  bgElevated: '#1D222D',       // Surface 2 (active states, hover)
  bgElevatedHigh: '#242A38',   // Surface elevated (popovers, dropdowns)
  
  // Frosty Accents
  accent: '#25ACE8',           // Electric Ice Blue (rgb(37, 172, 232))
  accentHover: '#38BDF8',      // Bright Ice
  accentAlt: '#1D6586',        // Deep Ice Cyan (rgb(29, 101, 134))
  accentGlow: 'rgba(37, 172, 232, 0.15)',
  focusRing: 'rgba(37, 172, 232, 0.35)',

  // Text hierarchy
  text0: '#0C0E12',            // Inverted on bright badges
  text1: '#F8FAFC',            // Pure crisp white / Ice white
  text2: '#E2E8F0',            // Headings and important labels
  text3: '#94A3B8',            // Body text
  text4: '#64748B',            // Muted labels and icons
  text5: '#475569',            // Subtle borders and timestamps

  // Semantic
  green1: '#86EFAC',
  green2: '#4ADE80',           // Verified / AES-256 OK
  yellow1: '#FDE047',
  yellow2: '#FBBF24',          // Folders / Warning
  red1: '#FCA5A5',
  red2: '#F87171',             // Danger / Delete
  blue1: '#93C5FD',
  blue2: '#38BDF8',            // Info / Audio

  // Structural Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.04)',
  borderHover: '#25ACE8',
  buttonBorder: 'rgba(255, 255, 255, 0.12)',

  // Cloud UI Legacy & Semantic Mappings
  canvas: '#0C0E12',
  sidebar: '#101218',
  surface1: '#161921',
  surface2: '#1D222D',
  surfaceElevated: '#242A38',
  ink: '#F8FAFC',
  inkSecondary: '#94A3B8',
  inkMuted: '#64748B',
  accentBlue: '#25ACE8',
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineSoft: 'rgba(255, 255, 255, 0.04)',
  success: '#4ADE80',
  danger: '#F87171',
  warning: '#FBBF24',
};

const fontSans = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const fontDisplay = "'Mona Sans Variable', 'Inter Variable', -apple-system, sans-serif";

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: tokens.accent,
      light: tokens.accentHover,
      dark: tokens.accentAlt,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: tokens.accentAlt,
      light: tokens.accent,
      contrastText: '#FFFFFF',
    },
    background: {
      default: tokens.canvas,
      paper: tokens.surface1,
    },
    divider: tokens.border,
    text: {
      primary: tokens.text1,
      secondary: tokens.text3,
      disabled: tokens.text4,
    },
    success: { main: tokens.green2 },
    error: { main: tokens.red2 },
    warning: { main: tokens.yellow2 },
    info: { main: tokens.accent },
    canvas: tokens.canvas,
    sidebar: tokens.sidebar,
    surface1: tokens.surface1,
    surface2: tokens.surface2,
    surfaceElevated: tokens.surfaceElevated,
    ink: tokens.text1,
    inkSecondary: tokens.text3,
    inkMuted: tokens.text4,
    hairline: tokens.border,
    hairlineSoft: tokens.borderLight,
    focusRing: tokens.focusRing,
    accentBlue: tokens.accent,
    selectionBg: tokens.accentGlow,
    folderGold: tokens.yellow2,
    surface3: tokens.surface2,
    signal: tokens.accent,
    signalSoft: tokens.accentGlow,
    dangerSoft: 'rgba(248, 113, 113, 0.15)',
    successSoft: 'rgba(74, 222, 128, 0.15)',
    steel: tokens.text3,
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  typography: {
    fontFamily: fontSans,
    h1: {
      fontFamily: fontDisplay,
      fontWeight: 600,
      fontSize: 32,
      letterSpacing: '-0.03em',
      lineHeight: 1.2,
    },
    h2: {
      fontFamily: fontDisplay,
      fontWeight: 600,
      fontSize: 24,
      letterSpacing: '-0.025em',
      lineHeight: 1.25,
    },
    h3: {
      fontFamily: fontDisplay,
      fontWeight: 600,
      fontSize: 20,
      letterSpacing: '-0.02em',
      lineHeight: 1.3,
    },
    h4: {
      fontFamily: fontDisplay,
      fontWeight: 600,
      fontSize: 18,
      letterSpacing: '-0.02em',
      lineHeight: 1.35,
    },
    h5: {
      fontFamily: fontDisplay,
      fontWeight: 600,
      fontSize: 16,
      letterSpacing: '-0.015em',
      lineHeight: 1.4,
    },
    h6: {
      fontFamily: fontDisplay,
      fontWeight: 600,
      fontSize: 14,
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
    },
    body1: {
      fontFamily: fontSans,
      fontWeight: 400,
      fontSize: 14,
      letterSpacing: '-0.01em',
      lineHeight: 1.5,
    },
    body2: {
      fontFamily: fontSans,
      fontWeight: 400,
      fontSize: 13,
      letterSpacing: '-0.005em',
      lineHeight: 1.5,
    },
    caption: {
      fontFamily: fontSans,
      fontWeight: 500,
      fontSize: 12,
      letterSpacing: '0.01em',
      lineHeight: 1.3,
    },
    overline: {
      fontFamily: fontSans,
      fontWeight: 600,
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
    subtitle1: {
      fontFamily: fontSans,
      fontWeight: 500,
      fontSize: 14,
      letterSpacing: '-0.01em',
    },
    subtitle2: {
      fontFamily: fontSans,
      fontWeight: 600,
      fontSize: 13,
      letterSpacing: '-0.005em',
    },
    button: {
      fontFamily: fontSans,
      fontWeight: 500,
      fontSize: 13,
      letterSpacing: '-0.01em',
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.canvas,
          color: tokens.text1,
          fontFamily: fontSans,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '::selection': {
          backgroundColor: 'rgba(37, 172, 232, 0.35)',
          color: '#FFFFFF',
        },
        'button:focus-visible, [role="button"]:focus-visible, a:focus-visible': {
          outline: `2px solid ${tokens.accent}`,
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
          borderRadius: 8,
          fontWeight: 500,
          fontFamily: fontSans,
          transition: 'all 120ms cubic-bezier(0.16, 1, 0.3, 1)',
          '&:active': { transform: 'scale(0.98)' },
        },
        sizeSmall: { padding: '4px 10px', fontSize: 12 },
        sizeMedium: { padding: '7px 16px', fontSize: 13 },
        contained: {
          backgroundColor: tokens.surface2,
          color: tokens.text1,
          border: `1px solid ${tokens.border}`,
          '&:hover': {
            backgroundColor: tokens.surfaceElevated,
            borderColor: tokens.accent,
            boxShadow: `0 0 12px ${tokens.accentGlow}`,
          },
          '&:disabled': {
            backgroundColor: tokens.surface1,
            borderColor: tokens.borderLight,
            color: tokens.text4,
          },
        },
        containedPrimary: {
          backgroundColor: tokens.accent,
          color: '#FFFFFF',
          border: `1px solid ${tokens.accentHover}`,
          '&:hover': {
            backgroundColor: tokens.accentHover,
            borderColor: '#FFFFFF',
            boxShadow: '0 0 16px rgba(37, 172, 232, 0.45)',
          },
          '&:disabled': {
            backgroundColor: 'rgba(37, 172, 232, 0.25)',
            borderColor: 'transparent',
            color: 'rgba(255, 255, 255, 0.4)',
          },
        },
        containedError: {
          backgroundColor: tokens.red2,
          color: '#FFFFFF',
          border: '1px solid #FFA3A3',
          '&:hover': {
            backgroundColor: '#EF4444',
            boxShadow: '0 0 16px rgba(248, 113, 113, 0.4)',
          },
        },
        outlined: {
          backgroundColor: 'transparent',
          color: tokens.text2,
          borderColor: tokens.border,
          '&:hover': {
            backgroundColor: tokens.surface1,
            borderColor: tokens.accent,
            color: tokens.text1,
          },
        },
        outlinedPrimary: {
          backgroundColor: 'rgba(37, 172, 232, 0.08)',
          color: tokens.accent,
          borderColor: 'rgba(37, 172, 232, 0.4)',
          '&:hover': {
            backgroundColor: 'rgba(37, 172, 232, 0.18)',
            borderColor: tokens.accent,
          },
        },
        outlinedError: {
          color: tokens.red2,
          borderColor: 'rgba(248, 113, 113, 0.4)',
          '&:hover': {
            backgroundColor: 'rgba(248, 113, 113, 0.12)',
            borderColor: tokens.red2,
          },
        },
        text: {
          color: tokens.text3,
          '&:hover': {
            backgroundColor: tokens.surface1,
            color: tokens.text1,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          color: tokens.text3,
          transition: 'all 120ms ease',
          '&:hover': {
            backgroundColor: tokens.surface2,
            color: tokens.text1,
          },
          '&:active': { transform: 'scale(0.95)' },
          '&.Mui-disabled': { color: tokens.text4 },
        },
        sizeSmall: { padding: 5 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          backgroundImage: 'none',
          borderRadius: 10,
          border: `1px solid ${tokens.border}`,
        },
        outlined: {
          border: `1px solid ${tokens.border}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surface1,
          backgroundImage: 'none',
          borderRadius: 12,
          border: `1px solid ${tokens.accent}`,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 20px rgba(37, 172, 232, 0.15)',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(8, 10, 14, 0.8)',
          backdropFilter: 'blur(6px)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '18px 24px 14px',
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: '-0.01em',
          borderBottom: `1px solid ${tokens.border}`,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '20px 24px' } },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '14px 24px',
          borderTop: `1px solid ${tokens.border}`,
          gap: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          borderRadius: 8,
          color: tokens.text1,
          fontSize: 13,
          fontFamily: fontSans,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.border,
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(37, 172, 232, 0.6)',
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 2px ${tokens.focusRing}`,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.accent,
          },
        },
        input: { padding: '8px 14px' },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: tokens.text4,
          borderRadius: 4,
          '&.Mui-checked': { color: tokens.accent },
          '&.MuiCheckbox-indeterminate': { color: tokens.accent },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 9999,
          height: 6,
          overflow: 'hidden',
        },
        bar: {
          background: `linear-gradient(90deg, ${tokens.accent} 0%, #38BDF8 100%)`,
          borderRadius: 9999,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surface2,
          backgroundImage: 'none',
          borderRadius: 10,
          border: `1px solid ${tokens.border}`,
          boxShadow: '0 12px 32px rgba(0,0,0,0.7), 0 0 12px rgba(37, 172, 232, 0.1)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 13,
          fontFamily: fontSans,
          color: tokens.text2,
          borderRadius: 6,
          margin: '2px 6px',
          padding: '7px 12px',
          transition: 'all 80ms ease',
          '&.Mui-selected': {
            backgroundColor: tokens.accentGlow,
            color: tokens.text1,
            fontWeight: 500,
          },
          '&:hover': {
            backgroundColor: 'rgba(37, 172, 232, 0.12)',
            color: tokens.text1,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: tokens.borderLight,
          color: tokens.text2,
          fontSize: 13,
          fontFamily: fontSans,
          padding: '10px 16px',
        },
        head: {
          color: tokens.text4,
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          borderBottom: `1px solid ${tokens.border}`,
          backgroundColor: tokens.sidebar,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.surfaceElevated,
          color: tokens.text1,
          border: `1px solid ${tokens.border}`,
          borderRadius: 6,
          fontSize: 12,
          fontFamily: fontSans,
          boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
          padding: '6px 10px',
        },
      },
    },
  },
});

export default theme;
