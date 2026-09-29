/** Repack an already partitioned Orc body without rebuilding fitted garments.
 * Usage: node scripts/ashen-reach/apply-orc-wrist-coverage.mjs INPUT.glb OUTPUT.glb
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {correctOrcWristCoverage} from './orc-wrist-coverage.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output || input === output) throw Error('Separate input and output GLB paths required');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const moved = correctOrcWristCoverage(doc);
await fs.mkdir(path.dirname(output), {recursive: true});
await io.write(output, doc);
console.log(JSON.stringify({input, output, moved}));
