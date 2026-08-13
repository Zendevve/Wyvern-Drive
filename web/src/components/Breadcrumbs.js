import React from 'react';
import {
  Box,
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';

// Long names clip to an ellipsis instead of overflowing the rail or mobile
// viewport; MUI Breadcrumbs wraps, so clipped crumbs never cause a scroll.
const crumbLinkSx = {
  color: 'inkMuted',
  maxWidth: 200,
  display: 'inline-block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '&:hover': { color: 'ink' },
};

/**
 * Breadcrumb trail. `trail` is an array of { id, name } ancestor folders,
 * newest last; an empty array means the root. `onNavigate(null)` goes home.
 */
export default function Breadcrumbs({ trail, onNavigate }) {
  const parts = trail || [];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        bgcolor: 'surface1',
        border: '1px solid hairlineSoft',
        borderRadius: '12px',
        px: 2,
        py: 0.85,
        mb: 2.5,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <MuiBreadcrumbs
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-separator': { color: 'hairline', mx: 1 },
        }}
      >
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', color: 'inkMuted' }}
        >
          <FontAwesomeIcon
            icon={faFolderOpen}
            aria-hidden="true"
            style={{ fontSize: 15, marginRight: 8, color: '#0099FF' }}
          />
          <Link
            component="button"
            underline="hover"
            sx={{ ...crumbLinkSx, fontWeight: 500, fontSize: 13 }}
            onClick={() => onNavigate(null)}
          >
            My drive
          </Link>
        </Box>
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1;
          if (isLast) {
            return (
              <Typography
                key={part.id}
                color="text.primary"
                fontWeight={600}
                fontSize={13}
                aria-current="page"
                noWrap
                sx={{ maxWidth: 220 }}
              >
                {part.name}
              </Typography>
            );
          }
          return (
            <Link
              component="button"
              key={part.id}
              underline="hover"
              sx={{ ...crumbLinkSx, fontWeight: 500, fontSize: 13 }}
              onClick={() => onNavigate(part.id)}
            >
              {part.name}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
}
