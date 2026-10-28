/* Family presentation helpers. No personal links are included in group results. */
(function(root){'use strict';
 const emojis=['🙂','😀','😎','🥰','🧑‍🍳','👩','👨','👧','👦','👶','🐶','🐱','🦊','🐻','🦄','🏀'];
 function avatar(value){return emojis.includes(value)||/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value||'')&&value.length<=120000?value:'🙂'}
 function phone(value){const raw=String(value||'').trim();if(!raw)return '';if(!/^[+\d\s().-]+$/.test(raw))throw Error('Enter a phone number with 7–15 digits, or leave it blank.');const n=raw.replace(/[^+\d]/g,'');if(!/^\+?\d{7,15}$/.test(n))throw Error('Enter a phone number with 7–15 digits, or leave it blank.');return n}
 function contact(value){const raw=String(value||'').trim();if(raw.includes('@')){if(raw.length>254||!/^[A-Za-z0-9._+-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(raw))throw Error('Enter a valid iMessage email or phone number.');return raw}return phone(raw)}
 function theme(poll){const c=cuisines.find(c=>c[0]===poll?.cuisine);if(!c)return null;const [emoji,...words]=c[1].split(' ');const food=words.join(' '),title=food+(poll.meal==='Lunch'?' lunch':' night');return {emoji,food,title,tagline:({pizza:'Every slice needs a vote.',mexican:'Let’s taco ’bout our favorites.'})[c[0]]||'One delicious decision, together.'}}
 function reminder(poll,name,url){const t=theme(poll);return '👋 A gentle '+(t?t.food.toLowerCase():poll.meal.toLowerCase())+' reminder, '+name+'!\n\nYour family is waiting for your '+(t?t.emoji+' '+t.title.toLowerCase():poll.meal.toLowerCase())+' vote. 🗳️'+(poll.title?'\n'+poll.title:'')+'\n'+url+'\n\n🔒 This link is just for you.'}
 function groupInvite(poll,url){const t=theme(poll);return `${t?t.emoji:'🍽️'} Goodnights • ${poll.title|| (t?t.title:poll.meal)} vote is open!${t?'\n'+t.tagline:''}\n\n🗳️ ${poll.expected_voters} people invited · ${poll.options?.length||0} places\n${({approval:'✅ Choose up to two favorites.',swipe:'👍 Yes or no to each place.',ranked:'🥇 Rank your top choices.'})[poll.method]}\n${poll.auto_tie?'Positive ties use one saved automatic random draw.\n':''}\n${url}\n\n${poll.one_time?'Enter your own name and vote once. No permanent family membership needed. Keep this invitation with trusted family.':poll.group_join_token?'Tap your avatar/name and vote! Please choose only yourself. Keep this invitation in our family group.':'Open on your usual voting phone. On a new phone, connect your private personal link once.'}`}
 function invite(poll,name,url){const t=theme(poll);return `${t?t.emoji:'🍽️'} Goodnights • ${poll.title|| (t?t.title:poll.meal)} vote!\n\nHey ${name}! 🗳️ ${t?t.tagline:'Help us pick where to eat.'}\n${({approval:'✅ Choose up to 2 favorites.',swipe:'👍 Say yes or no to every place.',ranked:'🥇 Rank your top choices.'})[poll.method]}\n${poll.auto_tie?'Positive ties use one saved automatic random draw.\n':''}\n🔒 Your personal voting link (just for you):\n${url}`}
 function result(poll,tally,url){
  const winners=(poll.options||[]).filter(r=>tally.winners.includes(r.id));
  const heading=tally.outcome==='no-choice'?'Nothing sounds good tonight':winners.length===1?'🏆 '+winners[0].name:winners.length?'🤝 It’s a tie: '+winners.map(r=>r.name).join(' / '):'🍽️ No winner this time';
  const scores=(poll.options||[]).filter(r=>poll.method!=='ranked'||r.id in (tally.rounds.at(-1)||{})).sort((a,b)=>tally.scores[b.id]-tally.scores[a.id]).slice(0,3).map(r=>`${winners.some(w=>w.id===r.id)?'⭐':'•'} ${r.name}: ${poll.method==='swipe'?Math.round(100*tally.scores[r.id]/Math.max(1,poll.voted_count))+'% yes':tally.scores[r.id]+(poll.method==='ranked'?' votes':' approvals')}`).join('\n');
  const place=winners.length===1?winners[0]:null;
  const where=place?.address?'\n📍 '+place.address:'';
  const fun=highlights(poll,tally).map(s=>s.emoji+' '+s.title+' — '+s.detail).join('\n');
  const t=theme(poll);
  return `${t?t.emoji:'🍽️'} Goodnights • ${poll.title|| (t?t.title:poll.meal)}${winners.length===1?' is decided!':winners.length?' needs a tiebreaker':' results'}\n\n${heading}${where}\n🧡 ${poll.voted_count} family ballots · ${poll.options.length} contenders\n${tally.details}\n\n${scores}${fun?'\n\n'+fun:''}\n\n📊 Results & directions:\n${url}\n\n${winners.length===1?(t?.food==='Pizza'?'See you for a slice! 🍕':t?.food==='Mexican'?'Taco ’bout a good choice! 🌮':'See you at the table! 🍴'):winners.length?'Our organizer will help settle the tie. 🤝':'Let’s try another family vote. 🍽️'}`;
 }
 function highlights(poll,tally){
  const n=poll.voted_count||0;if(n<3||tally.randomlyResolved||tally.winners.length!==1)return [];
  const id=tally.winners[0],support=tally.scores[id]||0;
  if(poll.method==='ranked'){
   const first=tally.rounds[0]||{},initial=first[id]||0;
   if(n>=4&&initial<Math.max(...Object.values(first))&&support>initial)return [{emoji:'💫',title:'A dinner comeback',detail:'Ranked preferences lifted the winner from behind'}];
   if(initial===n)return [{emoji:'🥇',title:'One shared first choice',detail:'The winner topped every ballot'}];
  }else if(support===n)return [{emoji:'🤝',title:'A table full of yeses',detail:'Every ballot approved the winner'}];
  const final=poll.method==='ranked'?tally.rounds.at(-1)||{}:tally.scores,runner=Math.max(0,...Object.entries(final).filter(([key])=>key!==id).map(([,v])=>v));
  return n>=4&&runner>0&&support-runner===1?[{emoji:'😮',title:'A close call!',detail:'Decided by just one vote'}]:[];
 }
 const cuisines=[['pizza','🍕 Pizza',/pizza|pizzeria/],['mexican','🌮 Mexican',/mexican|mexico|taco|burrito|tex.mex/],['burgers','🍔 Burgers',/burger/],['chicken','🍗 Chicken',/chicken|wings/],['italian','🍝 Italian',/italian|pasta/],['asian','🍜 Asian',/chinese|japanese|thai|vietnamese|korean|asian|sushi|ramen/],['seafood','🐟 Seafood',/seafood|fish/],['steak','🥩 Steak',/steak|steakhouse/],['cafe','🥪 Café & sandwiches',/cafe|café|sandwich|deli/]];
 function matchesCuisine(r,key){if(!key)return true;const c=cuisines.find(c=>c[0]===key);return !!c&&c[2].test([r.category,r.name].filter(Boolean).join(' ').toLowerCase())}
 // SMS body support varies by device; Copy message is always available alongside it.
 function sms(number,text,ios=false){return 'sms:'+encodeURIComponent(contact(number)).replace(/%40/g,'@').replace(/%2B/g,'+')+(ios?'&':'?')+'body='+encodeURIComponent(text)}
 root.GoodnightsFamily={emojis,avatar,phone,contact,reminder,groupInvite,invite,result,highlights,cuisines,matchesCuisine,theme,sms};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsFamily;
})(typeof window!=='undefined'?window:{});
