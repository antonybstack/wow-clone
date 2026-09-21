// Horizontal-band profile of a capture: mean and spread per 40-row band, so the
// dead parts of the frame can be found by number rather than by eye.
import sharp from 'sharp';
const [f,H]=process.argv.slice(2);const h=+(H||40);
const {data,info}=await sharp(f).extract({left:0,top:0,width:1280,height:620}).raw().toBuffer({resolveWithObject:true});
const W=info.width;
for(let y0=0;y0<info.height;y0+=h){
 const v=[];
 for(let y=y0;y<Math.min(y0+h,info.height);y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*info.channels;
  v.push(0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2]);
 }
 const m=v.reduce((a,b)=>a+b,0)/v.length;
 const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)*(b-m),0)/v.length);
 console.log(String(y0).padStart(4),'-',String(y0+h).padStart(4),' mean',m.toFixed(1).padStart(6),' sd',sd.toFixed(2).padStart(6),' '+'#'.repeat(Math.round(sd/2)));
}
