### 📅 Day 4: Full-Stack Local Emulation Alignment & BYO AI Cross-Region Federation Day

#### 🛠️ What I Did Today

1. **Bypassed SWA Control Plane Regional Restrictions**: Intercepted a `LocationNotAvailableForResourceType` failure
   caused by the total absence of Azure Static Web Apps management infrastructure in `japaneast`. Decoupled the
   architecture by routing SWA metadata exclusively to `eastasia` (Hong Kong) while anchoring the serverless core and
   storage backbones within `japaneast`. Bonded them via Cross-Region Linked Backends over the Azure global network mesh
   to secure a friction-free edge gateway.
2. **Stripped Quota Deadlocks via BYO AI Integration**: Resolved a subscription-wide instance limit and a soft-delete
   deadlock (`FlagMustBeSetForRestore`). Stripped all OpenAI resource blocks from the Bicep template to shift the
   paradigm into a BYO (Bring Your Own) federation model, dynamically routing outbound traffic to the pre-existing
   `0387621-2410-resource` engine without risking active agent assets.
3. **Enforced Zero-Secret Runtime Configuration**: Eradicated all plain-text keys and custom endpoints from Bicep
   manifests to eliminate Git credential leaks. Engineered an automated credential-harvesting sequence in
   `./infra-up.sh` that extracts tokens directly into local memory, instantly injecting them into the cloud Function App
   Settings via Azure CLI for absolute zero-trust compliance.
4. **Remediated NameError and Storage Firewall Blocks**: Fixed an immediate 37ms runtime crash by injecting missing `os`
   and `requests` dependencies into the `function_app.py` kernel. Remedied a persistent `AuthorizationFailure` 500 error
   by forcing public network access to `Enabled`, allowing the local machine (`func start`) to successfully latch onto
   the cloud `AzureWebJobsStorage` connection string.
5. **Aligned Target Model Deployment Identifiers**: Overcame a 404 `DeploymentNotFound` preflight mismatch by
   parameterizing the target model identifier. Upgraded the Python chat router to capture `AZURE_OPENAI_DEPLOYMENT_NAME`
   dynamically, falling back to the real-world `gpt-4o` target to completely unblock the full-stack local emulation
   pipeline.

#### 🎯 Why I Did It (Architectural Trade-offs & Reflections)

* **Cross-Region Decoupling Over Homogeneous Clustering**: When deploying global edge solutions like SWA, forcing a
  single-region footprint is a rookie mistake. Accepting the control-plane data latency between Hong Kong and Japan is a
  micro-price to pay for massive OpenAI quota availability. By linking the cross-region backend over the Microsoft
  private backbone, the front-end remains blazing fast while the data tier leverages Japan East's deep compute pools.