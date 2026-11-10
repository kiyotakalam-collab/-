import { ERROR_CAUSES, type CauseArea, type ErrorCause } from './error-causes';
export class ErrorCauseUI {
  private pending:{area:CauseArea;eventId:string}|null=null;
  private busy=false;
  constructor(private save:(area:CauseArea,id:string,cause:ErrorCause|null)=>Promise<void>,private render:()=>void,private notify:(message:string,error?:boolean)=>void){}
  offer(area:CauseArea,eventId:string){this.pending={area,eventId};}
  html(){return this.pending?`<details class="panel error-cause-prompt"><summary>直前の誤答：失点原因を記録する（任意）</summary><p class="small muted">入力しなくても演習を続けられます。未入力は「原因未記録」です。</p><label class="form-field">失点原因<select id="pending-error-cause"><option value="">原因未記録</option>${Object.entries(ERROR_CAUSES).map(([key,label])=>`<option value="${key}">${key}：${label}</option>`).join('')}</select></label><div class="insight-practice"><button class="button secondary" data-error-cause-save ${this.busy?'disabled':''}>原因を保存</button><button class="text-button" data-error-cause-skip>あとで</button></div></details>`:'';}
  bind(){
    const save=document.querySelector<HTMLButtonElement>('[data-error-cause-save]');if(save)save.onclick=async()=>{if(this.busy||!this.pending)return;const pending=this.pending,cause=(document.querySelector<HTMLSelectElement>('#pending-error-cause')?.value||null) as ErrorCause|null;this.busy=true;save.disabled=true;try{await this.save(pending.area,pending.eventId,cause);if(this.pending===pending)this.pending=null;this.notify('失点原因を保存しました。回答と復習予定は変更していません。');}catch(error){this.notify(String(error),true);}finally{this.busy=false;this.render();}};
    const skip=document.querySelector<HTMLButtonElement>('[data-error-cause-skip]');if(skip)skip.onclick=()=>{this.pending=null;this.render();};
  }
}
