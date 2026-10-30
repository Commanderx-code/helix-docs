// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import externalScripts from './scripts/lib/external-scripts.mjs';

const tools = [
  { label: 'Helix Toolbox', directory: 'toolbox' },
  { label: 'Helix Boot', directory: 'boot' },
  { label: 'webOS Launcher', directory: 'webos-launcher' },
  { label: 'Touchdown', directory: 'touchdown' },
];

export default defineConfig({
  site: 'https://docs.helixtech.app',
  build: {
    // Every style sheet is a file, so the CSP can keep style-src at 'self'
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Fonts and images stay files too; data: URLs would need a looser CSP
      assetsInlineLimit: 0,
    },
  },
  integrations: [
    starlight({
      title: 'Helix Tech Docs',
      logo: {
        dark: './src/assets/brand/logo-on-dark.png',
        light: './src/assets/brand/logo-on-light.png',
        alt: 'Helix Tech',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Commanderx-code' }],
      customCss: [
        '@fontsource/fira-sans/400.css',
        '@fontsource/fira-sans/500.css',
        '@fontsource/fira-sans/600.css',
        '@fontsource/fira-sans-condensed/700.css',
        '@fontsource/fira-sans-condensed/800.css',
        '@fontsource-variable/jetbrains-mono',
        './src/styles/theme.css',
      ],
      sidebar: tools.map(({ label, directory }) => ({
        label,
        collapsed: true,
        items: [{ autogenerate: { directory } }],
      })),
      components: {
        Footer: './src/components/Footer.astro',
        Header: './src/components/Header.astro',
        PageSidebar: './src/components/PageSidebar.astro',
        Sidebar: './src/components/Sidebar.astro',
        SocialIcons: './src/components/SocialIcons.astro',
      },
      routeMiddleware: './src/routeData.ts',
      lastUpdated: false,
      pagefind: true,
    }),
    externalScripts(),
  ],
});
