import { requestSchema } from "@/lib/tactics";
import { analyzeBoard } from "@/lib/openai";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    // Bound untrusted payloads before JSON parsing, including chunked requests.
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: "A board is required." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24_000) {
        await reader.cancel();
        return Response.json(
          { error: "Board request is too large." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const input = requestSchema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!input.success)
      return Response.json(
        { error: "Please send a valid tactical board and question." },
        { status: 400 },
      );
    return Response.json(await analyzeBoard(input.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Unable to read this board. Please try again." },
      { status: 400 },
    );
  }
}
