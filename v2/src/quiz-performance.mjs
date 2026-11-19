// Match the original quiz thresholds and trophy choices.
export function quizPerformance(correct,total){
 const pct=total>0?100*correct/total:0;
 if(pct===100)return {label:'Perfect Score',image:'Trophy7.svg',celebrate:true};
 if(pct>=80)return {label:'Excellent Score',image:'Trophy10.svg',celebrate:true};
 if(pct>=60)return {label:'Very Good Score',image:'Trophy8Silver.svg',celebrate:true};
 if(pct>=40)return {label:'Good Score',image:'Trophy11.svg',celebrate:false};
 if(pct>=20)return {label:'Poor Score',image:'sadEmoji.svg',celebrate:false};
 return {label:'Very Poor Score',image:'sadEmoji.svg',celebrate:false};
}
