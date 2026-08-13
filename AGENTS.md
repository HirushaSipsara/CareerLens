# Repository Guidelines

## Project Structure & Module Organization

CareerLens is split into a Next.js frontend and a Flask API. Frontend routes and global styles live in `frontend/app/`; reusable components are in `frontend/components/`, utilities in `frontend/lib/`, and static assets in `frontend/public/`. The API and Prometheus instrumentation are implemented in `backend/app.py`, with pytest coverage under `backend/tests/`. Infrastructure is organized separately: `monitoring/` contains Prometheus configuration, `terraform/` contains AWS infrastructure, `scripts/` contains Bash provisioning/deployment helpers, and `docker-compose.yml` runs the local stack.

## Build, Test, and Development Commands

- `docker compose up --build`: build and run the full stack. The frontend defaults to `http://localhost:8000`, the API to port `5000`, Prometheus to `9090`, and Grafana to `3001`.
- `cd frontend; npm ci; npm run dev`: install locked dependencies and start Next.js development mode.
- `cd frontend; npm run build`: run the production frontend build and TypeScript checks.
- `cd frontend; npm run lint`: lint TypeScript and React sources with ESLint.
- `cd backend; python -m pip install -r requirements.txt; python app.py`: install and run the Flask API locally.
- `cd backend; python -m pytest`: run the backend test suite exactly as CI does.

## Coding Style & Naming Conventions

Use four spaces in Python and follow PEP 8 conventions: `snake_case` for functions and variables, `UPPER_SNAKE_CASE` for constants. TypeScript is strict; use two-space indentation, single quotes, `PascalCase` for React components and interfaces, and `camelCase` for functions and state. Name component files in kebab case, for example `background-animation.tsx`. Prefer the `@/` import alias for frontend modules. Run lint and tests before submitting changes.

## Testing Guidelines

Pytest is the current test framework. Place backend tests in `backend/tests/`, name files `test_*.py`, and name cases `test_<behavior>`. Use Flask's test client and mock OpenRouter calls; tests must not depend on live API access. Add success, validation, and upstream-error cases for API changes. No coverage threshold is configured, so focus on behavior affected by the change.

## Commit & Pull Request Guidelines

Recent history uses short, imperative Conventional Commit subjects such as `feat: implement CareerLens frontend and backend services` and `chore: initialize project structure`. Keep commits focused and use an appropriate prefix (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Pull requests should explain the change, list verification commands, link related issues, and include screenshots for visible UI updates. Call out configuration, Terraform, or deployment impacts explicitly.

## Security & Configuration

Store `OPENROUTER_API_KEY` only in `backend/.env`; never commit secrets, `.env` files, Terraform state, or generated dependency directories. Use placeholders in documentation and logs.
