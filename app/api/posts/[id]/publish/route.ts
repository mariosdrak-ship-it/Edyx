import { NextResponse } from "next/server";
import { publishPost } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ post: await publishPost(params.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publishing failed." }, { status: 400 });
  }
}
