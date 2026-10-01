/** Fixed local audition contract. Candidate geometry never advertises an item or
 * expands the accepted appearance fit. Move reviewed rules into the catalogue
 * only with an explicit coverage revision and measured production publication.
 */
const PILOT_GARMENT_COVERAGE=Object.freeze({schema:1,
 coversByItem:Object.freeze({wayfarerTunic:['trousers.upper'],pilgrimTunic:['trousers.upper'],graveweaverTop:['trousers.upper']}),
 partsByItem:Object.freeze({wayfarerTrousers:[{mesh:'WayfarerTrousersUnderTorso',hideWhenRegions:['trousers.upper']}],graveweaverSkirt:[{mesh:'WayfarerTrousersUnderTorso',hideWhenRegions:['trousers.upper']}]}),
});
export function pilotCoverageForRace(race){
 if(!['human','orc','undead'].includes(race))throw Error('Unknown coverage pilot race');
 // Actual Human robe trousers are already cropped beneath the robe.
 return race==='human'?{...PILOT_GARMENT_COVERAGE,partsByItem:{wayfarerTrousers:PILOT_GARMENT_COVERAGE.partsByItem.wayfarerTrousers}}:PILOT_GARMENT_COVERAGE;
}
