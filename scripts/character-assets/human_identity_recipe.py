"""Bounded face recipe on the licensed MakeHuman topology.

Reuse the Human v1 face/eye helpers; exclude its body/muscle targets because the
released torso is retained. Targets are authored vertex deltas, not ellipsoid
sculpt approximations or runtime sliders.
https://static.makehumancommunity.org/mpfb/docs/assets/concept_targets.html
"""
FACE_TARGETS = (
    ('head-scale-vert-decr.target', .32),
    ('chin-bones-incr.target', .25),
    ('chin-prognathism-incr.target', .25),
    ('chin-width-incr.target', .18),
    ('l-eye-height1-incr.target', .22), ('r-eye-height1-incr.target', .22),
    ('l-eye-height2-incr.target', .12), ('r-eye-height2-incr.target', .12),
    ('eye-left-opened-up.target', .08), ('eye-right-opened-up.target', .08),
    ('mouth-upperlip-volume-incr.target', .20),
    ('mouth-lowerlip-volume-incr.target', .15),
    ('mouth-philtrum-volume-incr.target', .20),
)
# Keep the proxy/lids together. The historical 0.83 shrink plus aggressive lid
# projection was designed for a different face and produced a slit here.
EYE_GLOBE_SCALE = .95
CORNEA_BULGE_M = .0014
