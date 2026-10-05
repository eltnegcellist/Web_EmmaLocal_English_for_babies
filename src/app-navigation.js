export const APP_HISTORY_KEY = 'mitsukotobaScreen';

const APP_SCREENS = new Set(['onboarding','home','settings','about']);

export function appHistoryState(screen) {
  return { [APP_HISTORY_KEY]: screen };
}

export function resolveAppPopScreen(currentScreen, previousScreen, state) {
  const stateScreen = state?.[APP_HISTORY_KEY];
  if (APP_SCREENS.has(stateScreen)) return stateScreen;
  if (currentScreen === 'about' && APP_SCREENS.has(previousScreen)) return previousScreen;
  if (currentScreen === 'settings') return 'home';
  return null;
}

export function shouldUseBrowserBack(currentScreen, state) {
  return state?.[APP_HISTORY_KEY] === currentScreen;
}
