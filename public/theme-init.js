// Hors bundle et sans inline : appliqué avant le premier rendu, compatible CSP script-src 'self'.
(function () {
  try {
    var stored = localStorage.getItem('simulateur-flux-theme');
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {
    /* light by default */
  }
})();
