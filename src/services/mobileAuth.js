import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase';
import APP_CONFIG from '../config/appConfig';

export const GOOGLE_WEB_CLIENT_ID = '3081503011-qknrte2ckcc0rnccol4ms0h6l6u1rh27.apps.googleusercontent.com';

let isSocialLoginInitialized = false;

/**
 * Pre-warms Android Credential Manager / SocialLogin plugin
 */
export const initSocialLogin = async () => {
  if (isSocialLoginInitialized || !Capacitor.isNativePlatform()) return;
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        mode: 'online'
      }
    });
    isSocialLoginInitialized = true;
    console.log('[MobileAuth] Native Google SocialLogin initialized with Credential Manager');
  } catch (err) {
    console.warn('[MobileAuth] SocialLogin initialization notice:', err);
  }
};

/**
 * Checks if the current runtime is a native desktop or mobile container
 */
export const isNativePlatform = () => {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window !== 'undefined' && (
    window.__TAURI__ !== undefined ||
    window.__TAURI_INTERNALS__ !== undefined
  )) {
    return true;
  }
  return false;
};

/**
 * Unified Google Sign-in:
 * 1. Native Android Google Play Services / Credential Manager (Zero Web Browser, 100% In-App)
 * 2. In-App Chrome Custom Tab with deep linking fallback (ceova://auth/callback)
 * 3. Desktop (Tauri) and Web fallbacks
 */
export const initiateGoogleSignIn = async () => {
  const isCapacitor = Capacitor.isNativePlatform();
  const isTauri = typeof window !== 'undefined' && (
    window.__TAURI__ !== undefined ||
    window.__TAURI_INTERNALS__ !== undefined
  );

  if (isCapacitor) {
    console.log('[MobileAuth] Attempting Native In-App Google Sign-In (Credential Manager)...');
    try {
      await initSocialLogin();
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      const res = await SocialLogin.login({
        provider: 'google',
        options: {
          style: 'bottom'
        }
      });

      console.log('[MobileAuth] Native Google login response received:', res);
      const googleResult = res?.result;
      const idToken = googleResult?.idToken;
      const accessToken = googleResult?.accessToken?.token;

      if (idToken) {
        console.log('[MobileAuth] Signing into Supabase with Google ID token...');
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          access_token: accessToken || undefined
        });

        if (sessionError) {
          console.error('[MobileAuth] Supabase signInWithIdToken error:', sessionError);
          throw sessionError;
        }

        console.log('[MobileAuth] In-App Native Google Sign-In completed successfully!');
        return { type: 'signed_in', session: sessionData.session };
      }
    } catch (nativeErr) {
      console.warn('[MobileAuth] Native Google login error:', nativeErr);

      const rawMsg = (nativeErr?.message || '').toString();
      const rawCode = (nativeErr?.code || '').toString();
      const combined = `${rawMsg} ${rawCode}`.toLowerCase();

      // Differentiate genuine user cancellation from authentication/reauth/configuration failures.
      // E.g., "[16] Account reauth failed" contains "16", but is an auth failure, NOT a user cancellation.
      const isAuthFailure = combined.includes('reauth') || 
                            combined.includes('fail') || 
                            combined.includes('developer console') || 
                            combined.includes('misconfiguration') || 
                            combined.includes('error');

      const isExplicitCancel = !isAuthFailure && (
        combined.includes('user_cancelled') ||
        combined.includes('user canceled') ||
        combined.includes('user cancelled') ||
        combined.includes('canceled by user') ||
        combined.includes('cancelled by user') ||
        combined.includes('the user canceled') ||
        combined.includes('the user cancelled') ||
        rawCode === 'USER_CANCELLED'
      );

      if (isExplicitCancel) {
        console.log('[MobileAuth] User cancelled Google account selection.');
        return { type: 'cancelled' };
      }

      console.log('[MobileAuth] Native login failed; falling back to In-App Chrome Custom Tab OAuth...');
    }

    // Fallback: In-App Chrome Custom Tab OAuth with deep link return
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'ceova://auth/callback',
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
      }
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No OAuth URL returned from Supabase');

    console.log('[MobileAuth] Opening OAuth in Chrome Custom Tab:', data.url);
    await Browser.open({ url: data.url, windowName: '_self' });
    return { type: 'browser_opened' };
  } 
  
  if (isTauri && !import.meta.env.DEV) {
    console.log('[MobileAuth] Using Tauri desktop OAuth flow');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'ceova://auth/callback',
        skipBrowserRedirect: true
      }
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No OAuth URL returned from Supabase');

    const { open } = await import('@tauri-apps/plugin-shell');
    await open(data.url);
    return { type: 'browser_opened' };
  }

  // Web Fallback
  console.log('[MobileAuth] Using Web OAuth flow');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: APP_CONFIG.getRedirectUrl('/auth/callback')
    }
  });

  if (error) throw error;
  return { type: 'redirecting' };
};
