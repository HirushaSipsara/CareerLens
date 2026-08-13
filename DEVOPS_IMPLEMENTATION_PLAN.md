# CareerLens DevOps Implementation and Learning Plan

## Purpose

This plan turns the current CareerLens DevOps skeleton into a secure, repeatable, reviewable single-EC2 deployment. Complete the phases in order. Each phase has a learning objective, implementation tasks, verification, and a completion checkpoint. Do not run `terraform apply` until you have reviewed its plan and estimated the AWS cost.

The first target is intentionally modest: one public EC2 instance running immutable containers, managed through AWS Systems Manager (SSM). An Application Load Balancer, private application subnets, autoscaling, and custom AMIs are later-stage improvements, not requirements for learning the core workflow.

## Target Workflow and Architecture

```text
feature branch
  -> application tests + lint + image build
  -> Terraform fmt + validate + security scan
  -> pull request Terraform plan
  -> human review and merge
  -> protected environment approval
  -> apply the reviewed Terraform plan
  -> build images tagged with Git SHA
  -> push images to Amazon ECR
  -> deploy exact SHA through SSM
  -> health check
  -> automatic rollback on failure
```

```text
Internet -> 80/443 -> nginx frontend -> private Docker network -> Flask:5000
                                      -> Prometheus and Grafana (restricted)

GitHub Actions --OIDC--> AWS IAM role --> ECR / Terraform / SSM
Terraform state --------> encrypted, versioned S3 backend with locking
Administrator ----------> SSM Session Manager (no public SSH required)
```

## Phase 0: Establish a Safe Baseline

### Learn

Infrastructure changes need a known starting point, small commits, and evidence that existing behavior still works.

### Implement

1. Create a feature branch: `git switch -c feat/devops-foundation`.
2. Record installed versions: Terraform, Docker, Docker Compose, Python, Node.js, and AWS CLI.
3. Confirm AWS identity and region with `aws sts get-caller-identity` and `aws configure get region`.
4. Copy local secrets somewhere secure before changing configuration. Never print them.
5. Add `.gitattributes` so `*.sh` and `*.tf` use LF line endings.
6. Make both shell scripts executable in Git: `git update-index --chmod=+x scripts/setup.sh scripts/deploy.sh`.
7. Run the application baseline:

```powershell
Set-Location backend
python -m pip install -r requirements.txt
python -m pytest

Set-Location ..\frontend
npm ci
npm run lint
npm run build

Set-Location ..
docker compose config
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:5000/health
docker compose down
```

### Complete when

- Tests/builds pass, or any pre-existing failures are documented.
- Secrets and generated files remain untracked.
- Shell files are stored as executable LF files.

## Phase 1: Make Terraform Reproducible

### Learn

`fmt` provides canonical formatting, `validate` checks configuration consistency, and the dependency lock file makes provider selection repeatable.

### Implement

1. Split configuration by responsibility:

```text
terraform/
  backend.tf
  compute.tf
  data.tf
  iam.tf
  network.tf
  outputs.tf
  providers.tf
  security.tf
  terraform.tf
  variables.tf
  terraform.tfvars.example
```

2. Keep Terraform and provider constraints in `terraform.tf`.
3. Run `terraform init -backend=false`; commit the generated `.terraform.lock.hcl`.
4. Remove `.terraform.lock.hcl` from `.gitignore`. Continue ignoring `.terraform/`, state, saved plans, and real `.tfvars` files.
5. Add validations for `aws_region`, `instance_type`, `project_name`, and any CIDR inputs.
6. Replace placeholder repository values with explicit variables or remove the dependency on cloning source code.
7. Decide how AMI updates occur. Do not silently replace the server whenever `most_recent` selects a new image. Pin a reviewed AMI ID per environment or use a controlled AMI-version variable.
8. Create `terraform.tfvars.example` with non-secret example values only.

### Verify

```powershell
terraform -chdir=terraform fmt -recursive
terraform -chdir=terraform init -backend=false
terraform -chdir=terraform validate
terraform -chdir=terraform providers lock -platform=windows_amd64 -platform=linux_amd64
git diff --check
git status --short
```

### Complete when

- Formatting and validation pass.
- The provider lock file is committed with Windows and Linux checksums.
- No placeholder or secret is required to parse the configuration.

## Phase 2: Add Remote State Safely

