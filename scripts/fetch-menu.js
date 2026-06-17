import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.firestore().collection('menu').get().then(s => {
    console.log(s.docs.map(d=>d.data().name).join(', '));
}).catch(console.error).finally(() => process.exit());
