
FROM node:13.13.0

WORKDIR /usr/src/app

RUN git clone https://github.com/TimBogevich/Super-query.git

WORKDIR Super-query

RUN apt-get -y update
RUN apt-get -y install openjdk-8-jdk
RUN npm i
COPY connections.cfg .

EXPOSE 4000
CMD [ "node", "index.js" ]