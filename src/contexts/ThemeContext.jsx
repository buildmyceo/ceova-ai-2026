import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = 'ceova_theme_pref';

const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
};

export const ThemeProvider = ({ children }) => {
    // Preference can be 'system', 'dark', or 'light'
    const [themePref, setThemePrefState] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'system' || saved === 'dark' || saved === 'light') {
                return saved;
            }
        }
        return 'system';
    });

    const [resolvedTheme, setResolvedTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'dark' || saved === 'light') {
                return saved;
            }
        }
        return getSystemTheme();
    });

    // Update resolvedTheme when themePref changes or when system preference changes
    useEffect(() => {
        const updateTheme = () => {
            const currentSystem = getSystemTheme();
            const targetTheme = themePref === 'system' ? currentSystem : themePref;
            setResolvedTheme(targetTheme);

            const root = document.documentElement;
            const body = document.body;

            root.classList.remove('theme-dark', 'theme-light');
            root.classList.add(`theme-${targetTheme}`);
            root.setAttribute('data-theme', targetTheme);
            root.style.colorScheme = targetTheme;

            body.classList.remove('theme-dark', 'theme-light');
            body.classList.add(`theme-${targetTheme}`);
            body.setAttribute('data-theme', targetTheme);
        };

        updateTheme();

        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemChange = () => {
            if (themePref === 'system') {
                updateTheme();
            }
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleSystemChange);
            return () => mediaQuery.removeEventListener('change', handleSystemChange);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handleSystemChange);
            return () => mediaQuery.removeListener(handleSystemChange);
        }
    }, [themePref]);

    const setThemePref = useCallback((pref) => {
        setThemePrefState(pref);
        if (typeof window !== 'undefined') {
            localStorage.setItem(THEME_STORAGE_KEY, pref);
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setThemePrefState((prev) => {
            const current = prev === 'system' ? getSystemTheme() : prev;
            const next = current === 'dark' ? 'light' : 'dark';
            if (typeof window !== 'undefined') {
                localStorage.setItem(THEME_STORAGE_KEY, next);
            }
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ 
            themePref, 
            setThemePref, 
            resolvedTheme, 
            toggleTheme, 
            isSystemTheme: themePref === 'system' 
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
