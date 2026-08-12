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
    <MuiBreadcrumbs
      aria-label="breadcrumb"
      sx={{
        mb: 2,
        // hairline dividers: the route trail reads as ruled, not bulleted
        '& .MuiBreadcrumbs-separator': { color: 'hairline' },
      }}
    >
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', color: 'inkMuted' }}
      >
        <FontAwesomeIcon
          icon={faFolderOpen}
          aria-hidden="true"
          style={{ fontSize: 16, marginRight: 8 }}
        />
        <Link
          component="button"
          underline="hover"
          sx={crumbLinkSx}
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
              fontWeight={500}
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
            sx={crumbLinkSx}
            onClick={() => onNavigate(part.id)}
          >
            {part.name}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}
