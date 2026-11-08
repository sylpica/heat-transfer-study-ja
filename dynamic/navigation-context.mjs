import {sectionContextFromSearch} from '../dynamic-navigation.mjs';
export function attachNavigationContext(root,preset){
 const id=sectionContextFromSearch(location.search,preset);if(!id)return;
 const p=document.createElement('p'),a=document.createElement('a');p.id='source-context';p.append(document.createTextNode('教材に関連する代表実験です。数値はアプリの初期設定で、原本の例題の条件を再現したものではありません。 '));a.id='source-lesson';a.href='../index.html#reader/'+id;a.textContent='元の教材 §'+id+'へ戻る';p.append(a);root.prepend(p);
}
export function attachLaunchContext(root,{launch=null,error=null}={}){
 if(!launch&&!error)return;
 const aside=document.createElement('aside'),p=document.createElement('p');aside.id='launch-context';aside.setAttribute('aria-label','受け取った実験条件');p.id='launch-description';p.textContent=error?error.message:launch.description;aside.append(p);
 if(launch){const a=document.createElement('a');a.id='launch-lesson';a.href='../index.html#reader/'+launch.sectionId;a.textContent='対応する教材の節へ戻る';aside.append(a);const note=document.createElement('p');note.textContent='入力を編集した後は、設問の条件と一致するとは限りません。初期化・再生で定常状態まで自動的に到達するわけではありません。';aside.append(note);}
 root.prepend(aside);
}
