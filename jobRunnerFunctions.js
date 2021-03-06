const {Jobs, JobsHistory} = require("./metadataDb")
const cron = require('node-cron');
uuidv4 = require("uuid").v4
var {executeFile} = require("./fileManagerFunctions")
const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const wsPort = 8000
var runningJobs = new Set()
var cronJobs = []

 
const server = http.createServer();
const wsRunningJobs = new WebSocket.Server({ noServer: true }); // /jobs/runningJobs
const wsJobHistory = new WebSocket.Server({ noServer: true }); // /jobs/jobHistory
 
server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;
 
  if (pathname === '/jobs/runningJobs') {
    wsRunningJobs.handleUpgrade(request, socket, head, function done(ws) {
      wsRunningJobs.emit('connection', ws, request);
    });
  } else if (pathname === '/jobs/jobHistory') {
    wsJobHistory.handleUpgrade(request, socket, head, function done(ws) {
      wsJobHistory.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
 
server.listen(wsPort);



function commandExecuter(command) {
  let cmd = command.trim().replace("  ", " ").split(" ")
  if(cmd[0] === "exec" && cmd[1] && cmd[2]) {
    return executeFile(cmd[1], cmd[2])
  }
  else(console.log(`command ${command} can't be executed`))
}

async function jobRun(jobid) {
  let job = await Jobs.findByPk(jobid)
  execHistoriser(job.jobid, job.command) 
}

function execHistoriser(jobid, command) {
  const jobHist = JobsHistory.create({
    jobid,
    runid : uuidv4(),
    command,
    start_dt : new Date(),
    end_dt : null,
    status : "run",
  })
  jobHist.then((jobHist) => {
    runningJobs.add(jobid)
    wsRunningJobs.clients.forEach( client => {client.send(JSON.stringify([...runningJobs]))} );
    wsJobHistory.clients.forEach( client => client.send(JSON.stringify(jobHist)) );
    let result = commandExecuter(jobHist.command)
    jobHist.result = JSON.stringify(result)
    jobHist.end_dt = new Date 
    jobHist.status = "finish"
    jobHist.save()
    runningJobs.delete(jobid)
    wsRunningJobs.clients.forEach( client => client.send(JSON.stringify([...runningJobs])) );
    wsJobHistory.clients.forEach( client => client.send(JSON.stringify(jobHist)) );
  })
}

async function initAllJobs() {
  cronJobs.forEach(j => j.job.destroy())
  cronJobs = []
  const allJobs = await Jobs.findAll()
  allJobs.forEach(jobDesc => {
    if(jobDesc.status !== "unscheduled") {
      let job =  cron.schedule(jobDesc.pattern, () => execHistoriser(jobDesc.jobid, jobDesc.command) )
      cronJobs.push({jobid : jobDesc.jobid, job})
      jobDesc.status = job.status
      jobDesc.save()
    }
  })
}


async function jobEdit(jobEdited) {
  let jobEditedInst = await Jobs.build(jobEdited)
  jobEditedInst.isNewRecord = false
  const save = await jobEditedInst.save()
  await initAllJobs()
  return save
}

async function jobCreate(jobCreated) {
  const job = Jobs.create(jobCreated)
  initAllJobs()
  return job
}

initAllJobs()

module.exports = {
  jobRun,
  jobEdit,
  jobCreate,
}

