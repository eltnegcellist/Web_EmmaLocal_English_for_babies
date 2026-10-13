// Saved explicit OFF always wins; an unset preference enables the Ruri
// Topic × Interaction reply bank for both new and existing installations.
export const INTERACTION_SETTING_KEY = 'emma_interaction_experimental';
export function isInteractionEnabled(storage) {
  return storage.getItem(INTERACTION_SETTING_KEY) !== 'false';
}
