# Turbo Bolides

Jeu de course de karts en 3D pour Android : 6 pilotes, 3 tours, dérapages avec mini-turbo, plaques d'accélération et 4 objets (Turbo, Flaque d'huile, Missile, Bouclier).

- `src/game.html` : tout le jeu (three.js r128, aucun autre moteur).
- `build.js` : génère `www/` (page autonome, three.js embarqué → jouable hors ligne).
- `android/` : projet Android natif (Capacitor 6), forcé en paysage et plein écran.

## Obtenir l'APK sans rien installer (GitHub Actions)

1. Pousse ce dossier dans un dépôt GitHub.
2. Onglet **Actions** → « Construire l'APK Android » se lance tout seul.
3. Télécharge l'artefact `turbo-bolides-apk`, dézippe, copie `app-debug.apk` sur le téléphone et installe-le (autoriser « sources inconnues »).

## Construire sur ton PC

Prérequis : Node 20+, JDK 17, Android Studio (SDK Android).

```bash
npm install
npm run apk
```

L'APK sort dans `android/app/build/outputs/apk/debug/app-debug.apk`.
Pour tester sur un téléphone branché en USB : `npx cap run android`, ou ouvre le projet avec `npx cap open android`.

Après chaque modification de `src/game.html` : `npm run android:sync`.

## Publier sur le Play Store

Dans Android Studio : *Build → Generate Signed App Bundle* (fichier `.aab`), puis envoie-le dans la Play Console. Change d'abord l'`appId` dans `capacitor.config.json` si besoin (il ne peut plus changer après publication).
