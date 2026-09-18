/** Copy embedded glTF material resources into the assembled body buffer. */
export function copyFitMaterial(def, source, writer, destination) {
  const out=structuredClone(def);
  if (out.extensions) throw new Error('Fit material extensions are not supported');
  const refs=[out.pbrMetallicRoughness?.baseColorTexture,out.pbrMetallicRoughness?.metallicRoughnessTexture,out.normalTexture,out.occlusionTexture,out.emissiveTexture].filter(Boolean);
  for(const ref of refs){
    if(ref.texCoord && ref.texCoord!==0) throw new Error('Fit material requires UV0');
    if(ref.extensions) throw new Error('Fit texture transforms are not supported');
    const tex=source.json.textures?.[ref.index], img=source.json.images?.[tex?.source];
    if(!img || img.uri || img.bufferView==null || !['image/png','image/jpeg'].includes(img.mimeType)) throw Object.assign(new Error('TEXTURE_UNSUPPORTED: Fit textures must be embedded PNG/JPEG'),{code:'TEXTURE_UNSUPPORTED'});
    const view=source.json.bufferViews[img.bufferView];
    if(!view || view.buffer!==0 || (view.byteOffset||0)+view.byteLength>source.binary.length) throw new Error('Invalid fit image buffer');
    const acc=writer.append(source.binary.slice(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),'SCALAR');
    const bufferView=destination.accessors[acc].bufferView;
    destination.images??=[];destination.textures??=[];destination.samplers??=[];
    const image=destination.images.push({bufferView,mimeType:img.mimeType})-1;
    const texture={source:image};
    if(tex.sampler!=null){
      const sampler=source.json.samplers?.[tex.sampler];
      if(!sampler) throw new Error('Invalid fit sampler');
      texture.sampler=destination.samplers.push(structuredClone(sampler))-1;
    }
    ref.index=destination.textures.push(texture)-1;
  }
  return out;
}
