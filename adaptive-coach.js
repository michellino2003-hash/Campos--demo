/* CampOS v0.9.1 adaptive readiness engine */
(function () {
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function prescription(input={}){
    const sleep=clamp(input.sleep??78,0,100);
    const energy=clamp(input.energy??7,0,10)*10;
    const soreness=100-clamp(input.soreness??3,0,10)*10;
    const stress=100-clamp(input.stress??4,0,10)*10;
    const joints=clamp(input.joints??8,0,10)*10;
    const recent=100-clamp(((input.recentRpe??7)-5)*12,0,48);
    const pain=clamp(input.pain??0,0,10);
    let score=Math.round(sleep*.28+energy*.22+soreness*.16+stress*.12+joints*.16+recent*.06);
    const reasons=[];
    if(sleep<65)reasons.push('Sleep is below your performance range.');
    if(energy<=50)reasons.push('Energy is limited today.');
    if(soreness<=30)reasons.push('Soreness is elevated.');
    if(stress<=30)reasons.push('Stress load is elevated.');
    if(joints<=50)reasons.push('Joint comfort is reduced.');
    if(pain>=7){score=Math.min(score,35);reasons.unshift('High pain overrides the normal training plan.');}
    else if(pain>=4){score=Math.min(score,58);reasons.unshift('Pain is present, so the session is modified.');}
    const mode=score>=82?'PUSH':score>=60?'NORMAL':'RECOVER';
    const volume=mode==='PUSH'?1.05:mode==='NORMAL'?(pain>=4?.82:1):(pain>=4?.55:.7);
    const targetRpe=mode==='PUSH'?8:mode==='NORMAL'?(pain>=4?6:7):(pain>=4?5:6);
    const focus=mode==='PUSH'?'performance':mode==='NORMAL'?(pain>=4?'technical':'performance'):(pain>=4?'recovery':'technical');
    const message=mode==='PUSH'?'Recovery is strong. Use the extra capacity without chasing failure.':mode==='NORMAL'?(pain>=4?'Keep the purpose of the session, but remove unnecessary strain.':'You are ready for the planned session. Stay controlled and finish clean.'):(pain>=4?'Do not push through pain. Use pain-free movement and recovery work.':'Preserve the habit, reduce fatigue, and leave feeling better than you started.');
    return {score,mode,volume,targetRpe,focus,message,reasons,stopForPain:pain>=7};
  }
  function adaptWorkout(steps,p){
    if(!Array.isArray(steps))return [];
    if(p.stopForPain)return steps.filter(x=>x.type==='recovery');
    if(p.mode==='RECOVER')return steps.map((x,i)=>({...x,detail:x.type==='boxing'?'Technical only · relaxed pace':x.detail,adaptive:i%3===2?'optional':'keep'})).filter(x=>x.adaptive!=='optional');
    return steps.map(x=>({...x,adaptive:'keep'}));
  }
  window.CampOSAdaptiveCoach={prescription,adaptWorkout};
})();
