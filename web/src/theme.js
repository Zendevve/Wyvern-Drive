import { createTheme } from '@mui/material/styles';

// Framer dark-canvas world — token anchors (see DESIGN.md).
// Near-black with a faint warmth; binary ink/ink-muted hierarchy; accent blue
// is a signal color (links, focus, selection) and never a fill.
export const tokens = {
  canvas: '#0E0E10',
  surface1: '#1A1A1D',
  surface2: '#242428',
  ink: '#FFFFFF',
  inkMuted: '#999999',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  accentBlue: '#0099FF',
  focusRing: 'rgba(0,153,255,0.15)',
  success: '#3AC36F',
  danger: '#FF5C5C',
  warning: '#F5A524',
};

// Gradient spotlight cards — the brand's scarce atmosphere device. Exact
// production stops are unknown (derived from screenshots); these are base
// anchors for the violet/magenta/orange/coral family.
export const gradients = {
  violet:
    'linear-gradient(140deg, #5B21B6 0%, #7C3AED 48%, #A78BFA 100%)',
  magenta:
    'linear-gradient(140deg, #A21CAF 0%, #DB2777 55%, #F472B6 100%)',
  orange:
    'linear-gradient(140deg, #C2410C 0%, #F97316 55%, #FDBA74 100%)',
  coral:
    'linear-gradient(140deg, #BE123C 0%, #FB7185 60%, #FDA4AF 100%)',
};

