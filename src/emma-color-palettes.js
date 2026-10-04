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
    "label": "コーラル（赤）",
    "face": "#ffffff",
    "accent": "#f23b45",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "blue": {
    "label": "ブルー",
    "face": "#ffffff",
    "accent": "#1687ef",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "honey": {
    "label": "はちみつ",
    "face": "#ffffff",
    "accent": "#f5b400",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "berry": {
    "label": "ベリー",
    "face": "#ffffff",
    "accent": "#d633ad",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  }
};
export const FILLED_PALETTES = {
  "coral": {
    "label": "コーラル（赤）",
    "face": "#ffd7da",
    "accent": "#ed1828",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "blue": {
    "label": "ブルー",
    "face": "#d4eaff",
    "accent": "#0672e6",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "honey": {
    "label": "はちみつ",
    "face": "#ffe5af",
    "accent": "#efa300",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  },
  "berry": {
    "label": "ベリー",
    "face": "#eed4e6",
    "accent": "#c916a0",
    "dark": "#3f302c",
    "blush": "#e99ba5",
    "mouth": "#3f302c",
    "tongue": "#f1abb8"
  }
};
export function normalizeFilledPalette(value) {
  return value === 'gradient' ? value : Object.hasOwn(FILLED_PALETTES,value) ? value : 'coral';
}

export function normalizeSoftPalette(value) {
  return value === 'gradient' ? value : Object.hasOwn(SOFT_PALETTES, value) ? value : 'peach';
}

export function normalizeVividPalette(value) {
  const legacy = {sunshine:'honey', ocean:'blue', candy:'coral', forest:'berry'};
  const current = legacy[value] || value;
  return current === 'gradient' ? current : Object.hasOwn(VIVID_PALETTES, current) ? current : 'coral';
}

// Removed mono_red is migrated to vivid coral even if another vivid color was saved.
export function normalizeColorSettings(mode, vivid) {
  return {
    mode: ['soft', 'vivid', 'filled'].includes(mode) ? mode : 'vivid',
    vivid: mode === 'mono_red' ? 'coral' : mode === 'color_shift' ? 'gradient' : normalizeVividPalette(vivid)
  };
}

export const GRADIENT_CYCLE_MS = 60_000;
export const GRADIENT_DESCRIPTIONS = {
  "soft": "グラデーション：ピーチ→ミント→そら→ラベンダー→ピーチの順に、顔と飾りの色が滑らかに変わり、60秒で一周します。",
  "vivid": "グラデーション：赤→はちみつ→ブルー→ベリー→赤の順に、耳や飾りの色が滑らかに変わり、60秒で一周します。顔と体は白いままです。",
  "filled": "グラデーション：赤→はちみつ→ブルー→ベリー→赤の順に、顔・体と飾りの色が滑らかに変わり、60秒で一周します。"
};

// Each mode cycles through its own four palettes in 60 seconds.
export const COLOR_SHIFT_ORDER = ['coral', 'honey', 'blue', 'berry'];
export const SOFT_SHIFT_ORDER = ['peach', 'mint', 'sky', 'lavender'];
export function shiftingPalette(hue, mode = 'vivid') {
  const palettes = mode === 'soft' ? SOFT_PALETTES : mode === 'filled' ? FILLED_PALETTES : VIVID_PALETTES;
  const order = mode === 'soft' ? SOFT_SHIFT_ORDER : COLOR_SHIFT_ORDER;
  const position = (((hue % 360) + 360) % 360) / 90;
  const index = Math.floor(position);
  const fraction = position - index;
  const from = palettes[order[index]];
  const to = palettes[order[(index + 1) % 4]];
  const palette = {};
  for (const paint of ['face','accent','dark','blush','mouth','tongue']) {
    palette[paint] = '#' + [1,3,5].map(offset => {
      const a = parseInt(from[paint].slice(offset, offset + 2),16);
      const b = parseInt(to[paint].slice(offset, offset + 2),16);
      return Math.round(a + (b - a) * fraction).toString(16).padStart(2,'0');
    }).join('');
  }
  return palette;
}
