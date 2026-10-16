const $=s=>document.querySelector(s), CHANNEL='SBS_EEIR_V1';
const FIELDS=['Container','Owner','Size','Type','Grade','Block Remark','equipmentOwnershipType','leasingContractNo','redeliveryLocation1','redeliveryLocation2','redeliveryLocation3','globalHuntStatus','globalHuntRedeliveryLocation','Status','Error'];
let stock=[],results=[],running=false,stopRequested=false;
$('#headers').innerHTML=FIELDS.map(x=>`<th>${x}</th>`).join('');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function send(action,container){return new Promise(resolve=>{
 const id=crypto.randomUUID();const timeout=setTimeout(()=>{window.removeEventListener('message',handler);resolve({ok:false,error:'Tidak ada respons ekstensi. Periksa izin domain dan refresh halaman.'})},35000);
 const handler=ev=>{if(ev.source!==window||ev.origin!==location.origin||ev.data?.channel!==CHANNEL||ev.data?.direction!=='EXTENSION_TO_PAGE'||ev.data.id!==id)return;clearTimeout(timeout);window.removeEventListener('message',handler);resolve(ev.data.result)};
 window.addEventListener('message',handler);window.postMessage({channel:CHANNEL,direction:'PAGE_TO_EXTENSION',id,action,container},location.origin);
});}
function text(s){return String(s??'').trim()}
function normalize(s){return text(s).toUpperCase().replace(/[^A-Z0-9]/g,'')}
function key(s){return text(s).replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}
function pick(row,...candidates){for(const c of candidates){const k=Object.keys(row).find(x=>key(x)===key(c));if(k&&text(row[k]))return text(row[k])}return ''}
function field(node,target){
 if(!node||typeof node!=='object')return '';
 if(Array.isArray(node)){for(const v of node){const r=field(v,target);if(r!=='')return r}return ''}
 for(const [k,v] of Object.entries(node)){if(key(k)===key(target)&&v!=null&&typeof v!=='object')return String(v)}
 for(const v of Object.values(node)){if(v&&typeof v==='object'){const r=field(v,target);if(r!=='')return r}}
 return '';
}
function unwrap(d){ if(typeof d==='string'){try{return unwrap(JSON.parse(d))}catch{return d}}if(d&&typeof d==='object'&&Object.keys(d).length===1&&'d'in d)return unwrap(d.d);return d }
function toResult(s,res){const row={Container:s.Container,Owner:s.Owner,Size:s.Size,Type:s.Type,Grade:s.Grade,'Block Remark':s['Block Remark'],Status:'ERROR',Error:''};
 if(!res.ok){row.Error=res.error||'Gagal mencari';return row}
 const json=unwrap(res.data);const success=field(json,'success'), result=field(json,'result');
 if(String(success).toLowerCase()==='false'||String(result).toUpperCase()==='FAILED'){row.Status='NOT_FOUND';row.Error=field(json,'message')||'eEIR mengembalikan kegagalan';return row}
 const keys=['equipmentOwnershipType','leasingContractNo','redeliveryLocation1','redeliveryLocation2','redeliveryLocation3','globalHuntStatus','globalHuntRedeliveryLocation'];
 for(const k of keys)row[k]=field(json,k);
 if(!keys.some(k=>row[k])){row.Status='NO_FIELDS';row.Error='Respons diterima tetapi field yang diminta tidak ditemukan';return row}
 row.Status='MATCHED';return row;
}
function update(){const owners=[...new Set(stock.map(r=>r.Owner))].sort();const prior=$('#owner').value;$('#owner').innerHTML=['MSL',...owners.filter(x=>x!=='MSL'),'ALL'].map(s=>`<option value="${s}">${s}</option>`).join('');$('#owner').value=owners.includes(prior)?prior:owners.includes('MSL')?'MSL':'ALL';view()}
function selected(){return stock.filter(r=>$('#owner').value==='ALL'||r.Owner===$('#owner').value)}
function view(){const subset=selected();$('#stockstatus').textContent=`${stock.length.toLocaleString('id-ID')} container unik dibaca; ${subset.length.toLocaleString('id-ID')} sesuai filter ${$('#owner').value}.`;$('#total').textContent=subset.length.toLocaleString('id-ID');$('#start').disabled=running||!subset.length;render()}
function render(){ $('#processed').textContent=results.length;$('#matched').textContent=results.filter(r=>r.Status==='MATCHED').length;$('#errors').textContent=results.filter(r=>r.Status!=='MATCHED').length;$('#download').disabled=!results.length;$('#rows').innerHTML=results.slice(-150).reverse().map(r=>`<tr>${FIELDS.map(k=>`<td>${escapeHtml(text(r[k]))}</td>`).join('')}</tr>`).join('')}
function escapeHtml(s){return s.replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
$('#owner').onchange=view;
$('#file').onchange=async e=>{try{
 if(!window.XLSX)throw Error('Library XLSX belum termuat. Periksa koneksi internet atau kebijakan CDN.');
 const f=e.target.files[0];if(!f)return;
 const w=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});const sheet=w.Sheets[w.SheetNames[0]];
 const raw=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});const seen=new Set();stock=[];
 for(const r of raw){const cont=normalize(pick(r,'Cont','Container','Container Number'));if(!/^[A-Z]{4}\d{7}$/.test(cont)||seen.has(cont))continue;seen.add(cont);
 stock.push({Container:cont,Owner:pick(r,'Owner').toUpperCase()||'UNKNOWN',Size:pick(r,'Size'),Type:pick(r,'Type'),Grade:pick(r,'Grade'),'Block Remark':pick(r,'Block Remark')});}
 if(!stock.length)throw Error('Kolom Cont tidak ditemukan atau tidak ada nomor container valid');results=[];update();$('#runstatus').textContent='Stock berhasil dimuat. Login di tab eEIR, lalu jalankan uji 5 container.';
 }catch(err){$('#stockstatus').textContent='Error: '+err.message}};
