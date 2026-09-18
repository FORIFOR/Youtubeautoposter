import { endpoint, json, jsonBody, owner } from "@/lib/http";
import { Repository } from "@/lib/repository";
import { compare, draftScript } from "@/lib/growth";
import { draftInput } from "@/lib/validation";

export async function POST(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request), input = draftInput.parse(await jsonBody(request)), repo = new Repository();
  const data = await repo.state(ownerId), experiment = data.experiments.find(e => e.id === input.experimentId);
  if (!experiment) {
    const { AppError } = await import("@/lib/http");
    throw new AppError("比較計画が見つかりません。", 404);
  }
  const evidence = compare(experiment, data);
  // Drafting and claiming evidence are separate permissions. Even with
  // insufficient/inconclusive data we allow an exploratory draft, while the
  // Recommendation keeps candidate=null and publish=false.
  const draft = {
    id: crypto.randomUUID(),
    title: input.title,
    experimentId: experiment.id,
    script: draftScript(experiment, evidence, input.title),
    status: "draft" as const,
    revision: 1,
    evidence,
    createdAt: new Date().toISOString(),
  };
  await repo.addDraft(ownerId, draft);
  return json(draft, 201);
}); }
