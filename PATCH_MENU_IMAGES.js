/**
 * PATCH_MENU_IMAGES.js
 * Run this in your browser console (while logged in as Admin) to fix all
 * broken/mismatched image URLs in the Firestore menu collection.
 * 
 * HOW TO USE:
 * 1. Open the app in browser and log in as Admin
 * 2. Open DevTools Console (F12)
 * 3. Paste the entire script below and press Enter
 */

const IMAGE_PATCH = {
  // Beverages
  'BEV03': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/640px-A_small_cup_of_coffee.JPG',
  'BEV04': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Badam_Milk.jpg/640px-Badam_Milk.jpg',
  'BEV05': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/640px-A_small_cup_of_coffee.JPG',
  'BEV06': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Lassi_and_Lemonade.png/640px-Lassi_and_Lemonade.png',
  // Breakfast
  'BKT04': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Set_dosa_with_chutney_and_sambar.jpg/640px-Set_dosa_with_chutney_and_sambar.jpg',
  'BKT05': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Lemon_rice.jpg/640px-Lemon_rice.jpg',
  'BKT06': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Dosa_with_chutney.jpg/640px-Dosa_with_chutney.jpg',
  // Snacks
  'SNK01': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Pakora.jpg/640px-Pakora.jpg',
  'SNK02': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Mirchi_bajji.jpg/640px-Mirchi_bajji.jpg',
  // Lunch
  'LCH02': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Egg_fried_rice.jpg/640px-Egg_fried_rice.jpg',
  'LCH03': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Jeera_Rice.jpg/640px-Jeera_Rice.jpg',
  'LCH04': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Egg_bhurji.jpg/640px-Egg_bhurji.jpg',
  'LCH05': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Omelette_kerala_style.jpg/640px-Omelette_kerala_style.jpg',
};

// Access Firestore from the window (exposed by Firebase)
const { getFirestore, collection, getDocs, doc, updateDoc } = window._firebaseSDK || {};

(async () => {
  try {
    const db = getFirestore();
    const snap = await getDocs(collection(db, 'menu'));
    let patched = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const newUrl = IMAGE_PATCH[data.id];
      if (newUrl) {
        await updateDoc(doc(db, 'menu', docSnap.id), { imageUrl: newUrl });
        console.log(`✅ Patched ${data.id} (${data.name})`);
        patched++;
      }
    }
    console.log(`\n🎉 Done! Patched ${patched} menu items.`);
  } catch (err) {
    console.error('❌ Error:', err);
    console.log('Try running the seed from Admin panel instead.');
  }
})();
