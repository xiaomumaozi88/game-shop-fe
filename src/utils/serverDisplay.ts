export function formatServerChannelForDisplay(channel: string | number | undefined | null): string {
  if (channel === undefined || channel === null) return '';
  return String(channel).trim().replace(/_/g, '-');
}
