# Reference infrastructure (frozen snapshot)

`main.bicep`, `nested-infra.bicep`, `compute-module.bicep` and `network-rules.json` define the Azure topology used by the OmniGuard thesis: hub-spoke VNet, private endpoints, managed identities, Key Vault, Cosmos DB, IoT Hub and Container Apps.

They are a snapshot of the `secure-iot` preset from the separate **Bicep Studio** project, which generates and validates these files. They are not regenerated here; edit them directly if the reference topology must change.

Deployment inputs:

```bash
cp .azure/main.parameters.example.json .azure/main.parameters.json   # git-ignored; fill in values
make whatif      # preview
make provision   # creates billable Azure resources
make destroy     # tears them down
```

Notes:
- The LLM parameters still describe Azure OpenAI (`openAiKey`, `openAiEndpoint`, `openAiDeploymentName`). The application itself also supports DeepSeek/OpenAI-compatible providers via `LLM_PROVIDER`; adapting the template for that is not done.
- The infrastructure was deployed once for the thesis and has since been torn down. Nothing in this repository proves a live environment exists.
