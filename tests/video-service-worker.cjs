const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const assert=require('node:assert/strict');
const listeners={};
runInNewContext(readFileSync('sw.js','utf8'),{self:{addEventListener:(type,fn)=>listeners[type]=fn},URL});
for(const request of [
 {url:'https://example.com/public/exercise-videos/male/squat.mp4',destination:'video',headers:new Headers()},
 {url:'https://example.com/public/exercise-videos/female/squat.mp4',destination:'',headers:new Headers({Range:'bytes=0-1023'})},
 {url:'https://example.com/track.mp3',destination:'audio',headers:new Headers()}
]){
 let intercepted=false;
 listeners.fetch({request,respondWith(){intercepted=true}});
 assert.equal(intercepted,false,'Video/audio/range requests must go directly to the network');
}
console.log('Video service-worker checks passed: native media and Range requests bypass cache.');
