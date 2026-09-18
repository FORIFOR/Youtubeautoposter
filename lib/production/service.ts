import { AppError } from "../http";
import { digest, type LearningDraft } from "../learning";
import { sourceOf, type Job, type RemoteVideo } from "./domain";
import { ProductionRepository } from "./repository";
export async function currentSource(repo: ProductionRepository, job: Job) {
  const d = await repo.draft(job.ownerId,job.source.draftId) as LearningDraft|null;
  const e = await repo.experiment(job.ownerId,job.source.experimentId);
  if (!d||!e||d.completedAt||await digest(sourceOf(d,e))!==job.sourceHash) throw new AppError("元の台本・条件が更新されています。古い制作物では進められません。",409);
}
export async function requiredJob(repo:ProductionRepository,ownerId:string,id:string) {
  const job=await repo.job(ownerId,id);if(!job)throw new AppError("制作ジョブが見つかりません。",404);return job;
}
export async function registerPublicVideo(repo:ProductionRepository,job:Job,remote:RemoteVideo) {
  if (remote.channelId!==job.source.channelId) throw new AppError("投稿先チャンネルが一致しません。",409);
  if (remote.privacy!=="public"||!remote.processed||remote.duration===null||!job.artifact) return job;
  const data=await repo.state(job.ownerId);
  let video=data.videos.find(v=>v.youtubeId===remote.id);
  if(!video){
    video={id:crypto.randomUUID(),youtubeId:remote.id,title:remote.title,channelId:remote.channelId,
      publishedAt:new Date(remote.publishedAt).toISOString(),contentHash:job.artifact.sha256,durationSeconds:remote.duration,
      experimentId:job.source.experimentId,variant:job.source.variant,conditions:job.source.conditions,
      episode:job.plan?.title??job.source.title,createdAt:new Date().toISOString(),verified:true,
      productionProfile:job.artifact.profile};
    await repo.addVideo(job.ownerId,video);
  }
  // The published snapshot is retained even if the source was later edited.
  const draft=await repo.draft(job.ownerId,job.source.draftId) as LearningDraft|null;
  if(draft && draft.revision===job.source.draftRevision && !draft.completedAt){
    await repo.updateDraft(job.ownerId,{...draft,revision:draft.revision+1,completedAt:new Date().toISOString(),publishedVideoId:video.id,completionProvenance:"user_confirmed"} as LearningDraft,JSON.stringify(draft));
  }
  return repo.save(job,{...job,registeredVideoId:video.id});
}
