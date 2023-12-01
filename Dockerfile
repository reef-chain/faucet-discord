FROM node:18 as builder
RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y node-gyp

WORKDIR /usr/faucet

COPY package.json yarn.lock ./
RUN yarn install
COPY . ./

RUN yarn build-prod

ENTRYPOINT ["yarn", "start"]