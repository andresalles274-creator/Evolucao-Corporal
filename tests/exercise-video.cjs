const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
(async()=>{
 const {attachExerciseVideo,bindExerciseVideos}=await import('../exercise-video.js');
 class Video extends EventTarget {
  currentTime=0;duration=6;paused=true;seeking=false;loop=true;plays=0;
  play(){this.paused=false;this.plays++;this.dispatchEvent(new Event('play'));return Promise.resolve();}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  tick(seconds){this.currentTime+=seconds;this.dispatchEvent(new Event('timeupdate'));}
  end(){this.paused=true;this.dispatchEvent(new Event('ended'));}
 }
 const v=new Video();let progress;
 attachExerciseVideo(v,(elapsed,finished)=>progress={elapsed,finished});
 await v.play();
 for(let i=0;i<14;i++){v.tick(6);v.end();assert.equal(v.currentTime,0);}
 assert.equal(progress.elapsed,84);assert.equal(progress.finished,false);
 v.tick(6);assert.equal(v.paused,true);assert.equal(progress.finished,true);assert.equal(progress.elapsed,90);
 v.end();assert.equal(v.plays,15);
 await v.play();assert.equal(progress.elapsed,0);assert.equal(v.currentTime,0);
 v.tick(2);v.pause();v.tick(10);assert.equal(progress.elapsed,2);
 await v.play();v.seeking=true;v.currentTime=4;v.dispatchEvent(new Event('seeking'));v.seeking=false;v.dispatchEvent(new Event('seeked'));v.tick(1);assert.equal(progress.elapsed,3);
 const long=new Video();long.duration=200;attachExerciseVideo(long);await long.play();long.tick(90);assert.equal(long.paused,true);
 const app=readFileSync('app.js','utf8');
 const functions=app.slice(app.indexOf('function exerciseMotion('),app.indexOf('function coachExerciseUploadEditor('));
 const context={validExerciseMediaUrl:u=>/^https:/.test(u||''),esc:String,exerciseImage:()=>'<img>',selectedDemoGender:()=> 'male'};
 runInNewContext(functions+';this.motion=exerciseMotion;',context);
 for(const gender of ['male','female']){
  const html=context.motion({name:'Leg press',male_video_url:'https://example.com/m.mp4',female_video_url:'https://example.com/f.webm'},gender);
  assert.ok(html.includes('<video data-exercise-repeat'));assert.ok(!html.includes('<details'));assert.ok(html.includes('preload="metadata"'));
 }
 const nodes=[];
 const clickable=new Video();clickable.dataset={};clickable.after=()=>{};clickable.load=()=>{};
 clickable.ownerDocument={createElement:()=>{const el={textContent:'',after(){}};nodes.push(el);return el;},querySelectorAll:()=>[clickable]};
 const root={querySelectorAll:selector=>selector.startsWith('iframe')?[]:[clickable]};
 bindExerciseVideos(root);
 const button=nodes[1],status=nodes[0];
 assert.equal(button.textContent,'▶ Reproduzir vídeo');
 await button.onclick();assert.equal(clickable.paused,false);assert.equal(button.disabled,false);
 await button.onclick();assert.equal(clickable.paused,true);
 let refreshed=0;clickable.refreshExerciseSource=async()=>{refreshed++};
 await button.onclick();assert.equal(refreshed,1);assert.equal(clickable.paused,false);
 clickable.pause();clickable.error={code:4};clickable.dispatchEvent(new Event('error'));
 assert.match(status.textContent,/Não foi possível/);assert.match(button.textContent,/Tentar/);
 clickable.play=async()=>{throw Object.assign(new Error('blocked'),{name:'NotAllowedError'})};
 await button.onclick();assert.match(status.textContent,/Toque novamente/);assert.equal(button.disabled,false);
 bindExerciseVideos(root);assert.equal(nodes.length,2);
 console.log('Video checks passed: 90-second loops, pause/resume, replay, seeking, long clip limit, visible male/female players.');
})().catch(e=>{console.error(e);process.exitCode=1});
