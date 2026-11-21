// PDF contents are untrusted data. No scripts, links or embedded attachments are executed.
export function groupPdfLines(items){
 const lines=[];
 for(const item of items){if(!item.str?.trim())continue;const y=item.transform[5];let line=lines.find(l=>Math.abs(l.y-y)<3);if(!line){line={y,items:[]};lines.push(line);}line.items.push(item);}
 return lines.sort((a,b)=>b.y-a.y).map(l=>l.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ').trim());
}
export function candidateRows(lines){
 // Only suggest amounts for an unambiguous description/qty/unit-rate/line-total row.
 // Other supplier layouts leave amounts blank; the operator must review every row.
 return lines.filter(s=>s.length>4&&/[a-z]/i.test(s)&&/\d/.test(s)&&!/^\s*(?:total|subtotal|grand|invoice|date|gst|cgst|sgst|igst|phone|mobile|bank|account|ifsc|page|tax|amount|round|discount)\b/i.test(s)).slice(0,80).map(text=>{
  const row={name:text.slice(0,160),qty:'',cost:'',price:'',productId:''};
  const m=text.match(/^(.+?)\s+(\d{1,5})\s+(?:(?:pcs|nos|units)\s+)?([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/i);
  if(m){const qty=Number(m[2]),cost=Number(m[3].replace(/,/g,'')),total=Number(m[4].replace(/,/g,''));if(qty>0&&Math.abs(qty*cost-total)<0.011){row.name=m[1].slice(0,160);row.qty=m[2];row.cost=cost.toFixed(2);}}
  return row;
 });
}
export async function readSupplierPdf(file){
 if(!file||file.size>15_000_000)throw Error('Choose a PDF smaller than 15 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(!new TextDecoder().decode(bytes.slice(0,5)).startsWith('%PDF-'))throw Error('This file is not a PDF.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const pdfjs=await import('../vendor/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdf.worker.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true});
 let pdf;
 try{pdf=await task.promise;if(pdf.numPages>40)throw Error('Import at most 40 pages at a time.');const lines=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const text=await page.getTextContent();lines.push(...groupPdfLines(text.items));page.cleanup();}return {hash,lines,rows:candidateRows(lines)};}
 catch(e){if(e.name==='PasswordException')throw Error('This PDF is password protected. Use an unlocked supplier copy.');throw e;}
 finally{await task.destroy();}
}
