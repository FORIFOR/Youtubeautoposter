import { AppError, endpoint, json, jsonBody, owner } from "@/lib/http";
import { Repository } from "@/lib/repository";
import { draftUpdateInput } from "@/lib/validation";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return endpoint(async () => {
  const ownerId = await owner(request), { id } = await context.params, input = draftUpdateInput.parse(await jsonBody(request)), repo = new Repository();
  const draft = await repo.draft(ownerId, id);
  if (!draft) throw new AppError("下書きが見つかりません。", 404);
  if (draft.revision !== input.expectedRevision) throw new AppError("下書きが更新されています。最新の内容を読み直してから確認してください。", 409);
  const previous = JSON.stringify(draft);
  const updated = "script" in input ? { ...draft, script: input.script, status: "draft" as const, revision: draft.revision + 1 } : { ...draft, status: "reviewed" as const, revision: draft.revision + 1 };
  if (!await repo.updateDraft(ownerId, updated, previous)) throw new AppError("別の操作で下書きが更新されました。再読み込みしてください。", 409);
  return json(updated);
}); }
