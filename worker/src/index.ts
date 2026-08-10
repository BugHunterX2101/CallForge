import { fingerprint,isReadable,isInternalOnly } from './pipeline';
/** Managed worker entry point. Production adapters poll Gmail and Drive every 5 minutes,
 * acquire a unique ProcessedCall fingerprint, then enqueue extraction/CRM/draft/Slack work. */
async function main(){const sample={workspaceId:'demo',source:'gmail' as const,body:'',attendees:[],occurredAt:new Date(),url:''};console.log('Gravity worker started; sample fingerprint:',fingerprint(sample));console.log('Readable:',isReadable(sample.body),'Internal-only:',isInternalOnly(sample.attendees,'gravity.example'));}
main().catch(error=>{console.error(error);process.exit(1)});
