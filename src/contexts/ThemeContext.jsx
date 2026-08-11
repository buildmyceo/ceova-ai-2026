import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [themePref, setThemePref] = useState('dark');
    const [resolvedTheme, setResolvedTheme] = useState('dark');

    useEffect(() => {
        document.body.className = 'theme-dark';
    }, []);

    return (
        <ThemeContext.Provider value={{ themePref: 'dark', setThemePref: () => {}, resolvedTheme: 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