### Learn

Terraform state can contain sensitive data. Teams need encrypted remote storage, version recovery, access control, and protection against concurrent writes.

### Implement

1. Create a small `terraform/bootstrap/` root module for the state resources, or use HCP Terraform. For AWS, provision:
   - A uniquely named private S3 bucket.
   - Default server-side encryption.
   - Bucket versioning.
   - Public-access blocking.
   - A bucket policy requiring TLS.
   - State locking supported by the selected backend/Terraform version.
2. Apply this bootstrap once using a tightly controlled local state. Store its state securely; do not commit it.
3. Add an S3 backend to the main root module. Backend settings cannot use ordinary Terraform variables, so keep non-secret environment configuration in files such as `environments/dev.s3.tfbackend`.
4. Migrate existing state with `terraform init -migrate-state` only after backing it up.
5. Grant the CI Terraform role access only to the required state key and lock mechanism.

### Verify

```powershell
terraform -chdir=terraform init -reconfigure -backend-config=environments/dev.s3.tfbackend
terraform -chdir=terraform state list
terraform -chdir=terraform plan -var-file=environments/dev.tfvars
```

Test locking with two simultaneous plans in a disposable environment. Confirm bucket versioning and ensure state does not appear in Git.

### Complete when

- State is remote, encrypted, recoverable, and lock-protected.
- A second operator can initialize from a clean checkout.

## Phase 3: Build a Secure AWS Foundation

### Learn

Infrastructure should expose the smallest possible attack surface and give each workload only the permissions it needs.

### Implement

1. Create an explicit VPC, public subnet, internet gateway, route table, and associations rather than depending on the account's default VPC.
2. Permit public inbound traffic only on `80` and, after TLS is configured, `443`.
3. Do not expose `5000`, `9090`, or `3001` publicly. Keep them on the Docker network or restrict administrative access through SSM port forwarding/VPN.
4. Add an EC2 IAM role and instance profile for:
   - SSM managed-instance access.
   - Read-only pulls from the CareerLens ECR repositories.
   - Read access to only the required runtime parameters.
5. Remove the SSH key and port `22` after SSM access is proven. If temporarily retained, restrict it to a validated `/32` CIDR.
6. Require IMDSv2 with `http_tokens = "required"`.
7. Encrypt the root EBS volume, enable delete-on-termination deliberately, and tag all resources consistently through provider `default_tags`.
8. Use a stable DNS name. Introduce HTTPS before treating the service as production-facing.
9. Add budget alerts and document resources that incur hourly or public-IPv4 charges.

### Verify

- SSM reports the instance as managed and a Session Manager shell opens.
- AWS security groups show no public rules for ports `22`, `5000`, `9090`, or `3001`.
- `curl` to the public Flask/Prometheus/Grafana ports fails.
- EBS encryption and IMDSv2 enforcement are visible in AWS.

### Complete when

Only the web entry point is public and administration works without SSH.

## Phase 4: Implement Idempotent Server Bootstrap

### Learn

Bootstrap prepares a host; deployment releases an application. Keeping them separate prevents every release from changing the operating system.

### Implement `scripts/setup.sh`

1. Keep `#!/bin/bash` and `set -euo pipefail`.
2. Add small functions: `log`, `fail`, `require_root`, `install_docker`, `create_directories`, and `configure_service`.
3. Send errors to stderr and add `trap` reporting with the failing line number.
4. Set `DEBIAN_FRONTEND=noninteractive` only for package commands.
5. Install Docker from its official repository and install the Compose plugin.
6. Create `/opt/careerlens/releases`, `/opt/careerlens/config`, and `/var/log/careerlens` with explicit owner and permissions.
7. Install the production Compose manifest and deployment script. Do not copy application source or build images on the server.
8. Confirm the SSM agent and Docker service are enabled and running.
9. Make every step idempotent: a second execution must produce the same final state without failing or duplicating configuration.
10. Keep cloud-init/user data thin. Render it with `templatefile()` and use it only to invoke bootstrap and record logs.

### Verify

```bash
shellcheck scripts/setup.sh scripts/deploy.sh
shfmt -d scripts/setup.sh scripts/deploy.sh
bash -n scripts/setup.sh
sudo bash scripts/setup.sh
sudo bash scripts/setup.sh
systemctl is-active docker
docker compose version
```

