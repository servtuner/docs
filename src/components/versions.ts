// The published site's list of versions, written to /versions.json by scripts/build-site.mjs.
export type VersionEntry = { slug: string; base: string };
export type Versions = {
  /** The slug of the latest stable release, served at /. null before the first release. */
  latest: string | null;
  /** Newest first: the latest release (base /), older releases (/v0.2/), then next (/next/). */
  versions: VersionEntry[];
};

let loaded: Promise<Versions | null> | undefined;

const read = (path: string) =>
  fetch(new URL(path, location.origin).href)
    .then((response) => (response.ok ? (response.json() as Promise<Versions>) : null))
    .catch(() => null);

/** The published site's /versions.json, above every version's base, else this build's own copy under its base (a
 * build served on its own). Fetched once per page; null when neither is there. */
export function loadVersions(base: string): Promise<Versions | null> {
  loaded ??= read('/versions.json').then(
    (versions) => versions ?? (base === '/' ? null : read(`${base}versions.json`)),
  );
  return loaded;
}

export function versionLabel(entry: VersionEntry, latest: string | null): string {
  if (entry.slug === 'next') return 'next (unreleased)';
  return entry.slug === latest ? `${entry.slug} (latest)` : entry.slug;
}
