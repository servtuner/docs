import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { BASE, INDEXED, SITE, VERSION } from './scripts/lib/site.mjs';

export default defineConfig({
  vite: { define: { 'import.meta.env.DOCS_VERSION': JSON.stringify(VERSION) } },
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'servtuner',
      description: 'Benchmark, compare and size LLM serving stacks on Kubernetes.',
      logo: {
        light: './src/assets/wordmark-light.svg',
        dark: './src/assets/wordmark-dark.svg',
        alt: 'servtuner',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/site.css'],
      components: {
        Header: './src/components/Header.astro',
        Banner: './src/components/Banner.astro',
        MobileMenuFooter: './src/components/MobileMenuFooter.astro',
      },
      routeMiddleware: './src/route-middleware.ts',
      // Only the latest release, at /, is for search engines; older versions and next are not.
      head: INDEXED ? [] : [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } }],
      lastUpdated: false,
      sidebar: [
        {
          label: 'Documentation',
          items: [
            {
              label: 'Overview',
              items: ['overview/what-is-servtuner', 'overview/architecture', 'overview/core-concepts'],
            },
            { label: 'Quickstart', items: ['quickstart/first-run', 'quickstart/read-results'] },
            {
              label: 'Targets',
              items: [
                'guides/targets',
                'guides/targets/vllm',
                'guides/targets/litellm',
                'guides/targets/bifrost',
                'guides/targets/openai-compatible',
              ],
            },
            {
              label: 'Benchmark',
              items: [
                'guides/runspecs',
                'guides/workload-presets',
                'guides/slos-and-capacity',
                'guides/inspect-runs',
                'guides/schedules',
              ],
            },
            {
              label: 'Compare and size',
              items: ['guides/experiments', 'guides/sizing', 'guides/costs', 'guides/follow-ups', 'guides/planner'],
            },
            { label: 'Tune vLLM', items: ['guides/managed-vllm', 'guides/tuning-sessions'] },
            {
              label: 'Concepts',
              items: ['concepts/trustworthy-rps', 'concepts/metrics', 'concepts/run-bundles', 'concepts/engines'],
            },
            { label: 'Help', items: ['help/troubleshooting', 'help/glossary', 'help/contributing'] },
          ],
        },
        {
          label: 'Deployment',
          items: [
            {
              label: 'Install',
              items: [
                'deployment',
                'deployment/local',
                'deployment/kind',
                'deployment/helm',
                'deployment/air-gapped',
                'deployment/launcher',
              ],
            },
            {
              label: 'Configure',
              items: [
                'deployment/authentication',
                'deployment/prometheus',
                'deployment/storage',
                'deployment/transport-security',
                'deployment/secrets',
              ],
            },
          ],
        },
        {
          label: 'Reference',
          items: [
            {
              label: 'Reference',
              items: [
                'reference',
                'reference/cli',
                'reference/runspec',
                'reference/bundle-files',
                'reference/helm-values',
                'reference/configuration',
              ],
            },
            { label: 'API', items: [{ autogenerate: { directory: 'reference/api' } }] },
            { label: 'Schemas', collapsed: true, items: [{ autogenerate: { directory: 'reference/schemas' } }] },
          ],
        },
      ],
    }),
  ],
});
