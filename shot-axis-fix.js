(()=>{
  function formatSvTick(value){
    const n=Number(value);
    return Number.isFinite(n) ? n.toFixed(3).replace(/^0/,'') : String(value ?? '');
  }

  function applyShotContextAxis(){
    if(!window.Chart || typeof Chart.getChart!=='function') return;
    ['ctxType','ctxScore'].forEach(id=>{
      const canvas=document.getElementById(id);
      if(!canvas) return;
      const chart=Chart.getChart(canvas);
      if(!chart || !chart.options || !chart.options.scales || !chart.options.scales.y) return;
      const y=chart.options.scales.y;
      y.min=.5;
      y.max=1;
      if(!y.ticks) y.ticks={};
      y.ticks.stepSize=.05;
      y.ticks.callback=formatSvTick;
      try{ chart.update('none'); }catch(err){ console.warn('Axis update skipped:',err); }
    });
  }

  let timer=null;
  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(applyShotContextAxis,60);
  }

  const start=()=>{
    const target=document.getElementById('app')||document.body;
    if(target){
      const observer=new MutationObserver(schedule);
      observer.observe(target,{childList:true,subtree:true});
    }
    schedule();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  window.addEventListener('hashchange',schedule);
})();
