
FROM ubuntu:18.04

RUN apt-get -y update
RUN apt-get -y install openjdk-11-jdk curl git build-essential apt-utils make

RUN curl -sL https://deb.nodesource.com/setup_13.x | bash -
RUN apt-get install -y nodejs

WORKDIR /usr/src/app

RUN git clone https://github.com/TimBogevich/Super-query.git

WORKDIR Super-query


RUN npm i
COPY connections.cfg .

EXPOSE 4000 8000
CMD [ "node", "index.js" ]