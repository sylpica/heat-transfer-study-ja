// Independently written filtered signs for finite IEEE coordinates.
// BigInt dyadic fallback evaluates the polynomial on the supplied doubles,
// not a decimal reconstruction. These signs do not certify a mesh's quality.
const EPS=Number.EPSILON,MIN_NORMAL=2**-1022,view=new DataView(new ArrayBuffer(8));
// Keep every degree-four intermediate in the normal range for the filtered
// path. Extreme or mixed scales go directly to exact dyadics; a lost small
// product must not make the floating error estimate spuriously small.
const filterRange=values=>values.every(v=>v===0||(Number.isFinite(v)&&Math.abs(v)>=2**-128&&Math.abs(v)<=2**128));
function point(p){if(!Array.isArray(p)||p.length!==2||p.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('幾何述語は有限な2座標です。');return p;}
function dyad(x){if(x===0)return {n:0n,e:0};view.setFloat64(0,x,false);const bits=view.getBigUint64(0,false),q=Number((bits>>52n)&2047n),n=(bits&((1n<<52n)-1n))+(q?1n<<52n:0n);return {n:bits>>63n?-n:n,e:q?q-1075:-1074};}
const add=(a,b)=>{const e=Math.min(a.e,b.e);return {n:(a.n<<BigInt(a.e-e))+(b.n<<BigInt(b.e-e)),e};},neg=a=>({n:-a.n,e:a.e}),sub=(a,b)=>add(a,neg(b)),mul=(a,b)=>({n:a.n*b.n,e:a.e+b.e}),sign=a=>a.n>0n?1:a.n<0n?-1:0;
const exactDifference=(a,b)=>a.map((x,k)=>sub(dyad(x),dyad(b[k]))),cross=(a,b)=>sub(mul(a[0],b[1]),mul(a[1],b[0])),lift=a=>add(mul(a[0],a[0]),mul(a[1],a[1]));
export function orientation2D(a,b,c){
 point(a);point(b);point(c);const ax=a[0]-c[0],ay=a[1]-c[1],bx=b[0]-c[0],by=b[1]-c[1],p=ax*by,q=ay*bx,d=p-q,bound=64*EPS*(Math.abs(p)+Math.abs(q));
 if(filterRange([ax,ay,bx,by])&&Number.isFinite(d)&&Math.abs(d)>=MIN_NORMAL&&Math.abs(d)>bound)return {sign:Math.sign(d),exactFallback:false};
 return {sign:sign(cross(exactDifference(a,c),exactDifference(b,c))),exactFallback:true};
}
// Positive means d is inside the circumcircle of counterclockwise (a,b,c).
export function inCircle2D(a,b,c,d){
 point(a);point(b);point(c);point(d);const x=[a,b,c].map(p=>[p[0]-d[0],p[1]-d[1]]),l=x.map(p=>p[0]*p[0]+p[1]*p[1]),terms=[l[0]*x[1][0]*x[2][1],-l[0]*x[1][1]*x[2][0],-l[1]*x[0][0]*x[2][1],l[1]*x[0][1]*x[2][0],l[2]*x[0][0]*x[1][1],-l[2]*x[0][1]*x[1][0]],det=terms.reduce((s,v)=>s+v,0),bound=512*EPS*terms.reduce((s,v)=>s+Math.abs(v),0);
 if(filterRange(x.flat())&&Number.isFinite(det)&&Math.abs(det)>=MIN_NORMAL&&Math.abs(det)>bound)return {sign:Math.sign(det),exactFallback:false};
 const [u,v,w]=[a,b,c].map(p=>exactDifference(p,d)),exact=add(sub(mul(lift(u),cross(v,w)),mul(lift(v),cross(u,w))),mul(lift(w),cross(u,v)));
 return {sign:sign(exact),exactFallback:true};
}
