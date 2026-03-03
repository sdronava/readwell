# Readwell — AWS Deployment Architecture & Publisher Pipeline

> **Version**: 1.0 — Covers v0.1.0 MVP deployment to AWS
> **IaC**: AWS CDK v2 (TypeScript)
> **Diagram**: See [AWSArchitecture.png](AWSArchitecture.png)

---

## Guiding Principles

- **Serverless-first.** Pay per request, not per idle hour. Scale to zero between jobs.
- **CDK v2 TypeScript** — more expressive than raw CloudFormation for multi-stack architectures; type-safe, good IDE support, generates CloudFormation.
- **Security by default** — least-privilege IAM, magic-byte file validation, SSRF protection, GuardDuty S3 malware scanning, KMS encryption at rest.
- **Cost target** — ~$4–5/month at low traffic (500 DAU, 5 uploads/month). ~$18–20/month at medium traffic (2,000 DAU, 20 uploads/month).

---

## Part A: AWS Deployment Architecture (v0.1.0)

### Services Map

| Current Component | AWS Service(s) | Rationale |
|---|---|---|
| React/Vite frontend | **S3 + CloudFront** | Static files; no server required. CloudFront adds HTTPS, CDN, and SPA routing (404→index.html). |
| Content Gateway (FastAPI) | **Lambda + API Gateway HTTP API v2** | Stateless, read-only; fits Lambda perfectly. Mangum adapter wraps the ASGI app in one line. HTTP API v2 is cheaper and faster than REST API v1. |
| Document Converter worker | **ECS Fargate + SQS** | CPU/memory-intensive, runs for minutes per book — Lambda's 15-min limit is too risky for 500+ page books. Fargate uses the existing Dockerfile unchanged. Scales to zero when queue is empty. |
| `books/` filesystem | **S3 (content bucket)** | `S3StorageBackend` in `storage.py` already implemented. |
| PostgreSQL jobs table | **DynamoDB (single-table)** | All access patterns fit key-value and GSI queries. No idle cost with pay-per-request billing. No connection pooling complexity. |

### Three S3 Buckets

```
readwell-deploy-{acct}-{region}/          # Frontend SPA assets (CloudFront origin)
  web/index.html
  web/assets/index-{hash}.js
  web/assets/index-{hash}.css

readwell-content-{acct}-{region}/         # Converted book packages (CloudFront origin)
  books/{bookId}/metadata.json
  books/{bookId}/manifest.json
  books/{bookId}/chapters.json
  books/{bookId}/pages/page_NNN.json
  books/{bookId}/assets/images/*.webp

readwell-uploads-{acct}-{region}/         # Raw publisher uploads (private, no CDN)
  uploads/{bookId}/{filename}.epub
```

### CloudFront Distribution

One distribution, two origins:

| Origin | Path Pattern | TTL | Notes |
|---|---|---|---|
| `readwell-deploy` | `/` (default) | Short | Custom error: 404/403 → `index.html` 200 (React Router) |
| `readwell-content` | `/books/*` | JSON: 1 hr; Images: 7 days | Brotli/gzip enabled — JSON compresses ~70%, cutting transfer costs |

- S3 access via **OAC (Origin Access Control)**. Both buckets block all public access.
- API calls go directly to API Gateway domain (`VITE_GATEWAY_URL`). CloudFront does not proxy the API.

### Reader Data Flow (Happy Path)

```
Browser ──GET /──────────────────────────► CloudFront ──► S3 deploy (index.html + JS)
Browser ──GET /api/v1/books──────────────► API Gateway HTTP API ──► Lambda (Mangum+FastAPI)
                                                                          │
                                                                          ▼
                                                              S3 content: ListObjects
                                                              + GetObject (metadata.json)
                                                              filter: status=published
Browser ──GET /api/v1/books/{id}/pages/1─► API Gateway ──► Lambda ──► S3 GetObject
Browser ──GET /books/{id}/assets/*.webp──► CloudFront ──► S3 content (direct, 7-day cache)
```

`cdnBaseUrl` in the metadata response points to the CloudFront domain so images bypass Lambda entirely.

### Required Code Changes (Minimal Adapter Layer)

The core pipeline logic is unchanged. Only thin adapter shims are needed:

