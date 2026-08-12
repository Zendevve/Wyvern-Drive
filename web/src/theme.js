import { createTheme } from '@mui/material/styles';

// Signal Deck world — token anchors (see DESIGN.md).
// A fixed-grid instrument grammar for a private file system whose encrypted
// payloads move through Discord attachments. Matte graphite canvas, warm
// white ink, one amber signal for primary actions/selection, and a local
// monospace face for measurement and data roles. No gradients, no glass,
// no pill-button system.
export const tokens = {
  canvas: '#0A0E10',
  surface1: '#11181B',
  surface2: '#1A2428',
  surface3: '#233036',
  ink: '#F4F1E8',
  inkMuted: '#9BA7A7',
  hairline: 'rgba(193,211,205,0.18)',
  hairlineSoft: 'rgba(193,211,205,0.10)',
  signal: '#D9A441', // the single primary signal: amber
  focusRing: 'rgba(217,164,65,0.18)',
  success: '#79C49A',
  danger: '#E57569',
  warning: '#D9A441',
  info: '#84B7C4',
  steel: '#8A9795', // restrained steel edges and secondary control text
};

const display = "'Mona Sans Variable', 'Inter Variable', sans-serif";
const body = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
// Measurement/data role only — never body copy.
const mono = "ui-monospace, SFMono-Regular, Consolas, monospace";

const signalText = '#1B1408'; // dark ink that sits on the amber signal
const dangerText = '#2A0F0C';

