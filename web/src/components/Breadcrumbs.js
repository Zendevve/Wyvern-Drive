import React from 'react';
import {
  Box,
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';

/**
 * Breadcrumb trail. `trail` is an array of { id, name } ancestor folders,
 * newest last; an empty array means the root. `onNavigate(null)` goes home.
 */
export default function Breadcrumbs({ trail, onNavigate }) {
  const parts = trail || [];
  return (
    <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <FontAwesomeIcon
          icon={faFolderOpen}
          aria-hidden="true"
          style={{ fontSize: 16, marginRight: 8, color: '#999999' }}
        />
        <Link
          component="button"
          underline="hover"
          sx={{ color: 'inkMuted', '&:hover': { color: 'ink' } }}
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
            sx={{ color: 'inkMuted', '&:hover': { color: 'ink' } }}
            onClick={() => onNavigate(part.id)}
          >
            {part.name}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}
