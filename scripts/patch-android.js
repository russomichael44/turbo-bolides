// Force le mode paysage et le plein écran sur l'activité principale
const fs = require('fs');
const f = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(f, 'utf8');
if (!x.includes('screenOrientation')) {
  x = x.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"');
}
// Lien de retour après la connexion Google (turbobolides://auth?code=...)
if (!x.includes('android:scheme="turbobolides"')) {
  x = x.replace(/(<activity[\s\S]*?<\/intent-filter>)/, `$1
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="turbobolides" android:host="auth" />
            </intent-filter>`);
}
fs.writeFileSync(f, x);
const s = 'android/app/src/main/res/values/styles.xml';
if (fs.existsSync(s)) {
  let y = fs.readFileSync(s, 'utf8');
  y = y.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowFullscreen">true</item>');
  fs.writeFileSync(s, y);
}
console.log('AndroidManifest : paysage + plein écran');
