import React from 'react';
import {
  Box,
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faFolderOpen } from '@fortawesome/free-solid-svg-icons';

const crumbLinkSx = {
  color: 'inkSecondary',
  maxWidth: 220,
  display: 'inline-flex',
  alignItems: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 13.5,
  fontWeight: 500,
  borderRadius: '6px',
  px: 1,
  py: 0.5,
  transition: 'all 120ms ease-out',
  '&:hover': { color: 'ink', bgcolor: 'rgba(255,255,255,0.06)' },
};

/**
 * First-Party Cloud Breadcrumbs Path Bar.
 */
export default function Breadcrumbs({ trail, onNavigate }) {
  const parts = trail || [];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        bgcolor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid hairlineSoft',
        borderRadius: '8px',
        px: 1.5,
        py: 0.5,
        mb: 2,
      }}
    >
      <MuiBreadcrumbs
        aria-label="breadcrumb"
        separator={<FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }} />}
      >
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center' }}
        >
          <Link
            component="button"
            underline="none"
            sx={crumbLinkSx}
            onClick={() => onNavigate(null)}
          >
            <FontAwesomeIcon
              icon={faFolderOpen}
              aria-hidden="true"
              style={{ fontSize: 13, marginRight: 6, color: '#0084FF' }}
            />
            My Drive
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
                fontSize={13.5}
                aria-current="page"
                noWrap
                sx={{ maxWidth: 260, px: 1, py: 0.5 }}
              >
                {part.name}
              </Typography>
            );
          }
          return (
            <Link
              component="button"
              key={part.id}
              underline="none"
              sx={crumbLinkSx}
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
