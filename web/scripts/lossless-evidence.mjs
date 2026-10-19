import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 2026-10-16, Add liquidity build: the four Owner captures join the four Docs captures.
// The untouched browser PNG is losslessly encoded; no cropping, resizing or quantization.
export async function losslessEvidence(page, artifacts, filename) {
  assert.match(filename,/^(empty|stocks25)-(docs|owner)-(1440|375)\.webp$/);
  const scratch=path.resolve(artifacts,'../test/scratch/lossless-evidence');
  fs.mkdirSync(scratch,{recursive:true});
  const source=path.join(scratch,filename.replace(/\.webp$/,'.png'));
  const destination=path.join(artifacts,filename);
  const png=await page.screenshot({path:source,type:'png',fullPage:true});
  const facts=JSON.parse(execFileSync(process.env.BASKET_SCREENSHOT_PYTHON||'python3',[
    fileURLToPath(new URL('./lossless-evidence.py',import.meta.url)),source,destination
  ],{encoding:'utf8'}));
  const webp=fs.readFileSync(destination);
  assert.equal(webp.subarray(0,4).toString(),'RIFF');
  assert.equal(webp.subarray(8,16).toString(),'WEBPVP8L','Lossless WebP, never lossy VP8');
  const decoded=await page.evaluate(async ({png,webp})=>{
    async function pixels(type,base64){
      const i=new Image();i.src=`data:image/${type};base64,${base64}`;await i.decode();
      const canvas=document.createElement('canvas');canvas.width=i.naturalWidth;canvas.height=i.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(i,0,0);
      const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      return {width:canvas.width,height:canvas.height,rgbaSha256:hash};
    }
    return {png:await pixels('png',png),webp:await pixels('webp',webp)};
  },{png:png.toString('base64'),webp:webp.toString('base64')});
  assert.deepEqual(decoded.webp,decoded.png,'Browser-decoded PNG and WebP pixels are identical');
  assert.deepEqual(decoded.png,{width:facts.width,height:facts.height,rgbaSha256:facts.rgbaSha256},'Independent browser/Pillow decoded pixels agree');
  // Replace the corresponding older lossy container only after both decoders prove equality.
  const replaced=filename.replace(/\.webp$/,'.jpg');
  const previous=path.join(artifacts,replaced);
  if(fs.existsSync(previous))fs.unlinkSync(previous);
  return {file:`artifacts/${filename}`,replaces:`artifacts/${replaced}`,...facts,browserDecodedPixelEquality:true};
}
