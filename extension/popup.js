const o=document.querySelector('#origin'),s=document.querySelector('#status');
chrome.storage.local.get('allowedOrigin').then(x=>o.value=x.allowedOrigin||'');
document.querySelector('#save').onclick=async()=>{
 try{
  const url=new URL(o.value.trim());
  if(url.protocol!=='https:'||!url.hostname.endsWith('.github.io')||url.pathname!=='/')throw Error('Gunakan format https://username.github.io tanpa path');
  await chrome.storage.local.set({allowedOrigin:url.origin});
  s.textContent='Tersimpan: '+url.origin+' — refresh dashboard GitHub Pages.';
 }catch(e){s.textContent=e.message}
};
