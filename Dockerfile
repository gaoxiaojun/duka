FROM node:14

WORKDIR /src/duka

COPY package*.json /src

RUN cd src && npm install --only=production

COPY . .

CMD [ "npm", "start" ]
 