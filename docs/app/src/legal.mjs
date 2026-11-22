export const LEGAL_VERSION='2026-11-21.2';
export const legalLinks=()=>`<a href="./terms.html" data-legal-page>Terms &amp; Conditions</a> and <a href="./privacy.html" data-legal-page>Privacy Policy</a>`;

export function openLegalPage(event){
  const link=event.target.closest?.('a[data-legal-page]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||
    typeof HTMLDialogElement==='undefined'||!HTMLDialogElement.prototype.showModal)return;
  event.preventDefault();
  const dialog=document.createElement('dialog');
  dialog.className='legal-dialog';
  dialog.dataset.legalDialog='';
  dialog.setAttribute('aria-label','TyreDesk terms and privacy');
  const frame=document.createElement('iframe');
  frame.title='TyreDesk terms and privacy';
  frame.src=link.href;
  dialog.append(frame);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);
  dialog.showModal();
}
export function consentRecord(accepted,at=new Date().toISOString()){
  if(!accepted)throw Error('Read and accept the Terms & Conditions and acknowledge the Privacy Policy to create your shop.');
  return {termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION,acceptedAt:at};
}
