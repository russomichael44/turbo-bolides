// Force le mode paysage et le plein écran sur l'activité principale
const fs = require('fs');
const f = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(f, 'utf8');
if (!x.includes('screenOrientation')) {
  x = x.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"');
}
fs.writeFileSync(f, x);
const s = 'android/app/src/main/res/values/styles.xml';
if (fs.existsSync(s)) {
  let y = fs.readFileSync(s, 'utf8');
  y = y.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowFullscreen">true</item>');
  fs.writeFileSync(s, y);
}
console.log('AndroidManifest : paysage + plein écran');
