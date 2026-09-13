import fs from "fs";
import path from "path";

const dir = path.resolve("public/refs");
fs.mkdirSync(dir, { recursive: true });

const urls = [
    ["aldrassil-art.jpg", "https://static.wikia.nocookie.net/wowpedia/images/4/4b/Aldrassil.jpg/revision/latest?cb=20060604152207"],
    ["shadowglen-map.jpg", "https://static.wikia.nocookie.net/wowpedia/images/0/04/WorldMap-ShadowglenStart.jpg/revision/latest?cb=20120613160524"],
    ["teldrassil-map.jpg", "https://static.wikia.nocookie.net/wowpedia/images/8/8c/WorldMap-Teldrassil.jpg/revision/latest?cb=20180510092157"],
    ["aldrassil-wiki.jpg", "https://warcraft.wiki.gg/images/4/4b/Aldrassil.jpg"],
];

for (const [name, url] of urls) {
    try {
        const res = await fetch(url, { headers: { "User-Agent": "DuskwellGauntlet/1.0" } });
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(path.join(dir, name), buf);
        console.log(name, res.status, buf.length, res.headers.get("content-type"));
    } catch (e) {
        console.log(name, "ERR", e.message);
    }
}
