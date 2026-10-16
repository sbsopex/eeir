const EEIR_URL = 'https://maersk.sbs-icd.com/eeir';
let busy = false;
async function findTab(){
  const tabs = await chrome.tabs.query({url:'https://maersk.sbs-icd.com/*'});
  return tabs.find(t=>t.url && new URL(t.url).pathname==='/eeir') || null;
}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  (async()=>{
    const {allowedOrigin}=await chrome.storage.local.get('allowedOrigin');
    if(!sender.tab || !allowedOrigin || new URL(sender.tab.url).origin !== allowedOrigin) throw Error('Origin dashboard tidak diizinkan. Atur melalui popup ekstensi.');
    if(msg.action==='PING')return {ok:true,tabReady:!!(await findTab())};
    if(msg.action==='OPEN_EEIR'){
      let tab=await findTab(); if(!tab)tab=await chrome.tabs.create({url:EEIR_URL,active:true});
      else await chrome.tabs.update(tab.id,{active:true});
      return {ok:true,tabReady:true};
    }
    if(msg.action!=='LOOKUP')throw Error('Perintah tidak dikenal');
    const cont=String(msg.container||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(!/^[A-Z]{4}\d{7}$/.test(cont))return {ok:false,error:'Nomor container tidak valid'};
    if(busy)return {ok:false,error:'Pencarian sebelumnya masih berjalan'};
    const tab=await findTab(); if(!tab)return {ok:false,error:'Buka halaman eEIR dan login terlebih dahulu'};
    busy=true;
    try {
      const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:performLookup,args:[cont]});
      return result.result;
    } finally{busy=false;}
  })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e.message||e)}));
  return true;
});

// Dijalankan di MAIN world dalam halaman eEIR: menggunakan UI Search yang tersedia,
// lalu membaca hasil AJAX dari interaksi yang kita lakukan. Tidak membaca cookie/token.
async function performLookup(cont){
  const input=document.querySelector('#cont');
  const button=document.querySelector('#btn_retrieve');
  if(!input||!button)return {ok:false,error:'Form eEIR tidak ditemukan. Pastikan login dan buka /eeir.'};
  if(!window.jQuery)return {ok:false,error:'jQuery eEIR belum siap. Refresh halaman lalu coba lagi.'};
  return await new Promise(resolve=>{
    let done=false;
    const ns='.sbsAutoDetect'+Date.now();
    let timer;
    const finish=(result)=>{
      if(done)return;done=true;clearTimeout(timer);window.jQuery(document).off(ns);
      resolve(result);
    };
    timer=setTimeout(()=>finish({ok:false,error:'Timeout menunggu respons eEIR (30 detik)'}),30000);
    window.jQuery(document).on('ajaxSuccess'+ns,(_evt,xhr,settings,data)=>{
      if(!String(settings.url||'').includes('GetContEEIR2'))return;
      let json=data;
      if(typeof json==='string'){try{json=JSON.parse(json)}catch{}}
      finish({ok:true,data:json});
    });
    window.jQuery(document).on('ajaxError'+ns,(_evt,xhr,settings,_error)=>{
      if(!String(settings.url||'').includes('GetContEEIR2'))return;
      finish({ok:false,error:'eEIR HTTP '+xhr.status});
    });
    input.value=cont;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    button.click();
  });
}
