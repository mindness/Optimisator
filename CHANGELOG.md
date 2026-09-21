# Changelog

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [0.1.0] - 2026-09-21

### Ajouté
- Refonte UI « Cabinet en ligne » : montants éditables sur le canvas, tuiles KPI avec écart, lexique, synthèse.
- Pages légales `/legal` (mentions, CGU, confidentialité) et date de vérification des barèmes en pied de page.
- En-têtes de sécurité (`public/_headers`, CSP sans script inline).
- Suivi d'erreurs Sentry et audience Plausible, optionnels, sans fuite du scénario (hash d'URL retiré).
- Test E2E Playwright sur le build de prod ; CI étendue au backend et à l'E2E.
- Garde-fou de fraîcheur des barèmes (400 jours).
