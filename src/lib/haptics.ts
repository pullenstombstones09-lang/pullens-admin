// Haptic feedback utility — uses Navigator.vibrate() on supported devices
// Falls back silently on desktop/unsupported browsers

type HapticType = 'light' | 'confirm' | 'strong';

const PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  confirm: 30,
  strong: 50,
};

export function haptic(type: HapticType): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(PATTERNS[type]);
  }
}
