export const THEME_STORAGE_KEY = "papercut-theme";
export const CONTRAST_STORAGE_KEY = "papercut-contrast";
export const TEXT_SIZE_STORAGE_KEY = "papercut-text-size";

export type ThemePreference = "light" | "dark" | "system";

/** Inline, dependency-free script run in <head> before paint. Keep it tiny. */
export const themeBootstrapScript = `(function(){try{
var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";
var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
var c=document.documentElement.classList;c.toggle("dark",d);
if(localStorage.getItem("${CONTRAST_STORAGE_KEY}")==="high")c.add("hc");
if(localStorage.getItem("${TEXT_SIZE_STORAGE_KEY}")==="large")c.add("text-large");
}catch(e){}})();`;
