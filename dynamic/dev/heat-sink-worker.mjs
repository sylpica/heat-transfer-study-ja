import {installWorkerRuntime} from '../worker-runtime.mjs';import {createHeatSink} from './heat-sink.mjs';
installWorkerRuntime(data=>{if(data.kind!=='heat-sink')throw Error('有限容量基部と同一フィンの開発モデルだけです。');return createHeatSink(data.config);});
