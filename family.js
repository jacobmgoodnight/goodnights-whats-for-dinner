/* Family presentation helpers. No personal links are included in group results. */
(function(root){'use strict';
 const emojis=['🙂','😀','😎','🥰','🧑‍🍳','👩','👨','👧','👦','👶','🐶','🐱','🦊','🐻','🦄','🏀'];
 function avatar(value){return emojis.includes(value)||/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value||'')&&value.length<=120000?value:'🙂'}
 function phone(value){const raw=String(value||'').trim();if(!raw)return '';if(!/^[+\d\s().-]+$/.test(raw))throw Error('Enter a phone number with 7–15 digits, or leave it blank.');const n=raw.replace(/[^+\d]/g,'');if(!/^\+?\d{7,15}$/.test(n))throw Error('Enter a phone number with 7–15 digits, or leave it blank.');return n}
 function contact(value){const raw=String(value||'').trim();if(raw.includes('@')){if(raw.length>254||!/^[A-Za-z0-9._+-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(raw))throw Error('Enter a valid iMessage email or phone number.');return raw}return phone(raw)}
 function reminder(poll,name,url){return '👋 A gentle dinner reminder, '+name+'!\n\nYour family is waiting for your '+poll.meal.toLowerCase()+' vote. 🗳️\n'+url+'\n\n🔒 This link is just for you.'}
 function groupInvite(poll,url){return `🍽️ Goodnights • ${poll.meal} vote is open!\n\n🗳️ ${poll.expected_voters} people invited · ${poll.options?.length||0} places\n${({approval:'✅ Choose up to two favorites.',swipe:'👍 Yes or no to each place.',ranked:'🥇 Rank your top choices.'})[poll.method]}\n\n${url}\n\n${poll.group_join_token?'Tap your avatar/name and vote! Please choose only yourself. Keep this invitation in our family group.':'Open on your usual voting phone. On a new phone, connect your private personal link once.'}`}
 function invite(poll,name,url){return `🍽️ Goodnights • ${poll.meal} vote!\n\nHey ${name}! 🗳️ Help us pick where to eat.\n${({approval:'✅ Choose up to 2 favorites.',swipe:'👍 Say yes or no to every place.',ranked:'🥇 Rank your top choices.'})[poll.method]}\n\n🔒 Your personal voting link (just for you):\n${url}`}
 function result(poll,tally,url){
  const winners=(poll.options||[]).filter(r=>tally.winners.includes(r.id));
  const heading=winners.length===1?'🏆 '+winners[0].name:winners.length?'🤝 It’s a tie: '+winners.map(r=>r.name).join(' / '):'🍽️ No winner this time';
  const scores=(poll.options||[]).filter(r=>poll.method!=='ranked'||r.id in (tally.rounds.at(-1)||{})).sort((a,b)=>tally.scores[b.id]-tally.scores[a.id]).slice(0,3).map(r=>`${winners.some(w=>w.id===r.id)?'⭐':'•'} ${r.name}: ${poll.method==='swipe'?Math.round(100*tally.scores[r.id]/Math.max(1,poll.voted_count))+'% yes':tally.scores[r.id]+(poll.method==='ranked'?' final-round votes':' approvals')}`).join('\n');
  const place=winners.length===1?winners[0]:null;
  const where=place?.address?'\n📍 '+place.address:'';
  const fun=highlights(poll,tally).filter(s=>s.title!=='Everyone’s in!').map(s=>s.emoji+' '+s.title+' — '+s.detail).join('\n');
  return `🍽️ Goodnights • ${poll.meal}${winners.length===1?' is decided!':winners.length?' needs a tiebreaker':' results'}\n\n${heading}${where}\n🧡 ${poll.voted_count} family ballots · ${poll.options.length} contenders\n${tally.details}\n\n${scores}${fun?'\n\n'+fun:''}\n\n📊 Results & directions:\n${url}\n\n${winners.length===1?'See you at the table! 🍴':winners.length?'One more vote to settle dinner! 🗳️':'Let’s try another family vote. 🍽️'}`;
 }
 function highlights(poll,tally){
  const n=poll.voted_count||0;if(!n)return [];
  const expected=poll.expected_voters||n;
  const stats=[{emoji:'🧡',title:n>=expected?'Everyone’s in!':'Thanks, dinner crew',detail:n+' of '+expected+' invited ballots'}];
  if(tally.winners.length===1){const id=tally.winners[0],support=tally.scores[id]||0;
   if(poll.method!=='ranked'&&support===n)stats.push({emoji:'🤝',title:'A table full of yeses',detail:'Every ballot approved the winner'});
   if(poll.method==='ranked'){
    const first=tally.rounds[0]?.[id]||0;
    if(first===n)stats.push({emoji:'🥇',title:'One shared first choice',detail:'The winner topped every ballot'});
    else if(support>first)stats.push({emoji:'💫',title:'Preferences found a home',detail:(support-first)+' vote'+(support-first===1?'':'s')+' transferred to the winner'});
   }
   const final=poll.method==='ranked'?tally.rounds.at(-1)||{}:tally.scores,runner=Math.max(0,...Object.entries(final).filter(([key])=>key!==id).map(([,v])=>v));
   if(runner>0&&support-runner===1)stats.push({emoji:'😮',title:'A close call!',detail:'Decided by just one vote'});
  }
  if(poll.method==='ranked')stats.push({emoji:'🔄',title:tally.rounds.length+' round'+(tally.rounds.length===1?'':'s')+' to dinner',detail:'Your ranked choices did the work'});
  return stats.slice(0,3);
 }
 // SMS body support varies by device; Copy message is always available alongside it.
 function sms(number,text,ios=false){return 'sms:'+encodeURIComponent(contact(number)).replace(/%40/g,'@').replace(/%2B/g,'+')+(ios?'&':'?')+'body='+encodeURIComponent(text)}
 root.GoodnightsFamily={emojis,avatar,phone,contact,reminder,groupInvite,invite,result,highlights,sms};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsFamily;
})(typeof window!=='undefined'?window:{});
