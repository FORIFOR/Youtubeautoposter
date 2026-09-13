CREATE TABLE `analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`video_id` text NOT NULL,
	`day` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_analytics_video_day` ON `analytics` (`video_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_analytics_owner` ON `analytics` (`owner_id`);--> statement-breakpoint
CREATE TABLE `analytics_attempts` (
	`video_id` text PRIMARY KEY NOT NULL,
	`attempted_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `collection_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`finished_at` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_collection_runs_owner_finished` ON `collection_runs` (`owner_id`,`finished_at`);--> statement-breakpoint
CREATE TABLE `collector_locks` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_drafts_owner` ON `drafts` (`owner_id`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_experiments_owner` ON `experiments` (`owner_id`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`video_id` text NOT NULL,
	`checkpoint` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_observations_video_checkpoint` ON `observations` (`video_id`,`checkpoint`);--> statement-breakpoint
CREATE INDEX `idx_observations_owner` ON `observations` (`owner_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`youtube_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_videos_owner_youtube` ON `videos` (`owner_id`,`youtube_id`);--> statement-breakpoint
CREATE INDEX `idx_videos_experiment` ON `videos` (`experiment_id`);