#!/usr/bin/env python3
"""Independent 50-digit reference values for the wind -> h estimation module.

All correlations are taken from A Heat Transfer Textbook, 6th ed. (Lienhard):
  - flat plate laminar average Nu_L, eqn. (6.68), and Example 6.5
  - flat plate three-region average Nu_L, eqn. (6.120) with c from eqn. (6.115),
    and Example 6.9
  - abrupt-transition reduction of eqn. (6.120), Example 6.11
  - liquid-metal average Nu_L, eqn. (6.69)
  - cylinder cross flow: Churchill-Bernstein eqn. (7.65), component eqns.
    (7.66) and (7.68), Nakai-Okazaki eqn. (7.67), and Example 7.8
Values are evaluated with mpmath at 50 significant digits.  The "book"
entries are the values printed in the textbook examples (rounded there).
"""
import hashlib
import json
import pathlib

from mpmath import mp, mpf, sqrt, log10, log

mp.dps = 50

HERE = pathlib.Path(__file__).resolve()
OUT = HERE.parent.parent / "docs" / "dynamic" / "WIND_HEAT_TRANSFER_REFERENCE_20261107.json"


def num(x):
    return float(mp.nstr(x, 17))


def main():
    ref = {}

    # --- Example 6.5: laminar flat plate, air, eqn. (6.68) -----------------
    nu = mpf("1.95e-5"); k = mpf("0.0292"); pr = mpf("0.703")
    u = mpf(15); L = mpf("0.5")
    re = u * L / nu
    nusselt = mpf("0.664") * sqrt(re) * pr ** (mpf(1) / 3)
    h = nusselt * k / L
    ref["flatPlateLaminarEx65"] = {
        "source": "Example 6.5, eqn. (6.68)",
        "kinematicViscosity": num(nu), "conductivity": num(k), "prandtl": num(pr),
        "velocity": num(u), "length": num(L),
        "reynolds": num(re), "nusselt": num(nusselt), "h": num(h),
        "book": {"reynolds": 384600, "nusselt": 366.2, "h": 21.4},
    }

    # --- Example 6.9: three-region average for gases, eqns. (6.115)/(6.120)
    nu = mpf("1.575e-5"); k = mpf("0.0264"); pr = mpf("0.708")
    u = mpf(10); L = mpf(2)
    reL = u * L / nu; rel = mpf(400000); reu = mpf(870000)
    c = mpf("0.9922") * log10(rel) - mpf("3.013")
    t1 = mpf("0.037") * pr ** mpf("0.6") * (reL ** mpf("0.8") - reu ** mpf("0.8"))
    t2 = mpf("0.664") * sqrt(rel) * pr ** (mpf(1) / 3)
    t3 = (mpf("0.0296") * reu ** mpf("0.8") * pr ** mpf("0.6")
          - mpf("0.332") * sqrt(rel) * pr ** (mpf(1) / 3)) / c
    nusselt = t1 + t2 + t3
    h = nusselt * k / L
    ref["flatPlateMixedObservedEx69"] = {
        "source": "Example 6.9, eqns. (6.115) and (6.120)",
        "kinematicViscosity": num(nu), "conductivity": num(k), "prandtl": num(pr),
        "velocity": num(u), "length": num(L),
        "reynolds": num(reL), "transitionStart": num(rel), "transitionEnd": num(reu),
        "c": num(c), "terms": [num(t1), num(t2), num(t3)],
        "nusselt": num(nusselt), "h": num(h),
        "book": {"c": 2.55, "terms": [599.9, 374.3, 459.2], "nusselt": 1433, "h": 18.92},
    }

    # --- Example 6.11: abrupt-transition reduction of eqn. (6.120) ---------
    for tag, rt in (("a", mpf(400000)), ("b", mpf(870000))):
        nusselt = (mpf("0.037") * pr ** mpf("0.6") * (reL ** mpf("0.8") - rt ** mpf("0.8"))
                   + mpf("0.664") * sqrt(rt) * pr ** (mpf(1) / 3))
        ref[f"flatPlateAbruptEx611{tag}"] = {
            "source": "Example 6.11, abrupt-transition reduction of eqn. (6.120)",
            "prandtl": num(pr), "reynolds": num(reL), "transitionReynolds": num(rt),
            "nusselt": num(nusselt),
            "book": {"nusselt": 1760 if tag == "a" else 1152},
        }

    # --- Liquid abrupt form developed from eqn. (6.113) --------------------
    pr = mpf(7); re = mpf(2000000); rt = mpf(300000)
    nusselt = (mpf("0.040") * pr ** mpf("0.43") * (re ** mpf("0.8") - rt ** mpf("0.8"))
               + mpf("0.664") * sqrt(rt) * pr ** (mpf(1) / 3))
    ref["flatPlateLiquidAbrupt"] = {
        "source": "Abrupt-transition average developed from eqn. (6.113) as the text suggests",
        "prandtl": num(pr), "reynolds": num(re), "transitionReynolds": num(rt),
        "nusselt": num(nusselt),
    }

    # --- Flat plate liquid metal, eqn. (6.69) -------------------------------
    pe = mpf(200)
    ref["flatPlateLiquidMetal"] = {
        "source": "eqn. (6.69)", "peclet": num(pe),
        "nusselt": num(mpf("1.13") * sqrt(pe)),
    }

    # --- Example 7.8 evaluated forward with eqn. (7.66) ---------------------
    re = mpf(457); pr = mpf("0.712")
    nusselt = (mpf("0.3") + mpf("0.62") * sqrt(re) * pr ** (mpf(1) / 3)
               / (1 + (mpf("0.4") / pr) ** (mpf(2) / 3)) ** (mpf(1) / 4))
    ref["cylinderEx78"] = {
        "source": "Example 7.8 evaluated forward, eqn. (7.66)",
        "reynolds": num(re), "prandtl": num(pr), "nusselt": num(nusselt),
        "h": num(nusselt * mpf("0.0265") / mpf("0.0001")),
        "book": {"nusselt": 10.69, "h": 2833},
    }

    # --- Nakai-Okazaki, eqn. (7.67) ------------------------------------------
    pe = mpf("0.1")
    ref["cylinderNakaiOkazaki"] = {
        "source": "eqn. (7.67)", "peclet": num(pe),
        "nusselt": num(1 / (mpf("0.8237") - log(sqrt(pe)))),
    }

    # --- Component eqn. (7.68) vs full eqn. (7.65) ---------------------------
    re = mpf(100000); pr = mpf("0.7")
    base = (mpf("0.62") * sqrt(re) * pr ** (mpf(1) / 3)
            / (1 + (mpf("0.4") / pr) ** (mpf(2) / 3)) ** (mpf(1) / 4))
    ref["cylinderComponent768"] = {
        "source": "eqn. (7.68) compared with eqn. (7.65)",
        "reynolds": num(re), "prandtl": num(pr),
        "nusselt768": num(mpf("0.3") + base * (1 + sqrt(re / 282000))),
        "nusselt765": num(mpf("0.3") + base * (1 + (re / 282000) ** (mpf(5) / 8)) ** (mpf(4) / 5)),
    }

    payload = {
        "generatedBy": "scripts/dynamic-wind-heat-transfer-reference.py",
        "generatorSHA256": hashlib.sha256(HERE.read_bytes()).hexdigest(),
        "precisionDigits": 50,
        "textbook": "A Heat Transfer Textbook, 6th ed. (Lienhard)",
        "releaseApproved": False,
        "reference": ref,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
