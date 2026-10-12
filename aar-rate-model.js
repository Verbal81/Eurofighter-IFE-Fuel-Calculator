/* Receiver-observed A330 MRTT simulator curves. Gross rates include modeled
   receiver burn at the measurement condition. No real-world tanker rating. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.IFEAarRates=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const EPS=1e-8;
  function segments(run){
    let fuel=run.fuelStartKg,time=0;
    return run.checkpoints.map(p=>{const out={lo:fuel,hi:p.fuelKg,rate:(p.fuelKg-fuel)*60/(p.elapsedSec-time)+run.receiverFlow};fuel=p.fuelKg;time=p.elapsedSec;return out;});
  }
  function sample(run,fob){
    const parts=segments(run),segment=parts.find(p=>fob>=p.lo-EPS&&fob<p.hi-EPS)|| (fob<parts[0].lo?parts[0]:parts[parts.length-1]);
    return {...run,rate:segment.rate,covered:fob>=parts[0].lo-EPS&&fob<=parts[parts.length-1].hi+EPS};
  }
  function rateAt({runs,configuration,flightLevel,speedKt,fob}){
    const pts=runs.filter(r=>r.configuration===configuration&&Number.isFinite(r.receiverFlow)).map(r=>sample(r,fob));
    if(!pts.length)return {rate:NaN,kind:'NO DATA',ids:[]};
    const exact=pts.find(p=>Math.abs(p.flightLevel-flightLevel)<EPS&&Math.abs(p.speedKt-speedKt)<EPS);
    if(exact)return {rate:exact.rate,kind:exact.covered?'MEASURED PROFILE':'FUEL-BAND ESTIMATE',ids:[exact.run]};
    // Interpolate only samples covering the SAME current fuel band. Do not mix
    // whole-run averages from a low-fuel check with a near-full refuelling curve.
    const covered=pts.filter(p=>p.covered);
    for(let i=0;i<covered.length;i++)for(let j=i+1;j<covered.length;j++){
      const a=covered[i],b=covered[j];let w;
      if(a.flightLevel===b.flightLevel&&Math.abs(flightLevel-a.flightLevel)<EPS)w=(speedKt-a.speedKt)/(b.speedKt-a.speedKt);
      else if(a.speedKt===b.speedKt&&Math.abs(speedKt-a.speedKt)<EPS)w=(flightLevel-a.flightLevel)/(b.flightLevel-a.flightLevel);
      if(Number.isFinite(w)&&w>=0&&w<=1)return {rate:a.rate+(b.rate-a.rate)*w,kind:'INTERPOLATED',ids:[a.run,b.run]};
    }
    // Linear interpolation inside measured triangles; no unchecked extrapolation.
    for(let i=0;i<covered.length;i++)for(let j=i+1;j<covered.length;j++)for(let k=j+1;k<covered.length;k++){
      const a=covered[i],b=covered[j],c=covered[k],x=flightLevel,y=speedKt;
      const den=(b.speedKt-c.speedKt)*(a.flightLevel-c.flightLevel)+(c.flightLevel-b.flightLevel)*(a.speedKt-c.speedKt);
      if(Math.abs(den)<EPS)continue;
      const u=((b.speedKt-c.speedKt)*(x-c.flightLevel)+(c.flightLevel-b.flightLevel)*(y-c.speedKt))/den;
      const v=((c.speedKt-a.speedKt)*(x-c.flightLevel)+(a.flightLevel-c.flightLevel)*(y-c.speedKt))/den,w=1-u-v;
      if(Math.min(u,v,w)>=-EPS)return {rate:u*a.rate+v*b.rate+w*c.rate,kind:'INTERPOLATED',ids:[a.run,b.run,c.run]};
    }
    const pool=covered.length?covered:pts;
    pool.sort((a,b)=>Math.hypot((a.flightLevel-flightLevel)/100,(a.speedKt-speedKt)/100)-Math.hypot((b.flightLevel-flightLevel)/100,(b.speedKt-speedKt)/100));
    return {rate:pool[0].rate,kind:pool[0].covered?'REFERENCE ESTIMATE':'REFERENCE / FUEL-BAND ESTIMATE',ids:[pool[0].run]};
  }
  function effectiveRate(args){
    const {runs,configuration,fobIn,grossOnload,receiverFlow}=args;
    if(!Number.isFinite(fobIn)||!Number.isFinite(grossOnload)||grossOnload<0||!Number.isFinite(receiverFlow)||receiverFlow<0)return {rate:NaN,status:'INPUT CHECK'};
    const bounds=[...new Set(runs.filter(r=>r.configuration===configuration).flatMap(r=>[r.fuelStartKg,...r.checkpoints.map(p=>p.fuelKg)]))].sort((a,b)=>a-b);
    const kinds=new Set(),ids=new Set();let fuel=fobIn,remaining=grossOnload,time=0;
    for(let n=0;n<=bounds.length+2;n++){
      if(remaining<=EPS&&time>0)return {rate:grossOnload/time,time,peakFob:fuel,kinds:[...kinds],ids:[...ids],status:'OK'};
      const point=rateAt({...args,fob:fuel+EPS*2});kinds.add(point.kind);point.ids.forEach(id=>ids.add(id));
      const rate=point.rate,net=rate-receiverFlow;
      if(!Number.isFinite(rate)||net<=0)return {rate:NaN,status:Number.isFinite(rate)?'RATE ≤ RECEIVER FLOW':'NO DATA',kinds:[...kinds],ids:[...ids]};
      if(remaining<=EPS)return {rate:time>0?grossOnload/time:rate,time,peakFob:fuel,kinds:[...kinds],ids:[...ids],status:'OK'};
      const boundary=bounds.find(b=>b>fuel+EPS),dt=boundary===undefined?Infinity:(boundary-fuel)/net;
      const usedTime=Math.min(remaining/rate,dt);time+=usedTime;remaining=Math.max(0,remaining-rate*usedTime);fuel+=net*usedTime;
    }
    return {rate:NaN,status:'CURVE CHECK'};
  }
  return {rateAt,effectiveRate,segments};
});
