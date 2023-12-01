FROM node:18 as builder

RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y node-gyp

WORKDIR /usr/faucet

COPY package.json yarn.lock ./

RUN yarn install

COPY . ./

ENV MNEMONIC="REPLACE_MNEMONIC"
ENV DISCORD_TOKEN="REPLACE_DISCORD_TOKEN"
ENV DISCORD_CLIENT_ID="REPLACE_DISCORD_CLIENT_ID"

RUN yarn build-prod
RUN chmod +x /usr/faucet/entrypoint.sh
ENTRYPOINT ["/usr/faucet/entrypoint.sh"]
