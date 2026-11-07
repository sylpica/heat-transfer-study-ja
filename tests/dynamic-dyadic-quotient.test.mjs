import test from 'node:test';import assert from 'node:assert/strict';import {dyadicQuotient} from '../dynamic/dev/dyadic-quotient.mjs';
test('exact dyadic ratios round once to nearest-even for ordinary and subnormal ties without overflowing intermediates',()=>{
 assert.equal(dyadicQuotient({n:1n,e:0},{n:3n,e:0}),1/3);assert.equal(dyadicQuotient({n:-1n,e:0},{n:3n,e:0}),-1/3);assert.equal(dyadicQuotient({n:0n,e:-10000},{n:1n,e:0}),0);
 assert.equal(dyadicQuotient({n:3n,e:-1075},{n:1n,e:0}),2*Number.MIN_VALUE);assert.equal(dyadicQuotient({n:5n,e:-1075},{n:1n,e:0}),2*Number.MIN_VALUE);
 assert.equal(dyadicQuotient({n:(1n<<53n)+1n,e:-53},{n:1n,e:0}),1);assert.equal(dyadicQuotient({n:(1n<<53n)+3n,e:-53},{n:1n,e:0}),1+2*Number.EPSILON);
 const huge={n:(1n<<1000n)+1n,e:9000};assert.equal(dyadicQuotient(huge,huge),1);assert.equal(dyadicQuotient({n:1n,e:-1074},{n:1n,e:0}),Number.MIN_VALUE);
});
test('invalid, nonzero underflow and overflowing quotients reject instead of becoming a zero or infinite conductance',()=>{
 for(const [a,b]of [[{n:1n,e:-1075},{n:1n,e:0}],[{n:1n,e:1024},{n:1n,e:0}],[{n:1n,e:0},{n:0n,e:0}],[{n:1,e:0},{n:1n,e:0}],[{n:1n,e:Infinity},{n:1n,e:0}]])assert.throws(()=>dyadicQuotient(a,b));
});
