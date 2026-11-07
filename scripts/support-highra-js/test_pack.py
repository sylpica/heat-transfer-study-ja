from pathlib import Path
import sys,json,gzip,hashlib,unittest
import numpy as np
from scipy.fft import dctn,idctn
sys.path.insert(0,str(Path(__file__).parent))
from prepare_pack import js_dt,load,original
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/dynamic/support-highra-js'
def read(name):return json.loads((OUT/name).read_text())
def archive(row):
    b=(OUT/row['file']).read_bytes()
    assert hashlib.sha256(b).hexdigest()==row['sha256']
    return json.loads(gzip.decompress(b))

class ComparisonPackTests(unittest.TestCase):
    def test_packet_hashes_shapes_and_time_step_definitions(self):
        for r in read('PACK.json')['cases']+read('WARM_RUN_PACK.json')['cases']:
            p=archive(r);n=p['n'];self.assertEqual(len(p['initial']['u']),n*(n+1));self.assertEqual(len(p['initial']['v']),n*(n+1))
            self.assertEqual(len(p['initial']['temperatureOffset']),n*n)
            self.assertLessEqual(p['dt'],.1/(2*.71*n*n))
            self.assertLessEqual(p['dt'],.1/(n*np.sqrt(.71*p['ra']))*(1+1e-14))

    def test_projection_expectations_with_independent_full_rhs_dct(self):
        for r in read('PACK.json')['cases']:
            p=archive(r);n=p['n'];q=p['projection'];dt=p['dt']
            u=np.array(q['tentativeU']).reshape(n,n+1);v=np.array(q['tentativeV']).reshape(n+1,n)
            rhs=-n*(np.diff(u,axis=1)+np.diff(v,axis=0))/dt
            e=4*n*n*np.sin(np.pi*np.arange(n)/(2*n))**2;lam=e[:,None]+e[None,:];lam[0,0]=1
            a=dctn(rhs-rhs.mean(),type=2,norm='ortho')/lam;a[0,0]=0
            pressure=idctn(a,type=2,norm='ortho')
            self.assertLess(float(abs(pressure.ravel()-q['expectedPhysicalGaugePressure']).max()),1e-5)

    def test_replay_saved_cold_failure_with_smaller_timesteps(self):
        p=archive(read('PACK.json')['failureReplay'])
        for r in p['trials']:
            m,_=load('RA1000000_N128_DT1_stagev2');accepted=0;failed=False
            for _ in range(64):
                before=(m.T.copy(),m.u.copy(),m.v.copy(),m.time)
                try:m.step(r['dt']);accepted+=1
                except ValueError as e:
                    self.assertIn('Peclet',str(e));self.assertTrue(np.array_equal(before[0],m.T));self.assertTrue(np.array_equal(before[1],m.u));self.assertEqual(before[3],m.time);failed=True;break
            self.assertTrue(failed);self.assertEqual(accepted,r['acceptedSteps'])

    def test_actual_js_against_dct_budgets(self):
        tol=read('PACK.json')['tolerances']
        for file in ['JS_RESULTS.json','JS_WARM_RESULTS.json']:
            for r in read(file)['cases']:
                for p in r['projections']:
                    self.assertLess(p['velocityMaximumDifference'],tol['projectionVelocityMax'])
                    self.assertLess(p['pressureMaximumDifference'],p['pressureToleranceBudget'])
                for c in r['checkpoints']:
                    self.assertLess(c['temperatureMaximum'],tol['continuationTemperatureMax']);self.assertLess(c['velocityMaximum'],tol['continuationVelocityMax']);self.assertLess(c['NuMaximumDifference'],tol['continuationNuAbsolute'])
                self.assertEqual(hashlib.sha256((OUT/r['actualTailFile']).read_bytes()).hexdigest(),r['actualTailSHA256'])

    def test_original_js_failure_atomicity_and_no_false_cold_success(self):
        data=read('JS_RESULTS.json');self.assertFalse(data['fullJsColdToSteadyVerified'])
        for r in data['failureReplays']:
            self.assertTrue(r['atomic']);self.assertEqual(r['acceptedSteps'],r['expectedAcceptedSteps']);self.assertIn('Pe',r['failure'])
        fine=next(r for r in data['cases'] if r['n']==192);self.assertTrue(fine['originalMgRejectsThisSize'])

    def test_local_peak_nonmonotonicity_remains_with_multigrid(self):
        fine=read('JS_RESULTS.json')['cases'][-1]['checkpoints'][-1]['nu']['NuLocalMaximum']
        coarse=read('JS_WARM_RESULTS.json')['cases'][0]['checkpoints'][-1]['nu']['NuLocalMaximum']
        reference=17.925
        self.assertLess(fine,reference);self.assertGreater(coarse,reference)
        self.assertGreater(abs(fine-reference),abs(coarse-reference))

    def test_acceptance_pack_keeps_definitions_and_thresholds(self):
        p=read('ACCEPTANCE_PACK.json');self.assertFalse(p['releaseApproved']);self.assertFalse(p['wholeRaContinuumApproved'])
        for c in p['cases']:
            self.assertNotEqual(c['literatureReference']['Nu0'],c['literatureReference']['NuVolume'])
            self.assertEqual(c['literatureCriteria']['averageNuRelative'],.01);self.assertEqual(c['literatureCriteria']['localMaximumNuRelative'],.02)
        self.assertFalse(p['warm128']['coldStart'])

if __name__=='__main__':unittest.main()
