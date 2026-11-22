document.querySelector('[data-legal-back]').addEventListener('click',event=>{
  const dialog=window.frameElement?.closest('dialog[data-legal-dialog]');
  if(dialog){
    event.preventDefault();
    dialog.close();
  }else if(document.referrer&&new URL(document.referrer).origin===location.origin&&history.length>1){
    event.preventDefault();
    history.back();
  }
});
