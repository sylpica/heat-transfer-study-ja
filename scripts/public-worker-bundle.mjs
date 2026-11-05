import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';

// WebKit can load a cached module-worker entry while fetching its imports from
// the unavailable network on a new offline document. Ship one self-contained
// worker; source modules stay separate for review and development.
export async function buildPublicWorker({root,output,allowedSources}){
 const result=await build({absWorkingDir:root,entryPoints:['dynamic/worker.mjs'],bundle:true,
  format:'esm',platform:'browser',target:'es2020',minify:false,sourcemap:false,
  write:false,metafile:true,legalComments:'inline'});
 const allowed=new Set(allowedSources),inputs=Object.keys(result.metafile.inputs);
 for(const input of inputs){
  const path=relative(root,resolve(root,input)).split('\\').join('/');
  if(isAbsolute(path)||!path.startsWith('dynamic/')||path.startsWith('dynamic/dev/')||!path.endsWith('.mjs')||!allowed.has(path))
   throw Error('公開Workerに許可外の依存があります: '+path);
 }
 if(result.outputFiles.length!==1||Object.values(result.metafile.outputs).some(value=>value.imports.length))
  throw Error('公開Workerの外部依存を解消できませんでした。');
 // Validation must finish before replacing any distribution file.
 await writeFile(resolve(output,'dynamic/worker.mjs'),result.outputFiles[0].contents);
 return {inputs,bytes:result.outputFiles[0].contents.length};
}