| File | Change |
|---|---|
| `content_gateway/main.py` | Add `from mangum import Mangum; handler = Mangum(app)` + add `mangum` to `pyproject.toml` |
| `content_gateway/local_store.py` | Add `S3Store` class mirroring `LocalStore`'s interface, using `boto3 s3.get_object()`. Switched via `LOCAL_MODE=false`. |
| `content_gateway/routers/books.py` | `list_books()` must filter to `status=published` books only (currently lists all directories — would expose draft/rejected books to readers) |
| `document_converter/worker.py` | Replace PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` loop with `sqs.receive_message()` loop. Processing logic unchanged. |
| `document_converter/db.py` | Replace SQLAlchemy calls with DynamoDB `UpdateItem` for `claim_job`, `complete_job`, `fail_job`. |
| `document_converter/worker.py` | After successful conversion: `s3.put_object_tagging` on uploads key with `{status: processed}` to trigger Glacier lifecycle rule. |

---

## Part B: Publisher Upload Pipeline

### Roles

| Role | Cognito Group | Capabilities |
|---|---|---|
| Publisher | `publisher` | Upload files or submit URLs; view own book statuses |
| Admin | `admin` | View all books in `review` status; approve or reject |
| Reader | (unauthenticated) | Read all `published` books via public Content Gateway |

### Authentication

**Amazon Cognito User Pool**
- Email + password login (SRP flow).
- Groups: `publisher`, `admin`.
- API Gateway uses a **native Cognito JWT authorizer** — tokens are validated before Lambda is invoked.
- Publisher portal: Cognito Hosted UI or Amplify SDK (protected route within the SPA, or separate app).
- Rate limiting: API Gateway usage plans, 10 RPS per `sub` claim on upload endpoints.

### Publisher Portal API

| Method | Path | Auth | Function |
|---|---|---|---|
| POST | `/publisher/upload/request` | Cognito (publisher) | Generate pre-signed S3 PUT URL for file upload |
| POST | `/publisher/upload/url` | Cognito (publisher) | Submit a URL for ingestion |
| GET | `/publisher/books` | Cognito (publisher) | List own books and statuses |
| GET | `/publisher/books/{bookId}/status` | Cognito (publisher) | Poll job status |
| PATCH | `/publisher/books/{bookId}/review` | Cognito (admin) | Approve or reject a book in `review` |

### Upload Pipeline — File Upload Flow

```
Publisher ──POST /publisher/upload/request { filename, size, metadata }
               │  (Cognito JWT validated by API Gateway before Lambda is called)
               ▼
       Upload Orchestrator Lambda
       ├── Validate: size ≤ 100 MB, extension .epub or .zip
       ├── Generate bookId (UUID)
       ├── DynamoDB PutItem: UPLOAD#{uploadId} { bookId, publisherId, sourceType=file, status=pending }
       ├── DynamoDB PutItem: BOOK#{bookId} { status=uploading, publisherId }
       └── Return { uploadUrl (pre-signed PUT, 15-min expiry, max-content-length condition), bookId }

Publisher ──PUT {uploadUrl} (EPUB bytes uploaded directly to S3 — bypasses Lambda 6MB limit)

S3 ObjectCreated ──► EventBridge ──► EPUB Validator Lambda
    ├── Byte-range GET of first 512 bytes from S3
    ├── Verify ZIP magic bytes: PK\x03\x04 at offset 0
    ├── Verify mimetype entry = "application/epub+zip"
    ├── Check for pending GuardDuty S3 finding on this object
    │
    ├── [INVALID] ──► DynamoDB UpdateItem: UPLOAD status=rejected, reason
    │               ──► S3 DeleteObject
    │               ──► DynamoDB UpdateItem: BOOK status=rejected
    │
    └── [VALID]  ──► DynamoDB UpdateItem: UPLOAD status=validated, BOOK status=queued
                 ──► SQS SendMessage (conversion-jobs queue) { bookId, uploadSourceId, s3Bucket, s3Key }

SQS ──► ECS Fargate Worker (auto-scaled from 0 based on queue ApproximateNumberOfMessagesVisible)
    ├── S3 GetObject (download EPUB to /tmp)
    ├── DocumentConverter.convert()  [existing pipeline — no changes]
    ├── S3 PutObject (books/{bookId}/ package to content bucket)
    ├── DynamoDB UpdateItem: JOB status=done, BOOK status=review
    └── S3 PutObjectTagging: uploads key → { status: processed }
        (lifecycle rule transitions to Glacier Instant Retrieval after 7 days)

Admin ──PATCH /publisher/books/{bookId}/review
    ├── approve ──► DynamoDB UpdateItem: BOOK status=published
    └── reject  ──► DynamoDB UpdateItem: BOOK status=rejected, rejectionReason
