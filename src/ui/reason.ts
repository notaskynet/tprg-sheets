// Human wording for why a checklist item is not satisfied.
import type { CheckItem } from '@/engine/creation';

export function reasonOf(item: CheckItem, t: (k: string) => string): string {
  if (item.ok) return '';
  if (item.empty) return t('whyEmpty');
  const parts: string[] = [];
  if (item.missing && item.missing > 0) parts.push(`${t('whyMissing')} ${item.missing}`);
  if (item.over && item.over > 0) parts.push(`${t('whyOver')} ${item.over}`);
  return parts.join(' · ');
}
