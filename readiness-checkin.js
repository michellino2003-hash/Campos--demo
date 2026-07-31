/* CampOS v0.9.2 readiness check-in + adaptive session bridge */
(function(){
 const KEY='campos_readiness_v1';
 const defaults={sleep:78,energy:7,soreness:3,stress:4,joints:8,pain:0};
 function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}}
 function save(v){localStorage.setItem(KEY,JSON.stringify(v));return v}
 function evaluate(v=load()){
   if(!window.CampOSAdaptiveCoach)return null;
   const plan=window.CampOSAdaptiveCoach.prescription(v);
   localStorage.setItem('campos_last_prescription',JSON.stringify({...plan,inputs:v,at:Date.now()}));
   window.dispatchEvent(new CustomEvent('campos:readiness',{detail:plan}));
   return plan;
 }
 function mount(target=document.body){
   if(document.getElementById('camposCheckin'))return;
   const s=load(),wrap=document.createElement('div');wrap.id='camposCheckin';wrap.style.cssText='position:fixed;inset:0;background:#000d;z-index:120;display:none;align-items:flex-end;justify-content:center';
   wrap.innerHTML=`<div style="width:min(100%,470px);max-height:92vh;overflow:auto;background:#0d1713;border:1px solid #2a4035;border-radius:28px 28px 0 0;padding:22px 18px 32px;color:#f5f7f6;font-family:Inter,system-ui,sans-serif"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:10px;letter-spacing:1.5px;color:#7f9188;font-weight:900">30-SECOND CHECK-IN</div><h2 style="margin:5px 0 0">How are you showing up?</h2></div><button id="rcClose" style="background:#17231d;color:#dce7e1;border:1px solid #304239;border-radius:99px;padding:9px 12px">CLOSE</button></div><div id="rcFields"></div><button id="rcBuild" style="width:100%;margin-top:16px;padding:16px;border:0;border-radius:16px;background:#50e59d;color:#082016;font-weight:950">ADAPT TODAY'S SESSION →</button><div id="rcResult" style="margin-top:14px"></div></div>`;
   target.appendChild(wrap);
   const defs=[['sleep','Sleep quality',0,100,5,'%'],['energy','Energy',0,10,1,'/10'],['soreness','Soreness',0,10,1,'/10'],['stress','Stress',0,10,1,'/10'],['joints','Joint comfort',0,10,1,'/10'],['pain','Pain',0,10,1,'/10']];
   document.getElementById('rcFields').innerHTML=defs.map(([k,l,min,max,step,u])=>`<label style="display:block;margin-top:16px"><div style="display:flex;justify-content:space-between;font-size:12px"><b>${l}</b><span id="rc_${k}_v">${s[k]}${u}</span></div><input id="rc_${k}" type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" style="width:100%;margin-top:9px;accent-color:#50e59d"></label>`).join('');
   defs.forEach(([k,,, , ,u])=>document.getElementById('rc_'+k).addEventListener('input',e=>document.getElementById('rc_'+k+'_v').textContent=e.target.value+u));
   document.getElementById('rcClose').onclick=()=>wrap.style.display='none';
   document.getElementById('rcBuild').onclick=()=>{const v={};defs.forEach(([k])=>v[k]=Number(document.getElementById('rc_'+k).value));save(v);const p=evaluate(v);if(!p)return;const mode=p.mode==='PUSH'?'PUSH DAY':p.mode==='NORMAL'?'ON PLAN':'RECOVERY MODE';document.getElementById('rcResult').innerHTML=`<div style="padding:16px;border-radius:18px;background:#13221b;border:1px solid #31513f"><div style="font-size:10px;color:#8fa097;font-weight:900">READINESS ${p.score}/100 · ${mode}</div><strong style="display:block;font-size:18px;margin:7px 0">Target RPE ${p.targetRpe} · ${Math.round(p.volume*100)}% volume</strong><div style="font-size:12px;line-height:1.5;color:#a9b7b0">${p.message}</div></div>`;};
 }
 function open(){mount();document.getElementById('camposCheckin').style.display='flex'}
 window.CampOSReadiness={load,save,evaluate,mount,open};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mount());else mount();
})();
