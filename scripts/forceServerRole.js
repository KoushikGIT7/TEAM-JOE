/**
 * FORCE SERVER ROLE
 * Paste this into your browser console while logged in as an ADMIN
 */
(async function forceRole() {
  const targetUid = 'ynjyfchVjsM78C66tkTAYkVJuXT2';
  const targetRole = 'SERVER';
  
  console.log(`🚀 Forcing role ${targetRole} for UID: ${targetUid}...`);
  
  try {
    const { db } = await import('./src/firebase.js').catch(() => import('./firebase.js'));
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    
    await setDoc(doc(db, 'users', targetUid), {
      role: targetRole,
      active: true,
      lastActive: serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Successfully forced role to SERVER.');
    console.log('The user should now be able to login to the Kitchen Portal.');
  } catch (error) {
    console.error('❌ Failed to force role:', error);
  }
})();
