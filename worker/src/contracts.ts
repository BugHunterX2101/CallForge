import { z } from "zod";
export const extractionSchema=z.object({summary:z.string().min(1),objections:z.array(z.string()),commitments:z.array(z.string()),nextSteps:z.array(z.object({description:z.string(),owner:z.enum(['rep','client','named_colleague','unknown']),dueDate:z.string().nullable()})),stageSignal:z.enum(['discovery','proposal','negotiation','closed_won','none']),dealMatchConfidence:z.enum(['high','medium','low']),followup:z.object({to:z.string().email(),subject:z.string(),body:z.string()})});
export type Extraction=z.infer<typeof extractionSchema>;
