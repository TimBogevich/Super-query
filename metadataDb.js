const Sequelize = require('sequelize');
require('sequelize-hierarchy')(Sequelize);
uuidv4 = require("uuid").v4

var deasync = require('deasync');
const { text } = require('body-parser');


const sequelize = new Sequelize(
  'postgres://a9s50a6be6d67c73303d0064279911a9ab9220fce1e:a9sc4217dba55465098c455dd4603a6c643ffdb329a@193.148.161.187:49251/pgd459eee',
  {
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000
    }
  }
)


const Jobs = sequelize.define('jobs', {
  jobid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
  name : Sequelize.STRING,
  pattern : Sequelize.STRING,
  createdt : Sequelize.DATE,
  command : Sequelize.STRING,
  descr : Sequelize.STRING,
  status : Sequelize.STRING,
  folderId : Sequelize.INTEGER,
  uid: {
    type: new Sequelize.VIRTUAL,
    get: () => uuidv4()
  }
});

const JobsFolders = sequelize.define('jobsfolders', {
  folderId : { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
  name : Sequelize.STRING,
  uid: {
    type: new Sequelize.VIRTUAL,
    get: () => uuidv4()
  }
});
JobsFolders.isHierarchy()

const JobsHistory = sequelize.define('jobshistory', {
    jobid: Sequelize.INTEGER,
    runid : { type: Sequelize.STRING, primaryKey: true},
    result : Sequelize.TEXT,
    command : Sequelize.TEXT,
    start_dt : Sequelize.DATE,
    end_dt : Sequelize.DATE,
    status : Sequelize.STRING,
},
{  
  indexes : [
    {fields : ["jobid"]},
    {fields : ["start_dt"]}
  ]
}
);
JobsFolders.hasMany(Jobs, {foreignKey: 'folderId' })
Jobs.belongsTo(JobsFolders, { foreignKey: 'folderId' })

Jobs.hasMany(JobsHistory, { foreignKey: 'jobid' })
JobsHistory.belongsTo(Jobs, { foreignKey: 'jobid' })

const seqsync = sequelize.sync({force : true})
.then(async () => {
  await JobsFolders.bulkCreate([
    {
      folderId : 1,
      name : "test"
    }
  ])
  Jobs.bulkCreate([
    {
      jobid : 1,
      name : "Text job 1",
      pattern : "* * * * *",
      createdt : new Date,
      command : "exec pg_run.sql Postgres",
      descr : "just test job",
      status : "unscheduled",
      folderId : 1,
    },
    {
      jobid : 2,
      name : "Text job 2",
      pattern : "* * * * *",
      createdt : new Date,
      command : "exec pg_run.sql Postgres",
      descr : "just test job",
      status : "unscheduled",
      folderId : 1,
    },
  ])
})


deasync.loopWhile(() => {
  return !seqsync.isFulfilled()
})

module.exports = {
  Jobs,
  JobsHistory,
  sequelize,
  JobsFolders,
}

