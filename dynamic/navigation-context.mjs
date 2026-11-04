import {sectionContextFromSearch} from '../dynamic-navigation.mjs';
export function attachNavigationContext(root,preset){
 const id=sectionContextFromSearch(location.search,preset);if(!id)return;
 const p=document.createElement('p'),a=document.createElement('a');p.id='source-context';p.append(document.createTextNode('教材に関連する代表実験です。数値はアプリの初期設定で、原本の例題の条件を再現したものではありません。 '));a.id='source-lesson';a.href='../index.html#reader/'+id;a.textContent='元の教材 §'+id+'へ戻る';p.append(a);root.prepend(p);
}
