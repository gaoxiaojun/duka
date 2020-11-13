FROM node:14

WORKDIR /usr/src/duka

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "npm", "start" ]
 
