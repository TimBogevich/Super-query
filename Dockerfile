FROM node:13.13.0

WORKDIR /usr/src/app

RUN git clone https://github.com/TimBogevich/Super-query.git

RUN CD Super-query

RUN apt update
RUN apt install openjdk-8-jdk
RUN npm i

EXPOSE 4000
CMD [ "node", "index.js" ]