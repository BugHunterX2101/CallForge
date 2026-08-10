import type { Call, CannedTranscript, Deal, Draft, Integration, Task } from "./types";
export const deals: Deal[] = [
 {id:"deal_techflow",account:"TechFlow",name:"Enterprise Expansion",stage:"Discovery",value:120000,due:"Today, 4 PM",owner:"Demo Rep",primaryContact:"Nina Patel",budget:"$100k – $150k",timeline:"Q1 2027",decisionMaker:"Nina Patel",competitors:"None known"},
 {id:"deal_acme",account:"Acme Corp",name:"Q3 Renewal",stage:"Proposal",value:45000,due:"Oct 24",owner:"Demo Rep",primaryContact:"Sarah Jenkins",budget:"$150k – $200k",timeline:"Q1 2024",decisionMaker:"Sarah Jenkins",competitors:"Logisync, Oracle"},
 {id:"deal_stark",account:"Stark Ind.",name:"Stark Ind. Pilot",stage:"Negotiation",value:250000,due:"Pending",owner:"Demo Rep",primaryContact:"Tony Stark",budget:"Not specified",timeline:"Not specified",decisionMaker:"Tony Stark",competitors:"Not specified"},
 {id:"deal_global",account:"GlobalNet",name:"GlobalNet Integration",stage:"Closed Won",value:85500,due:"Oct 20",owner:"Demo Rep",primaryContact:"Grace Ng",budget:"$85,500",timeline:"Closed",decisionMaker:"Grace Ng",competitors:"None"}
];
export const drafts: Draft[] = [{id:"draft_acme",callId:"call_acme",to:"sarah.j@acmecorp.com",subject:"Following up: Gravity + Acme Corp Ops Efficiency",status:"awaiting_approval",gmailDraftId:"demo_gmail_draft",body:`Hi Sarah,\n\nGreat speaking with you and the team today. It’s clear that reducing the 12% manual data entry error rate in your fulfillment centers is a top priority for Q1.\n\nAs promised, I’ve attached our technical documentation regarding the SAP integration to address your team’s architecture questions. We are confident we can deploy without disrupting your peak season operations.\n\nI will follow up shortly with a customized ROI calculator based on the $1.2M shrinkage figure we discussed.\n\nAre you and your lead architect available next Tuesday at 10 AM PST for a technical deep dive?\n\nBest,\nDemo Rep`}];
export const calls: Call[] = [
 {id:"call_acme",title:"Acme Corp Initial Discovery",date:"Oct 24, 2023 - 10:00 AM PST",duration:"45m 12s",source:"Zoom",dealId:"deal_acme",draftId:"draft_acme",status:"processed",transcriptUrl:"#demo-transcript",summary:"The Acme Corp team, led by Sarah Jenkins, VP Ops, is primarily concerned with reducing manual data entry errors across their fulfillment centers. They are currently using a legacy system that causes a 12% error rate, translating to roughly $1.2M in annual shrinkage. They expressed strong interest in our automated reconciliation module, provided it can integrate seamlessly with their existing SAP backend.",objections:["Implementation time might disrupt peak season operations.","Concerned about data residency requirements for their EU warehouses.","Pushback on per-user pricing model vs flat site license."],commitments:["Provide SAP integration technical documentation by Friday.","Schedule a deep-dive demo with their lead architect next week.","Send over a customized ROI calculator based on their $1.2M shrinkage figure."]},
 {id:"call_stark",title:"Stark Ind. Pilot Sync",date:"Oct 23, 2023 - 4:15 PM PST",duration:"28m 40s",source:"Phone",dealId:"deal_stark",draftId:null,status:"input_needed",transcriptUrl:"#demo-transcript",summary:"Tony Stark confirmed Stark Ind. wants to pilot the automated reconciliation module across two warehouses. He asked for a firm implementation date and rollout plan. The confirmed go-live date was not stated in the transcript and is required before the deal can move forward.",objections:["Wants a firm implementation date before committing to the pilot window.","Asked about support SLAs during the pilot phase."],commitments:["Send pilot scope and rollout plan by Friday.","Tony will connect his ops lead for the site survey."]}
];
export const tasks: Task[] = [
 {id:"task_1",title:"Send updated pricing proposal for Q3",source:"Acme Corp Sync",due:"Due Today",owner:"Rep",completed:false},
 {id:"task_2",title:"Provide technical specs for API integration",source:"Tech Review",due:"Due Oct 14",owner:"Client",completed:false},
 {id:"task_3",title:"Schedule follow-up meeting with procurement",source:"Intro Call",due:"Due Oct 10",owner:"Rep",completed:true}
];
export const integrations: Integration[] = ["Gmail","Google Calendar","Zoom","Google Drive","Slack","HubSpot","Google Sheets"].map(provider=>({provider:provider as Integration["provider"],connected:["Gmail","Google Calendar","Zoom"].includes(provider)}));
export const contacts: { id:string; name:string; email:string; account:string; role:string; dealId:string }[] = [
 {id:"contact_acme",name:"Sarah Jenkins",email:"sarah.j@acmecorp.com",account:"Acme Corp",role:"VP Operations",dealId:"deal_acme"},
 {id:"contact_stark",name:"Tony Stark",email:"tony@starkindustries.com",account:"Stark Ind.",role:"Head of Operations",dealId:"deal_stark"},
 {id:"contact_techflow",name:"Nina Patel",email:"nina.patel@techflow.io",account:"TechFlow",role:"CTO",dealId:"deal_techflow"},
 {id:"contact_global",name:"Grace Ng",email:"grace.ng@globalnet.com",account:"GlobalNet",role:"Procurement Lead",dealId:"deal_global"}
];
export const callTranscripts: Record<string,string> = {
 call_acme:`Sarah Jenkins (VP Ops, Acme Corp): Thanks for the time today. Our fulfillment centers are drowning in manual data entry — we're measuring a 12% error rate right now, and that translates to roughly $1.2M in annual shrinkage.\n\nDemo Rep: That's exactly the problem Gravity's reconciliation module solves. How does your team feel about automating that pipeline?\n\nSarah Jenkins: We're interested, but we need it to sit on top of our existing SAP backend without breaking peak season. Implementation timing is our biggest concern.\n\nDemo Rep: Understood. We can stage the rollout so nothing touches your peak window. I'll send our SAP integration documentation by Friday.\n\nSarah Jenkins: Good. Also — we have EU warehouses with strict data residency rules. Can you confirm where the data lives?\n\nDemo Rep: We support regional data residency. I'll include the specifics in the docs. And your $1.2M shrinkage figure — I'll build a customized ROI calculator around it.\n\nSarah Jenkins: One more thing: your pricing is per-user. We'd prefer a flat site license.\n\nDemo Rep: Happy to discuss that. Can we schedule a deep dive with your lead architect next week?\n\nSarah Jenkins: Let's do it. Send me the options.`,
 call_stark:`Tony Stark (Stark Ind.): We like the reconciliation module. Let's pilot it across two warehouses.\n\nDemo Rep: Great. When would you want to go live?\n\nTony Stark: We need a firm implementation date before we commit to a window — send me the rollout plan and I'll get my ops lead on the site survey.\n\nDemo Rep: I'll send the pilot scope and rollout plan by Friday. Any concerns on support?\n\nTony Stark: Just that we need a clear SLA during the pilot. If that holds, we're in.`
};
export const cannedTranscripts: CannedTranscript[] = [
 {
  id:"canned_globalnet",
  title:"GlobalNet Q4 Expansion Call",
  attendees:["grace.ng@globalnet.com","rep@gravity.example"],
  source:"Zoom",
  duration:"38m 05s",
  dealId:"deal_global",
  body:`Grace Ng (GlobalNet): We're happy with the integration so far. For Q4 we want to expand the rollout to our EMEA region.\n\nDemo Rep: Great — what does that expansion look like for your team?\n\nGrace Ng: We need a phased plan that lands before the holiday freeze. Budget is approved up to $40k for the first phase.\n\nDemo Rep: I'll send the phased expansion plan and a revised quote this week.\n\nGrace Ng: Please also add our compliance officer to the rollout calls.`,
  extraction:{
   summary:"Grace Ng confirmed GlobalNet is happy with the current integration and wants to expand the rollout to EMEA in Q4. A phased plan must land before the holiday freeze, with up to $40k approved for the first phase. She asked for the compliance officer to be added to rollout calls.",
   objections:["Wants the expansion phased so it completes before the holiday freeze."],
   commitments:["Send a phased EMEA expansion plan and revised quote this week.","Add the compliance officer to rollout calls."],
   tasks:[{title:"Send GlobalNet phased EMEA expansion plan",due:"Due Today",owner:"Rep"},{title:"Send revised quote for EMEA phase one",due:"Due Today",owner:"Rep"},{title:"Add compliance officer to rollout calls",due:"Due Oct 28",owner:"Rep"}],
   draft:{to:"grace.ng@globalnet.com",subject:"GlobalNet EMEA expansion — phased plan & quote",body:`Hi Grace,\n\nGreat call today. As discussed, here's the plan for the Q4 EMEA expansion:\n\n• Phased rollout that completes before the holiday freeze\n• Revised quote for phase one (budget approved up to $40k)\n\nI've added your compliance officer to the rollout calls. I'll have the full plan to you this week.\n\nBest,\nDemo Rep`}
  }
 },
 {
  id:"canned_techflow",
  title:"TechFlow Architecture Review",
  attendees:["nina.patel@techflow.io","rep@gravity.example"],
  source:"Zoom",
  duration:"52m 20s",
  dealId:"deal_techflow",
  body:`Nina Patel (CTO, TechFlow): We've reviewed the API docs. Our team can start the sandbox integration next week.\n\nDemo Rep: Excellent. The sandbox is ready for you.\n\nNina Patel: One concern — we need SSO/SAML support before we go to production.\n\nDemo Rep: SAML is on our roadmap and available in the enterprise plan.\n\nNina Patel: Good. Let's target a production cutover for early Q1. I'll have our security team run the review this month.`,
  extraction:{
   summary:"Nina Patel confirmed TechFlow's team can begin the sandbox integration next week and wants SAML/SSO support before production. A production cutover is targeted for early Q1, subject to a security review this month.",
   objections:["Requires SAML/SSO support before production."],
   commitments:["Start sandbox integration next week.","Security team runs review this month.","Target early Q1 production cutover."],
   tasks:[{title:"Enable TechFlow sandbox workspace",due:"Due Today",owner:"Rep"},{title:"Send SAML/SSO enterprise plan details",due:"Due Oct 22",owner:"Rep"},{title:"Run security review of Gravity",due:"Due Oct 30",owner:"Client"}],
   draft:{to:"nina.patel@techflow.io",subject:"TechFlow sandbox + next steps",body:`Hi Nina,\n\nGreat news — your sandbox workspace is ready and your team can start integrating next week.\n\nOn SAML/SSO: it's available in the enterprise plan and we can enable it before your production cutover. I've attached the details and our security documentation for your team's review.\n\nWe're targeting early Q1 for cutover — let me know once the security review kicks off and I'll lock the date.\n\nBest,\nDemo Rep`}
  }
 },
 {
  id:"canned_stark2",
  title:"Stark Ind. Implementation Date",
  attendees:["tony@starkindustries.com","rep@gravity.example"],
  source:"Gmail",
  duration:"22m 10s",
  dealId:"deal_stark",
  body:`Tony Stark: We're ready to commit to the pilot. Implementation can start December 1st.\n\nDemo Rep: Confirmed December 1st for the two-warehouse pilot.\n\nTony Stark: Yes. Send the finalized rollout plan and the site survey schedule.\n\nDemo Rep: You'll have both this week.\n\nTony Stark: Our ops lead will be your point of contact for the survey.`,
  extraction:{
   summary:"Tony Stark confirmed the pilot go-live date of December 1st across two warehouses. The finalized rollout plan and site survey schedule are due this week, with his ops lead as the point of contact.",
   objections:[],
   commitments:["Confirm December 1st pilot start across two warehouses.","Send finalized rollout plan and site survey schedule this week."],
   tasks:[{title:"Finalize Stark Ind. rollout plan",due:"Due Today",owner:"Rep"},{title:"Schedule site survey with ops lead",due:"Due Oct 25",owner:"Rep"}],
   draft:{to:"tony@starkindustries.com",subject:"Confirmed: Stark Ind. pilot starts December 1",body:`Hi Tony,\n\nConfirmed — we're locked in for the two-warehouse pilot starting December 1st.\n\nHere's what you'll receive this week:\n• Finalized rollout plan\n• Site survey schedule with your ops lead\n\nLooking forward to getting this live.\n\nBest,\nDemo Rep`}
  }
 }
];
