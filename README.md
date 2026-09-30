# Yekigai — POC

Yekigai est un mini-jeu de 10 à 15 minutes pour les entretiens Product, construit autour des 4 dimensions de l'Ikigai.

## Lancer le projet

Prérequis : Node.js 22 recommandé.

```bash
npm install
npm run dev
```

Vite affiche ensuite l'URL locale à ouvrir dans le navigateur, généralement `http://localhost:5173`.

## Build de production

```bash
npm run build
```

Le build est généré dans `dist/`. Ce dossier est ignoré par Git et n'a pas à être commité.

Pour vérifier le build localement :

```bash
npm run preview
```

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` est inclus.

1. Créer un repository GitHub.
2. Pousser **les sources du projet** sur la branche `main`.
3. Dans `Settings → Pages`, sélectionner **GitHub Actions** comme source.
4. À chaque push sur `main`, GitHub Actions exécute `npm install`, `npm run build`, puis publie automatiquement le contenu de `dist/`.

`dist/` reste dans `.gitignore` : il n'est jamais à pousser manuellement.

Le `base: './'` de Vite permet au build de fonctionner sur une URL GitHub Pages de type `https://utilisateur.github.io/nom-du-repo/` sans modifier le nom du repo dans le code.

## Règles du jeu

1. **Pioche** — 3 cartes sont tirées aléatoirement dans chacun des 4 decks de 12 cartes.
2. **Choix** — le candidat sélectionne 1 carte par dimension et explique ses choix au recruteur.
3. **Plateau** — les 4 cartes choisies prennent place dans le plateau Ikigai.
4. **Intersections** — le candidat choisit :
   - l'intersection qui lui ressemble le plus aujourd'hui ;
   - une autre intersection qu'il aimerait davantage développer.
5. **Questions** — pour chaque intersection choisie, une question est tirée au hasard parmi plusieurs questions propres à cette intersection et au type de choix (`today` ou `develop`).
6. **Discussion** — les deux questions servent de support à l'échange candidat / recruteur.
7. **5e carte** — le candidat choisit une amorce de phrase parmi plusieurs propositions puis la complète lui-même.
8. **Centre** — cette phrase devient sa 5e carte, au centre du plateau.
9. **À emporter** — le bouton de génération crée et télécharge une image PNG de la 5e carte.

Il n'y a **ni score, ni matching avec le poste, ni bonne ou mauvaise réponse**.

## Données éditables

Tout le contenu du jeu est dans `public/data/` :

- `config.json` — textes d'interface, règles et paramètres du jeu ;
- `decks.json` — 4 decks × 12 cartes ;
- `intersections.json` — 4 intersections et leurs banques de questions ;
- `final-card-prompts.json` — amorces de phrases pour la 5e carte.

Le contenu peut donc évoluer sans modifier la logique dans `src/app.js`.
