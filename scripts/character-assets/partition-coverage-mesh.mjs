/** Offline index partition, preserving every source attribute, morph and skin.
 * Native glTF primitives can share accessors and use independent triangle lists.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 * https://gltf-transform.dev/modules/core/classes/Primitive
 */
export function partitionCoverageMesh(doc, meshName, coveredName, vertexCovered) {
  const root=doc.getRoot(),mesh=root.listMeshes().find(m=>m.getName()===meshName);
  if(!mesh||root.listMeshes().some(m=>m.getName()===coveredName))throw Error('Missing source or duplicate coverage mesh');
  const nodes=root.listNodes().filter(n=>n.getMesh()===mesh);
  if(nodes.length!==1)throw Error('Coverage partition requires one explicit source instance');
  const node=nodes[0];
  if(root.listAnimations().some(a=>a.listChannels().some(c=>c.getTargetNode()===node&&c.getTargetPath()==='weights')))throw Error('Animated node morph weights require an explicit coverage adapter');
  const planned=[];let originalTriangles=0,coveredTriangles=0;
  for(const [sourcePrimitive,primitive]of mesh.listPrimitives().entries()){
    const accessor=primitive.getIndices(),indices=accessor?.getArray(),positions=primitive.getAttribute('POSITION');
    if(primitive.getMode()!==4||!indices||indices.length%3||!positions)throw Error('Coverage requires indexed triangles');
    const keep=[],hide=[];
    for(let i=0;i<indices.length;i+=3){
      const triangle=Array.from(indices.subarray(i,i+3));
      if(triangle.some(v=>!Number.isInteger(v)||v<0||v>=positions.getCount()))throw Error('Invalid source triangle');
      const decisions=triangle.map(v=>vertexCovered(primitive,v));
      if(decisions.some(v=>typeof v!=='boolean'))throw Error('Coverage classification must return booleans');
      const target=decisions.every(Boolean)?hide:keep;target.push(...triangle);
    }
    planned.push({primitive,accessor,indices,keep,hide,sourcePrimitive});
    originalTriangles+=indices.length/3;coveredTriangles+=hide.length/3;
  }
  if(!coveredTriangles||coveredTriangles===originalTriangles)throw Error('Coverage must retain nonempty exposed and covered surfaces');
  const covered=doc.createMesh(coveredName).setWeights(mesh.getWeights()).setExtras({...mesh.getExtras(),coverageSource:meshName});
  for(const {primitive,accessor,indices,keep,hide,sourcePrimitive}of planned){
    // Primitive.clone is shallow: original skin, UV and morph accessors remain
    // shared. Replace indices on each clone, never mutate the source accessor.
    for(const [target,list]of [[mesh,keep],[covered,hide]])if(list.length){
      const part=primitive.clone().setExtras({...primitive.getExtras(),coveragePartition:{sourceMesh:meshName,sourcePrimitive}}).setIndices(doc.createAccessor(`${coveredName}-indices`,accessor.getBuffer())
        .setType('SCALAR').setArray(new indices.constructor(list)));
      target.addPrimitive(part);
    }
    mesh.removePrimitive(primitive);primitive.dispose();
    if(!accessor.listParents().some(p=>p.propertyType!=='Root'))accessor.dispose();
  }
  const sibling=doc.createNode(coveredName).setMesh(covered).setSkin(node.getSkin())
    .setTranslation(node.getTranslation()).setRotation(node.getRotation()).setScale(node.getScale()).setWeights(node.getWeights());
  const parent=node.getParentNode();
  if(parent)parent.addChild(sibling);
  else for(const scene of root.listScenes())if(scene.listChildren().includes(node))scene.addChild(sibling);
  return {source:meshName,covered:coveredName,originalTriangles,coveredTriangles,exposedTriangles:originalTriangles-coveredTriangles,vertexReindexing:false};
}
