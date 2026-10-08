(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.IFECore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};
  const max0=v=>Math.max(0,num(v,0));
  const EPS=1e-7;

  function computeAarFuelState({fobIn=0,targetOutFob=0,durationBurn=0,requestedOnload=0,manual=false,capacity=0}={}){
    const fIn=Number(fobIn), target=max0(targetOutFob), burn=Number(durationBurn), cap=max0(capacity);
    const requiredGross=Math.max(0,target+burn-fIn);
    const requested=manual?Number(requestedOnload):requiredGross;
    // Constant simultaneous transfer/burn: physical FOB is linear between IN and OUT.
    // Checking BOTH endpoints therefore bounds the entire event. AFTER LOAD is accounting only.
    const initialValid=Number.isFinite(fIn)&&fIn>=0&&fIn<=cap+EPS;
    const grossCapacity=initialValid&&Number.isFinite(burn)&&burn>=0?Math.max(0,cap-fIn+burn):NaN;
    const capacityLimited=requested>grossCapacity+EPS;
    const candidate=manual?requested:Math.min(requested,grossCapacity);
    const rawOut=fIn+candidate-burn;
    const valid=initialValid&&Number.isFinite(burn)&&burn>=0&&Number.isFinite(candidate)&&candidate>=0&&rawOut>=-EPS&&rawOut<=cap+EPS;
    // An infeasible MANUAL request is rejected, never silently reduced to a different onload.
    const accepted=valid?candidate:NaN;
    const fobAfterLoad=valid?fIn+accepted:NaN;
    const fobOut=valid?Math.min(cap,Math.max(0,rawOut)):NaN;
    const netGain=accepted-burn;
    const shortfall=Math.max(0,target-fobOut);
    return {
      fobIn:fIn,targetOutFob:target,durationBurn:burn,capacity:cap,
      requiredGross,requested,grossCapacity,accepted,fobAfterLoad,fobOut,netGain,shortfall,
      valid,initialValid,capacityLimited,fuelExhausted:rawOut < -EPS,
      targetOverCapacity:target>cap+EPS,
      afterLoadWithinStaticCapacity:fobAfterLoad<=cap+EPS
    };
  }

  function computeAarTransfer({rate=null,receiverFlow=0,eventDuration=0,fobIn=0,targetOutFob=0,grossOnload=0,manual=false,capacity=0}={}){
    const R=Number(rate),F=Number(receiverFlow),D=Number(eventDuration),I=Number(fobIn),T=Number(targetOutFob),G=Number(grossOnload),C=Number(capacity);
    const base={rate:rate==null||rate===''?NaN:R,transferTime:NaN,transferBurn:NaN,orbitTime:NaN,orbitBurn:NaN,eventBurn:F*D,grossOnload:NaN,fobOut:NaN,peakFob:NaN,valid:false};
    if(rate==null||rate==='')return {...base,status:'RATE REQUIRED',missingRate:true};
    if(!Number.isFinite(R)||R<=0)return {...base,status:'RATE CHECK'};
    if(!Number.isFinite(F)||F<0)return {...base,status:'FLOW REQUIRED'};
    if(R<=F)return {...base,status:'RATE ≤ RECEIVER FLOW'};
    if(!Number.isFinite(D)||D<0||!Number.isFinite(I)||I<0||I>C||!Number.isFinite(C)||C<=0||(!manual&&(!Number.isFinite(T)||T<0))||(manual&&(!Number.isFinite(G)||G<0)))return {...base,status:'INPUT CHECK'};
    // Target is at EVENT OUT. Burn occurs throughout the event, not just during transfer.
    // With no extra orbit, t = (T-I)/(R-F). With a longer fixed event, t = (T-I+F*D)/R.
    const minimumTargetTime=Math.max(0,(T-I)/(R-F));
    const time=manual?G/R:Math.max(0,(T-I+F*D)/R);
    const requiredTime=!manual&&time>D+EPS?minimumTargetTime:time;
    const gross=manual?G:R*requiredTime;
    const transferBurn=F*requiredTime,orbitTime=Math.max(0,D-requiredTime),orbitBurn=F*orbitTime;
    const peak=I+gross-transferBurn,out=peak-orbitBurn;
    const result={...base,transferTime:requiredTime,transferBurn,orbitTime,orbitBurn,eventBurn:transferBurn+orbitBurn,grossOnload:gross,peakFob:peak,fobOut:out};
    if(requiredTime>D+EPS)return {...result,status:'EVENT TOO SHORT',fobOut:NaN};
    if(peak>C+EPS||out>C+EPS)return {...result,status:'TRANSFER CAP LIMIT',fobOut:NaN};
    if(out< -EPS)return {...result,status:'FUEL EXHAUSTED',fobOut:NaN};
    return {...result,status:'TRANSFER PLAN OK',valid:true};
  }

  function computeJokerRequirement({remainingAtWp=0,holdFuelAtWp=0,aarBurnAtWp=0,recoveryFloor=0,buffer=0,basis='in'}={}){
    const remIn=max0(remainingAtWp), hold=max0(holdFuelAtWp), floor=max0(recoveryFloor), buf=max0(buffer);
    const normalized=basis==='out'?'out':'in';
    const remBasis=normalized==='out'?Math.max(0,remIn-hold-max0(aarBurnAtWp)):remIn;
    const base=remBasis+floor;
    return {basis:normalized,remaining:remBasis,base,auto:base+buf};
  }

  function holdOutState({etaInMin=0,holdMin=0,fobIn=0,holdFuel=0}={}){
    const f=Number(fobIn)-max0(holdFuel);
    return {etaOutMin:num(etaInMin,0)+max0(holdMin),fobOut:Number.isFinite(f)&&f>=0?f:NaN};
  }


  function propagateFuelPath({startFob=0,groundFuel=0,legFuelAt=[],holdFuelAt=[],aarIndex=-1,aarNetGain=0,capacity=Infinity}={}){
    const n=Math.max(1,legFuelAt.length,holdFuelAt.length), fobInAt=new Array(n).fill(NaN), fobOutAt=new Array(n).fill(NaN);
    let firstInvalidIndex=-1,f=Number(startFob);
    const checked=(value,i)=>{
      if(!Number.isFinite(value)||value < -EPS||value>capacity+EPS){
        if(firstInvalidIndex<0)firstInvalidIndex=i;
        return NaN;
      }
      return Math.min(capacity,Math.max(0,value));
    };
    f=checked(f,0)-max0(groundFuel);
    for(let i=0;i<n;i++){
      if(i>0)f-=Number(legFuelAt[i]??0);
      f=checked(f,i);
      fobInAt[i]=f;
      if(i===aarIndex)f=checked(f+Number(aarNetGain),i);
      f-=Number(holdFuelAt[i]??0);
      f=checked(f,i);
      fobOutAt[i]=f;
    }
    return {fobInAt,fobOutAt,landingFob:fobInAt[n-1],valid:firstInvalidIndex<0,firstInvalidIndex};
  }

  function buildSimpleTimeline({legMinutes=[],holdMinutes=[],aarIndex=-1,aarDuration=0,hardTimeMinutes=[]}={}){
    const n=legMinutes.length+1, eta=new Array(n).fill(0), out=new Array(n).fill(0);
    const planned=Array.from({length:n},(_,i)=>max0(holdMinutes[i]||0));
    const added=new Array(n).fill(0), deltas=new Array(n).fill(NaN), issues=[];
    const calculate=()=>{
      let t=0;
      for(let i=0;i<n;i++){
        eta[i]=t;
        out[i]=t+planned[i]+added[i]+(i===aarIndex?max0(aarDuration):0);
        if(i<n-1)t=out[i]+max0(legMinutes[i]||0);
      }
    };
    calculate();
    let lastAnchor=0;
    for(let i=1;i<n;i++){
      const target=hardTimeMinutes[i];
      if(!Number.isFinite(target))continue;
      const delta=target-eta[i];
      deltas[i]=delta;
      if(delta>EPS){
        // Prefer an explicitly planned HOLD before this anchor. Otherwise wait at
        // the immediately preceding intermediate WP. Never move an earlier anchor.
        let at=-1;
        for(let j=i-1;j>=Math.max(1,lastAnchor);j--)if(planned[j]>0){at=j;break;}
        if(at<0&&i-1>=Math.max(1,lastAnchor))at=i-1;
        if(at>=0){added[at]+=delta;calculate();}
        else issues.push({index:i,delta,reason:'NO HOLD WAYPOINT'});
      }else if(delta < -EPS)issues.push({index:i,delta,reason:'LATE'});
      lastAnchor=i;
    }
    return {etaIn:eta,wpOut:out,holdMinutes:planned.map((m,i)=>m+added[i]),scheduleHoldMinutes:added,hardTimeDeltaAt:deltas,hardTimeIssues:issues};
  }

  return {computeAarTransfer,computeAarFuelState,computeJokerRequirement,holdOutState,propagateFuelPath,buildSimpleTimeline};
});
