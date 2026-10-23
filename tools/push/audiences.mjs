// Trust server-owned device bindings and membership records, never subscriber-supplied roles.
export async function memberDeviceIds(db, auth, docs) {
  const bindings = [];
  for (let i = 0; i < docs.length; i += 100) {
    const group = docs.slice(i, i + 100);
    const records = await db.getAll(...group.map(doc => db.doc('churchDevices/' + doc.id)));
    records.forEach((record, index) => { if (record.data()?.memberUid) bindings.push({ device: group[index].id, uid: record.data().memberUid }); });
  }
  const ids = [...new Set(bindings.map(binding => binding.uid))], allowed = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100);
    const [memberships, accounts] = await Promise.all([db.getAll(...group.map(id => db.doc('churchMembers/' + id))), auth.getUsers(group.map(uid => ({ uid })))]);
    const verified = new Set(accounts.users.filter(user => user.emailVerified && !user.disabled).map(user => user.uid));
    memberships.forEach((record, index) => { if (record.data()?.active === true && verified.has(group[index])) allowed.add(group[index]); });
  }
  return new Set(bindings.filter(binding => allowed.has(binding.uid)).map(binding => binding.device));
}
export function recipients(docs, audience, approvedDevices) {
  return [...new Map(docs.filter(doc => (audience !== 'members' || approvedDevices.has(doc.id)) && typeof doc.data().token === 'string' && doc.data().token).map(doc => [doc.data().token, doc])).values()];
}
