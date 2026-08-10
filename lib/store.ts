import { drafts } from "./demo-data";
export async function updateDraft(id:string,patch:{body?:string}) { const draft=drafts.find(d=>d.id===id); if(!draft) throw new Error('Draft not found'); if(patch.body) draft.body=patch.body; return draft; }
export async function markDraftApproved(id:string){const draft=drafts.find(d=>d.id===id);if(!draft)throw new Error('Draft not found');if(draft.status==='sent')return draft;/* In production, GmailAdapter.sendDraft is called transactionally before this transition. */draft.status='sent';return draft;}
