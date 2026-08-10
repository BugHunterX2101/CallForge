import { NextResponse } from "next/server"; import { markDraftApproved } from "@/lib/store";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const draft=await markDraftApproved(id);return NextResponse.json(draft)}
