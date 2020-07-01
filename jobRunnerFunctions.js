const {Jobs, JobsHistory} = require("./metadataDb")
const cron = require('node-cron');
uuidv4 = require("uuid").v4
var cronJobs = []
var scheduledJobs = []
var {executeFile} = require("./fileManagerFunctions")

function commandExecuter(command) {
  let cmd = command.trim().replace("  ", " ").split(" ")
  if(cmd[0] === "exec" && cmd[1] && cmd[2]) {
    return executeFile(cmd[1], cmd[2])
  }
  else(console.log(`command ${command} can't be executed`))
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
    let result = commandExecuter(jobHist.command)
    jobHist.result = JSON.stringify(result)
    jobHist.end_dt = new Date 
    jobHist.status = "finish"
    jobHist.save()
  })

}

async function initAllJobs() {
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

async function jobUnschedule(jobid) {
  let job = cronJobs.find(cj => cj.jobid == jobid)
  if(job) {
    job.job.stop()
    cronJobs.splice(cronJobs[job],1)
    let jobDesc = await Jobs.findOne({where: {jobid}})
    jobDesc.status = "unscheduled"
    await jobDesc.save()

  }
}

async function jobSchedule(jobid) {
  let jobDesc = await Jobs.findOne({where: {jobid}})
  let crJob = cronJobs.find(cj => cj.jobid == jobid)
  if(jobDesc.status === "unscheduled" && !crJob) {
    let job =  cron.schedule(jobDesc.pattern, () => execHistoriser(jobDesc.jobid, jobDesc.command) )
    cronJobs.push({jobid : jobDesc.jobid, job})
    jobDesc.status = job.status
    await jobDesc.save()
  }
}

initAllJobs()

module.exports = {
  jobUnschedule,
  jobSchedule,
}

