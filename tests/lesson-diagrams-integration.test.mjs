import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LESSON_DIAGRAMS, LESSON_DIAGRAM_PATHS, lessonDiagramPath, lessonDiagramSize } from '../lesson-diagrams.mjs';

const root = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, root), 'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');

test('lesson diagram registry covers the 76 integrated sections exactly once', () => {
  const ids = Object.keys(LESSON_DIAGRAMS);
  assert.equal(ids.length, 76);
  assert.equal(new Set(Object.values(LESSON_DIAGRAMS)).size, 76);
  assert.equal(LESSON_DIAGRAM_PATHS.length, 76);
  for (const id of ['10.2', '10.5', '10.6']) assert.ok(LESSON_DIAGRAMS[id], `chapter 10 addition missing: ${id}`);
});

test('every registered diagram asset and its dedicated test exist on disk', () => {
  for (const [sectionId, file] of Object.entries(LESSON_DIAGRAMS)) {
    assert.ok(existsSync(new URL(`assets/lesson-diagrams/${file}`, root)), `missing SVG for ${sectionId}`);
    const slug = sectionId.replace('.', '-');
    assert.ok(existsSync(new URL(`tests/lesson-diagram-${slug}.test.mjs`, root)), `missing dedicated test for ${sectionId}`);
    const svg = read(`assets/lesson-diagrams/${file}`);
    assert.match(svg, new RegExp(`data-lesson="${sectionId.replace('.', '\\.')}"`));
    assert.equal(lessonDiagramPath(sectionId), `./assets/lesson-diagrams/${file}`);
  }
  assert.equal(lessonDiagramPath('12.1'), null);
});

test('reader UI, public build allowlist and service worker all reference the diagrams', () => {
  const app = read('app.js');
  assert.match(app, /from '\.\/lesson-diagrams\.mjs'/);
  assert.match(app, /renderLessonDiagram\(section\.id\)/);
  assert.match(app, /const LEGACY_STORAGE_KEY = 'heat-study-ja:v1';/, 'storage key scheme must stay untouched');
  const build = read('scripts/build-public-site.mjs');
  assert.match(build, /LESSON_DIAGRAM_PATHS/);
  assert.match(build, /'lesson-diagrams\.mjs'/);
  const sw = read('sw.js');
  assert.ok(sw.includes("'./lesson-diagrams.mjs'"));
  for (const path of LESSON_DIAGRAM_PATHS) assert.ok(sw.includes(`'./${path}'`), `service worker must precache ${path}`);
});

test('lazy lesson images reserve the exact intrinsic SVG proportions before decoding',()=>{
 for(const [id,file] of Object.entries(LESSON_DIAGRAMS)){const svg=read(`assets/lesson-diagrams/${file}`),tag=svg.match(/<svg\b[^>]*>/)[0],width=Number(tag.match(/\bwidth="(\d+)"/)[1]),height=Number(tag.match(/\bheight="(\d+)"/)[1]);assert.deepEqual(lessonDiagramSize(id),{width,height},id);}
 assert.equal(lessonDiagramSize('__proto__'),null);assert.equal(lessonDiagramSize('99.1'),null);assert.match(read('app.js'),/figureSizeAttributes\(lessonDiagramSize\(sectionId\)\|\|\{\}\)/);
});
