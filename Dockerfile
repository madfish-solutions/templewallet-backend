FROM node:20
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn
COPY . .
RUN yarn run build
EXPOSE 3000
CMD [ "node", "dist/index.js" ]
