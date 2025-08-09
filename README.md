# Southern Walk HOA – Dissolution Campaign

This repo holds the data and specs for a lightweight volunteer coordination app
(tracking homeowners, primary/secondary owners, renters, canvassing routes, and voting status).

This application is to be created for and deployed in [AWS Amplify](https://aws.amazon.com/amplify/). 

## Requirements
- `docs/` – provides a set of files describing the documentation for the application requirements

## How changes happen
I collaborate with an AI assistant that proposes changes as PR-ready patches.  
See **Contributing** for how to apply patches.

## Contributing (patch workflow)
1. Save a patch file (e.g. `update-requirements.patch`) to your repo root.
2. Apply it:
   ```bash
   git checkout -b ai/update-requirements
   git apply --whitespace=fix update-requirements.patch
   git commit -am "Apply AI-proposed updates"
   git push -u origin ai/update-requirements
   gh pr create -f   # or open a PR on GitHub UI