```

### Upload Pipeline — URL Ingestion Flow

```
Publisher ──POST /publisher/upload/url { url, metadata }
               ▼
       Upload Orchestrator Lambda
       ├── Parse URL: reject scheme ≠ https
       ├── Blocklist check: localhost, 127.x, 0.0.0.0, 169.254.169.254 (IMDS),
       │   169.254.170.2 (ECS IMDS), *.internal, *.local
       ├── RFC1918 IP check on literal IPs in URL
       ├── DynamoDB PutItem: UPLOAD (sourceType=url), BOOK (status=ingesting)
       ├── Return { bookId, status: ingesting }  (async from here)
       └── SQS SendMessage (url-ingestion queue) { url, bookId, uploadSourceId }

SQS url-ingestion ──► URL Ingester Lambda
    ├── Resolve hostname DNS → re-check resolved IPs against RFC1918 + loopback
    │   (DNS rebinding protection: attacker cannot steer to private IP after initial check)
    ├── HEAD {url} (10s timeout):
    │   ├── status == 200?
    │   ├── Content-Type ∈ [application/epub+zip, application/zip, application/octet-stream]?
    │   └── Content-Length ≤ 50 MB?
    ├── Streaming GET {url}: hard-abort at 50 MB byte limit in download loop
    ├── S3 PutObject → uploads/{bookId}/ingested_{bookId}.epub
    └── [S3 ObjectCreated triggers EPUB Validator Lambda — same path as file upload from here]
```

### DynamoDB Single-Table Design

**Table**: `readwell-main` | PK (String) | SK (String)
**Billing**: PAY_PER_REQUEST | **PITR**: enabled | **Deletion protection**: enabled

#### BOOK entity

```
PK: BOOK#{bookId}    SK: BOOK#{bookId}

Fields:   bookId, title, author, language, license, publisherId, uploadSourceId,
          status (uploading|queued|converting|review|published|rejected|failed),
          createdAt, updatedAt, totalPages, coverS3Key, rejectionReason

GSI1:  PK = PUBLISHER#{publisherId}   SK = BOOK#{createdAt}
       → "list books by publisher, sorted newest first"

GSI2:  PK = STATUS#{status}           SK = BOOK#{createdAt}
       → "admin review queue: all books in 'review' status"
```

#### UPLOAD_SOURCE entity

```
PK: UPLOAD#{uploadSourceId}    SK: UPLOAD#{uploadSourceId}

Fields:   uploadSourceId, bookId, publisherId, sourceType (file|url),
          originalFilename, sourceUrl, s3Bucket, s3Key,
          fileSizeBytes, sha256Checksum, uploadedAt,
          validationStatus (pending|passed|rejected), validationReason

GSI1:  PK = BOOK#{bookId}           SK = UPLOAD#{uploadedAt}
       → "find source document for a given book"  ← traceability

GSI2:  PK = PUBLISHER#{publisherId}  SK = UPLOAD#{uploadedAt}
       → "audit: all uploads by a publisher"
```

#### CONVERSION_JOB entity

```
PK: JOB#{jobId}    SK: JOB#{jobId}

Fields:   jobId, bookId, status (queued|running|done|failed), sqsMessageId,
          workerTaskArn, startedAt, finishedAt, errorMessage, createdAt

GSI1:  PK = BOOK#{bookId}    SK = JOB#{createdAt}
       → "list all conversion attempts for a book"
```

#### PUBLISHER entity

```
PK: PUBLISHER#{cognitoSub}    SK: PUBLISHER#{cognitoSub}

Fields:   cognitoSub, email, displayName, organizationName,
          status (active|suspended), uploadCount, createdAt, updatedAt
