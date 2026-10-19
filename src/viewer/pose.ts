import * as THREE from 'three';
import { optics } from '../eye/anchors';

/**
 * The eye's current pose, shared by the model, the light rays and the particles (updated every
 * frame by EyeModel as the pupil, lens and gaze ease to their targets).
 */
export const eyePose = {
  /** Gaze in degrees: [horizontal (+ = towards the patient's left), vertical (+ = up)]. */
  gaze: [0, 0] as [number, number],
  pupilMm: optics.pupilDiameterMm,
  /** Accommodation state of the lens, 0 relaxed … 1 accommodated. */
  lensA: 0,
  quaternion: new THREE.Quaternion(),
  /** Rotation of the eyeball about its centre of rotation: turn about the vertical axis, then tilt. */
  set(gaze: readonly [number, number], out: THREE.Quaternion) {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(gaze[0]));
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-gaze[1]));
    out.copy(yaw).multiply(pitch);
    this.gaze = [gaze[0], gaze[1]];
    this.quaternion.copy(out);
    return out;
  },
  /** A point on the eyeball, moved with the eye's current rotation. */
  apply(p: THREE.Vector3): THREE.Vector3 {
    const c = new THREE.Vector3(...optics.rotationCentre);
    return p.sub(c).applyQuaternion(this.quaternion).add(c);
  },
};