$('#connect').onclick=async()=>{const r=await send('PING');$('#connection').textContent=r.ok?(r.tabReady?'Ekstensi terhubung; tab eEIR tersedia. Pastikan sudah login.':'Ekstensi terhubung. Buka tab eEIR dan login manual.'):'Belum terhubung: '+r.error;$('#connection').classList.toggle('warn',!r.ok)};
$('#open').onclick=async()=>{const r=await send('OPEN_EEIR');$('#connection').textContent=r.ok?'Tab eEIR dibuka. Silakan login manual pada tab tersebut, lalu kembali ke dashboard.':r.error};
$('#start').onclick=async()=>{if(running||!stock.length)return;running=true;stopRequested=false;$('#start').disabled=true;$('#stop').disabled=false;
 const items=selected().slice(0,Number($('#limit').value)||undefined);const done=new Set(results.map(r=>r.Container));const todo=items.filter(s=>!done.has(s.Container));$('#progress').max=items.length||1;$('#progress').value=items.length-todo.length;
 for(const s of todo){if(stopRequested)break;$('#runstatus').textContent=`Mencari ${s.Container} — ${results.length} hasil terkumpul`;
 const response=await send('LOOKUP',s.Container);const row=toResult(s,response);results.push(row);render();$('#progress').value++;
 if(response.error&&/login|form eEIR|tidak ditemukan/i.test(response.error)){stopRequested=true;$('#runstatus').textContent='Proses dihentikan: '+response.error;break}
 await wait(1300);}
 running=false;$('#stop').disabled=true;view();if(!stopRequested)$('#runstatus').textContent=`Selesai. ${results.length} hasil tersedia; segera export.`;else $('#runstatus').textContent+=' (dihentikan)';};
$('#stop').onclick=()=>{stopRequested=true;$('#runstatus').textContent='Menghentikan setelah pencarian berjalan selesai…'};
$('#clear').onclick=()=>{if(running)return;results=[];$('#progress').value=0;render();$('#runstatus').textContent='Hasil dibersihkan.'};
$('#download').onclick=()=>{if(!results.length)return;
 const sheet=XLSX.utils.json_to_sheet(results.map(r=>Object.fromEntries(FIELDS.map(k=>[k,r[k]??'']))),{header:FIELDS});
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'EEIR Results');
 XLSX.writeFile(book,`SBS_EEIR_${new Date().toISOString().slice(0,10)}.xlsx`);
};
