import React from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';

/**
 * Breadcrumb trail. `trail` is an array of { id, name } ancestor folders,
 * newest last; an empty array means the root. `onNavigate(null)` goes home.
 */
export default function Breadcrumbs({ trail, onNavigate }) {
  const parts = trail || [];
  return (
    <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      <Link component="button" underline="hover" color="inherit" onClick={() => onNavigate(null)}>
        My drive
      </Link>
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        if (isLast) {
          return (
            <Typography key={part.id} color="text.primary" aria-current="page">
              {part.name}
            </Typography>
          );
        }
        return (
          <Link
            component="button"
            key={part.id}
            underline="hover"
            color="inherit"
            onClick={() => onNavigate(part.id)}
          >
            {part.name}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}
