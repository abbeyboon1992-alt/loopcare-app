import { runEscalationEngine } from "@/lib/escalationEngine";

export async function GET() {
  await runEscalationEngine();
  return Response.json({ success: true });
}