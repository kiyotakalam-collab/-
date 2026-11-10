import { validateAmbiguousCatalog, type AmbCatalog } from '../src/ambiguous';
export const AMB_TIME='2026-11-10T03:00:00.000Z';
export function ambiguousFixture():AmbCatalog {
  const source={title:'架空教材のテスト専用出典',url:'https://example.org/amb-test'},base={version:1,updatedAt:AMB_TIME,deleted:false,verification:'verified',sources:[source]};
  const terms=['a','b','c','d','e','f'].map((id,i)=>({...base,id:'at-test-'+id,name:'架空用語'+id,aliases:['架空別名'+id],date:String(9000+i),region:i%2?'架空地域B':'架空地域A',era:'架空時代',field:i%2?'架空分野B':'架空分野A',description:'架空の比較テスト用語。実際の歴史教材ではない。',relatedEvents:[]}));
  const group={...base,id:'ag-test-six',name:'架空の6用語の区別',termIds:terms.map(t=>t.id),causes:['名称類似','年代近接'],registrationReason:'以前間違えたという架空の登録理由。回答記録にはしない。',essentialPoint:'架空の値を比較する。',orderingNotes:'テスト専用の架空の順序。',description:'架空の比較グループ。',comparison:[{key:'partner',label:'架空の相手',values:Object.fromEntries(terms.map(t=>[t.id,'架空の相手'+t.id]))}],relationships:[{fromId:terms[0].id,toId:terms[1].id,type:'before',description:'架空データでの前後関係。',sources:[source],verification:'verified'}]};
  const card={...base,groupId:group.id,termIds:[terms[0].id],optionTermIds:[],optionLabels:{},correctTermId:null,distractors:[],answer:'架空用語a',explanation:'これはテスト専用の架空の解説。'};
  return validateAmbiguousCatalog({schemaVersion:1,version:2,updatedAt:AMB_TIME,terms,groups:[group,{...group,id:'ag-test-shared',name:'架空の共有用語の区別',termIds:terms.slice(0,2).map(t=>t.id),comparison:[],relationships:[]}],cards:[
    {...card,id:'ac-test-recall',kind:'recall',prompt:'架空の説明Aに該当する用語は？'},
    {...card,id:'ac-test-recall-b',kind:'recall',termIds:[terms[1].id],prompt:'架空の説明Bに該当する用語は？',answer:'架空用語b'},
    {...card,id:'ac-test-choice',kind:'identify',prompt:'架空の条件Xに合う用語を選べ。',optionTermIds:terms.slice(0,3).map(t=>t.id),correctTermId:terms[0].id,distractors:terms.slice(1,3).map(t=>({termId:t.id,explanation:'架空の条件Xでは誤答になる。',sources:[source],verification:'verified'}))},
    {...card,id:'ac-test-compare',kind:'compare',termIds:terms.map(t=>t.id),prompt:'架空の6用語の相手を比較せよ。',answer:'テスト専用の比較正答。'},
  ]});
}
