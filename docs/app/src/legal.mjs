export const LEGAL_VERSION='2026-11-21.2';
export const legalLinks=()=>`<a href="./terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a> and <a href="./privacy.html" target="_blank" rel="noopener">Privacy Policy</a>`;
export function consentRecord(accepted,at=new Date().toISOString()){
  if(!accepted)throw Error('Read and accept the Terms & Conditions and acknowledge the Privacy Policy to create your shop.');
  return {termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION,acceptedAt:at};
}
