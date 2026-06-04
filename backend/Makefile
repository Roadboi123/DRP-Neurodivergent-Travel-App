.PHONY: migrate

# Apply pending database migrations (reads DATABASE_URL from the environment/.env).
# Runs automatically before the web server on deploy (see Procfile); use this to
# apply them by hand locally.
migrate:
	python -m app.db.migrate
