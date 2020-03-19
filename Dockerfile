FROM node:12

WORKDIR /usr/src/lifescope-location-estimator

COPY package.json ./

RUN npm install

COPY . .

CMD ["node", "--experimental-modules", "server.js"]