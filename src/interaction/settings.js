// Interaction is enabled for new users, and an explicit opt-out persists.
// Do not use getItem(...) === 'true', since that silently disables first-time users.
export const INTERACTION_PREFERENCE_KEY = 'emma_interaction_experimental';
export function interactionEnabled(storage) {
  return storage.getItem(INTERACTION_PREFERENCE_KEY) !== 'false';
}
