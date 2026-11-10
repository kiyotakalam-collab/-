import {reviewUrgency,URGENCY_LABELS} from './retention';
import { dueSummary, japanDateKey, japanDateTime, learningRows, masteryCounts, masteryGroups, MASTERY_LABELS, MASTERY_RULES, monthDays, reviewCalendar, shiftMonth, type Dimension, type InsightsSource, type LearningArea, type LearningRow, type Mastery } from './learning-insights';

const h=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const areaName=(area:LearningArea)=>area==='culture'?'文化史':'年号';
const percent=(n:number,total:number)=>total?Math.round(n/total*100):0;
const statuses=Object.keys(MASTERY_LABELS) as Mastery[];
export class LearningInsightsUI {
  private month=japanDateKey().slice(0,7);
  private selectedDate=japanDateKey();
  private calendarArea:LearningArea|'all'='all';
  private calendarScope:'date'|'due'|'overdue'='date';
  private dashboardArea:LearningArea='culture';
  private status:Mastery|'all'='all';
  private dimension:Dimension|null=null;
  private group='';
  private listLimit=30;
  constructor(private read:()=>InsightsSource,private rerender:()=>void,private study:(area:LearningArea,ids:string[])=>void,private dashboard:()=>string=()=>'' ){}
  private update(focus?:string){this.rerender();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}
  private switcher(page:'calendar'|'mastery'){
    const current=page==='calendar'?this.calendarArea:this.dashboardArea;
    return `<div class="insight-switch" role="group" aria-label="集計する学習エリア">${(page==='calendar'?['all','culture','years']:['culture','years']).map(area=>`<button data-insight-area="${area}" data-insight-page="${page}" aria-pressed="${current===area}">${area==='all'?'両方':areaName(area as LearningArea)}</button>`).join('')}</div>`;
  }
  private header(page:'calendar'|'mastery'){
    return `<section class="page-heading"><div><div class="eyebrow">YOUR LEARNING, CLEARLY</div><h1>${page==='calendar'?'世界史復習カレンダー':'定着度ダッシュボード'}</h1><p>${page==='calendar'?'復習予定と実際の学習を、日本時間で確認。':'最近の回答と復習時期から、次に学ぶ範囲を見つけます。'}</p></div></section><nav class="insight-pages" aria-label="学習管理の画面"><button class="button ${page==='calendar'?'primary':'secondary'}" data-nav="calendar" ${page==='calendar'?'aria-current="page"':''}>復習カレンダー</button><button class="button ${page==='mastery'?'primary':'secondary'}" data-nav="mastery" ${page==='mastery'?'aria-current="page"':''}>定着度</button></nav>${this.switcher(page)}`;
  }
  private summary(rows:LearningRow[],now=Date.now()){
    const summary=dueSummary(rows,now);
    return `<div class="insight-stats"><div><span>いま期限到来</span><strong data-insight-due>${summary.due}</strong></div><div><span>うち期限超過</span><strong data-insight-overdue>${summary.overdue}</strong></div><div><span>今日の予定</span><strong>${summary.today}</strong></div></div><p class="small muted">今日の期限到来 ${summary.todayDue}問 ／ 今日これから ${summary.today-summary.todayDue}問</p>`;
  }
  private yearNotice(source:InsightsSource){return source.years?'':'<p class="notice" role="status">年号データを読み込み中、または保存領域を利用できません。年号エリアで保存状態を確認できます。</p>';}
  private practice(area:LearningArea,ids:string[],label:string){return `<button class="button ${area==='culture'?'primary':'secondary'}" data-insight-study="${area}" data-insight-ids="${h(JSON.stringify(ids))}" ${ids.length?'':'disabled'}>${h(label)}（${ids.length}問）</button>`;}
  private rowList(rows:LearningRow[]){
    return `<p class="small muted">対象 ${rows.length}問 ／ ${Math.min(this.listLimit,rows.length)}問を表示</p><div class="insight-targets">${rows.slice(0,this.listLimit).map(row=>`<article class="insight-target" data-insight-row="${h(row.id)}" data-insight-row-area="${row.area}"><div><span class="insight-area ${row.area}">${areaName(row.area)}</span><span class="insight-status ${row.mastery}">${MASTERY_LABELS[row.mastery]}</span><span class="insight-status">${URGENCY_LABELS[reviewUrgency(row.dueAt,row.recent.at(-1))]}</span></div><h3>${h(row.title)}</h3><p class="small muted">${h(row.region)} ／ ${h(row.era)} ／ Lv.${row.level}</p><p class="small">正答 ${row.correct} ／ 誤答 ${row.wrong} · 連続正答 ${row.streak}</p><p class="small muted">最終回答：${row.lastAt===null?'未学習':japanDateTime(row.lastAt)}<br>次回復習：${row.dueAt===null?'学習後に計算':japanDateTime(row.dueAt)}</p>${this.practice(row.area,[row.id],'この問題を学習')}</article>`).join('')||'<p class="insight-empty">この条件の対象はありません。</p>'}</div>${rows.length>this.listLimit?'<button class="button secondary" data-insight-more>さらに30問表示</button>':''}`;
  }
  calendar(){
    const now=Date.now(),source=this.read(),rows=learningRows(source,now),visible=rows.filter(row=>this.calendarArea==='all'||row.area===this.calendarArea),today=japanDateKey(now);
    const {scheduled,actual}=reviewCalendar(rows,source,this.calendarArea),selected=visible.filter(row=>row.dueAt!==null&&(this.calendarScope==='due'?row.dueAt<=now:this.calendarScope==='overdue'?japanDateKey(row.dueAt)<today:japanDateKey(row.dueAt)===this.selectedDate));
    const done=actual.get(this.selectedDate)??{culture:0,years:0,total:0};
    return `<div class="learning-insights" data-insight-view="calendar">${this.header('calendar')}${this.yearNotice(source)}${this.summary(visible,now)}<div class="insight-practice"><button class="button secondary" data-insight-scope="due">期限到来をまとめて見る</button><button class="button secondary" data-insight-scope="overdue">期限超過だけを見る</button></div><p class="insight-explainer">期限超過は前日以前の予定です。今日の予定には、これから期限を迎える問題も含みます。未学習には復習予定がありません。</p><section class="panel insight-calendar"><div class="insight-month"><button class="button secondary" data-insight-month="-1" aria-label="前の月">‹</button><h2>${h(this.month.replace('-','年'))}月</h2><button class="button secondary" data-insight-month="1" aria-label="次の月">›</button></div><button class="text-button" data-insight-today>今日に戻る</button><p class="small muted">文＝文化史 ／ 年＝年号 ／ 計＝予定合計<br>実績は実際の回答数です（予定とは別集計）。</p><div class="insight-calendar-grid"><div class="insight-weekdays" aria-hidden="true">${['日','月','火','水','木','金','土'].map(day=>`<span>${day}</span>`).join('')}</div><div class="insight-month-days">${monthDays(this.month).map(date=>{
      if(!date)return '<span class="insight-blank" aria-hidden="true"></span>';
      const day=scheduled.get(date)??{culture:0,years:0,total:0},history=actual.get(date),label=`${date} 復習予定：文化史${day.culture}問、年号${day.years}問、合計${day.total}問。実際の回答${history?.total??0}回`;
      return `<button id="insight-date-${date}" class="insight-date ${date===today?'is-today':''}" data-insight-date="${date}" aria-label="${h(label)}" aria-pressed="${date===this.selectedDate}" ${date===today?'aria-current="date"':''}><strong>${Number(date.slice(-2))}</strong><span class="culture">文 ${day.culture}</span><span class="years">年 ${day.years}</span><span>計 ${day.total}</span>${history?`<small>実 ${history.total}</small>`:''}</button>`;
    }).join('')}</div></div></section><section class="panel insight-selection" aria-labelledby="insight-day-title"><h2 id="insight-day-title">${this.calendarScope==='due'?'いま期限到来している問題':this.calendarScope==='overdue'?'期限超過している問題':h(this.selectedDate)+'の復習予定'}</h2><p>現在の予定：文化史 ${selected.filter(row=>row.area==='culture').length}問 ／ 年号 ${selected.filter(row=>row.area==='years').length}問</p>${this.calendarScope==='date'?`<p class="small muted">この日の実際の回答：文化史 ${done.culture}回 ／ 年号 ${done.years}回</p>`:''}<p class="small muted">回答すると予定は更新されます。過去の予定表を保存・再現する画面ではありません。</p><div class="insight-practice">${(['culture','years'] as LearningArea[]).filter(area=>this.calendarArea==='all'||this.calendarArea===area).map(area=>this.practice(area,selected.filter(row=>row.area===area).map(row=>row.id),`${areaName(area)}の対象を演習`)).join('')}</div>${this.rowList(selected)}</section></div>`;
  }
  mastery(){return this.dashboard();}
  bind(){
    document.querySelectorAll<HTMLButtonElement>('[data-insight-scope]').forEach(button=>button.onclick=()=>{this.calendarScope=button.dataset.insightScope as 'due'|'overdue';this.listLimit=30;this.update();document.getElementById('insight-day-title')?.scrollIntoView({block:'nearest'});});
    document.querySelectorAll<HTMLButtonElement>('[data-insight-area]').forEach(button=>button.onclick=()=>{if(button.dataset.insightPage==='calendar')this.calendarArea=button.dataset.insightArea as LearningArea|'all';else{this.dashboardArea=button.dataset.insightArea as LearningArea;this.dimension=null;this.status='all';}this.listLimit=30;this.update();});
    document.querySelectorAll<HTMLButtonElement>('[data-insight-date]').forEach(button=>button.onclick=()=>{this.calendarScope='date';this.selectedDate=button.dataset.insightDate!;this.listLimit=30;this.update('insight-date-'+this.selectedDate);});
    document.querySelectorAll<HTMLButtonElement>('[data-insight-month]').forEach(button=>button.onclick=()=>{this.calendarScope='date';this.month=shiftMonth(this.month,Number(button.dataset.insightMonth));this.selectedDate=this.month===japanDateKey().slice(0,7)?japanDateKey():this.month+'-01';this.listLimit=30;this.update();});
    const today=document.querySelector<HTMLButtonElement>('[data-insight-today]');if(today)today.onclick=()=>{this.calendarScope='date';this.selectedDate=japanDateKey();this.month=this.selectedDate.slice(0,7);this.listLimit=30;this.update('insight-date-'+this.selectedDate);};
    document.querySelectorAll<HTMLButtonElement>('[data-insight-status]').forEach(button=>button.onclick=()=>{this.status=button.dataset.insightStatus as Mastery;this.listLimit=30;this.update();document.getElementById('insight-filter-title')?.scrollIntoView({block:'nearest'});});
    document.querySelectorAll<HTMLButtonElement>('[data-insight-dimension]').forEach(button=>button.onclick=()=>{this.dimension=button.dataset.insightDimension as Dimension;this.group=button.dataset.insightGroup!;this.listLimit=30;this.update();document.getElementById('insight-filter-title')?.scrollIntoView({block:'nearest'});});
    const reset=document.querySelector<HTMLButtonElement>('[data-insight-reset]');if(reset)reset.onclick=()=>{this.dimension=null;this.status='all';this.listLimit=30;this.update();};
    const more=document.querySelector<HTMLButtonElement>('[data-insight-more]');if(more)more.onclick=()=>{this.listLimit+=30;this.update();};
    document.querySelectorAll<HTMLButtonElement>('[data-insight-study]').forEach(button=>button.onclick=()=>this.study(button.dataset.insightStudy as LearningArea,JSON.parse(button.dataset.insightIds!)));
  }
}
