// Correctly rounded quotient of two exact dyadics, with no Float64 division
// of already underflowed/overflowed polynomial intermediates.
export function dyadicQuotient(a,b){
 if(!a||!b||typeof a.n!=='bigint'||typeof b.n!=='bigint'||!Number.isSafeInteger(a.e)||!Number.isSafeInteger(b.e)||Math.abs(a.e)>10000||Math.abs(b.e)>10000||b.n===0n)throw Error('正確な二進有理数の商が不正です。');
 if(a.n===0n)return 0;const negative=(a.n<0n)!==(b.n<0n),n=a.n<0n?-a.n:a.n,d=b.n<0n?-b.n:b.n,e=a.e-b.e,bn=n.toString(2).length,bd=d.toString(2).length;let ratioExponent=bn-bd;
 if(ratioExponent>=0?n<(d<<BigInt(ratioExponent)):(n<<BigInt(-ratioExponent))<d)ratioExponent--;
 const exponent=ratioExponent+e;if(exponent>1023||exponent< -1075)throw Error('非ゼロの幾何比が浮動小数点で解像できません。');
 const quantum=Math.max(-1074,exponent-52),shift=e-quantum,num=shift>=0?n<<BigInt(shift):n,den=shift>=0?d:d<<BigInt(-shift);let q=num/den;const remainder=num-q*den,twice=2n*remainder;if(twice>den||(twice===den&&(q&1n)!==0n))q++;
 const magnitude=Number(q)*2**quantum;if(!Number.isFinite(magnitude)||magnitude===0)throw Error('非ゼロの幾何比が浮動小数点で解像できません。');return negative?-magnitude:magnitude;
}
