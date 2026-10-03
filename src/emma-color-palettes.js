// Approved character colors, shared with Android EmmaColorTheme.kt.
export const SOFT_PALETTES = {
  "peach": {
    "label": "ピーチ",
    "face": "#ffede6",
    "accent": "#f2a69c",
    "dark": "#51443f",
    "blush": "#f0a9ae",
    "mouth": "#51443f",
    "tongue": "#eba0aa"
  },
  "mint": {
    "label": "ミント",
    "face": "#e5f5ee",
    "accent": "#7bc6ae",
    "dark": "#51443f",
    "blush": "#f0a9ae",
    "mouth": "#51443f",
    "tongue": "#eba0aa"
  },
  "sky": {
    "label": "そら",
    "face": "#e8f2fe",
    "accent": "#83b9e6",
    "dark": "#51443f",
    "blush": "#f0a9ae",
    "mouth": "#51443f",
    "tongue": "#eba0aa"
  },
  "lavender": {
    "label": "ラベンダー",
    "face": "#f2e9ff",
    "accent": "#b49ae3",
    "dark": "#51443f",
    "blush": "#f0a9ae",
    "mouth": "#51443f",
    "tongue": "#eba0aa"
  }
};
export const VIVID_PALETTES = {
  "coral": {
    "label": "コーラル",
    "face": "#ffffff",
    "accent": "#df3e50",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "blue": {
    "label": "ブルー",
    "face": "#ffffff",
    "accent": "#1474b2",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "honey": {
    "label": "はちみつ",
    "face": "#ffffff",
    "accent": "#d68c0a",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "berry": {
    "label": "ベリー",
    "face": "#ffffff",
    "accent": "#a13d7c",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  }
};
export function normalizeSoftPalette(value) {
  return Object.hasOwn(SOFT_PALETTES, value) ? value : 'peach';
}

export function normalizeVividPalette(value) {
  const legacy = {sunshine:'honey', ocean:'blue', candy:'coral', forest:'berry'};
  const current = legacy[value] || value;
  return Object.hasOwn(VIVID_PALETTES, current) ? current : 'coral';
}
