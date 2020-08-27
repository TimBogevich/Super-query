var {jobRun, jobEdit, jobCreate} = require("./jobRunnerFunctions")
const {Jobs, JobsHistory, JobsFolders} = require("./metadataDb")
const { concat } = require("pouchdb-adapter-cordova-sqlite")

module.exports = function(app){

  app.get('/jobs',async (req, res) => {
    res.send(await Jobs.findAll({
      order : [['jobid']],
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


  app.post('/jobs/run/:jobid', async (req, res) => {
    let operation = req.body.operation
    if(operation === "run") {
      await jobRun(req.params.jobid)
    }
    res.send(await Jobs.findAll())
  })    


  app.post('/jobs/edit', async (req, res) => {
     res.send(await jobEdit(req.body.job))
  })

  app.post('/jobs/create', async (req, res) => {
     res.send(await jobCreate(req.body.job))
  })



}