// Bridge hanya mengizinkan dashboard origin yang secara eksplisit dipilih di popup ekstensi.
const CHANNEL = 'SBS_EEIR_V1';
window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data.channel !== CHANNEL || data.direction !== 'PAGE_TO_EXTENSION') return;
  const { allowedOrigin } = await chrome.storage.local.get('allowedOrigin');
  if (!allowedOrigin || location.origin !== allowedOrigin) return;
  const actions = ['PING', 'OPEN_EEIR', 'LOOKUP'];
  if (!actions.includes(data.action) || typeof data.id !== 'string') return;
  try {
    const result = await chrome.runtime.sendMessage({action:data.action, container: data.container});
    window.postMessage({channel:CHANNEL,direction:'EXTENSION_TO_PAGE',id:data.id,result}, location.origin);
  } catch (e) {
    window.postMessage({channel:CHANNEL,direction:'EXTENSION_TO_PAGE',id:data.id,result:{ok:false,error:String(e.message||e)}},location.origin);
  }
});
window.postMessage({channel:CHANNEL,direction:'EXTENSION_TO_PAGE',id:'ready',result:{ok:true}},location.origin);
