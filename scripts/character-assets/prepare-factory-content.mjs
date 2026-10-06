/** One entry point around the existing factory/shape/coverage/native publication tools.
 * Local pack publication is explicitly separate from a gated production Pages release.
 * https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {parseArguments} from './equipment-factory.mjs';
import {validateDescriptor, verifyPinnedInputs} from './equipment-factory-contract.mjs';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {assertAssetFit} from '../../src/ashen-reach/equipment-contract.js';
import {SWAP_BUDGET} from '../lib/swap-budget.mjs';
import {verifyProductionHumanIdentities} from './verify-production-human-identities.mjs';
const options = parseArguments(process.argv.slice(2));
assert(options.races.length === 3, 'Content entry point prepares all supported races');
const descriptor = validateDescriptor(JSON.parse(await fs.readFile(options.descriptor, 'utf8')));
await verifyPinnedInputs(descriptor);
const catalogueItem = EQUIPMENT_ITEMS[descriptor.id];
if (options.publish) {
    assert(process.env.ASHEN_CDP_PORT && process.env.ASHEN_TEST_URL, 'Publication requires an audited owned native dev harness');
    assert(catalogueItem?.parts?.some(p => p.mesh === descriptor.mesh), 'Register the item and evolve the frozen catalogue before integration');
}
const steps = [], out = options.out;
await fs.mkdir(out, {recursive: true});
async function run(name, script, args = []) {
    const started = Date.now(), log = await fs.open(path.join(out, `${name}.log`), 'w');
    try {
        const child = spawn(process.execPath, [script, ...args], {env: process.env, stdio: ['ignore', log.fd, log.fd]});
        await new Promise((resolve, reject) => {child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(Error(`${name} failed (${code}); inspect ${out}/${name}.log`)));});
        steps.push({name, elapsedMs: Date.now() - started});
        console.log(JSON.stringify(steps.at(-1)));
    } finally {await log.close();}
}
await run('factory', 'scripts/character-assets/equipment-factory.mjs', [options.descriptor, '--out', `${out}/factory`, ...(options.publish ? ['--publish'] : ['--repeat'])]);
if (options.publish) {
    await run('shapes', 'scripts/character-assets/prepare-production-human-shapes.mjs');
    await run('startup-character', 'scripts/ashen-reach/prepare-starter-character.mjs');
    await run('coverage', 'scripts/character-assets/prepare-coverage-release.mjs', ['--publish']);
    // Coverage rewrites the shared manifest, including its final newline. Pin
    // identity provenance only after that publication has completed.
    await run('identities', 'scripts/character-assets/refresh-human-identity-equipment.mjs', [options.descriptor]);
    await run('remote', 'scripts/character-assets/prepare-remote-pieces.mjs');
    await run('native-bounds', 'scripts/character-assets/prepare-remote-pieces-native.mjs');
    await run('remote-publication', 'scripts/character-assets/publish-remote-pieces.mjs');
    const identityVerification = await verifyProductionHumanIdentities();
    const packs = {}, native = JSON.parse(await fs.readFile('public/ashen-reach/remote-pieces/v1/prepared.json', 'utf8'));
    for (const [race, directory] of [['human', 'equipment'], ['human', 'human-shape-v1'], ['orc', 'equipment-orc'], ['undead', 'equipment-undead']]) {
        const manifest = JSON.parse(await fs.readFile(`public/ashen-reach/${directory}/${directory.startsWith('equipment') ? 'manifest-coverage-v1.json' : 'manifest.json'}`, 'utf8'));
        const full = manifest.items[descriptor.id], compact = manifest.compactItems?.[descriptor.id] ?? full;
        assertAssetFit(full, catalogueItem, race); assertAssetFit(compact, catalogueItem, race);
        assert(full.bytes <= SWAP_BUDGET.pieceBytes && compact.bytes <= SWAP_BUDGET.pieceBytes, `${directory}: item exceeds the existing byte budget`);
        packs[directory] = {full, compact, sweptBounds: native.races[race].pieces[descriptor.id]};
    }
    await fs.writeFile(`${out}/content-report.json`, JSON.stringify({item: descriptor.id, localPacksPublished: true,
        productionReleased: false, steps, packs, identityVerification, budget: SWAP_BUDGET,
        remainingGates: ['Actual Armory fit/transactions/motion', 'Cold/resident swap budgets', 'Native cold-start and FPS gates', 'Reviewed VE/Telegram motion', 'Commit/push, sealed Pages upload and public checks']}, null, 2));
} else {
    await fs.writeFile(`${out}/content-report.json`, JSON.stringify({item: descriptor.id, localPacksPublished: false, productionReleased: false, steps}, null, 2));
}
