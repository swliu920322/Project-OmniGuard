# 📑 Project-OmniGuard: Cloud AI Architect Growth Journal

---

### 📅 Day 3: Serverless Compute Convergence & Quota Aggression Day

#### 🛠️ What I Did Today

1. **Crushed Subscription-Wide Quota Deadlocks**: Encountered a severe platform block in the Southeast Asia region (
   `SubscriptionIsOverQuotaForSku`). Executed an immediate tactical down-scale to the `Standard/S1` dedicated plan,
   leveraging available core allocations to bypass the subscription restriction without blocking the pipeline.
2. **Forged Regional Virtual Network Outbound Integration**: Injected the serverless compute brain directly into the
   Spoke VNet's `BackendSubnet` using the mutated `Standard/S1` hosting plan. This physically preserved the outbound
   network integration capability, forcing all application egress traffic to be captured by the private backbone
   network.
3. **Remediated Global Namespace Collisions**: Intercepted an `AccountNameInvalid` error during preflight compilation.
   Truncated the component prefix from `funcstor` to the industrial-neutral abbreviation `st`, locking the total
   namespace length at 19 characters to clear the rigid 24-character global domain limit.
4. **Upgraded the Token-Based Credentialless Control Chain**: Explicitly activated the System-Assigned Managed Identity
   for the compute node in the Bicep template. Migrated the application connection string stringently to the
   zero-credential pattern via `AzureWebJobsStorage__accountName` to align with MAS TRM compliance standards.

#### 🎯 Why I Did It (Architectural Trade-offs & Reflections)

* **Tactical Downscaling Against Platform Resource Locks**: In tight sprint constraints, waiting for cloud vendor
  support tickets to clear VM quotas is operational suicide. Pivoting to the `Standard/S1` dedicated plan is not a
  compromise on security; on the network plane, the Standard tier preserves 100% of the Regional VNet Outbound
  Integration capabilities. The private data path required by zero-trust architecture remains fully intact, while the
  development pipeline is instantly unblocked.