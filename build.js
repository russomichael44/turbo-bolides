// Construit www/index.html (page autonome, three.js embarqué localement pour jouer hors ligne)
const fs = require('fs');
const path = require('path');
const www = path.join(__dirname, 'www');
fs.mkdirSync(www, { recursive: true });
let game = fs.readFileSync(path.join(__dirname, 'src/game.html'), 'utf8');
game = game.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'three.min.js')
  .replace('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'peerjs.min.js');
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0b1622">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Turbo Bolides">
${game.split('<div id="stage">')[0]}
</head>
<body>
<div id="stage">${game.split('<div id="stage">')[1]}
</body>
</html>
`;
fs.writeFileSync(path.join(www, 'index.html'), html);
fs.copyFileSync(path.join(__dirname, 'node_modules/three/build/three.min.js'), path.join(www, 'three.min.js'));
fs.copyFileSync(path.join(__dirname, 'node_modules/peerjs/dist/peerjs.min.js'), path.join(www, 'peerjs.min.js'));
for (const f of ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(__dirname, 'assets', f), path.join(www, f));
console.log('www/ prêt');

// Bolide Rush : jeu d'arcade 2D, servi sur /rush/
const rush = fs.readFileSync(path.join(__dirname, 'src/rush.html'), 'utf8');
fs.mkdirSync(path.join(www, 'rush'), { recursive: true });
fs.writeFileSync(path.join(www, 'rush', 'index.html'), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#12141b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${rush}
</body>
</html>
`);
console.log('www/rush/ prêt');
