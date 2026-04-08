import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

async function auditStaffRoles() {
  console.log('🔍 Auditing staff roles based on email patterns...');
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  
  let fixedCount = 0;
  
  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    const email = data.email || '';
    const currentRole = data.role;
    
    if (!email) continue;
    
    const emailLower = email.toLowerCase();
    let correctRole = null;
    
    if (emailLower.endsWith('@joecafe.com') || emailLower.endsWith('@joe.com')) {
      if (emailLower.startsWith('admin@'))   correctRole = 'ADMIN';
      else if (emailLower.startsWith('cashier@')) correctRole = 'CASHIER';
      else if (emailLower.startsWith('server@'))  correctRole = 'SERVER';
      else if (emailLower.startsWith('cook@'))    correctRole = 'COOK';
      else if (emailLower.startsWith('staff@'))   correctRole = 'SERVER';
    }
    
    if (correctRole && currentRole !== correctRole) {
      console.log(`✅ Fixing role for ${email}: ${currentRole} -> ${correctRole}`);
      await updateDoc(doc(db, 'users', userDoc.id), { role: correctRole });
      fixedCount++;
    }
  }
  
  console.log(`📊 Audit complete. Fixed ${fixedCount} users.`);
}

auditStaffRoles().catch(console.error);
