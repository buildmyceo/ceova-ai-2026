import { Capacitor } from '@capacitor/core';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
import { LocalNotifications } from '@capacitor/local-notifications';

let isBackgroundInitialized = false;

/**
 * Requests Notification permission (Android 13+ POST_NOTIFICATIONS)
 */
export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      } catch (e) {
        console.warn('[Notification] Web permission error:', e);
        return false;
      }
    }
    return Notification.permission === 'granted';
  }

  try {
    const status = await LocalNotifications.requestPermissions();
    console.log('[Notification] Permission status:', status);
    return status.display === 'granted';
  } catch (err) {
    console.warn('[Notification] Failed to request permissions:', err);
    try {
      const bgStatus = await BackgroundMode.requestNotificationsPermission();
      return bgStatus.notifications === 'granted';
    } catch (e) {
      console.warn('[Notification] Fallback error:', e);
      return false;
    }
  }
}

/**
 * Initializes Background Mode:
 * 1. Enables background execution so Android doesn't kill the app
 * 2. Disables WebView throttling so timers, network & Supabase stay active
 * 3. Requests notification permission
 * 4. Requests battery optimization exemption
 */
export async function initBackgroundService() {
  if (isBackgroundInitialized || !Capacitor.isNativePlatform()) return;
  isBackgroundInitialized = true;

  try {
    console.log('[BackgroundService] Initializing background execution...');

    // 1. Request notification permission first
    const hasNotificationPerm = await requestNotificationPermission();
    console.log('[BackgroundService] Notification permission granted:', hasNotificationPerm);

    // 2. Configure background service notification
    await BackgroundMode.setSettings({
      title: 'CEOVA AI',
      text: 'CEOVA is running in the background',
      subText: 'Active',
      color: '#0f172a',
      silent: true,
      hidden: false,
      channelName: 'CEOVA Background Service',
      channelDescription: 'Keeps CEOVA AI active and listening in background',
      allowClose: false
    });

    // 3. Enable background execution
    await BackgroundMode.enable();

    // 4. Disable webview throttling so JS execution continues in background
    await BackgroundMode.disableWebViewOptimizations();

    // 5. Check and request battery optimization exemption (so OS doesn't freeze the process)
    try {
      const batteryStatus = await BackgroundMode.checkBatteryOptimizations();
      if (batteryStatus && batteryStatus.enabled) {
        console.log('[BackgroundService] Requesting disable battery optimizations...');
        await BackgroundMode.requestDisableBatteryOptimizations();
      }
    } catch (batErr) {
      console.warn('[BackgroundService] Battery optimization request notice:', batErr);
    }

    console.log('[BackgroundService] Background mode successfully enabled and active.');
  } catch (err) {
    console.error('[BackgroundService] Failed to initialize background mode:', err);
  }
}

/**
 * Send a local push notification to the user
 */
export async function sendLocalNotification(title, body, id = Date.now() % 100000) {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title || 'CEOVA AI',
            body: body || '',
            id: Number(id),
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'beep.wav',
            smallIcon: 'ic_launcher'
          }
        ]
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title || 'CEOVA AI', { body });
    }
  } catch (err) {
    console.warn('[Notification] Failed to send notification:', err);
  }
}
