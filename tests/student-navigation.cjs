const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const app=readFileSync('app.js','utf8');
const flush=()=>new Promise(setImmediate);
(async()=>{
 const pending=[];let selected='A';
 const db={from(table){const query={table,filters:{},select(){return this},eq(k,v){this.filters[k]=v;return this},in(k,v){this.filters[k]=v;return this},order(){return this},limit(){return this},then(resolve){pending.push({table,filters:this.filters,resolve})}};return query;}};
 const context={supabase:db,data:{},loadErrors:{},isCurrentDataTarget:id=>id===selected,Promise};
 const fn=app.slice(app.indexOf('async function loadTrainingData('),app.indexOf('async function loadTrainingCheckins('));
 runInNewContext(fn+';this.load=loadTrainingData;',context);
 const request=context.load('A');await flush();
 assert.deepEqual(pending.map(x=>x.table),['exercise_library','training_plans','training_sessions']);
 pending.splice(0).forEach(x=>x.resolve({data:x.table==='training_plans'?[{id:'planA'}]:x.table==='training_sessions'?[{id:'sessionA'}]:[{id:'exercise'}]}));
 await flush();assert.deepEqual(pending.map(x=>x.table),['training_days','training_set_logs']);
 pending.splice(0).forEach(x=>x.resolve({data:x.table==='training_days'?[{id:'dayA'}]:[{id:'logA'}]}));
 await flush();assert.equal(pending[0].table,'training_day_exercises');
 // A response from the old student must not overwrite a newly selected student's data.
 selected='B';context.data={training_plans:[{id:'planB'}]};pending.shift().resolve({data:[{id:'oldExercise'}]});await request;
 assert.equal(context.data.training_plans[0].id,'planB');assert.equal(context.data.training_day_exercises,undefined);
 const selections=[],renders=[];
 const chooseContext={isCoach:true,selectedStudentId:'old',selectedTrainingDayId:null,selectedStudentProfile:null,studentSelectionRequest:0,studentDataLoading:false,route:'home',data:{students:[{user_id:'A',full_name:'Student A'},{user_id:'B',full_name:'Student B'}],measurements:[{user_id:'old'}]},loadErrors:{},clearPhotoDraft(){},sessionStorage:{setItem(){}},loadStudentData:()=>new Promise(resolve=>selections.push(resolve)),render(){renders.push({route:this.route,loading:this.studentDataLoading})},toast(){}};
 // VM function calls use global state, so capture it directly in the callback.
 chooseContext.render=()=>renders.push({route:chooseContext.route,loading:chooseContext.studentDataLoading});
 const chooseCode=app.slice(app.indexOf('async function chooseStudent('),app.indexOf('function selectedStudentName('));
 runInNewContext(chooseCode+';this.choose=chooseStudent;',chooseContext);
 const a=chooseContext.choose('A','training');
 assert.equal(chooseContext.route,'training');assert.equal(chooseContext.studentDataLoading,true);assert.equal(renders.length,1);assert.equal(chooseContext.data.measurements.length,0);
 const b=chooseContext.choose('B','student');selections.shift()();await a;
 assert.equal(chooseContext.studentDataLoading,true);assert.equal(chooseContext.selectedStudentId,'B');assert.equal(renders.length,2);
 selections.shift()();await b;assert.equal(chooseContext.studentDataLoading,false);assert.equal(renders.length,3);
 // Navigation starts at the top after the decorators run, but saves do not reset scroll.
 const frames=[],positions=[];const content={scrollTop:900,scrollLeft:20};
 const navContext={route:'training',selectedStudentId:'B',user:{id:'coach'},selectedTrainingDayId:null,lastRenderedScreenKey:'',window:{scrollTo:o=>positions.push(o.top)},document:{querySelector:()=>content,scrollingElement:{scrollTop:900},body:{scrollTop:900}},requestAnimationFrame:fn=>frames.push(fn)};
 const navCode=app.slice(app.indexOf('function resetNavigationScroll('),app.indexOf('function isCurrentDataTarget('));
 runInNewContext(navCode+';this.reset=resetNavigationScroll;',navContext);
 navContext.reset();assert.equal(content.scrollTop,0);assert.equal(positions.length,1);
 frames.shift()();frames.shift()();assert.equal(positions.length,3);
 navContext.reset();assert.equal(positions.length,3);
 navContext.route='trainingDay';navContext.selectedTrainingDayId='day1';navContext.reset();assert.equal(positions.length,4);
 navContext.selectedTrainingDayId='day2';navContext.reset();assert.equal(positions.length,5);
 // A queued reset from a previous page cannot move the current page.
 const previous=positions.length;frames.shift()();assert.equal(positions.length,previous);
 console.log('Student navigation checks passed: parallel queries, stale-response isolation, top on route/day changes, no scroll reset on saves.');
})().catch(error=>{console.error(error);process.exitCode=1});
