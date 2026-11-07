import {installWorkerRuntime} from '../worker-runtime.mjs';
import {createCavity} from './cavity.mjs';
// No manufactured callbacks or code expressions are accepted over this port.
installWorkerRuntime(data=>{if(data.kind!=='cavity')throw Error('開発用キャビティだけです。');return createCavity(data.config);});