Inspect `/var/log/cloud-init-output.log`. Both setup executions must succeed.

### Complete when

A fresh instance becomes deployment-ready automatically, and rerunning setup is safe.

## Phase 5: Implement Immutable Deployment and Rollback

### Learn

A release is an exact artifact, not whatever `latest` or a Git branch happens to contain. A deployment is complete only after verification, and a failed release must be recoverable.

### Implement

1. Let Terraform create separate ECR repositories for frontend and backend images.
2. Create `docker-compose.prod.yml` containing `image:` references only—no `build:` directives.
3. Tag both images with the full Git commit SHA. Optionally add a human-readable release tag, but deploy by immutable SHA or image digest.
4. Make `deploy.sh` accept one required release identifier.
5. In the script:
   - Validate the release format and required commands/files.
   - Acquire a `flock` lock so two deployments cannot overlap.
   - Authenticate to ECR through the EC2 instance role.
   - Record the currently running release.
   - Write the candidate release to a temporary environment file.
   - Run `docker compose pull` and `docker compose up -d --remove-orphans`.
   - Poll backend and frontend health endpoints with a bounded timeout.
   - Mark the release successful only after health checks pass.
   - Restore the previous release and verify it if the candidate fails.
   - Remove old unused images conservatively; never delete the rollback image.
6. Do not log API keys, tokens, registry passwords, or complete environment files.
7. Add an application `/version` endpoint returning the deployed Git SHA so releases are observable.

### Test

- Deploy a valid SHA.
- Deploy the same SHA again; it should be safe.
- Deploy a deliberately unhealthy image and prove rollback.
- Start two deployments and prove the second is rejected or waits.
- Reboot the instance and prove the last healthy release starts.

### Complete when

Every running container maps to a commit, failed health checks roll back, and deployment requires no source build on EC2.

## Phase 6: Add Pull-Request Quality Gates

### Learn

CI answers whether a change is safe to review. It must not deploy unreviewed pull-request code.

### Implement

Create focused workflows rather than one large script:

1. `app-ci.yml`
   - Backend dependency installation and pytest.
   - Frontend `npm ci`, lint, and production build.
   - Frontend and backend Docker builds without pushing.
2. `terraform-ci.yml`
   - Pin the Terraform CLI version.
   - `terraform fmt -check -recursive`.
   - `terraform init -backend=false` and `terraform validate`.
   - TFLint with the AWS ruleset.
   - A Terraform security/configuration scan such as Trivy or Checkov.
   - A real plan for trusted pull requests using a least-privileged planning role.
3. `shell-ci.yml`
   - `shellcheck scripts/*.sh`.
   - `shfmt -d scripts/*.sh`.
4. Give workflows minimum `permissions`, add concurrency controls, pin third-party actions to reviewed versions or commit SHAs, and enable dependency updates.
5. Never provide AWS privileges or secrets to untrusted fork pull requests.

### Complete when

Branch protection requires all relevant checks and reviewers can inspect the infrastructure plan before merging.

## Phase 7: Add Approved Continuous Delivery

### Learn

Authentication, authorization, artifact promotion, and approval are separate controls.

### Implement

1. Configure GitHub-to-AWS OIDC. Do not create long-lived AWS access keys for Actions.
2. Create separate least-privileged IAM roles for:
   - Terraform plan.
   - Terraform apply.
   - Image build/push.
   - Application deployment through SSM.
3. Restrict role trust policies to the exact repository, branch, workflow, and protected GitHub environment.
4. Create a protected `production` environment with required approval.
5. On merge to `main`:
   - Re-run all checks.
   - Produce and preserve a Terraform plan.
   - Require approval, then apply that exact plan.
   - Build and push frontend/backend images tagged with the same Git SHA.
   - Generate an SBOM and scan images before promotion.
   - Sign images if adding a supply-chain tool such as Cosign.
   - Invoke deployment through SSM Run Command.
   - Verify `/health` and `/version` externally.
6. Use GitHub `concurrency` so only one production deployment runs at a time.
7. Store deployment evidence: commit SHA, image digests, plan, approver, timestamps, health result, and rollback result.

### Complete when

A merge cannot deploy without checks and approval, AWS uses short-lived credentials, and the deployed SHA is independently verifiable.

## Phase 8: Manage Secrets Correctly

### Learn

