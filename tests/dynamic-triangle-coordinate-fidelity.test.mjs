import test from 'node:test';import assert from 'node:assert/strict';
import {createConvexTriangleMesh} from '../dynamic/dev/convex-triangle-mesh.mjs';
import {createBoundaryRefinedTriangleMesh} from '../dynamic/dev/boundary-refined-triangle-mesh.mjs';
const box=(offset,L,H=L)=>[[offset,offset],[offset+L,offset],[offset+L,offset+H],[offset,offset+H]];
test('distinct but quantized large-offset coordinates reject rather than representing a distorted physical mesh as the normalized PDE geometry',()=>{
 for(const offset of [1e12,1e14,1e15])for(const subdivisions of [3,5,10]){const input={outline:box(offset,4),subdivisions},before=structuredClone(input);assert.throws(()=>createConvexTriangleMesh(input),/物理座標.*精度|物理.*面積.*精度/);assert.deepEqual(input,before);}
});
test('exactly representable large translations and small/slender shapes preserve both physical coordinates and element areas',()=>{
 for(const input of [{outline:box(1e9,1),subdivisions:4},{outline:box(1e15,4),subdivisions:16},{outline:box(2**53,64),subdivisions:4},{outline:box(3e15,3),subdivisions:3},{outline:box(0,1e-12),subdivisions:4},{outline:[[0,0],[1,0],[.4,1e-9]],subdivisions:4}]){const m=createConvexTriangleMesh(input);assert.ok(m.numerics.maximumPhysicalCoordinateReconstructionNormalizedError<=4096*Number.EPSILON);assert.ok(m.numerics.maximumPhysicalElementAreaRelativeError<=4096*Number.EPSILON);assert.equal(m.numerics.physicalCoordinateFidelityChecked,true);assert.equal(m.numerics.physicalCoordinateNormalizedErrorBudget,4096*Number.EPSILON);}
});
test('boundary midpoint additions also preserve the declared physical-coordinate and element-area fidelity budgets',()=>{
 const m=createBoundaryRefinedTriangleMesh({outline:box(1e15,4,2),subdivisions:4});assert.ok(m.numerics.boundaryRefinement.splits>0);assert.ok(m.numerics.maximumPhysicalCoordinateReconstructionNormalizedError<=m.numerics.physicalCoordinateNormalizedErrorBudget);assert.ok(m.numerics.maximumPhysicalElementAreaRelativeError<=m.numerics.physicalElementAreaRelativeErrorBudget);
});
