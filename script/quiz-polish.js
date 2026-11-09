/* Add the same home exit to every existing settings panel. */
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('#settingsContent .settingsContentInner,#settingsReviewContent .settingsContentInner,#settingsReviewContent,#catSettingsContent .catSettingsContentInner').forEach(panel=>{
  if(panel.querySelector('.lc-quiz-home'))return;
  const home=document.createElement('a');home.className='lc-quiz-home';home.href='/';home.textContent='← LightCity homepage';panel.append(home);
 });
});
