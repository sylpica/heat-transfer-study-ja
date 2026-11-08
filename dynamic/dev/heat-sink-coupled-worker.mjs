// Worker entry for the coupled heat-sink dev screen.  The steady coupled
// solve is a single heavy call (tens of thousands of unknowns at r=4), so
// it runs off the main thread; the core module is used unchanged and its
// refusal messages are forwarded verbatim.
import {solveHeatSinkCoupled} from './heat-sink-coupled.mjs';
self.onmessage=({data})=>{
 try{
  const solved=solveHeatSinkCoupled(data.input,data.options);
  const {theta,baseId,finId,fluidId,...result}=solved;
  self.postMessage({type:'result',result});
 }catch(error){
  self.postMessage({type:'error',message:error.message});
 }
};
