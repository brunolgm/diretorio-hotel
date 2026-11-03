// Browser-only adapter. SQL/RPC behavior is tested separately in the rollback matrix.
export async function saveFbAction(_state:object,form:FormData) { document.body.dataset.fbLocalSave=String(form.get('name')); return {}; }
export async function deleteFbAction() { document.body.dataset.fbLocalDelete='confirmed'; }
export async function moveFbAction() { document.body.dataset.fbLocalMove='requested'; }
export async function uploadFbImageAction() { document.body.dataset.fbLocalImage='upload'; }
export async function removeFbImageAction() { document.body.dataset.fbLocalImage='remove'; }
