export interface GiftPackSmallImage {
  num: number;
  img_url: string;
  quality: string;
}

export function parseGiftPackSmallImages(
  raw: string | GiftPackSmallImage[] | undefined | null
): GiftPackSmallImage[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GiftPackSmallImage =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as GiftPackSmallImage).img_url === 'string' &&
        typeof (item as GiftPackSmallImage).quality === 'string' &&
        typeof (item as GiftPackSmallImage).num === 'number'
    );
  } catch {
    return [];
  }
}
