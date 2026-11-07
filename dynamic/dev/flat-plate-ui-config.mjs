// UI preset uses the existing 300 K air reference facts, not a new material fit.
const grids=new Map([['32x16',[32,16]],['64x32',[64,32]],['128x64',[128,64]],['256x128',[256,128]],['512x128',[512,128]],['512x256',[512,256]]]);
export function airFlatPlateConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['velocity','wallDifference','grid'].includes(k)))throw Error('平板画面の条件が不正です。');
 const {velocity:U,wallDifference:delta,grid}=input,L=.1,nu=1.575e-5;
 if(typeof U!=='number'||!Number.isFinite(U)||U<1.575*(1-8*Number.EPSILON)||U>15.75*(1+8*Number.EPSILON)||typeof delta!=='number'||!Number.isFinite(delta)||Math.abs(delta)>30||!grids.has(grid))throw Error('外流速度1.575〜15.75 m/s、壁温差±30 K、対応格子を指定してください。');
 const [nx,ny]=grids.get(grid),H=12*Math.sqrt(nu*L/U);
 return {width:L,height:H,depth:.01,nx,ny,nu,rho:1.177,freeStreamVelocity:U,cp:1006,k:.0264,inletTemperature:300,wallTemperature:300+delta,initial:300};
}