```

### S3 Lifecycle Rules — Uploads Bucket

| Rule | Trigger Condition | Action |
|---|---|---|
| Archive processed sources | Object tag `status=processed`, age ≥ 7 days | Transition to **S3 Glacier Instant Retrieval** |
| Abort incomplete multiparts | Incomplete multipart upload, age ≥ 2 days | Abort and delete |
| Delete rejected uploads | Object tag `status=rejected`, age ≥ 1 day | Permanently delete |

**Traceability note**: The `UPLOAD_SOURCE` DynamoDB record stores `s3Bucket` and `s3Key` permanently. Even after a source moves to Glacier, the key is preserved — the source document is always traceable to its publisher and the book it produced.

### Security Summary

| Threat | Control |
|---|---|
| Non-EPUB disguised as .epub | Magic-byte validation: ZIP `PK\x03\x04` + `mimetype=application/epub+zip` |
| Malware in uploaded file | Amazon GuardDuty S3 Protection — findings route via EventBridge to reject the file |
| Oversized upload | Pre-signed URL carries `Content-Length` condition; S3 enforces it server-side |
| SSRF via URL submission | Hostname blocklist + RFC1918 IP check + DNS rebinding protection in URL Ingester Lambda |
| Unauthorized pipeline access | Cognito JWT authorizer on API Gateway; `publisher` group required |
| Publisher accessing others' books | DynamoDB queries scoped to `publisherId` from JWT `sub` claim |
| Raw uploads exposed publicly | Uploads bucket: no public access, no CloudFront origin, no presigned GET URLs |
| Books visible before admin approval | Content Gateway's `list_books()` filters `status=published` only |
| Path traversal / key collision | bookId is a Lambda-generated UUID — publishers cannot control the S3 key |
| Data at rest exposure | KMS CMK encrypts uploads bucket and DynamoDB at rest |

---

## CDK Stack Decomposition

**Location**: `infra/` at project root

```
infra/
  bin/
    readwell.ts                # CDK app entry point; instantiates stacks in order
  lib/
    foundation-stack.ts        # DynamoDB, SQS (2 queues + DLQ), ECR, Cognito, KMS
    storage-stack.ts           # 3 S3 buckets + CloudFront distribution
    api-stack.ts               # 5 Lambda functions + API Gateway HTTP API v2
    worker-stack.ts            # ECS cluster, Fargate task def, service, auto-scaling
    shared/
      constants.ts             # Table name, bucket names, queue names (no magic strings)
      iam-policies.ts          # Reusable least-privilege policy statement factories
  package.json
  tsconfig.json
  cdk.json
