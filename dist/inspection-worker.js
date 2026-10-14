import {inspectPackage} from './inspect-package.js';
// Only trusted module code runs. Uploaded executable bytes are never executed.
self.onmessage = async event => {
  try {
    const {buffer,reference}=event.data;
    const result=await inspectPackage(new Uint8Array(buffer),reference);
    self.postMessage({ok:true,result});
  } catch {
    self.postMessage({ok:false});
  }
};
