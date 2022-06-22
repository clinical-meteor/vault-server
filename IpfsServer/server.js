
// import * as IPFS from 'ipfs-core';
// import { AbortController } from "node-abort-controller";
// import { concat } from 'uint8arrays/concat';
// import { toString } from 'uint8arrays/to-string';

// global.AbortController = AbortController;

// async function initializeIpfsServer(){
//     let ipfsServer = await IPFS.create({ host: 'localhost', port: '3005', protocol: 'http' })
//     // let ipfs = await IPFS.create();

//     let fileAdded = await ipfsServer.add({
//         path: "hello.txt",
//         content: "Hello World 101"
//     });

//     console.log("IPFS HelloWorld: ", fileAdded.path, fileAdded.cid);
    
//     // let chunks = [];
//     // for await (let chunk of ipfsServer.cat(fileAdded.cid)) {
//     //     chunks.push(chunk);
//     // }

//     // console.log("Added file contents:", toString(Uint8Array.from(concat(chunks))));
// }

// if(process.env.ENABLE_IPFS){
//     initializeIpfsServer();
// }


// // QmXXY5ZxbtuYj6DnfApLiGstzPN7fvSyigrRee3hDWPCaf