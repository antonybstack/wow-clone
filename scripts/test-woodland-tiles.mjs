import test from 'node:test';
import assert from 'node:assert/strict';
import {woodlandTileKey,distanceToWoodlandBounds,woodlandDetail,createWoodlandTiles} from '../src/ashen-reach/woodland-tiles.js';
import fs from 'node:fs';

test('128 metre tile ownership is continuous across negative coordinates',()=>{
 assert.equal(woodlandTileKey(-.01,127.99),'-1,0');
 assert.equal(woodlandTileKey(-128,-128),'-1,-1');
 assert.equal(woodlandTileKey(128,0),'1,0');
});
test('distance uses tile bounds and hysteresis retains the previous selection',()=>{
 const bounds={min:[0,0,0],max:[128,20,128]};
 assert.equal(distanceToWoodlandBounds({x:64,y:10,z:64},bounds),0);
 assert.equal(distanceToWoodlandBounds({x:228,y:10,z:64},bounds),100);
 for(const previous of ['full','reduced'])for(const d of [100,120,140])assert.equal(woodlandDetail(d,previous),previous);
 assert.equal(woodlandDetail(99.9,'reduced'),'full');assert.equal(woodlandDetail(140.1,'full'),'reduced');
});
test('spatial grouping preserves all generated tree placement and triangle budgets',()=>{
 const variants=JSON.parse(fs.readFileSync(new URL('../public/ashen-reach/woodland/trees.json',import.meta.url))).variants;
 const woodland=createWoodlandTiles(variants);
 for(const x of [-1,1,127,128])woodland.add({x,z:1,y:2,height:12,kind:.3,lean:[0,0]});
 assert.equal(woodland.tiles.size,3);assert.equal(woodland.tiles.get('0,0').trees,2);
 let full=0,reduced=0;
 for(const tile of woodland.tiles.values()){full+=tile.full.idx.length/3;reduced+=tile.reduced.idx.length/3;assert(tile.bounds.min[1]<=2);assert(tile.bounds.max[1]>=14);}
 assert.equal(full,4*1240);assert(reduced>=4*300&&reduced<=4*400);
});
