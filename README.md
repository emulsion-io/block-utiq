# block-utiq

Extension Chrome et Firefox qui redirige les sites listes dans `block.json` vers une page
d'information indiquant que le domaine est repertorie comme utilisant Utiq.

## Structure

- `block.json` contient la liste embarquée par défaut des domaines à rediriger.
- `extension.config.json` centralise les métadonnées communes des manifests.
- `src/background/service-worker.js` met à jour la liste depuis GitHub toutes les 24h et redirige les domaines bloqués.
- `src/blocked/` contient la page HTML affichée à l'utilisateur.
- `scripts/build-extension.mjs` génère les extensions Chrome et Firefox.
- `scripts/package-extension.mjs` crée les archives ZIP à publier.
- `scripts/update-block-list.mjs` remplace `block.json` depuis un export Utiq au format `sites[].domain`.
- `dist/` contient les extensions générées et les archives ZIP prêtes à soumettre aux stores.

## Commandes

Installer les dépendances :

```bash
npm install
```

Générer les extensions non compressées :

```bash
npm run build
```

Créer les archives ZIP :

```bash
npm run package
```

Ou, pour repartir de zéro et produire les deux archives :

```bash
npm run dist
```

Les extensions non compressées sont générées dans :

- `dist/chrome`
- `dist/firefox`

Les archives prêtes à soumettre aux stores sont générées dans :

- `dist/packages/block-utiq-chrome.zip`
- `dist/packages/block-utiq-firefox.zip`

## Tester localement

### Chrome

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Cliquer sur `Load unpacked`.
4. Sélectionner `dist/chrome`.

### Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur `Charger un module complémentaire temporaire`.
3. Sélectionner `dist/firefox/manifest.json`.

## Modifier la liste de blocage

La liste embarquée dans l'extension vient de `block.json`. Une fois installée, l'extension met ensuite son cache à jour toutes les 24h depuis :

La source de blocage actuelle est https://utiq-tracker.online/

`https://github.com/emulsion-io/block-utiq/blob/main/block.json`

Pour changer la liste embarquée, éditez `block.json`, puis relancez :

```bash
npm run dist
```

Pour régénérer rapidement `block.json` depuis un fichier source Utiq :

```bash
npm run update:blocklist -- "/utiq-sites.json"
```

Le script lit `sites[].domain`, supprime les doublons et remplace `block.json`.
