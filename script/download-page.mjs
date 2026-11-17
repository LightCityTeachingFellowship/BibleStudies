const section=document.getElementById('download-member'),link=document.getElementById('member-app-link');
function render(){const api=globalThis.LightCityMembers;section.hidden=!(api?.user&&!api.user.isAnonymous&&Array.isArray(api.library));}
if(/Android/i.test(navigator.userAgent)){link.href='intent://lightcityfellowship.com/app-access/#Intent;scheme=https;package=com.lightcityfellowship.mobilepilot;S.browser_fallback_url='+encodeURIComponent('https://lightcityfellowship.com/app-access/')+';end';}
window.addEventListener('lightcity-members-changed',render);Promise.resolve(globalThis.LightCityMembers?.ready).then(render,render);render();
