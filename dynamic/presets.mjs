// A few physical facts, independently organized. No source table or book prose is copied.
export const MATERIALS=[
 {id:'copper',name:'純銅',k:398,rho:8954,cp:384},
 {id:'al6061',name:'アルミニウム6061-T6',k:167,rho:2700,cp:896},
 {id:'iron',name:'純鉄',k:80,rho:7897,cp:447}
].map(m=>({...m,referenceTemperature:293.15,source:'A Heat Transfer Textbook 6.00, Appendix A, Table A.1 (PDF753 / book739)',limitation:'20℃の参考値を一定とする教育近似。純度/加工/温度による差を解かず、任意温度での実物性を保証しない。'}));
export function preset(id='heating',nx=24){
 const c={nx,ny:Math.round(nx/2),width:.1,height:.05,depth:.005,materials:[{...MATERIALS[1]}],initial:293.15,boundaries:{left:{type:'temperature',temperature:333.15}},source:0};
 if(id==='cooling'){c.initial=333.15;c.boundaries={left:{type:'convection',temperature:293.15,h:80},right:{type:'convection',temperature:293.15,h:80},top:{type:'convection',temperature:293.15,h:80},bottom:{type:'convection',temperature:293.15,h:80}};}
 if(id==='fin'){c.width=.05;c.height=.005;c.ny=1;c.depth=.005;c.distributedConvection={h:30,areaPerVolume:2*(c.height+c.depth)/(c.height*c.depth),temperature:293.15};c.boundaries.left.temperature=333.15;}
 if(id==='radiation'){c.initial=333.15;c.boundaries=Object.fromEntries(['left','right','top','bottom'].map(s=>[s,{type:'radiation',temperature:293.15,emissivity:.8}]));}
 return c;
}
