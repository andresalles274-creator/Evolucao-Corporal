// Repeat existing footage without changing the source files or movement speed.
export function attachExerciseVideo(video, report=()=>{}) {
 let elapsed=0,last=video.currentTime||0,finished=false;
 const limit=90;
 const update=()=>report(Math.min(limit,elapsed),finished);
 const restart=()=>{video.currentTime=0;last=0;};
 const finish=()=>{elapsed=limit;finished=true;video.pause();update();};
 video.loop=false;
 video.addEventListener('play',()=>{
  // Keep only one demonstration playing at a time.
  video.ownerDocument?.querySelectorAll('video[data-exercise-repeat]').forEach(other=>{if(other!==video)other.pause();});
  if(finished){elapsed=0;finished=false;restart();}
  last=video.currentTime;update();
 });
 video.addEventListener('seeking',()=>{last=video.currentTime;});
 video.addEventListener('seeked',()=>{last=video.currentTime;});
 video.addEventListener('timeupdate',()=>{
  const now=video.currentTime;
  if(!video.paused&&!video.seeking)elapsed+=Math.max(0,now-last);
  last=now;
  if(elapsed>=limit)finish();else update();
 });
 video.addEventListener('ended',()=>{
  if(finished)return;
  // Account for the final interval, which some browsers deliver after pause.
  elapsed+=Math.max(0,video.currentTime-last);
  if(elapsed>=limit){finish();return;}
  // Do not loop a failed/empty stream.
  if(!Number.isFinite(video.duration)||video.duration<=0)return;
  restart();
  const attempt=video.play();
  if(attempt?.catch)attempt.catch(()=>{}); // Native play remains available.
 });
 update();
}

export function bindExerciseVideos(root=document) {
 bindYouTubeVideos(root);
 root.querySelectorAll('video[data-exercise-repeat]').forEach(video=>{
  if(video.dataset.repeatBound)return;
  video.dataset.repeatBound='1';
  const status=video.ownerDocument.createElement('span');
  status.className='exercise-video-progress';
  if(video.parentElement?.classList.contains('training-video'))video.parentElement.after(status);
  else video.after(status);
  const button=video.ownerDocument.createElement('button');
  button.type='button';button.className='exercise-video-toggle';
  button.textContent='▶ Reproduzir vídeo';
  status.after(button);
  let busy=false,failed=false;
  const sync=()=>{button.textContent=video.paused?'▶ Reproduzir vídeo':'❚❚ Pausar vídeo';};
  const unavailable=()=>{
   failed=true;button.disabled=false;button.textContent='↻ Tentar reproduzir novamente';
   status.textContent='Não foi possível carregar este vídeo. Tente novamente; se continuar, a origem pode estar indisponível.';
  };
  video.addEventListener('error',unavailable);
  video.addEventListener('playing',()=>{failed=false;sync();});
  video.addEventListener('pause',sync);
  video.addEventListener('ended',sync);
  button.onclick=async()=>{
   if(busy)return;
   if(!video.paused){video.pause();return;}
   busy=true;button.disabled=true;
   try{
    // Refresh private links after the app has been left open for hours.
    if(video.refreshExerciseSource)await video.refreshExerciseSource();
    if(failed||video.error){failed=false;video.load();}
    await video.play();sync();
   }catch(error){
    if(error?.name==='NotAllowedError'){
     status.textContent='Toque novamente em Reproduzir vídeo para iniciar.';
     button.textContent='▶ Reproduzir vídeo';
    }else unavailable();
   }finally{busy=false;button.disabled=false;}
  };
  if(video.error)unavailable();
  attachExerciseVideo(video,(seconds,finished)=>{
   if(failed)return;
   const whole=Math.floor(seconds);
   const time=Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');
   status.textContent=finished?'Demonstração concluída · 1:30. Toque em reproduzir para repetir.':time+' / 1:30 · movimento em repetição';
  });
 });
}

let youtubeReady;
function loadYouTube() {
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(!youtubeReady)youtubeReady=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{resolve(window.YT);}};
  const script=document.createElement('script');
  script.src='https://www.youtube.com/iframe_api';
  script.onerror=()=>reject(new Error('YouTube indisponível'));
  document.head.appendChild(script);
 });
 return youtubeReady;
}
function bindYouTubeVideos(root) {
 root.querySelectorAll('iframe[data-exercise-youtube]').forEach(frame=>{
  if(frame.dataset.repeatBound)return;
  frame.dataset.repeatBound='1';
  loadYouTube().then(YT=>{
   if(!frame.isConnected)return;
   let elapsed=0,finished=false,timer=null,last=0;
   const status=document.createElement('span');status.className='exercise-video-progress';
   frame.parentElement.after(status);
   const report=()=>{const seconds=Math.floor(Math.min(90,elapsed));status.textContent=finished?'Demonstração concluída · 1:30. Toque em reproduzir para repetir.':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' / 1:30 · movimento em repetição';};
   const stopTimer=()=>{if(timer!==null)clearInterval(timer);timer=null;};
   new YT.Player(frame,{events:{onStateChange(event){
    const player=event.target;stopTimer();
    if(event.data===1){
     if(finished){elapsed=0;finished=false;player.seekTo(0,true);}
     last=performance.now();
     timer=setInterval(()=>{
      if(!frame.isConnected){stopTimer();player.destroy();return;}
      const now=performance.now();elapsed+=(now-last)/1000;last=now;
      if(elapsed>=90){elapsed=90;finished=true;stopTimer();player.pauseVideo();}
      report();
     },200);
    }else if(event.data===0&&!finished){player.seekTo(0,true);player.playVideo();}
    report();
   },onError(){stopTimer();status.textContent='Vídeo indisponível no YouTube.';}}});
   report();
  }).catch(()=>{}); // The ordinary inline embed still works if the API is blocked.
 });
}
