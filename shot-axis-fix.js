(()=>{
  function formatSvTick(value){
    const n=Number(value);
    return Number.isFinite(n) ? n.toFixed(3).replace(/^0/,'') : value;
  }

  function applyShotContextAxis(){
    if(!window.Chart) return;
    ['ctxType','ctxScore'].forEach(id=>{
      const canvas=document.getElementById(id);
      if(!canvas) return;
      const chart=Chart.getChart(canvas);
      if(!chart || !chart.options || !chart.options.scales || !chart.options.scales.y) return;
      chart.options.scales.y.min=.5;
      chart.options.scales.y.max=1;
      chart.options.scales.y.ticks={
        ...(chart.options.scales.y.ticks||{}),
        stepSize:.05,
        callback:formatSvTick
      };
      chart.update('none');
    });
  }

  const observer=new MutationObserver(()=>setTimeout(applyShotContextAxis,0));
  const start=()=>{
    if(document.body) observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(applyShotContextAxis,0);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  window.addEventListener('hashchange',()=>setTimeout(applyShotContextAxis,50));
})();
