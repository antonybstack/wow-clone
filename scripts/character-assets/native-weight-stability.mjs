/** Keep demonstrated native transfer rounding ties at reviewed source values.
 * Exact mesh/joint correspondence and a 2e-6 envelope make these anchors fail
 * closed when the authored source changes. No skinning or fitting is computed.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes
 */
export function pinNativeWeightRows(primitive, rawWeights, stableWeights, rows, maximumDelta) {
 if(maximumDelta!==.000002||rawWeights.length!==stableWeights.length)throw Error('Unsupported native stability envelope');
 let maximum=0;
 for(const row of rows){
  const count=primitive.getAttribute('POSITION').getCount();
  if(!Number.isInteger(row.vertex)||row.vertex<0||row.vertex>=count||row.position.length!==3||row.joints.length!==4||row.weights.length!==4)throw Error('Invalid native stability row');
  const pos=primitive.getAttribute('POSITION').getElement(row.vertex,[]),joints=primitive.getAttribute('JOINTS_0').getElement(row.vertex,[]);
  if(pos.some((v,i)=>v!==row.position[i])||joints.some((v,i)=>v!==row.joints[i])||row.weights.some(v=>!Number.isFinite(v)||v<0)||Math.abs(row.weights.reduce((a,b)=>a+b,0)-1)>2e-6)throw Error('Native stability correspondence changed');
  for(let k=0;k<4;k++){
   const i=row.vertex*4+k,delta=Math.abs(rawWeights[i]-row.weights[k]);
   if(!Number.isFinite(delta)||delta>maximumDelta||Math.abs(stableWeights[i]-row.weights[k])>maximumDelta)throw Error('Native transfer exceeds reviewed stability envelope');
   stableWeights[i]=row.weights[k];maximum=Math.max(maximum,delta);
  }
 }
 return maximum;
}