Marking a Terraform value `sensitive` only hides display; Terraform may still store it in state.

### Implement

1. Store `OPENROUTER_API_KEY` in AWS Systems Manager Parameter Store as `SecureString` or in Secrets Manager.
2. Create the secret value outside Terraform so it never enters Terraform state. Terraform may manage only the parameter metadata and access policy if appropriate.
3. Grant the instance role access to that one secret path.
4. Retrieve it at runtime into a root-owned file with mode `0600`, or inject it through a controlled service mechanism.
5. Define a rotation and revocation process.
6. Run secret scanning in CI and enable repository secret protection.

### Complete when

No application secret exists in Git, Terraform state, container images, Compose files, user data, logs, or workflow output.

## Phase 9: Observability and Operations

### Learn

Metrics are useful only when they are secured, retained, and connected to actionable alerts and runbooks.

### Implement

1. Keep Prometheus and Grafana private; access them through SSM forwarding or a protected network path.
2. Replace the default Grafana admin password and provision dashboards/data sources as code.
3. Pin Prometheus and Grafana image versions instead of using `latest`.
4. Configure log rotation and container restart policies.
5. Add alarms for instance status checks, disk use, memory pressure, elevated API errors, and latency.
6. Add runbooks for deployment failure, unhealthy service, disk exhaustion, lost secret, and state recovery.
7. Back up or deliberately treat Grafana as reproducible/replaceable.

### Complete when

An operator can detect a failure, identify the deployed version, find relevant logs/metrics, and follow a tested recovery procedure.

## Phase 10: Recovery, Drift, and Teardown Drills

### Learn

Backups and rollback claims are not real until they are tested.

### Implement and test

1. Restore an earlier S3 state version in a disposable environment.
2. Replace the EC2 instance and prove bootstrap plus deployment recover service.
3. Run a scheduled read-only `terraform plan -detailed-exitcode` to detect drift.
4. Test application rollback to the previous image digest.
5. Use `terraform plan -destroy` before teardown and require explicit approval.
6. Destroy the disposable environment and confirm no chargeable resources remain: instances, EBS volumes/snapshots, Elastic IPs, load balancers, NAT gateways, ECR images, and monitoring storage.

### Complete when

Recovery and teardown procedures are documented with actual test evidence.

## Recommended Commit Sequence

Keep reviewable commits aligned to learning outcomes:

```text
chore: normalize infrastructure file conventions
refactor: organize Terraform root module
feat: add remote Terraform state backend
feat: provision secure CareerLens network and instance
feat: add idempotent EC2 bootstrap
feat: add immutable release deployment and rollback
ci: add application and infrastructure quality gates
ci: authenticate to AWS with GitHub OIDC
feat: add approved production deployment workflow
docs: add operations and disaster recovery runbooks
```

## Definition of Done

The DevOps implementation is complete only when all statements below are true:

- A clean checkout can initialize and validate Terraform.
- `fmt`, `validate`, lint, tests, security scans, and container builds pass in CI.
- Pull requests display a reviewable Terraform plan and never deploy.
- State is encrypted, remote, versioned, and lock-protected.
- The server exposes only intentional web ports and is administered through SSM.
- The host is reproducibly bootstrapped and the setup script is idempotent.
- Images are built once, scanned, and deployed by immutable SHA/digest.
- Production apply/deploy requires a protected approval and short-lived OIDC credentials.
- Health checks verify every release and a failed release rolls back automatically.
- Secrets are absent from Git, state, images, user data, and logs.
- Monitoring, incident runbooks, recovery, drift detection, and teardown have been tested.

## Later Industry Progression

After the single-instance workflow is proven, progress to separate development and production accounts, private application subnets, an HTTPS Application Load Balancer, managed DNS/certificates, autoscaling across Availability Zones, external managed monitoring, policy as code, and Packer/EC2 Image Builder. Add these because reliability or scale requires them—not merely to make the architecture look complex.

## Primary Learning References

- [Terraform configuration style](https://developer.hashicorp.com/terraform/language/style)
- [Terraform automation workflow](https://developer.hashicorp.com/terraform/tutorials/automation/automate-terraform)
- [Terraform remote state](https://developer.hashicorp.com/terraform/language/state/remote)
- [Terraform dependency lock file](https://developer.hashicorp.com/terraform/language/files/dependency-lock)
- [GitHub Actions OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
