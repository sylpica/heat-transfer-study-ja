// DOM-independent configuration layer for the transient-brick-3d
// development screen: face definitions, presets, the form-value ->
// core-input builder, and the cross-section (slice) extraction from a
// core snapshot. The builder passes exactly the keys each boundary kind
// allows, because the core refuses unknown boundary keys instead of
// ignoring them; every other validation is the core's own, so its
// Japanese refusal reasons reach the screen unchanged.
export const BRICK_FACES=[
 {key:'xMin',label:'x− 面（x = 0）',axis:0,side:-1},
 {key:'xMax',label:'x+ 面（x = Lx）',axis:0,side:1},
 {key:'yMin',label:'y− 面（y = 0）',axis:1,side:-1},
 {key:'yMax',label:'y+ 面（y = Ly）',axis:1,side:1},
 {key:'zMin',label:'z− 面（z = 0）',axis:2,side:-1},
 {key:'zMax',label:'z+ 面（z = Lz）',axis:2,side:1}];
export const BRICK_FACE_KEYS=BRICK_FACES.map(f=>f.key);
export const BOUNDARY_TYPES=[
 {value:'insulated',label:'断熱'},
 {value:'temperature',label:'温度指定'},
 {value:'flux',label:'熱流束（内向き）'},
 {value:'convection',label:'対流'}];
const face=(type,extra={})=>({type,...extra});
// Form values are plain data: lengths in mm, temperatures in K,
// flux in W/m^2, h in W/(m^2 K). faces[key] carries every parameter
// field; buildBrickInput keeps only the ones the chosen kind allows.
export function buildBrickInput(v){
 const boundaries={};
 for(const key of BRICK_FACE_KEYS){
  const f=v.faces[key];
  if(f.type==='temperature')boundaries[key]=face('temperature',{temperature:f.temperature});
  else if(f.type==='flux')boundaries[key]=face('flux',{flux:f.flux});
  else if(f.type==='convection')boundaries[key]=face('convection',{h:f.h,temperature:f.fluidTemperature});
  else boundaries[key]=face('insulated');
 }
 return {size:{x:v.sizeMm.x/1000,y:v.sizeMm.y/1000,z:v.sizeMm.z/1000},
  cells:{nx:v.cells.nx,ny:v.cells.ny,nz:v.cells.nz},
  k:v.k,rho:v.rho,cp:v.cp,initial:v.initial,boundaries};
}
export const BRICK_PRESETS=[
 {id:'manual',label:'手入力',values:null},
 {id:'asymmetric',label:'非対称の混合境界',values:{
  sizeMm:{x:100,y:80,z:60},cells:{nx:12,ny:10,nz:8},k:25,rho:900,cp:1100,initial:300,frameSeconds:5,
  faces:{xMin:{type:'temperature',temperature:380},xMax:{type:'convection',h:25,fluidTemperature:300},
   yMin:{type:'flux',flux:2000},yMax:{type:'insulated'},
   zMin:{type:'insulated'},zMax:{type:'convection',h:10,fluidTemperature:290}}}},
 {id:'dirichlet-cube',label:'全面温度指定の立方体',values:{
  sizeMm:{x:100,y:100,z:100},cells:{nx:8,ny:8,nz:8},k:10,rho:1000,cp:1000,initial:300,frameSeconds:25,
  faces:{xMin:{type:'temperature',temperature:350},xMax:{type:'temperature',temperature:350},
   yMin:{type:'temperature',temperature:350},yMax:{type:'temperature',temperature:350},
   zMin:{type:'temperature',temperature:350},zMax:{type:'temperature',temperature:350}}}},
 {id:'flux-convection',label:'一面流束＋対向面対流',values:{
  sizeMm:{x:100,y:80,z:60},cells:{nx:8,ny:6,nz:5},k:25,rho:900,cp:1100,initial:300,frameSeconds:10,
  faces:{xMin:{type:'flux',flux:5000},xMax:{type:'convection',h:50,fluidTemperature:290},
   yMin:{type:'insulated'},yMax:{type:'insulated'},zMin:{type:'insulated'},zMax:{type:'insulated'}}}}];
export const DEFAULT_PRESET='asymmetric';
// Slice planes: 'xy' fixes z, 'xz' fixes y, 'yz' fixes x. Rows run
// from the largest fixed-perpendicular coordinate downwards so the
// vertical axis of the drawing points along +rowAxis.
export const SLICE_PLANES={
 xy:{fixed:2,colAxis:0,rowAxis:1,colName:'x',rowName:'y',fixedName:'z'},
 xz:{fixed:1,colAxis:0,rowAxis:2,colName:'x',rowName:'z',fixedName:'y'},
 yz:{fixed:0,colAxis:1,rowAxis:2,colName:'y',rowName:'z',fixedName:'x'}};
export const cellIndex=(nx,ny,i,j,l)=>i+nx*(j+ny*l);
export function sliceField(snapshot,plane,fixedIndex){
 const spec=SLICE_PLANES[plane];if(!spec)throw Error('断面の向きが不正です。');
 const counts=[snapshot.nx,snapshot.ny,snapshot.nz];
 const fixed=Math.min(counts[spec.fixed]-1,Math.max(0,Math.trunc(fixedIndex)||0));
 const nCol=counts[spec.colAxis],nRow=counts[spec.rowAxis];
 const centres=[snapshot.centres.x,snapshot.centres.y,snapshot.centres.z];
 const values=[];
 for(let r=0;r<nRow;r++){
  const rowCoord=nRow-1-r,row=[];
  for(let c=0;c<nCol;c++){
   const coord=[0,0,0];coord[spec.fixed]=fixed;coord[spec.colAxis]=c;coord[spec.rowAxis]=rowCoord;
   row.push(snapshot.temperature[cellIndex(snapshot.nx,snapshot.ny,coord[0],coord[1],coord[2])]);
  }
  values.push(row);
 }
 return {plane,fixedAxis:spec.fixed,fixedIndex:fixed,fixedCentre:centres[spec.fixed][fixed],
  colAxis:spec.colAxis,rowAxis:spec.rowAxis,colName:spec.colName,rowName:spec.rowName,fixedName:spec.fixedName,
  nCol,nRow,colCentres:centres[spec.colAxis],rowCentres:centres[spec.rowAxis].slice().reverse(),values};
}
// Map a (row, col) position inside a slice back to the (i, j, l) cell.
export function sliceCell(slice,row,col){
 const coord=[0,0,0];
 coord[slice.fixedAxis]=slice.fixedIndex;
 coord[slice.colAxis]=col;
 coord[slice.rowAxis]=slice.nRow-1-row;
 return {i:coord[0],j:coord[1],l:coord[2]};
}
export function probeTemperature(snapshot,cell){
 return snapshot.temperature[cellIndex(snapshot.nx,snapshot.ny,cell.i,cell.j,cell.l)];
}
