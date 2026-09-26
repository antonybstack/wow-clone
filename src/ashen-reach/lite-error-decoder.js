// Keep Lite's verbose decoder reachable only from the failure path.
// https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/49-error-handling.md
export {decodeError} from '@babylonjs/lite';
