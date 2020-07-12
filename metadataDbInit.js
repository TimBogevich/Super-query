
const {sequelize, Jobs, JobsTree} = require("./metadataDb")
var deasync = require('deasync');

const seqsync = sequelize.sync({force : true}).then(() => {
  Jobs.bulkCreate([
    {
      jobid : 1,
      jobname : "Text job 1",
      pattern : "* * * * *",
      createdt : new Date,
      command : "test",
      descr : "just test job",
      status : "N/A",
    },
    {
      jobid : 2,
      jobname : "Text job 2",
      pattern : "* * * * *",
      createdt : new Date,
      command : "exec test.txt MySQL",
      descr : "just test job",
      status : "unscheduled",
    },
  ])
})


deasync.loopWhile(() => {
  return !seqsync.isFulfilled()
})

