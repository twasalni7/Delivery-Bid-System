import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "tw_theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark", "creamy");
  // Always force light mode
  root.classList.add("light");
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always use light theme
  const [theme] = useState<Theme>("light");

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, "light"); } catch {}
  }, [theme]);

  // setTheme does nothing, theme is always light
  const setTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
