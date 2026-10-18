export type AndroidBackAction =
  | 'close-nested'
  | 'show-tabs'
  | 'show-journal'
  | 'stay';

export function resolveAndroidBackAction(
  routeName: string,
  tab: string,
  hasNestedScreen: boolean,
): AndroidBackAction {
  if (hasNestedScreen) return 'close-nested';
  if (routeName !== 'tabs') return 'show-tabs';
  if (tab !== 'journal') return 'show-journal';
  return 'stay';
}
