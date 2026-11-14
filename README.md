# Turbo Bolides

Jeu de course de karts en 3D pour Android : 6 pilotes, dérapages avec mini-turbo, plaques d'accélération et 4 objets (Turbo, Flaque d'huile, Missile, Bouclier).

## Modes

- **Solo** contre 5 bots, ou **entre amis** en ligne (jusqu'à 6 joueurs) avec un code d'invitation de 5 caractères. Les places libres peuvent être complétées par des bots.
- **Course** (2, 3 ou 5 tours), **Bataille** (3 cœurs, dernier en piste), **Patate chaude** (une bombe passe de kart en kart au contact).
- Options : sens inverse, objets en folie, niveau des bots.
- **Classement** : points par manche (10, 7, 5, 3, 2, 1), classement de la soirée, classement « entre amis » cumulé et records personnels (enregistrés sur l'appareil).

## Jeu en ligne

Connexion pair-à-pair (WebRTC via PeerJS) : le téléphone de l'hôte fait office de serveur, aucun serveur à héberger. La mise en relation passe par le service public gratuit PeerJS (0.peerjs.com). Sur certains réseaux mobiles très restrictifs, la connexion directe peut échouer ; en Wi-Fi ou en 4G classique, ça passe en général.

- `src/game.html` : tout le jeu (three.js r128, aucun autre moteur).
- `build.js` : génère `www/` (page autonome, three.js et PeerJS embarqués).
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
