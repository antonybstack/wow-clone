"""Offline Human mage posture and foot trajectories in canonical glTF space.

This authors animation, not Havok motion or runtime foot IK. Ground contacts are
for a level surface; terrain adaptation is a separate future feature.
"""
import math
from mathutils import Vector, Quaternion

TORSO = ['Hips', 'Spine', 'spine04', 'Spine2', 'spine02', 'spine01',
         'Neck', 'neck02', 'neck03', 'Head', 'LeftShoulder', 'RightShoulder',
         'shoulder01.L', 'shoulder01.R']
LEGS = [side + part for side in ['Left', 'Right']
        for part in ['UpLeg', 'Leg', 'Foot', 'ToeBase']]
LEG_HELPERS = [part + '.' + side for side in ['L', 'R']
               for part in ['pelvis', 'upperleg02', 'lowerleg02']]
ROTATIONS = TORSO + LEGS + LEG_HELPERS
GAITS = {
    'walk': {'cycleSeconds': .68, 'speed': 2.5, 'stance': .5, 'span': .85, 'lift': .105},
    'run': {'cycleSeconds': .58, 'speed': 7., 'stance': .22, 'span': .8932, 'lift': .27},
}

def smooth(t):
    t = max(0., min(1., t))
    return t*t*(3.-2.*t)

def foot_path(phase, gait):
    """Linear stance retreat matches speed * cycleSeconds; C1 swing return."""
    support, span = gait['stance'], gait['span']
    front = span*.5
    if phase < support:
        u = phase/support
        z = front-span*u
        # Heel strike -> flat sole -> toe-off. Raise ankle around toe contact.
        strike=.12 if gait['speed']>3 else -.12
        pitch = strike*(1.-smooth(u/.18)) + .33*smooth((u-.65)/.35)
        y = .0723 + max(0., math.sin(pitch))*.143
    else:
        u = (phase-support)/(1.-support)
        # Match the stance velocity only near the endpoints. A full cubic
        # Hermite tangent at running speed overshoots beyond anatomical reach.
        tangent = -span/support*(1.-support)
        z = -front+span*smooth(u)+tangent*(u*math.exp(-u/.05)-(1.-u)*math.exp(-(1.-u)/.05))
        strike=.12 if gait['speed']>3 else -.12
        pitch = .33*(1.-smooth(u))+strike*smooth(u)-.18*math.sin(math.pi*u)
        y = .0723 + max(0.,math.sin(pitch))*.143 + gait['lift']*math.sin(math.pi*u)**1.25
    return z, y, pitch

def author(local, mode, t, duration, env):
    names, rest, rw, worlds, rotation, world_rotation, aim = [env[k] for k in
        ['names', 'rest', 'rw', 'worlds', 'rotation', 'world_rotation', 'aim']]
    phase=t/duration
    for n in ROTATIONS:
        rotation(local,n,rest[names[n]][1])
    hips=rw[names['Hips']].translation.copy()
    hips.y=.909+.002*math.sin(phase*math.tau)
    feet={};lean=4.;pelvis_yaw=0.;pelvis_roll=0.
    if mode in GAITS:
        gait=GAITS[mode];run=mode=='run'
        hips.y=(.865 if run else .925)+(.024 if run else .009)*math.cos(phase*math.tau*2)
        pelvis_yaw=.035*math.sin(phase*math.tau)
        pelvis_roll=.012*math.sin(phase*math.tau)
        lean=(12. if run else 6.)+(.8 if run else .4)*math.sin(phase*math.tau*2)
        for side,offset,sign in [('Left',0,1),('Right',.5,-1)]:
            z,y,pitch=foot_path((phase+offset)%1,gait)
            feet[side]=(Vector((sign*.157,y,z-.025)),pitch)
        # Solve the pelvis height from actual limb reach, not a fixed crouch.
        # This gives extension over support and compression between contacts.
        limits=[]
        for side,(target,_) in feet.items():
            hip_offset=rw[names[side+'UpLeg']].translation-rw[names['Hips']].translation
            l1=(rw[names[side+'Leg']].translation-rw[names[side+'UpLeg']].translation).length
            l2=(rw[names[side+'Foot']].translation-rw[names[side+'Leg']].translation).length
            h=hips+hip_offset
            horizontal=(target.x-h.x)**2+(target.z-h.z)**2
            limits.append(target.y+math.sqrt(max(.01,((l1+l2)*.988)**2-horizontal))-hip_offset.y)
        hips.y=min(hips.y,*limits)
    else:
        for side,sign in [('Left',1),('Right',-1)]:
            feet[side]=(Vector((sign*.173,.0723,.022 if side=='Left' else -.012)),0.)
        if mode=='jumpStart' or mode=='jumpLoop':
            lift=smooth(t/.24) if mode=='jumpStart' else 1.
            lean=4.+7.*lift
            hips.y=.909-.012*lift
            for side,sign in [('Left',1),('Right',-1)]:
                feet[side]=(Vector((sign*.168,.0723+(.17 if side=='Left' else .22)*lift,
                                    -.11*lift if side=='Left' else -.20*lift)),.10*lift)
        elif mode=='jumpLand':
            # No replay of a takeoff inside the landing clip. Compress/recover
            # within the existing runtime's 450 ms landing budget.
            compression=math.sin(math.pi*min(1.,t/.36))**2
            hips.y=.909-.065*compression
            lean=4.+5.*compression
        elif mode=='cast':
            lean=4.+3.*math.sin(math.pi*phase)**2

    i=names['Hips'];parent=worlds(local)[env['parents'][i]]
    tr,qr,sc=local[i]
    local[i]=(parent.inverted()@hips,qr,sc)
    world_rotation(local,'Hips',Quaternion((0,1,0),pelvis_yaw) @ Quaternion((0,0,1),pelvis_roll) @ rw[i].to_quaternion())
    # Correct the whole chain with a swing at its base; keep the anatomical
    # spine curvature. Looking at only one local Euler channel hides helpers.
    w=worlds(local)
    neck=w[names['Neck']].translation
    target=hips+Vector((0,neck.y-hips.y,math.tan(math.radians(lean))*(neck.y-hips.y)))
    aim(local,'Spine','Neck',target)
    # Head remains level rather than inheriting a downward sprint stare.
    world_rotation(local,'Head',Quaternion((0,1,0),-.025*math.sin(phase*math.tau) if mode in GAITS else 0) @ rw[names['Head']].to_quaternion())
    for side,(target,pitch) in feet.items():
        w=worlds(local);s=w[names[side+'UpLeg']].translation
        e=w[names[side+'Leg']].translation;f=w[names[side+'Foot']].translation
        l1=(e-s).length;l2=(f-e).length
        direction=target-s;distance=min(direction.length,(l1+l2)*.995);direction.normalize()
        target=s+direction*distance
        pole=Vector((.045 if side=='Left' else -.045,0,1))
        pole-=direction*pole.dot(direction);pole.normalize()
        along=(l1*l1-l2*l2+distance*distance)/(2*distance)
        knee=s+direction*along+pole*math.sqrt(max(0,l1*l1-along*along))
        aim(local,side+'UpLeg',side+'Leg',knee)
        aim(local,side+'Leg',side+'Foot',target)
        world_rotation(local,side+'Foot',Quaternion((1,0,0),pitch) @ rw[names[side+'Foot']].to_quaternion())
        # Keep the toe pad flatter through push-off; other toe helpers retain
        # their anatomical relative orientation.
        rotation(local,side+'ToeBase',Quaternion((1,0,0),-max(0,pitch)*.65) @ rest[names[side+'ToeBase']][1])
    return hips-rw[names['Hips']].translation
