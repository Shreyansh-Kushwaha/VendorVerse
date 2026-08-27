// Applies the saved or preferred theme before React mounts, so there is no
// flash of the wrong palette. Kept as a file rather than an inline script so
// the Content-Security-Policy does not need script-src 'unsafe-inline'.
(function () {
  try {
    var saved = localStorage.getItem('vv_theme');
    var dark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