```

**Deployment order**: `Foundation` → `Storage` → `Api` + `Worker` (parallel)

### Stack 1: FoundationStack

Long-lived shared resources. Separated to prevent accidental deletion when deploying app code.

| Construct | Details |
|---|---|
| `aws_dynamodb.Table` | `readwell-main`, PAY_PER_REQUEST, PITR on, deletion protection on |
| `aws_sqs.Queue` | `conversion-jobs`, visibility timeout 15 min, DLQ (maxReceiveCount=3) |
| `aws_sqs.Queue` | `url-ingestion`, visibility timeout 5 min, DLQ |
| `aws_ecr.Repository` | `readwell/document-converter` |
| `aws_cognito.UserPool` | Email login, groups: `publisher`, `admin` |
| `aws_cognito.UserPoolClient` | SPA client (no secret, PKCE) |
| `aws_kms.Key` | CMK for uploads bucket + DynamoDB encryption |

### Stack 2: StorageStack

| Construct | Details |
|---|---|
| S3 `readwell-deploy` | Private, OAC; holds frontend SPA |
| S3 `readwell-content` | Private, OAC, S3 Intelligent-Tiering after 30 days; holds book packages |
| S3 `readwell-uploads` | Private, KMS-encrypted, EventBridge notifications on, lifecycle rules (Glacier after 7 days) |
| CloudFront Distribution | 2 origins; brotli compression; custom error (SPA routing); OAC for both S3 origins |

### Stack 3: ApiStack

| Lambda | Trigger | Memory | Timeout | Key IAM |
|---|---|---|---|---|
| `content-gateway` | API Gateway (public) | 512 MB | 30 s | `s3:GetObject + s3:ListBucket` on content bucket |
| `upload-orchestrator` | API Gateway (Cognito auth) | 256 MB | 10 s | `s3:PutObject` (presigned), `dynamodb:PutItem`, `sqs:SendMessage` |
| `epub-validator` | EventBridge (S3 ObjectCreated) | 256 MB | 60 s | `s3:GetObject` (byte-range), `s3:DeleteObject`, `s3:PutObjectTagging`, `dynamodb:UpdateItem`, `sqs:SendMessage` |
| `url-ingester` | SQS url-ingestion | 1024 MB | 300 s | `s3:PutObject` on uploads, `dynamodb:UpdateItem` |
| `publisher-status` | API Gateway (Cognito auth) | 256 MB | 10 s | `dynamodb:GetItem + dynamodb:Query` (PUBLISHER GSI) |

URL Ingester needs 1024 MB and 300 s timeout + 1024 MB ephemeral storage for the streaming 50 MB download.

### Stack 4: WorkerStack

| Construct | Details |
|---|---|
| ECS Cluster | `readwell-cluster`, Fargate-only |
| Fargate Task Definition | 1 vCPU, 2 GB; image from ECR `readwell/document-converter:latest` |
| Fargate Service | `desiredCount=0`, `minHealthyPercent=0`, `maxHealthyPercent=200` |
| Auto-scaling | Scale out when `ApproximateNumberOfMessagesVisible ≥ 1`; scale in 5 min after queue empty |
| Task IAM Role | `s3:GetObject` uploads; `s3:PutObject + s3:PutObjectTagging` content; `dynamodb:GetItem + dynamodb:UpdateItem`; `sqs:ReceiveMessage + sqs:DeleteMessage + sqs:ChangeMessageVisibility` |

---

## Cost Estimate

> **Pricing source**: `awslabs.aws-pricing-mcp-server` (us-east-1, on-demand, queried March 2026)
> **Raw rates**: Lambda $0.20/1M requests + $0.0000166667/GB-s; API GW HTTP API $1.00/1M calls;
> CloudFront $0.085/GB (first 10 TB); Fargate $0.04048/vCPU-hr + $0.004445/GB-hr;
> DynamoDB $0.25/1M RRU + $1.25/1M WRU; S3 $0.023/GB-month

| Service | Scenario A | Scenario B | Key Assumptions |
|---|---|---|---|
| Lambda | **$0.00** | **$3.61** | A: ~600K invocations, 150K GB-s → within free tier. B: 2.4M invocations, 600K GB-s → 200K above free |
| API Gateway HTTP API | **$0.60** | **$2.40** | $1.00/1M calls. A: 600K calls. B: 2.4M calls |
| CloudFront | **$2.55** | **$10.20** | $0.085/GB data transfer. A: 30 GB. B: 120 GB. Brotli cuts this by ~40% for JSON |
| ECS Fargate | **$0.03** | **$0.12** | $0.0246/conversion (1 vCPU, 2 GB, 30 min). A: 1 conv. B: 5 conv |
| DynamoDB | **$0.10** | **$0.50** | On-demand. A: ~400K RRU + 20K WRU. B: ~2M RRU + 80K WRU |
| S3 storage | **$0.12** | **$0.46** | $0.023/GB. A: 5 GB content. B: 20 GB content |
| S3 requests | **$0.01** | **$0.05** | GET $0.0004/10K. Minimal PUTs negligible |
| GuardDuty S3 | **$0.00** | **$0.00** | $0.09/GB; uploads < 1 GB → within free GB |
| Cognito | **$0.00** | **$0.00** | Free up to 50,000 MAU |
| ECR + CloudWatch | **$0.55** | **$1.00** | ECR image storage (~500 MB = $0.05); CloudWatch logs |
| **Total** | **~$4.00/month** | **~$18.34/month** | |

**Scenario A**: 500 DAU, 20 pages/session, 5 publisher uploads/month, 1 book conversion
**Scenario B**: 2,000 DAU, 20 pages/session, 20 uploads/month, 5 book conversions
Free tier (first 12 months) would bring Scenario A to ~$3.20/month.

**Cost levers**:
- Enable CloudFront Brotli compression on JSON → cuts transfer cost by ~40%
- Fargate scales to zero — zero idle compute between conversions
- Lambda free tier absorbs nearly all of Scenario A
- S3 Intelligent-Tiering on content bucket automatically moves cold books to cheaper tiers

---

## Verification

Once CDK stacks are implemented and deployed:

1. **CDK synth**: `cd infra && npx cdk synth` — zero errors, 4 CloudFormation templates emitted.
2. **CDK deploy**: `npx cdk deploy --all` — all stacks green in `us-east-1`.
3. **Reader smoke test**: Open CloudFront URL → library loads → click book → pages/TTS render → image assets load from CloudFront (verify in Network tab: `*.cloudfront.net` origin).
4. **Publisher file upload**: Cognito sign-up (publisher group) → POST `/publisher/upload/request` → upload EPUB via pre-signed URL → poll status → reach `review` → admin PATCH to `published` → book appears in library.
5. **Publisher URL ingestion**: POST `/publisher/upload/url` with valid EPUB URL → status `ingesting` → `queued` → `review` → `published`.
6. **Security tests**:
   - Upload a renamed `.jpg` as `.epub` → expect `status=rejected` (magic byte mismatch)
   - POST URL `http://169.254.169.254/latest/meta-data/` → expect 400 blocked at Lambda before SQS dispatch
   - POST URL `http://internal-service.local/book.epub` → expect 400 blocked at hostname blocklist
7. **Glacier transition** (dev): manually tag upload object `status=processed`, set lifecycle rule to 1-day for test, confirm object transitions and `s3:GetObject` returns from Glacier tier.
8. **Scale-to-zero**: enqueue 3 conversion jobs, observe Fargate tasks spin up, drain queue, wait 5 min, observe tasks scale back to 0.
9. **Traceability audit**: given a `bookId`, query DynamoDB → `BOOK#{bookId}` record shows `uploadSourceId`; query `UPLOAD#{uploadSourceId}` → shows `publisherId`, `s3Key`, `sha256Checksum`.
