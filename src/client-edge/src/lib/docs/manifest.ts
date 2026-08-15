import {
  assertContractCompatible,
  type DocItem,
  type DocManifest,
  type Perspective,
  type Domain,
} from '@omnidocs/schema';
import manifestJson from '../../generated/docs/docs-manifest.json';

/** Build-time static manifest bound into the client bundle. */
const manifest = manifestJson as DocManifest;

// Runtime guard: ensure the committed manifest matches this app's schema major.
assertContractCompatible(manifest.contractVersion);

export function getAllDocs(): DocItem[] {
  return manifest.docs;
}

export function totalDocCount(): number {
  return manifest.docCount;
}

export function getDocBySlug(slug: string): DocItem | undefined {
  return manifest.docs.find((d) => d.slug === slug);
}

export function getDocById(id: string): DocItem | undefined {
  return manifest.docs.find((d) => d.id === id);
}

export function filterByPerspective(perspective: Perspective): DocItem[] {
  return manifest.docs.filter((d) => d.perspectives.includes(perspective));
}

export function filterByDomain(domain: Domain): DocItem[] {
  return manifest.docs.filter((d) => d.domains.includes(domain));
}

export function allPerspectives(): Perspective[] {
  return Array.from(new Set(manifest.docs.flatMap((d) => d.perspectives)));
}

export function allDomains(): Domain[] {
  return Array.from(new Set(manifest.docs.flatMap((d) => d.domains)));
}

export { manifest };