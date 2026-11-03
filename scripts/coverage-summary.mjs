import {readFile} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {GUIDE_SECTIONS} from '../guide.mjs';
import {learningCoverage} from '../learning-coverage.mjs';
import {questionFieldGroup,FIELD_GROUP_ORDER} from '../chapter-curriculum.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const [book,questions,glossary,contentManifest,originalNotes,deepLessons]=await Promise.all([
  read('data/book.json'),read('data/questions.json'),read('data/glossary.json'),
  read('data/content-manifest.json'),read('data/original-notes.json'),read('data/original-deep-lessons.json')
]);
const report=learningCoverage({book,questions,glossary,guides:GUIDE_SECTIONS,contentManifest,originalNotes,deepLessons});
const japanese=new Set();
for(const path of contentManifest.files||[]){
  if(typeof path!=='string'||!/^\.?\/?data\/sections\/[\w.-]+\.json$/.test(path))throw new Error('公開本文のマニフェスト経路を検査してください。');
  const data=await read(path);
  if(data.language==='ja'&&typeof data.sectionId==='string'&&Array.isArray(data.blocks)&&data.blocks.length)japanese.add(data.sectionId);
}
report.publicJapaneseSections=japanese.size;
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
  console.log('教材の範囲と履歴（書籍全文の完成率ではない）');
  console.log('原本PDFページ数:',report.pdfPages,'/ 書籍の節数:',report.textbookSections);
  console.log('公開版で日本語本文を実際に収録した節:',report.publicJapaneseSections,'/',report.textbookSections);
  console.log('独立執筆の日本語節別概念ノート:',report.independentlyAuthoredJapaneseNotes,'/',report.textbookSections,'節（原本訳文・専門家校閲済み本文ではない）');
  console.log('独立作成の節別4択確認問題がある節:',report.sectionsWithIndependentCheckQuestions,'/',report.textbookSections);
  console.log('追加の独立執筆の詳細日本語講義:',report.originalDeepLessons,'/',report.textbookSections,'節（外部専門家校閲・原本全文訳ではない）');
  console.log('旧PCの本文・下書き存在記録:',report.oldPcDraftOrPrivateRecordSections,'/',report.textbookSections,'（実物未移行・独立未検証）');
  console.log('公開演習:',report.totalQuestions,'問（独立補足・応用',report.appCreatedQuestions,'問 / 書籍出典',report.bookCitedQuestions,'問）');
  console.log('書籍出典問題が存在する節:',report.sectionsWithBookCitedQuestions,'/',report.textbookSections);
  console.log('独立作成の章別補助講座:',report.originalChapterGuides,'/',report.chapterCount,'章 / 章別独自演習あり:',report.chaptersWithOriginalPractice,'/',report.chapterCount,'章');
  console.log('アプリ独自ガイド:',report.guideEntries,'項目 / 用語:',report.glossaryTerms,'項目');
  console.log('アプリの分野（章の主題）別問題数:',JSON.stringify(Object.fromEntries(FIELD_GROUP_ORDER.map(group=>[group,questions.filter(q=>questionFieldGroup(q,GUIDE_SECTIONS)===group).length]))));
  console.log('作成時の細分類ラベル別問題数:',JSON.stringify(report.practiceByField));
  console.log('章別の書籍出典問題:',JSON.stringify(report.chapters));
  console.log('注意: PDFの掲載、下書きの存在、問題数は全文翻訳・専門家校閲・全機能完成を示さない。');
}
