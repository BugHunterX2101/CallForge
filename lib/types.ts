export type Stage = "Discovery" | "Proposal" | "Negotiation" | "Closed Won";
export type DraftStatus = "drafted" | "awaiting_approval" | "sent" | "rejected";
export type Deal = { id:string; account:string; name:string; stage:Stage; value:number; due:string; owner:string; primaryContact:string; budget:string; timeline:string; decisionMaker:string; competitors:string };
export type Call = { id:string; title:string; date:string; duration:string; source:"Zoom"|"Gmail"|"Drive"; summary:string; objections:string[]; commitments:string[]; dealId:string; draftId:string; status:"processed"|"input_needed"; transcriptUrl:string };
export type Draft = { id:string; callId:string; to:string; subject:string; body:string; status:DraftStatus; gmailDraftId?:string };
export type Task = { id:string; title:string; source:string; due:string; owner:"Rep"|"Client"; completed:boolean };
export type Integration = { provider:"Gmail"|"Google Calendar"|"Zoom"|"Google Drive"|"Slack"|"HubSpot"|"Google Sheets"; connected:boolean };
