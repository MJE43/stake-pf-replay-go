import { AppShell, Card, Container, Paper, createTheme, rem } from '@mantine/core';

const CONTAINER_SIZES: Record<'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl', string> = {
  xxs: rem(200),
  xs: rem(320),
  sm: rem(480),
  md: rem(720),
  lg: rem(960),
  xl: rem(1280),
  xxl: rem(1440),
};

export const theme = createTheme({
  defaultRadius: 'md',
  fontFamily: 'Inter, var(--mantine-font-family)',
  fontFamilyMonospace: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
    '2xl': rem(24),
    '3xl': rem(30),
    '4xl': rem(36),
    '5xl': rem(48),
  },
  headings: {
    fontFamily: 'Inter, var(--mantine-font-family)',
    fontWeight: '600',
  },
  colors: {
    brand: [
      '#f6f5ff',
      '#e9e6ff',
      '#d1ccff',
      '#b2a6ff',
      '#9074ff',
      '#7350ff',
      '#6232f5',
      '#5328d8',
      '#4523b0',
      '#371c89',
    ],
  },
  primaryColor: 'brand',
  components: {
    Container: Container.extend({
      vars: (theme, props) => {
        const { fluid, size } = props;
        let resolved = CONTAINER_SIZES.lg;
        if (fluid) {
          resolved = '100%';
        } else if (typeof size === 'number') {
          resolved = rem(size);
        } else if (size && size in CONTAINER_SIZES) {
          resolved = CONTAINER_SIZES[size as keyof typeof CONTAINER_SIZES];
        }
        return {
          root: {
            '--container-size': resolved,
          },
        };
      },
    }),
    AppShell: AppShell.extend({
      defaultProps: {
        padding: 'lg',
      },
    }),
    Paper: Paper.extend({
      defaultProps: {
        p: 'lg',
        shadow: 'sm',
        radius: 'md',
        withBorder: true,
      },
    }),
    Card: Card.extend({
      defaultProps: {
        p: 'lg',
        shadow: 'sm',
        radius: 'md',
        withBorder: true,
      },
    }),
  },
});
