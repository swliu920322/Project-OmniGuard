# 📑 Project-OmniGuard: Cloud AI Architect Growth Journal

### 📅 Day 2: Governance & Micro-Segmentation Day

#### 🛠️ What I Did Today

1. **Subscription-Level Architecture Escalation**: Scaled up the architectural hierarchy by declaring
   `targetScope = 'subscription'` at the root of `main.bicep`. This fully automates the instantiation, standard tagging,
   and lifecycle management of the `omni-guard-rg` resource group within the IaC pipeline.
2. **Decoupled Security Control Plane**: Rejected hardcoded firewall policies within the cloud templates. Isolated all
   fine-grained network access controls into an external file `.azure/network-rules.json`, dynamically loading and
   parsing the security matrix at runtime using the high-leverage `json(loadTextContent())` function.
3. **Subnet Micro-Segmentation Matrix**: Hand-coded zero-trust Network Security Groups (NSGs). Configured
   `omni-backend-nsg` to entirely drop all inbound public traffic from the Internet, and engineered `omni-storage-nsg`
   with rigid rules—physically accepting inbound traffic *exclusively* from the Backend subnet (`10.1.1.0/24`) over port
   443, dropping any out-of-boundary packet instantly.
4. **Hierarchical Component Decoupling via Nested Modules**: Architected a modular component pattern by splitting the
   infrastructure layer. Designed `.azure/nested-infra.bicep` to act as a localized module, utilizing Bicep's `module`
   syntax to scope down execution context inside the target resource group, maintaining clear separation of concerns and
   prop passing.

#### 🎯 Why I Did It This Way (Architectural Trade-offs & Reflections)

* **Orchestrator and Sub-module Synchronization (Scope Conflict Battle)**: During implementation, I hit a hard platform
  constraint where subscription-level templates are legally prohibited from declaring resource-group-level subnet
  specifics directly. Leveraging my 10 years of complex frontend architecture experience, I applied component-driven
  design (similar to separating global routers from local views) by splitting the code into `main` (the supervisor) and
  `nested` (the tactical executor), passing data smoothly while breaking the platform limits.
* **Configuration-Driven High-Leverage Governance**: Embedding rigid IP or port blocks directly inside IaC templates
  creates monolithic script bloat. Extruding the firewall matrix into a decoupled JSON configuration aligns with
  enterprise elite standards: future security auditors or Chief Security Officers (CSOs) can iterate policies
  independently within the pure JSON matrix without modifying a single line of core infrastructure code.
* **Physical Activation Mechanics of Cloud Networks**: During validation, I discovered that Azure's distributed fabric
  hides the "Effective Routes" panel if a subnet does not host any active Network Interfaces (NICs). Instead of spinning
  up expensive VMs and bleeding credits to force UI updates, I utilized advanced SA CLI auditing (`az network nsg show`)
  to bypass the web interface and query the raw security payload directly. This achieved 100% architectural assurance at
  exactly zero financial cost.
