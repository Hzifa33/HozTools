(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function center(W,H,ratio=0,fill=.9){
    let w=W*fill,h=H*fill;
    if(ratio>0){w=Math.min(w,h*ratio);h=w/ratio;}
    return {x:(W-w)/2,y:(H-h)/2,w,h};
  }
  function resize(s,handle,dx,dy,W,H,ratio=0){
    if(handle==='move')return {...s,x:clamp(s.x+dx,0,W-s.w),y:clamp(s.y+dy,0,H-s.h)};
    let l=s.x,t=s.y,r=l+s.w,b=t+s.h;
    if(handle.includes('w'))l=clamp(l+dx,0,r-1);
    if(handle.includes('e'))r=clamp(r+dx,l+1,W);
    if(handle.includes('n'))t=clamp(t+dy,0,b-1);
    if(handle.includes('s'))b=clamp(b+dy,t+1,H);
    if(!(ratio>0))return {x:l,y:t,w:r-l,h:b-t};
    const horizontal=/[we]/.test(handle),vertical=/[ns]/.test(handle);
    const ax=handle.includes('w')?s.x+s.w:handle.includes('e')?s.x:s.x+s.w/2;
    const ay=handle.includes('n')?s.y+s.h:handle.includes('s')?s.y:s.y+s.h/2;
    let w=horizontal?r-l:(b-t)*ratio;
    if(horizontal&&vertical&&Math.abs(dy)>Math.abs(dx)/ratio)w=(b-t)*ratio;
    const maxW=horizontal?(handle.includes('w')?ax:W-ax):2*Math.min(ax,W-ax);
    const maxH=vertical?(handle.includes('n')?ay:H-ay):2*Math.min(ay,H-ay);
    w=clamp(w,Math.min(1,maxW,maxH*ratio),Math.min(maxW,maxH*ratio));
    const h=w/ratio;
    return {x:horizontal?(handle.includes('w')?ax-w:ax):ax-w/2,y:vertical?(handle.includes('n')?ay-h:ay):ay-h/2,w,h};
  }
  function draw(start,end,W,H,ratio=0){
    const left=end.x<start.x,up=end.y<start.y;
    let w=Math.max(1,Math.abs(end.x-start.x)),h=Math.max(1,Math.abs(end.y-start.y));
    if(ratio>0){w=Math.min(Math.max(w,h*ratio),left?start.x:W-start.x,(up?start.y:H-start.y)*ratio);h=w/ratio;}
    return {x:left?start.x-w:start.x,y:up?start.y-h:start.y,w,h};
  }
  const api={center,resize,draw};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HozCropGeometry=api;
})(typeof window==='object'?window:globalThis);
