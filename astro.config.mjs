import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';
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
      // llms.txt, llms-full.txt, llms-small.txt and one file per set, at this build's base (/next/llms.txt).
      plugins: [
        starlightLlmsTxt({
          // The generated API and schema pages are most of the text, and 404 is not documentation: last in
          // llms-full.txt, left out of llms-small.txt. (Only drafts leave llms-full.txt, and a draft is not built.)
          demote: ['reference/api/**', 'reference/schemas/**', '404'],
          exclude: ['reference/api/**', 'reference/schemas/**', '404'],
          customSets: [
            {
              label: 'Deployment',
              description: 'installing, verifying and configuring servtuner',
              paths: ['deployment', 'deployment/**'],
            },
            {
              label: 'Reference',
              description: 'the CLI, RunSpec, bundle files, Helm values, configuration, API and schemas',
              paths: ['reference', 'reference/**'],
            },
          ],
        }),
      ],
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
              items: [
                'concepts/workloads',
                'concepts/trustworthy-rps',
                'concepts/metrics',
                'concepts/run-bundles',
                'concepts/engines',
              ],
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
                'deployment/verify',
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
