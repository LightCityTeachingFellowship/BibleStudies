const endpoint='https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/getChurchAudioArchive';
export async function archiveRequest(data={}){const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data}),signal:AbortSignal.timeout(25000)});const body=await response.json();if(!response.ok||body.error)throw Error(body.error?.message||'The archive could not load.');return body.result||body.data;}

let catalogue, catalogueUntil = 0, catalogueRequest;

export async function archiveRecordings({ refresh = false } = {}) {
  if (catalogueRequest) return catalogueRequest;
  if (!refresh && catalogue && Date.now() < catalogueUntil) return catalogue;
  catalogueRequest = archiveRequest().then(result => {
    if (!Array.isArray(result?.recordings)) throw Error('The archive could not load.');
    catalogue = result.recordings.filter(row => /^[a-f0-9]{32}$/.test(row?.id) && typeof row.title === 'string');
    catalogueUntil = Date.now() + 60_000;
    return catalogue;
  }).finally(() => { catalogueRequest = null; });
  return catalogueRequest;
}
