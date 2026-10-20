// Keep explicit opt-outs when upgrading from the preview's Emma/Visual selector.
export function bindVisualCueSettings({enabled, motion, storage, configure}) {
  const read = key => { try { return storage.getItem(key); } catch { return null; } };
  const saved = read('emma_visual_cue_enabled');
  enabled.checked = saved === null ? read('emma_visual_cue_mode') !== 'emma' : saved !== 'false';
  motion.checked = read('emma_visual_motion') !== 'false';

  function apply() {
    const mode = enabled.checked ? 'visual' : 'emma';
    motion.disabled = !enabled.checked;
    configure({mode, motion: motion.checked});
    try {
      storage.setItem('emma_visual_cue_enabled', String(enabled.checked));
      storage.setItem('emma_visual_cue_mode', mode);
      storage.setItem('emma_visual_motion', String(motion.checked));
    } catch { /* The current session still works when storage is unavailable. */ }
  }
  enabled.addEventListener('change', apply);
  motion.addEventListener('change', apply);
  apply();
  return {apply};
}
