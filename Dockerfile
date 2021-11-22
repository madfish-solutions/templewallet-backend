FROM node:14
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn
COPY . .
RUN yarn run build
EXPOSE 3031
CMD [ "node", "dist/index.js" ]