const display = "'Mona Sans Variable', 'Inter Variable', sans-serif";
const body = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const lightEdge = (alphaTop = 0.10, drop = '0 10px 30px rgba(0,0,0,0.25)') =>
  `inset 0 1px 0 rgba(255,255,255,${alphaTop}), ${drop}`;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: tokens.accentBlue }, // links, focus, selection — not fills
    background: { default: tokens.canvas, paper: tokens.canvas },
    divider: tokens.hairline,
    text: {
      primary: tokens.ink,
      secondary: tokens.inkMuted,
      disabled: 'rgba(255,255,255,0.35)',
    },
    success: { main: tokens.success },
    error: { main: tokens.danger },
    warning: { main: tokens.warning },
    info: { main: tokens.accentBlue },
    // World tokens, addressable from sx via theme.palette.*
    canvas: tokens.canvas,
    surface1: tokens.surface1,
    surface2: tokens.surface2,
    ink: tokens.ink,
    inkMuted: tokens.inkMuted,
    hairline: tokens.hairline,
    hairlineSoft: tokens.hairlineSoft,
    focusRing: tokens.focusRing,
  },
  shape: { borderRadius: 10 }, // Framer `rounded.md` as the utility default
  spacing: 5, // Framer base unit: 5/10/15/20/30 instead of 4/8/16/24
  typography: {
    fontFamily: body,
    // Letter-spacing scales with size, hard: posters up top, comfortable body.
    h1: {
      // display-lg — poster headline (login)
      fontFamily: display,
      fontWeight: 500,
      fontSize: 62,
      lineHeight: 1.0,
      letterSpacing: '-3.1px',
    },
    h2: {
      // display-md — page titles
      fontFamily: display,
      fontWeight: 500,
      fontSize: 32,
      lineHeight: 1.13,
      letterSpacing: '-1.0px',
    },
    h3: {
      // headline — dialog titles (Inter tier per the brief)
      fontWeight: 700,
      fontSize: 22,
      lineHeight: 1.2,
      letterSpacing: '-0.8px',
    },
    h4: {
      // subhead
      fontWeight: 400,
      fontSize: 24,
      lineHeight: 1.3,
      letterSpacing: '-0.01px',
    },
    h5: {
      // body-lg
      fontWeight: 400,
      fontSize: 18,
      lineHeight: 1.3,
      letterSpacing: '-0.18px',
    },
    h6: {
      fontWeight: 600,
      fontSize: 16,
      lineHeight: 1.25,
      letterSpacing: '-0.16px',
    },
    body1: {
      // body
      fontWeight: 400,
      fontSize: 15,
      lineHeight: 1.3,
      letterSpacing: '-0.15px',
    },
    body2: {
      // body-sm
      fontWeight: 500,
      fontSize: 14,
      lineHeight: 1.4,
      letterSpacing: '-0.14px',
    },
    caption: {
      fontWeight: 500,
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: '-0.13px',
    },
    overline: {
      // micro
      fontWeight: 400,
      fontSize: 12,
      lineHeight: 1.2,
      letterSpacing: '-0.12px',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: 15,
      lineHeight: 1.3,
      letterSpacing: '-0.15px',
    },
    subtitle2: {
      fontWeight: 600,
      fontSize: 14,
      lineHeight: 1.4,
      letterSpacing: '-0.14px',
    },
    button: {
      fontWeight: 500,
      fontSize: 14,
      lineHeight: 1.0,
      letterSpacing: '-0.14px',
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.canvas,
          color: tokens.ink,
        },
        '::selection': {
          backgroundColor: 'rgba(0,153,255,0.30)', // blue selection halos
        },
        ':focus-visible': {
          outline: '2px solid rgba(0,153,255,0.55)',
          outlineOffset: 2,
        },
        'input:focus-visible, textarea:focus-visible': {
          outline: 'none', // MUI containers carry the blue ring instead
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 100, // pill — the brand's only CTA shape
          padding: '10px 15px',
          transition:
            'transform 120ms ease, background-color 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
          '&:active': { transform: 'scale(0.97)' }, // pressed = shrink, not darken
        },
        sizeSmall: { padding: '6px 12px', fontSize: 13, letterSpacing: '-0.13px' },
        // button-primary: white pill on canvas
        contained: {
          backgroundColor: tokens.ink,
          color: tokens.canvas,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.88)' },
          '&:disabled': {
            backgroundColor: 'rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.4)',
          },
        },
        containedPrimary: {
          backgroundColor: tokens.ink,
          color: tokens.canvas,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.88)' },
          '&:disabled': {
            backgroundColor: 'rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.4)',
          },
        },
        containedError: {
          backgroundColor: tokens.danger,
          color: '#1A0A0A',
          '&:hover': { backgroundColor: '#FF7575' },
        },
        // button-secondary: charcoal pill — never a bordered ghost
        outlined: {
          backgroundColor: tokens.surface1,
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          '&:hover': {
            backgroundColor: tokens.surface2,
            borderColor: 'rgba(255,255,255,0.14)',
          },
          '&:disabled': { color: 'rgba(255,255,255,0.4)' },
        },
        outlinedPrimary: {
          backgroundColor: tokens.surface1,
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          '&:hover': {
            backgroundColor: tokens.surface2,
            borderColor: 'rgba(255,255,255,0.14)',
          },
        },
        outlinedError: {
          color: tokens.danger,
          borderColor: 'rgba(255,92,92,0.35)',
          '&:hover': {
            backgroundColor: 'rgba(255,92,92,0.08)',
            borderColor: 'rgba(255,92,92,0.5)',
            color: '#FF7575',
          },
        },
        text: {
          color: tokens.inkMuted,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)', color: tokens.ink },
        },
        textPrimary: {
          color: tokens.inkMuted,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)', color: tokens.ink },
        },
        textError: {
          color: tokens.danger,
          '&:hover': { backgroundColor: 'rgba(255,92,92,0.08)', color: '#FF7575' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '50%', // circular icon buttons
          color: tokens.inkMuted,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)', color: tokens.ink },
          '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
        },
        sizeSmall: { padding: 8 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          backgroundImage: 'none',
          borderRadius: 20, // `rounded.xl` — pricing/mockup tiles
        },
        outlined: { borderColor: tokens.hairline },
        elevation1: { boxShadow: lightEdge() },
        elevation2: { boxShadow: lightEdge() },
        elevation3: { boxShadow: lightEdge(0.12, '0 16px 40px rgba(0,0,0,0.35)') },
        elevation4: { boxShadow: lightEdge(0.12, '0 16px 48px rgba(0,0,0,0.45)') },
        elevation8: { boxShadow: lightEdge(0.12, '0 24px 64px rgba(0,0,0,0.5)') },
        elevation12: { boxShadow: lightEdge(0.12, '0 24px 64px rgba(0,0,0,0.5)') },
        elevation16: { boxShadow: lightEdge(0.12, '0 24px 64px rgba(0,0,0,0.5)') },
        elevation24: { boxShadow: lightEdge(0.12, '0 24px 64px rgba(0,0,0,0.5)') },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surface2,
          backgroundImage: 'none',
          borderRadius: 20,
          boxShadow: lightEdge(0.12, '0 24px 64px rgba(0,0,0,0.5)'),
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { backgroundColor: 'rgba(0,0,0,0.72)' } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { padding: '24px 24px 0', fontWeight: 700, fontSize: 22, letterSpacing: '-0.8px' },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '16px 24px' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '16px 24px 24px' } },
    },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          borderRadius: 10, // `rounded.md`
          color: tokens.ink,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.hairline,
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.14)',
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 1px ${tokens.focusRing}`, // blue ring, same surface
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'transparent',
          },
          '&.Mui-disabled': { backgroundColor: 'rgba(255,255,255,0.03)' },
        },
        input: { padding: '10px 14px' },
        inputAdornedStart: { paddingLeft: 14 },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: tokens.inkMuted,
          '&.Mui-focused': { color: tokens.inkMuted },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '&.Mui-checked': { color: tokens.accentBlue },
          '&.MuiCheckbox-indeterminate': { color: tokens.accentBlue },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 100, height: 6 },
        bar: { backgroundColor: tokens.ink, borderRadius: 100 },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: tokens.accentBlue,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, backgroundColor: tokens.surface1, color: tokens.ink },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          color: tokens.inkMuted,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)', color: tokens.ink },
          '&.Mui-selected': {
            backgroundColor: tokens.surface2, // selected = lift, not color
            color: tokens.ink,
            '&:hover': { backgroundColor: tokens.surface2 },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: tokens.hairlineSoft, color: tokens.ink },
        head: {
          color: tokens.inkMuted,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: '-0.13px',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.surface2,
          color: tokens.ink,
          borderRadius: 8,
          fontSize: 12,
          boxShadow: lightEdge(),
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surface2,
          backgroundImage: 'none',
          borderRadius: 15,
          boxShadow: lightEdge(0.10, '0 16px 40px rgba(0,0,0,0.45)'),
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: tokens.ink,
          '&.Mui-selected': { backgroundColor: 'rgba(0,153,255,0.12)' },
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: tokens.canvas, backgroundImage: 'none' } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.canvas,
          backgroundImage: 'none',
          color: tokens.ink,
          boxShadow: 'none',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: tokens.surface1,
          backgroundImage: 'none',
          color: tokens.ink,
        },
        standardError: {
          backgroundColor: 'rgba(255,92,92,0.10)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.danger },
        },
        standardWarning: {
          backgroundColor: 'rgba(245,165,36,0.10)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.warning },
        },
        standardSuccess: {
          backgroundColor: 'rgba(58,195,111,0.10)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.success },
        },
        standardInfo: {
          backgroundColor: 'rgba(0,153,255,0.10)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.accentBlue },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: 'rgba(255,255,255,0.06)' } },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: tokens.hairlineSoft } } },
    MuiAvatar: {
      styleOverrides: { root: { backgroundColor: tokens.surface2, color: tokens.ink } },
    },
  },
});

export default theme;
