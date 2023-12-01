# Reef chain Faucet with Discord Bot and Node.js

## Run Docker
Build Docker Image
`
docker build -t faucet .
`

Run docker image [pass run time env]
`
docker run --env DISCORD_TOKEN=<YOUR_DISCORD_TOKEN> --env DISCORD_CLIENT_ID=<YOUR_DISCORD_CLIENT_ID> --env MNEMONIC=<YOUR_MNEMONIC> faucet
`
make sure to replace <VARS> 