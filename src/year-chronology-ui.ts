import { comparableYear, correctOrdering, orderingCandidates, orderingProgress, selectOrderingQuestions, timelineItems, timelineLayout, yearLabel, type OrderingFilter, type OrderingQuestion } from './year-chronology';
import type { YearDB, YearItem, YearSnapshot } from './years';

const h=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const options=(values:[string,string][],current:string)=>values.map(([value,label])=>`<option value="${h(value)}" ${value===current?'selected':''}>${h(label)}</option>`).join('');
export class YearChronologyUI {
  private filter:OrderingFilter={level:'all',region:'all',era:'all',mode:'all'};
  private count=5;
  private queue:OrderingQuestion[]=[];
  private index=0;
  private order:string[]=[];
  private graded=false;
  private active=false;
  private busy=false;
  private starting=false;
  private generation=0;
  private sessionId='';
  private reviewId='';
  private timeline={start:0,end:0,regions:[] as string[],level:'all',era:'all',scale:4};
  private detailId='';
  private rangeError='';
  constructor(private read:()=>YearSnapshot,private db:()=>YearDB|null,private reload:()=>Promise<void>,private render:()=>void,private notify:(text:string,error?:boolean)=>void,private ready:()=>Promise<void>){}
  isStudying(){return this.active&&this.index<this.queue.length;}
  leave(){this.generation++;this.active=false;this.queue=[];this.starting=false;}
  private classifications(prefix:string,current:{level:string|number;region?:string;era:string}){
    const items=this.read().catalog.items.filter(item=>!item.deleted);
    return `<label class="form-field">難易度<select name="${prefix}Level">${options([['all','全レベル'],...['1','2','3','4'].map(n=>[n,`Lv.${n}`] as [string,string])],String(current.level))}</select></label>${current.region===undefined?'':`<label class="form-field">地域<select name="${prefix}Region">${options([['all','全地域'],...[...new Set(items.map(x=>x.region))].sort().map(x=>[x,x] as [string,string])],current.region)}</select></label>`}<label class="form-field">時代<select name="${prefix}Era">${options([['all','全時代'],...[...new Set(items.map(x=>x.era))].sort().map(x=>[x,x] as [string,string])],current.era)}</select></label>`;
  }
  ordering(){
    const state=this.read(), progress=orderingProgress(state.orderingEvents);
    const history=`<details class="panel ordering-history"><summary>年代整序の成績・履歴（${state.orderingEvents.length}回答）</summary><p>累積正答 ${state.orderingEvents.filter(e=>e.correct).length} ／ 累積誤答 ${state.orderingEvents.filter(e=>!e.correct).length}</p><p class="small muted">一問一答とは別の成績です。正解しても累積誤答は保持されます。</p>${[...state.orderingEvents].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,30).map(event=>`<article class="chronology-history-row"><strong>${event.correct?'○ 正答':'× 誤答'} · ${h(new Date(event.at).toLocaleString('ja-JP'))}</strong><span>${event.correctOrderIds.map(id=>h(state.catalog.items.find(item=>item.id===id)?.event??id)).join(' → ')}</span><span>この4件：累積正答 ${progress.get(event.questionId)!.correct} ／ 累積誤答 ${progress.get(event.questionId)!.wrong} · 直近 ${progress.get(event.questionId)!.recent.map(right=>right?'○':'×').join(' ')}</span></article>`).join('')}</details>`;
    if(!this.active){const candidates=orderingCandidates(state.catalog,state.orderingEvents,this.filter);
      return `<form id="ordering-options" class="panel chronology-setup"><div class="chronology-form-grid">${this.classifications('order',this.filter)}<label class="form-field">出題モード<select name="orderMode">${options([['all','全範囲'],['unseen','未学習'],['weak','苦手優先']],this.filter.mode)}</select></label><label class="form-field">出題数<select name="orderCount">${options(['5','10','20'].map(x=>[x,`${x}問`]),String(this.count))}</select></label></div><p>対象 ${candidates.length}組 ／ 今回 ${Math.min(this.count,candidates.length)}問</p><p class="small muted">異なる4年の出来事を、原則200年以内の近い年代から出題します。未学習・苦手は整序問題の履歴で判定します。</p>${candidates.length?'':'<p role="status">比較可能な異なる4年の出来事が不足しています。地域・時代・難易度を変更してください。</p>'}<button class="button primary chronology-start" ${!candidates.length||!this.db()||this.starting||this.busy?'disabled':''}>年代整序を開始</button></form>${history}`;
    }
    if(this.index>=this.queue.length)return `<section class="panel chronology-finished"><h2>年代整序テスト終了</h2><p>${this.queue.length}問中 ${state.orderingEvents.filter(event=>event.sessionId===this.sessionId&&event.correct).length}問正答</p><button class="button primary" data-order-action="stop">同じ条件でもう一度学ぶ</button></section>${history}`;
    const question=this.queue[this.index], byId=new Map(question.items.map(item=>[item.id,item]));
    const review=state.orderingEvents.find(event=>event.id===this.reviewId), p=progress.get(question.id);
    return `<section class="panel ordering-session"><div class="chronology-session-top"><button class="text-button" data-order-action="stop" ${this.busy?'disabled':''}>演習を終了</button><strong>${this.index+1} / ${this.queue.length}問</strong></div><h2>次の出来事を古い順に並べ替えよ。</h2><p class="small muted">上下ボタンで移動します。上が最も古い出来事です。</p><ol class="ordering-items">${this.order.map((id,i)=>`<li data-order-item="${h(id)}"><span class="ordering-number">${i+1}</span><strong>${h(byId.get(id)!.event)}</strong><div class="ordering-move"><button aria-label="${h(byId.get(id)!.event)}を上へ" data-order-move="${i}" data-step="-1" ${this.graded||this.busy||i===0?'disabled':''}>↑</button><button aria-label="${h(byId.get(id)!.event)}を下へ" data-order-move="${i}" data-step="1" ${this.graded||this.busy||i===3?'disabled':''}>↓</button></div></li>`).join('')}</ol>${this.graded&&review?`<div class="ordering-result" role="status"><h3>${review.correct?'○ 正解':'× 不正解'}</h3><p>正しい順序</p><ol>${review.correctOrderIds.map(id=>`<li>${h(byId.get(id)!.event)}（${h(byId.get(id)!.year)}）</li>`).join('')}</ol><p>この問題の累積正答 ${p?.correct??0} ／ 累積誤答 ${p?.wrong??0}</p></div><button class="button primary chronology-start" data-order-action="next">次の問題へ</button>`:`<button class="button primary chronology-start" data-order-action="grade" ${this.busy?'disabled':''}>${this.busy?'保存中…':'答え合わせ'}</button>`}</section>`;
  }
  private initRange(){
    if(this.timeline.start||this.timeline.end)return;
    const years=this.read().catalog.items.filter(x=>!x.deleted).map(x=>comparableYear(x.year)).filter((x):x is number=>x!==null);
    if(years.length){this.timeline.start=Math.min(...years);this.timeline.end=Math.max(...years);}
  }
  timelineView(){
    this.initRange();const state=this.read(), all=state.catalog.items.filter(x=>!x.deleted), dates=all.map(x=>comparableYear(x.year)).filter((x):x is number=>x!==null);
    const min=dates.length?Math.min(...dates):0,max=dates.length?Math.max(...dates):0;
    const regions=[...new Set(all.map(x=>x.region))].sort(), t=this.timeline;
    const visible=timelineItems(state.catalog,{...t,level:t.level==='all'?'all':Number(t.level) as 1|2|3|4,region:'all'});
    const span=Math.max(1,t.end-t.start),scale=Math.min(t.scale,20000/span),width=Math.max(500,span*scale+212);
    const step=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000,100000].find(x=>x*scale>=100)??100000;
    const ticks:number[]=[];for(let year=Math.ceil(t.start/step)*step;year<=t.end;year+=step)if(year!==0)ticks.push(year);
    const byId=new Map(visible.map(item=>[item.id,item])); const detail=byId.get(this.detailId);
    return `<form id="timeline-options" class="panel chronology-setup"><div class="chronology-form-grid"><label class="form-field">開始年<input name="timelineStart" type="number" min="${min}" max="${max}" step="1" value="${t.start}" required></label><label class="form-field">終了年<input name="timelineEnd" type="number" min="${min}" max="${max}" step="1" value="${t.end}" required></label>${this.classifications('timeline',t)}<label class="form-field">表示密度<select name="timelineScale">${options([['4','縮小'],['12','標準'],['32','拡大']],String(t.scale))}</select></label></div><fieldset class="timeline-regions"><legend>地域（複数選択可・未選択で全地域）</legend>${regions.map(region=>`<label><input type="checkbox" name="timelineRegion" value="${h(region)}" ${t.regions.includes(region)?'checked':''}>${h(region)}</label>`).join('')}</fieldset><p class="small muted">教材の範囲：${dates.length?`${yearLabel(min)}〜${yearLabel(max)}`:'比較可能な年号がありません'}。紀元前は負の整数で指定します。</p><button class="button primary chronology-start" ${dates.length?'':'disabled'}>年表を表示</button>${this.rangeError?`<p role="alert">${h(this.rangeError)}</p>`:''}</form><section class="panel timeline-panel"><h2>同時代の出来事</h2><p role="status">${visible.length}件を年代順に表示</p><p class="small muted">横にスクロールして比較できます。同年の出来事は別の段に表示します。期間・推定年代など比較できない表記は対象外です（${all.length-dates.length}件）。</p>${visible.length?`<div class="timeline-scroll" tabindex="0" role="region" aria-label="横スクロールできる地域別年表"><div class="timeline-canvas" style="width:${width}px"><div class="timeline-axis">${ticks.map(year=>`<span style="left:${(year-t.start)*scale}px">${h(yearLabel(year))}</span>`).join('')}</div>${regions.filter(region=>visible.some(item=>item.region===region)).map((region,i)=>{const layout=timelineLayout(visible.filter(item=>item.region===region),t.start,scale);return `<section class="timeline-lane" style="--lane-hue:${205+i*17}"><h3>${h(region)}</h3><div class="timeline-lane-events" style="height:${layout.rows*176}px">${layout.positions.map(({item,x,row})=>`<button class="timeline-event" data-timeline-id="${h(item.id)}" style="left:${x}px;top:${row*176}px" aria-label="${h(item.year)}年 ${h(item.event)}"><time>${h(item.year)}</time><strong>${h(item.event)}</strong><small>${h(item.region)} · Lv.${item.level}</small></button>`).join('')}</div></section>`;}).join('')}</div></div><details class="timeline-text-list"><summary>年代順の一覧で見る（${visible.length}件）</summary>${visible.map(item=>`<button class="chronology-shortcut" data-timeline-id="${h(item.id)}"><span>${h(item.year)} · ${h(item.event)}<small> ／ ${h(item.region)}</small></span></button>`).join('')}</details>`:'<p>この条件に合う比較可能な年号がありません。範囲・地域・時代を変更してください。</p>'}</section>${detail?this.detail(detail):''}`;
  }
  private detail(item:YearItem){return `<section class="panel timeline-detail" aria-labelledby="timeline-detail-title"><h2 id="timeline-detail-title" tabindex="-1">${h(item.event)}</h2><p><strong>${h(item.year)}</strong> ／ ${h(item.region)} ／ ${h(item.era)} ／ Lv.${item.level}</p><p>${h(item.explanation||'解説は登録されていません。')}</p><h3>登録済みの出典</h3><ul>${item.sources.map(source=>`<li><a href="${h(source.url)}" target="_blank" rel="noopener noreferrer">${h(source.title)}</a></li>`).join('')||'<li>出典は登録されていません。</li>'}</ul><p class="small muted">固定ID：${h(item.id)}</p></section>`;}
  bind(){
    const form=document.querySelector<HTMLFormElement>('#ordering-options');
    if(form){form.onchange=event=>{const name=(event.target as HTMLSelectElement).name,d=new FormData(form);this.filter={level:d.get('orderLevel')==='all'?'all':Number(d.get('orderLevel')) as 1|2|3|4,region:String(d.get('orderRegion')),era:String(d.get('orderEra')),mode:String(d.get('orderMode')) as OrderingFilter['mode']};this.count=Number(d.get('orderCount'));this.render();document.querySelector<HTMLElement>(`#ordering-options [name="${name}"]`)?.focus({preventScroll:true});};form.onsubmit=event=>{event.preventDefault();void this.start();};}
    document.querySelectorAll<HTMLButtonElement>('[data-order-move]').forEach(button=>button.onclick=()=>{if(this.graded||this.busy)return;const i=Number(button.dataset.orderMove),j=i+Number(button.dataset.step);if(j<0||j>=4)return;[this.order[i],this.order[j]]=[this.order[j],this.order[i]];this.render();document.querySelector<HTMLElement>(`[data-order-move="${j}"][data-step="${button.dataset.step}"]`)?.focus({preventScroll:true});});
    document.querySelectorAll<HTMLButtonElement>('[data-order-action]').forEach(button=>button.onclick=()=>{void this.action(button.dataset.orderAction!);});
    const timeline=document.querySelector<HTMLFormElement>('#timeline-options');
    if(timeline)timeline.onsubmit=event=>{event.preventDefault();const d=new FormData(timeline),start=Number(d.get('timelineStart')),end=Number(d.get('timelineEnd'));if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||!start||!end||start>end){this.rangeError='開始年と終了年を確認してください。0年は指定できません。';}else{this.timeline={start,end,regions:d.getAll('timelineRegion').map(String),level:String(d.get('timelineLevel')),era:String(d.get('timelineEra')),scale:Number(d.get('timelineScale'))};this.rangeError='';this.detailId='';}this.render();};
    document.querySelectorAll<HTMLButtonElement>('[data-timeline-id]').forEach(button=>button.onclick=()=>{const scroll=document.querySelector('.timeline-scroll'),left=scroll?.scrollLeft??0,top=window.scrollY;this.detailId=button.dataset.timelineId!;this.render();const next=document.querySelector('.timeline-scroll');if(next)next.scrollLeft=left;window.scrollTo(0,top);const title=document.querySelector<HTMLElement>('#timeline-detail-title');title?.focus({preventScroll:true});title?.scrollIntoView({block:'nearest'});});
  }
  private async start(){
    if(this.starting||this.busy||!this.db())return;const generation=this.generation;this.starting=true;this.render();
    try{await this.ready();if(generation!==this.generation)return;const state=this.read();this.queue=selectOrderingQuestions(state.catalog,state.orderingEvents,this.filter,this.count);if(!this.queue.length)return;this.index=0;this.active=true;this.sessionId=crypto.randomUUID();this.prepare();}
    catch(error){this.notify(String(error),true);}finally{this.starting=false;this.render();}
  }
  private prepare(){this.order=this.queue[this.index]?.items.map(item=>item.id)??[];this.graded=false;this.reviewId=crypto.randomUUID();}
  private async action(action:string){
    if(this.busy)return;
    if(action==='stop'){this.leave();this.render();return;}
    if(action==='next'&&this.graded){this.index++;this.prepare();this.render();return;}
    if(action!=='grade'||!this.active||this.graded||!this.db())return;
    const generation=this.generation;this.busy=true;this.render();
    try{const q=this.queue[this.index];correctOrdering(q.items);await this.db()!.addOrderingReview(this.reviewId,q.items.map(x=>x.id),[...this.order],this.sessionId);await this.reload();if(generation===this.generation)this.graded=true;}
    catch(error){this.notify(String(error),true);}finally{this.busy=false;this.render();}
  }
}
