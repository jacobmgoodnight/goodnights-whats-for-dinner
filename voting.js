/* Deterministic tallying; ballots are shown by the backend only after poll ends. */
(function(root){
  function tally(poll){
    const options=poll.options||[], ballots=poll.ballots||[];
    const scores=Object.fromEntries(options.map(o=>[o.id,0]));
    const activeIds=options.map(o=>o.id);
    let winners=[],details='',rounds=[];
    if(!ballots.length) return {scores,winners,details:'No ballots were submitted.',rounds,tiedWinners:[],randomlyResolved:false,outcome:'empty'};
    if(poll.method==='approval'){
      ballots.forEach(ballot=>Array.from(new Set(ballot||[])).forEach(id=>{if(id in scores)scores[id]++}));
      const best=Math.max(...Object.values(scores));
      winners=activeIds.filter(id=>scores[id]===best);
      details=`${best} of ${ballots.length} approved this choice.`;
    } else if(poll.method==='swipe'){
      ballots.forEach(ballot=>activeIds.forEach(id=>{if(ballot[id]===true)scores[id]++}));
      const best=Math.max(...Object.values(scores));
      winners=activeIds.filter(id=>scores[id]===best);
      details=`Most yes votes: ${best}/${ballots.length} (${Math.round(best/ballots.length*100)}% positive).`;
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
    const tiedWinners=winners.length>1?[...winners]:[];
    const randomlyResolved=tiedWinners.includes(poll.tie_winner_id);
    if(randomlyResolved){
      winners=[poll.tie_winner_id];
      details+=' 🎲 Chosen randomly between '+tiedWinners.length+' tied leaders. Votes are unchanged.';
    }
    // Honor immutable historical draws before applying the new no-choice rule.
    const noSupport=poll.method==='swipe'&&Math.max(...Object.values(scores))===0;
    if(noSupport&&!randomlyResolved){
      return {scores,winners:[],details:'No restaurant received a yes vote. The organizer can start a new shortlist.',rounds,tiedWinners:[],randomlyResolved:false,outcome:'no-choice'};
    }
    if(noSupport)details+=' Historical saved draw: no restaurant received a yes vote.';
    const outcome=randomlyResolved?'random':winners.length>1?'tie':winners.length?'winner':'empty';
    return {scores,winners,details,rounds,tiedWinners,randomlyResolved,outcome};
  }
  root.GoodnightsVoting={tally};
  if(typeof module!=='undefined'&&module.exports) module.exports={tally};
})(typeof window!=='undefined'?window:globalThis);
