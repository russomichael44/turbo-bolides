# Turbo Bolides

Jeu de course de karts en 3D pour Android : 6 pilotes, dérapages avec mini-turbo, plaques d'accélération et 4 objets (Turbo, Flaque d'huile, Missile, Bouclier).

## Modes

- **Solo** contre des bots, ou **entre amis** en ligne (jusqu'à 6 joueurs) avec un code d'invitation de 5 caractères. Dans le salon, l'hôte ajoute ou retire chaque bot (bouton ×).
- **Course** (2, 3 ou 5 tours), **Bataille** (3 cœurs, dernier en piste), **Ballons** (dans l'arène : 3 ballons, on vole un ballon en frôlant un kart plus lent, un objet reçu en fait éclater un), **Patate chaude** (une bombe passe de kart en kart au contact).
- **Dérapage** : maintenir le bouton Dérapage (ou Espace) en tournant, puis relâcher pour le mini-turbo.
- **Grand Prix** : championnat de 4 courses avec points (15, 12, 10, 8, 6, 4), 4 coupes (Forêt, Désert, Glace, Éclair) et 3 niveaux de bots. Podium final, bonus de crédits et trophée par coupe et par niveau.
- **Contre-la-montre** (solo) : seul sur la piste, tours illimités (on termine par le menu pause). Dès le 2e tour, un fantôme rejoue ton meilleur tour, et il se met à jour dès que tu le bats. Record par circuit ; le fantôme est enregistré sur l'appareil.
- **9 objets** : Turbo, Triple turbo (3 charges), Étoile filante (7 s d'invincibilité, plus rapide, fait tourner les karts touchés), Fumigène (encre sur l'écran des karts derrière), Flaque d'huile, Missile, Bouclier, Peaux de banane (3 à poser), Éclair (fait rétrécir et ralentit tous les autres).
- **6 personnages** (Flash le renard, Boulon le robot, Gloups la grenouille, Bambou le panda, Glaçon le pingouin, Zorb l'extraterrestre) en 3 catégories de poids, et **4 karts** (Classique, Fusée, Buggy, Bolide). Chaque combinaison change la vitesse, l'accélération, la maniabilité et le tout-terrain. Le pseudo du joueur reste affiché pendant la course.
- **4 circuits** : Circuit des Pins (forêt), Canyon Rouge (désert), Station Givrée (neige), Baie des Palmiers (plage).
- Options : sens inverse, objets en folie, niveau des bots.
- Musique de fond et effets sonores, chacun désactivable (accueil ou boutons en haut à droite pendant la course).
- **Boutique** : chaque manche rapporte des crédits selon la place (100, 75, 55, 40, 30, 20 ; ×0,7 à ×1,4 selon le niveau des bots en solo, ×1,2 en ligne). Ils servent à acheter 7 boosters (Départ canon, Bouclier de départ, Poche pleine, Moteur gonflé, Trèfle, Pneus slick, Prime ×2), à équiper dans le salon (2 max) et consommés au départ de la manche. Crédits et boosters sont enregistrés sur l'appareil.
- **Comptes** : connexion par e-mail et mot de passe, avec code de secours en cas d'oubli. Pseudo, personnage, kart, crédits, boosters et records sont sauvegardés en ligne et retrouvés sur tous les appareils. Le serveur est une fonction Netlify (`netlify/functions/api.mjs`, logique dans `netlify/lib/accounts.mjs`) qui stocke les comptes dans Netlify Blobs. Mots de passe chiffrés (scrypt), jamais en clair. Connexion Google possible : sur le site, bouton Google officiel ; dans l'app Android, connexion dans le navigateur du téléphone puis retour dans l'app par le lien `turbobolides://auth` (code à usage unique, 3 min, lié à un secret de l'app). Nécessite la variable d'environnement Netlify `GOOGLE_CLIENT_ID`.
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

## iPhone

Ouvrir https://turbo-bolides.netlify.app dans Safari, bouton Partager, puis **Sur l'écran d'accueil**. Le jeu s'ouvre alors en plein écran comme une app, avec son icône.
