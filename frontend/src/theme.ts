import { createTheme, rem } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '600',
  },
  
  colors: {
    // Enhanced color palette for better contrast and visual appeal
    blue: [
      '#e7f5ff',
      '#d0ebff',
      '#a5d8ff',
      '#74c0fc',
      '#339af0',
      '#228be6',
      '#1c7ed6',
      '#1971c2',
      '#1864ab',
      '#0c5aa6'
    ],
    gray: [
      '#f8f9fa',
      '#f1f3f4',
      '#e9ecef',
      '#dee2e6',
      '#ced4da',
      '#adb5bd',
      '#6c757d',
      '#495057',
      '#343a40',
      '#212529'
    ],
  },

  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
  },

  radius: {
    xs: rem(2),
    sm: rem(4),
    md: rem(8),
    lg: rem(12),
    xl: rem(16),
  },

  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },

  components: {
    Button: {
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
      },
    },

    TextInput: {
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
      styles: {
        input: {
          border: '1px solid var(--mantine-color-gray-3)',
          '&:focus': {
            borderColor: 'var(--mantine-color-blue-5)',
            boxShadow: '0 0 0 3px rgba(34, 139, 230, 0.1)',
          },
        },
      },
    },

    NumberInput: {
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
      styles: {
        input: {
          border: '1px solid var(--mantine-color-gray-3)',
          '&:focus': {
            borderColor: 'var(--mantine-color-blue-5)',
            boxShadow: '0 0 0 3px rgba(34, 139, 230, 0.1)',
          },
        },
      },
    },

    Select: {
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
      styles: {
        input: {
          border: '1px solid var(--mantine-color-gray-3)',
          '&:focus': {
            borderColor: 'var(--mantine-color-blue-5)',
            boxShadow: '0 0 0 3px rgba(34, 139, 230, 0.1)',
          },
        },
        dropdown: {
          border: '1px solid var(--mantine-color-gray-3)',
          boxShadow: 'var(--mantine-shadow-lg)',
        },
        option: {
          '&:hover': {
            backgroundColor: 'var(--mantine-color-gray-1)',
          },
          '&[data-selected]': {
            backgroundColor: 'var(--mantine-color-blue-1)',
            color: 'var(--mantine-color-blue-9)',
            '&:hover': {
              backgroundColor: 'var(--mantine-color-blue-2)',
            },
          },
        },
      },
    },

    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
      },
      styles: {
        root: {
          border: '1px solid var(--mantine-color-gray-2)',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: 'var(--mantine-shadow-md)',
          },
        },
      },
    },

    Paper: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          border: '1px solid var(--mantine-color-gray-2)',
        },
      },
    },

    Badge: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
        },
      },
    },

    Alert: {
      defaultProps: {
        radius: 'md',
      },
    },

    Code: {
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-gray-1)',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-sm)',
          padding: '2px 6px',
          fontSize: '0.875rem',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        },
      },
    },

    Title: {
      styles: {
        root: {
          color: 'var(--mantine-color-dark-8)',
        },
      },
    },

    NavLink: {
      styles: {
        root: {
          borderRadius: 'var(--mantine-radius-md)',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-gray-1)',
          },
          '&[data-active]': {
            backgroundColor: 'var(--mantine-color-blue-1)',
            color: 'var(--mantine-color-blue-9)',
            fontWeight: 500,
            '&:hover': {
              backgroundColor: 'var(--mantine-color-blue-2)',
            },
          },
        },
      },
    },

    Table: {
      styles: {
        root: {
          color: 'var(--mantine-color-dark-8)',
        },
        td: {
          color: 'var(--mantine-color-dark-8)',
          borderBottom: '1px solid var(--mantine-color-gray-3)',
        },
        th: {
          color: 'var(--mantine-color-dark-8)',
          fontWeight: 600,
          borderBottom: '2px solid var(--mantine-color-gray-4)',
        },
      },
    },
  },
});