const panelEdge = (alpha = 0.10, drop = '0 10px 30px rgba(0,0,0,0.35)') =>
  `inset 0 1px 0 rgba(193,211,205,${alpha}), ${drop}`;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: tokens.signal }, // the single signal: amber
    background: { default: tokens.canvas, paper: tokens.canvas },
    divider: tokens.hairline,
    text: {
      primary: tokens.ink,
      secondary: tokens.inkMuted,
      disabled: 'rgba(244,241,232,0.35)',
    },
    success: { main: tokens.success },
    error: { main: tokens.danger },
    warning: { main: tokens.warning },
    info: { main: tokens.info },
    // World tokens, addressable from sx via theme.palette.*
    canvas: tokens.canvas,
    surface1: tokens.surface1,
    surface2: tokens.surface2,
    surface3: tokens.surface3,
    ink: tokens.ink,
    inkMuted: tokens.inkMuted,
    hairline: tokens.hairline,
    hairlineSoft: tokens.hairlineSoft,
    focusRing: tokens.focusRing,
    signal: tokens.signal,
    signalSoft: 'rgba(217,164,65,0.18)',
    dangerSoft: 'rgba(229,117,105,0.14)',
    successSoft: 'rgba(121,196,154,0.14)',
    steel: tokens.steel,
  },
  shape: { borderRadius: 8 }, // control shape; panels/cells vary by role
  spacing: 5, // Framer base unit: 5/10/15/20/30 instead of 4/8/16/24
  typography: {
    fontFamily: body,
    // Fixed instrument hierarchy: display/brand on Mona Sans, body on Inter,
    // measurement roles on the local mono stack. Labels and buttons never
    // use the display face.
    h1: {
      // boot-screen headline (login / setup)
      fontFamily: display,
      fontWeight: 500,
      fontSize: 40,
      lineHeight: 1.05,
      letterSpacing: '-1.2px',
    },
    h2: {
      // page/panel titles
      fontFamily: display,
      fontWeight: 500,
      fontSize: 28,
      lineHeight: 1.15,
      letterSpacing: '-0.6px',
    },
    h3: {
      // panel titles
      fontWeight: 600,
      fontSize: 20,
      lineHeight: 1.25,
      letterSpacing: '-0.3px',
    },
    h4: {
      // subhead
      fontWeight: 500,
      fontSize: 18,
      lineHeight: 1.3,
      letterSpacing: '-0.2px',
    },
    h5: {
      // section lead
      fontWeight: 500,
      fontSize: 16,
      lineHeight: 1.3,
      letterSpacing: '-0.15px',
    },
    h6: {
      // wordmark-scale titles
      fontWeight: 600,
      fontSize: 16,
      lineHeight: 1.25,
      letterSpacing: '-0.16px',
    },
    body1: {
      fontWeight: 400,
      fontSize: 15,
      lineHeight: 1.45,
      letterSpacing: '-0.1px',
    },
    body2: {
      fontWeight: 400,
      fontSize: 14,
      lineHeight: 1.4,
      letterSpacing: '-0.1px',
    },
    caption: {
      fontWeight: 500,
      fontSize: 12,
      lineHeight: 1.3,
      letterSpacing: '0.02em',
    },
    overline: {
      // micro labels — ruled manifest headers
      fontWeight: 600,
      fontSize: 11,
      lineHeight: 1.2,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: 15,
      lineHeight: 1.3,
      letterSpacing: '-0.1px',
    },
    subtitle2: {
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: '-0.1px',
    },
    button: {
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: '0.02em',
      textTransform: 'none',
    },
    fontFamilyMonospace: mono,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.canvas,
          color: tokens.ink,
        },
        '::selection': {
          backgroundColor: 'rgba(217,164,65,0.30)', // amber selection halos
        },
        ':focus-visible': {
          outline: '2px solid rgba(217,164,65,0.55)',
          outlineOffset: 2,
        },
        'input:focus-visible, textarea:focus-visible': {
          outline: 'none', // MUI containers carry the amber ring instead
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8, // control shape — never a pill
          padding: '8px 14px',
          transition:
            'transform 140ms ease, background-color 160ms ease, color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
          '&:active': { transform: 'scale(0.98)' },
        },
        sizeSmall: { padding: '5px 10px', fontSize: 12, letterSpacing: '0.02em' },
        sizeLarge: { padding: '10px 18px', fontSize: 14 },
        // primary action: amber signal, dark text
        contained: {
          backgroundColor: tokens.signal,
          color: signalText,
          '&:hover': { backgroundColor: '#E0AE52' },
          '&:disabled': {
            backgroundColor: 'rgba(217,164,65,0.35)',
            color: 'rgba(27,20,8,0.5)',
          },
        },
        containedPrimary: {
          backgroundColor: tokens.signal,
          color: signalText,
          '&:hover': { backgroundColor: '#E0AE52' },
          '&:disabled': {
            backgroundColor: 'rgba(217,164,65,0.35)',
            color: 'rgba(27,20,8,0.5)',
          },
        },
        containedError: {
          backgroundColor: tokens.danger,
          color: dangerText,
          '&:hover': { backgroundColor: '#EE8378' },
        },
        // secondary action: graphite with hairline border
        outlined: {
          backgroundColor: tokens.surface2,
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          '&:hover': {
            backgroundColor: tokens.surface3,
            borderColor: 'rgba(193,211,205,0.28)',
          },
          '&:disabled': { color: 'rgba(244,241,232,0.4)' },
        },
        outlinedPrimary: {
          backgroundColor: tokens.surface2,
          color: tokens.ink,
          border: `1px solid ${tokens.hairline}`,
          '&:hover': {
            backgroundColor: tokens.surface3,
            borderColor: 'rgba(193,211,205,0.28)',
          },
        },
        outlinedError: {
          color: tokens.danger,
          borderColor: 'rgba(229,117,105,0.4)',
          '&:hover': {
            backgroundColor: tokens.dangerSoft,
            borderColor: 'rgba(229,117,105,0.6)',
            color: '#EE8378',
          },
        },
        text: {
          color: tokens.inkMuted,
          '&:hover': { backgroundColor: 'rgba(193,211,205,0.06)', color: tokens.ink },
        },
        textPrimary: {
          color: tokens.inkMuted,
          '&:hover': { backgroundColor: 'rgba(193,211,205,0.06)', color: tokens.ink },
        },
        textError: {
          color: tokens.danger,
          '&:hover': { backgroundColor: tokens.dangerSoft, color: '#EE8378' },
        },
      },
    },
    // ButtonBase underpins every button/icon-button/menu/list control. Its
    // reset sets `outline: 0` on the root, which masks the global
    // `:focus-visible` ring from CssBaseline (same specificity, later order
    // wins). Re-assert the amber ring on the keyboard-focus class so focus
    // is always visible; it also gives programmatic-focus states a marker.
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '2px solid rgba(217,164,65,0.55)',
            outlineOffset: 2,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // icon actions are 8px corners, not circles
          color: tokens.inkMuted,
          transition: 'transform 140ms ease, background-color 160ms ease, color 160ms ease',
          '&:active': { transform: 'scale(0.94)' },
          '&:hover': { backgroundColor: 'rgba(193,211,205,0.08)', color: tokens.ink },
          '&.Mui-disabled': { color: 'rgba(244,241,232,0.3)' },
        },
        sizeSmall: { padding: 6 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          backgroundImage: 'none',
          borderRadius: 12, // panels
        },
        outlined: { borderColor: tokens.hairline },
        elevation1: { boxShadow: panelEdge() },
        elevation2: { boxShadow: panelEdge() },
        elevation3: { boxShadow: panelEdge(0.12, '0 16px 40px rgba(0,0,0,0.4)') },
        elevation4: { boxShadow: panelEdge(0.12, '0 16px 48px rgba(0,0,0,0.5)') },
        elevation8: { boxShadow: panelEdge(0.12, '0 24px 64px rgba(0,0,0,0.55)') },
        elevation12: { boxShadow: panelEdge(0.12, '0 24px 64px rgba(0,0,0,0.55)') },
        elevation16: { boxShadow: panelEdge(0.12, '0 24px 64px rgba(0,0,0,0.55)') },
        elevation24: { boxShadow: panelEdge(0.12, '0 24px 64px rgba(0,0,0,0.55)') },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surface2,
          backgroundImage: 'none',
          borderRadius: 12,
          boxShadow: panelEdge(0.12, '0 24px 64px rgba(0,0,0,0.55)'),
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { backgroundColor: 'rgba(4,6,8,0.72)' } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '20px 24px 12px',
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: '-0.3px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '12px 24px' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 20px' } },
    },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface1,
          borderRadius: 8,
          color: tokens.ink,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.hairline,
            transition: 'border-color 160ms ease, box-shadow 160ms ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(193,211,205,0.28)',
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 1px ${tokens.focusRing}`, // amber ring, same surface
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(217,164,65,0.45)',
          },
          '&.Mui-disabled': { backgroundColor: 'rgba(193,211,205,0.03)' },
        },
        input: { padding: '9px 12px' },
        inputAdornedStart: { paddingLeft: 12 },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: tokens.inkMuted,
          '&.Mui-focused': { color: tokens.signal },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '&.Mui-checked': { color: tokens.signal },
          '&.MuiCheckbox-indeterminate': { color: tokens.signal },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(193,211,205,0.10)',
          // segmented/ruled track: measurement grammar, not a soft bar
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0 14px, rgba(10,14,16,0.55) 14px 15px)',
          borderRadius: 3,
          height: 6,
        },
        bar: { backgroundColor: tokens.signal, borderRadius: 3 },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: tokens.signal,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, backgroundColor: tokens.surface2, color: tokens.ink },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          position: 'relative',
          borderRadius: 8,
          color: tokens.inkMuted,
          '&:hover': { backgroundColor: 'rgba(193,211,205,0.05)', color: tokens.ink },
          '&.Mui-selected': {
            backgroundColor: 'rgba(217,164,65,0.18)', // signalSoft
            color: tokens.ink,
            // Non-color state marker: a ruled signal edge on the active item.
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 8,
              bottom: 8,
              width: 3,
              borderRadius: 2,
              backgroundColor: tokens.signal,
            },
            '&:hover': { backgroundColor: 'rgba(217,164,65,0.22)' },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: tokens.hairlineSoft, color: tokens.ink },
        head: {
          color: tokens.inkMuted,
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.surface3,
          color: tokens.ink,
          borderRadius: 6,
          fontSize: 12,
          boxShadow: panelEdge(),
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.surface2,
          backgroundImage: 'none',
          borderRadius: 8,
          boxShadow: panelEdge(0.10, '0 16px 40px rgba(0,0,0,0.5)'),
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: tokens.ink,
          '&.Mui-selected': { backgroundColor: 'rgba(217,164,65,0.18)' },
          '&:hover': { backgroundColor: 'rgba(193,211,205,0.06)' },
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
          borderRadius: 8,
          backgroundColor: tokens.surface1,
          backgroundImage: 'none',
          border: `1px solid ${tokens.hairlineSoft}`,
          color: tokens.ink,
        },
        standardError: {
          backgroundColor: 'rgba(229,117,105,0.14)',
          borderColor: 'rgba(229,117,105,0.35)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.danger },
        },
        standardWarning: {
          backgroundColor: 'rgba(217,164,65,0.14)',
          borderColor: 'rgba(217,164,65,0.35)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.warning },
        },
        standardSuccess: {
          backgroundColor: 'rgba(121,196,154,0.14)',
          borderColor: 'rgba(121,196,154,0.35)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.success },
        },
        standardInfo: {
          backgroundColor: 'rgba(132,183,196,0.14)',
          borderColor: 'rgba(132,183,196,0.35)',
          color: tokens.ink,
          '& .MuiAlert-icon': { color: tokens.info },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: 'rgba(193,211,205,0.08)' } },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: tokens.hairlineSoft } } },
    MuiAvatar: {
      styleOverrides: { root: { backgroundColor: tokens.surface2, color: tokens.ink } },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface2,
          backgroundImage: 'none',
          color: tokens.ink,
          borderRadius: 8,
          boxShadow: panelEdge(0.12, '0 16px 48px rgba(0,0,0,0.5)'),
        },
      },
    },
  },
});

export default theme;
