#!/bin/bash

echo "Triggered on $(date)" > src/client-edge/trigger.txt
git add src/client-edge/trigger.txt
git commit -m "ci(gate): force re-trigger standalone swa workflow $(date)"
git push origin main