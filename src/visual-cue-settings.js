// Keep explicit opt-outs when upgrading from the preview's Emma/Visual selector.
export function bindVisualCueSettings({enabled, storage, configure}) {
  const read = key => { try { return storage.getItem(key); } catch { return null; } };
  const saved = read('emma_visual_cue_enabled');
  enabled.checked = saved === null ? read('emma_visual_cue_mode') !== 'emma' : saved !== 'false';

  function apply() {
    const mode = enabled.checked ? 'visual' : 'emma';
    configure({mode, motion: true});
    try {
      storage.setItem('emma_visual_cue_enabled', String(enabled.checked));
      storage.setItem('emma_visual_cue_mode', mode);
    } catch { /* The current session still works when storage is unavailable. */ }
  }
  enabled.addEventListener('change', apply);
  apply();
  return {apply};
}
