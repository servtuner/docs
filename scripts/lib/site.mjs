// How this build is placed in the published site, from the environment, read by astro.config.mjs and the scripts.
//   DOCS_BASE     the path the build is served under: / (the latest release), /v0.3/ or /next/
//   DOCS_VERSION  the version slug this build documents, such as 0.3, or next for unreleased main
//   DOCS_INDEXED  false keeps search engines out (every build except the one at /)
export const BASE = withSlashes(process.env.DOCS_BASE ?? '/');
export const VERSION = process.env.DOCS_VERSION ?? 'next';
export const INDEXED = (process.env.DOCS_INDEXED ?? 'true') !== 'false';
export const SITE = 'https://docs.servtuner.dev';

/** "/v0.3" and "v0.3/" both become "/v0.3/"; "" becomes "/". */
export function withSlashes(path) {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}
