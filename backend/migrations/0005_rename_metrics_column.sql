-- 0005_rename_metrics_column: renames warning_clicked_for_info to warning_interacted_with.
ALTER TABLE journey_metrics RENAME COLUMN warning_clicked_for_info TO warning_interacted_with;
