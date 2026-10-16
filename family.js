/* Family presentation helpers. No personal links are included in group results. */
(function(root){'use strict';
 const emojis=['🙂','😀','😎','🥰','🧑‍🍳','👩','👨','👧','👦','👶','🐶','🐱','🦊','🐻','🦄','🏀'];
 function avatar(value){return emojis.includes(value)||/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value||'')&&value.length<=24000?value:'🙂'}
 function phone(value){const raw=String(value||'').trim();if(!raw)return '';if(!/^[+\d\s().-]+$/.test(raw))throw Error('Enter a phone number with 7–15 digits, or leave it blank.');const n=raw.replace(/[^+\d]/g,'');if(!/^\+?\d{7,15}$/.test(n))throw Error('Enter a phone number with 7–15 digits, or leave it blank.');return n}
 function invite(poll,name,url){return `🍽️ Goodnights • ${poll.meal} vote!\n\nHey ${name}! 🗳️ Help us pick where to eat.\n${({approval:'✅ Choose up to 2 favorites.',swipe:'👍 Say yes or no to every place.',ranked:'🥇 Rank your top choices.'})[poll.method]}\n\n🔒 Your personal voting link (just for you):\n${url}`}
 function result(poll,tally,url){
  const winners=(poll.options||[]).filter(r=>tally.winners.includes(r.id));
  const heading=winners.length===1?'🏆 '+winners[0].name:winners.length?'🤝 It’s a tie: '+winners.map(r=>r.name).join(' / '):'🍽️ No winner this time';
  const scores=(poll.options||[]).filter(r=>poll.method!=='ranked'||r.id in (tally.rounds.at(-1)||{})).sort((a,b)=>tally.scores[b.id]-tally.scores[a.id]).slice(0,3).map(r=>`${winners.some(w=>w.id===r.id)?'⭐':'•'} ${r.name}: ${poll.method==='swipe'?Math.round(100*tally.scores[r.id]/Math.max(1,poll.voted_count))+'% yes':tally.scores[r.id]+(poll.method==='ranked'?' final-round votes':' approvals')}`).join('\n');
  return `🍽️ Goodnights • ${poll.meal} results\n\n${heading}\n🗳️ ${poll.voted_count} family ballots\n${tally.details}\n\n${scores}\n\n📊 See the results & restaurant logos:\n${url}`;
 }
 // SMS body support varies by device; Copy message is always available alongside it.
 function sms(number,text,ios=false){return 'sms:'+phone(number)+(ios?'&':'?')+'body='+encodeURIComponent(text)}
 root.GoodnightsFamily={emojis,avatar,phone,invite,result,sms};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsFamily;
})(typeof window!=='undefined'?window:{});
