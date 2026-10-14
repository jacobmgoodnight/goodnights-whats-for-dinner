/* Deterministic tallying; ballots are shown by the backend only after poll ends. */
(function(root){
  function tally(poll){
    const options=poll.options||[], ballots=poll.ballots||[];
    const scores=Object.fromEntries(options.map(o=>[o.id,0]));
    const activeIds=options.map(o=>o.id);
    let winners=[],details='',rounds=[];
    if(!ballots.length) return {scores,winners,details:'No ballots were submitted.',rounds};
    if(poll.method==='approval'){
      ballots.forEach(ballot=>Array.from(new Set(ballot||[])).forEach(id=>{if(id in scores)scores[id]++}));
      const best=Math.max(...Object.values(scores));
      winners=activeIds.filter(id=>scores[id]===best);
      details=`${best} of ${ballots.length} approved this choice.`;
    } else if(poll.method==='swipe'){
      ballots.forEach(ballot=>activeIds.forEach(id=>{if(ballot[id]===true)scores[id]++}));
      const best=Math.max(...Object.values(scores));
      winners=activeIds.filter(id=>scores[id]===best);
      details=`${Math.round(best/ballots.length*100)}% positive votes (${best}/${ballots.length}).`;
    } else {
      let active=[...activeIds];
      while(active.length){
        let count=Object.fromEntries(active.map(id=>[id,0]));
        ballots.forEach(rank=>{
          const first=(rank||[]).find(id=>active.includes(id));
          if(first)count[first]++;
        });
        rounds.push(count);
        const cast=Object.values(count).reduce((a,b)=>a+b,0);
        const best=Math.max(...Object.values(count));
        const leaders=active.filter(id=>count[id]===best);
        if(cast>0 && best>cast/2 || active.length===1){winners=leaders;break}
        const low=Math.min(...Object.values(count));
        const last=active.filter(id=>count[id]===low);
        if(last.length===active.length){
          // A genuine deadlock among the remaining candidates: ask for a runoff.
          winners=leaders;
          break;
        }
        // Eliminate equally lowest-ranked candidates together; avoids an
        // arbitrary alphabetical tiebreaker when they are behind the leaders.
        active=active.filter(id=>!last.includes(id));
      }
      const final=rounds[rounds.length-1]||{};
      Object.assign(scores,final);
      details=`Instant-runoff count · ${rounds.length} round${rounds.length===1?'':'s'}.`;
    }
    return {scores,winners,details,rounds};
  }
  root.GoodnightsVoting={tally};
  if(typeof module!=='undefined'&&module.exports) module.exports={tally};
})(typeof window!=='undefined'?window:globalThis);
