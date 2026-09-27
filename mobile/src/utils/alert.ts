import { Alert as RNAlert, Platform } from 'react-native';
import { tr } from '../i18n/t';
import type { AlertButton } from 'react-native';

// react-native-web ships Alert.alert as an empty function, so every confirm dialog in the app
// silently did nothing in the browser (Block, Unblock, Close chat, Revoke Wali...). This shim
// keeps the native Alert on iOS/Android and uses the browser's own dialogs on web.
function webAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  const cancel = list.find((b) => b.style === 'cancel');
  const actions = list.filter((b) => b.style !== 'cancel');

  if (actions.length === 0) {
    window.alert(text);
    cancel?.onPress?.();
    return;
  }

  if (actions.length === 1) {
    if (cancel || list.length > 1) {
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel?.onPress?.();
    } else {
      window.alert(text);
      actions[0].onPress?.();
    }
    return;
  }

  // Several choices: ask for each one in turn until the person picks one.
  for (const action of actions) {
    if (window.confirm(`${text}\n\n${action.text}?`)) {
      action.onPress?.();
      return;
    }
  }
  cancel?.onPress?.();
}

export const Alert = {
  alert(rawTitle: string, rawMessage?: string, rawButtons?: AlertButton[]) {
    const title = tr(rawTitle);
    const message = rawMessage ? tr(rawMessage) : rawMessage;
    const buttons = rawButtons?.map((b) => ({ ...b, text: b.text ? tr(b.text) : b.text }));
    if (Platform.OS === 'web') {
      webAlert(title, message, buttons);
      return;
    }
    RNAlert.alert(title, message, buttons);
  },
};
