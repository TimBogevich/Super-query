var {jobUnschedule, jobSchedule, jobRun} = require("./jobRunnerFunctions")
const {Jobs, JobsHistory, JobsFolders} = require("./metadataDb")

module.exports = function(app){

  app.get('/jobs',async (req, res) => {
    res.send(await Jobs.findAll({
      include : {
        model: JobsHistory,
        order : [['start_dt', 'DESC']] ,
        limit : 50,
      }
    }))
  })

  app.get('/jobfolders',async (req, res) => {
    res.send(await JobsFolders.findAll({
      include : {
        model: Jobs,
        include : {
          model: JobsHistory,
          order : [['start_dt', 'DESC']] ,
          limit : 50,
        }
      }
    }))
  })

  app.get('/jobs/history', async (req, res) => {
    res.send( await JobsHistory.findAll({
      limit: 20,
      order : [['start_dt', 'DESC']] ,
      include : Jobs,
    }))
  })


  app.post('/jobs/:jobid', async (req, res) => {
    let operation = req.body.operation
    if(operation === "schedule") {
      await jobSchedule(req.params.jobid)
    }
    else if(operation === "unschedule") {
      await jobUnschedule(req.params.jobid)
    }
    else if(operation === "run") {
      await jobRun(req.params.jobid)
    }
    res.send(await Jobs.findAll())
  })    
}