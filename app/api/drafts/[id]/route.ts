import { NextResponse } from "next/server"; import { updateDraft } from "@/lib/store";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return NextResponse.json(await updateDraft(id,await request.json()))}
