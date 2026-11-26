// Notification copy is configurable; delivery audience and destinations remain
// owned by each existing sender. Variables are expanded as plain text only.
export const NOTIFICATION_TYPES = Object.freeze({
  video: ['Video', '{contentTitle}'],
  article: ['{contentTitle}', 'A new article is available.'],
  summary: ['{contentTitle}', 'A new summary is available.'],
  quiz: ['Quiz', '{contentTitle}'],
  learning: ['{contentType}', '{contentTitle}'],
  prayerMorning: ['{group} group prayer today', 'Your group is scheduled to pray today. Open the calendar for your local time.'],
  prayerToday: ['{group} prayer reminder', 'Your group is scheduled to pray today. Open the calendar for your local time.'],
  prayerStarting: ['{group} prayer reminder', 'Your group prayer begins in 30 minutes. Open the calendar for your local time.'],
  prayerWeek: ['{group} owns the coming prayer week', 'Your group owns next week and prays on Sunday and Tuesday. Open the calendar to see your local times.'],
  service: ['Service begins in 30 minutes', '{serviceTitle}. Open the calendar for your local time.'],
  communion: ['Communion service today', 'We shall eat and drink of the body and blood of our LORD today. God God bless us greatly'],
  streamReport: ['{reportTitle}', '{reportBody}']
});
const KEYS = new Set(['contentTitle', 'contentType', 'group', 'serviceTitle', 'reportTitle', 'reportBody']);
const variable = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
export function validateNotificationTemplate(input) {
  if (!input || typeof input !== 'object') throw Error('Notification text is required.');
  const result = {};
  for (const [field, max] of [['title', 100], ['body', 300]]) {
    const value = typeof input[field] === 'string' ? input[field].trim() : '';
    if (!value || value.length > max) throw Error(`Enter ${field} text of at most ${max} characters.`);
    for (const match of value.matchAll(variable)) if (!KEYS.has(match[1])) throw Error(`Unknown variable: ${match[1]}`);
    result[field] = value;
  }
  const image = typeof input.image === 'string' ? input.image.trim() : '';
  if (image) {
    let url; try { url = new URL(image); } catch { throw Error('Enter a valid HTTPS image link.'); }
    if (url.protocol !== 'https:' || url.username || url.password || image.length > 2048) throw Error('Enter a valid HTTPS image link.');
  }
  result.image = image;
  return result;
}
export function renderNotificationTemplate(type, custom, values = {}) {
  const defaults = NOTIFICATION_TYPES[type];
  if (!defaults) throw Error('Unknown notification type.');
  const template = custom ? validateNotificationTemplate(custom) : {title: defaults[0], body: defaults[1], image: ''};
  const expand = text => text.replace(variable, (_, key) => String(values[key] ?? '').trim());
  return {title: expand(template.title), body: expand(template.body), image: template.image};
}

// Missing settings preserve the sender's current copy and image exactly.
export async function configuredNotification(db,type,original,values={}) {
 const snapshot=await db.doc('churchStudioPublications/notification-center/settings/current').get();
 const custom=snapshot.data()?.templates?.[type];
 if(!custom)return original;
 const rendered=renderNotificationTemplate(type,custom,values);
 if(!rendered.title||!rendered.body)throw Error('Notification template has missing information.');
 return {...original,title:rendered.title,body:rendered.body,...(rendered.image?{image:rendered.image}:{})};
}
