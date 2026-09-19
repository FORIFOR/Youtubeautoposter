import { AppError, endpoint, json, jsonBody, owner } from "@/lib/http";
import { Repository } from "@/lib/repository";
import { compare } from "@/lib/growth";
import { makeLearningDraft } from "@/lib/learning";
import { draftInput } from "@/lib/validation";
export async function POST(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request), input = draftInput.parse(await jsonBody(request)), repo = new Repository();
  const data = await repo.state(ownerId), experiment = data.experiments.find(e => e.id === input.experimentId);
  if (!experiment) throw new AppError("比較計画が見つかりません。", 404);
  const draft = makeLearningDraft(experiment, data, compare(experiment, data), input.title);
  await repo.addDraft(ownerId, draft);
  return json(draft, 201);
}); }
