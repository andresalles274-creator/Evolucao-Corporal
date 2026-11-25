const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const assert=require('node:assert/strict');
const src=readFileSync('app.js','utf8');
const fn=src.slice(src.indexOf('async function uploadExerciseMedia('),src.indexOf('function coachExerciseImageEditor('));
async function upload({kind='video',audience='all',type='video/mp4',size=100,coach=true,saveError=false,uploadError=false}={}){
 const state={uploads:0,removed:0,patch:null,rendered:0};
 const ex={id:'exercise',instructions:'Keep instructions',thumbnail_url:'old-image',video_url:'old-video',male_video_url:'old-male-video',female_video_url:'old-female-video'};
 const status={textContent:''},button={disabled:false},inputs=[{},{}];
 const form={dataset:{exercise:'exercise'},querySelector:s=>s.startsWith('button')?button:status,querySelectorAll:()=>inputs};
 const storage={upload:async()=>{state.uploads++;return {error:uploadError?{message:'offline'}:null}},getPublicUrl:()=>({data:{publicUrl:'https://example.com/media.mp4'}}),remove:async()=>{state.removed++;return {error:null}}};
 const db={storage:{from:()=>storage},from:table=>{assert.equal(table,'exercise_library');return {update:patch=>{state.patch=patch;return {eq:(key,id)=>{assert.equal(id,'exercise');return {select:()=>({maybeSingle:async()=>saveError?{error:{message:'denied'}}:{data:{id:'exercise'}}})}}}}}}};
 const context={isCoach:coach,user:{id:'coach'},exById:()=>ex,FormData:class{get(key){return {kind,audience,media:{type,size}}[key]}},crypto:{randomUUID:()=> 'unique'},supabase:db,validExerciseMediaUrl:u=>u.startsWith('https://'),window:{scrollY:0,scrollTo(){}},requestAnimationFrame:cb=>cb(),render:()=>state.rendered++,toast(){},Date};
 runInNewContext(fn+';this.upload=uploadExerciseMedia;',context);
 await context.upload(form);
 return {...state,ex,status:status.textContent,button,inputs};
}
(async()=>{
 let r=await upload();assert.equal(r.patch.video_url,'https://example.com/media.mp4');assert.equal('male_video_url' in r.patch,false);assert.equal(r.ex.male_video_url,'old-male-video');assert.equal(r.ex.female_video_url,'old-female-video');assert.equal(r.ex.thumbnail_url,'old-image');assert.equal(r.ex.instructions,'Keep instructions');assert.equal(r.rendered,1);
 r=await upload({kind:'image',type:'image/jpeg',audience:'female'});assert.deepEqual(Object.keys(r.patch).sort(),['female_image_url','updated_at']);assert.equal(r.ex.video_url,'old-video');assert.equal(r.ex.thumbnail_url,'old-image');
 r=await upload({kind:'image',type:'image/png'});assert.equal(r.patch.thumbnail_url,r.patch.male_image_url);assert.equal(r.patch.thumbnail_url,r.patch.female_image_url);assert.equal(r.ex.video_url,'old-video');
 r=await upload({audience:'male'});assert.deepEqual(Object.keys(r.patch).sort(),['male_video_url','updated_at']);
 for(const args of [{size:51*1024*1024},{type:'text/html'},{kind:'image',type:'image/png',size:11*1024*1024},{coach:false}]){r=await upload(args);assert.equal(r.uploads,0);assert.equal(r.patch,null)}
 r=await upload({saveError:true});assert.equal(r.removed,1);assert.equal(r.ex.video_url,'old-video');assert.equal(r.rendered,0);assert.equal(r.button.disabled,false);
 r=await upload({uploadError:true});assert.equal(r.patch,null);assert.equal(r.button.disabled,false);
 console.log('10 upload scenarios passed: field isolation, audience, validation, coach gate, failure cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
