import React from 'react';
import {
  Box,
  Breadcrumbs as MuiBreadcrumbs,
  Button,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faChevronRight } from '@fortawesome/free-solid-svg-icons';

const crumbBtnSx = {
  color: 'text.secondary',
  maxWidth: 240,
  display: 'inline-flex',
  alignItems: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: 500,
  px: 1,
  py: 0.5,
  borderRadius: 1,
  minWidth: 0,
  textTransform: 'none',
  transition: 'all 120ms ease',
  '&:hover': {
    color: 'text.primary',
    bgcolor: 'surface2',
  },
};

/**
 * Cloud-Drive Interactive Breadcrumbs Path Bar
 */
export default function Breadcrumbs({ trail, onNavigate }) {
  const parts = trail || [];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        py: 0.5,
      }}
    >
      <MuiBreadcrumbs
        aria-label="breadcrumb"
        separator={
          <FontAwesomeIcon
            icon={faChevronRight}
            style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.3)' }}
          />
        }
      >
        <Button
          size="small"
          onClick={() => onNavigate(null)}
          sx={crumbBtnSx}
        >
          <FontAwesomeIcon
            icon={faFolderOpen}
            aria-hidden="true"
            style={{ fontSize: 13, marginRight: 8, color: '#FBBF24' }}
          />
          My drive
        </Button>
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1;
          if (isLast) {
            return (
              <Typography
                key={part.id}
                color="text.primary"
                fontWeight={600}
                fontSize={14}
                aria-current="page"
                noWrap
                sx={{ maxWidth: 280, px: 1, py: 0.5 }}
              >
                {part.name}
              </Typography>
            );
          }
          return (
            <Button
              key={part.id}
              size="small"
              sx={crumbBtnSx}
              onClick={() => onNavigate(part.id)}
            >
              {part.name}
            </Button>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
}
