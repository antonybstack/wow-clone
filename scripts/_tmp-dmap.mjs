import sharp from 'sharp';
const [a,b,out,G]=process.argv.slice(2);const g=+(G||6);
const A=await sharp(a).raw().toBuffer({resolveWithObject:true});
const B=await sharp(b).raw().toBuffer();
const o=Buffer.alloc(A.data.length);
for(let i=0;i<A.data.length;i++)o[i]=Math.min(255,Math.abs(A.data[i]-B[i])*g);
await sharp(o,{raw:{width:A.info.width,height:A.info.height,channels:A.info.channels}}).png().toFile(out);
