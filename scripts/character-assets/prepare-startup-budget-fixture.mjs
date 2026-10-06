/** Generate the timing recipe from current assets instead of a historic outfit label. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {maximumCompactAppearance} from './startup-appearance-budget.mjs';
import {HUMAN_IDENTITY_PRESETS} from '../../src/character/appearance/human-identity.js';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
const directory=process.argv[2];assert(directory,'Specify an evidence output directory');
const shape=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json'));
const identities=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json'));
const report=maximumCompactAppearance(HUMAN_IDENTITY_PRESETS.map(preset=>({id:preset.id,components:preset.components,
 manifest:preset.sourceLabel?identities.presets[preset.id].manifest:shape})));
const base=defaultAppearance(),maximum=report.maximum;
const appearance=validateAppearance({...base,components:maximum.components,equipment:maximum.equipment,
 shape:{...base.shape,height:1.15,build:-.95},dyes:{helmet:'moss',torso:'oxblood',legs:'indigo'}});
await fs.mkdir(directory,{recursive:true});
await fs.writeFile(path.join(directory,'maximum-compact-budget.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(directory,'seed-maximum-compact.json'),JSON.stringify(appearance,null,2)+'\n');
console.log(JSON.stringify({profile:maximum.profile,bytes:maximum.bytes,equipment:maximum.equipment,enumerated:report.enumerated,valid:report.valid}));
