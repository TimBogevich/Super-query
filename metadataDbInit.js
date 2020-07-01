const Sequelize = require('sequelize');
var deasync = require('deasync');


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
  jobname : Sequelize.STRING,
  pattern : Sequelize.STRING,
  createdt : Sequelize.DATE,
  command : Sequelize.STRING,
  descr : Sequelize.STRING,
  status : Sequelize.STRING,
});

const JobsTree = sequelize.define('jobs', {
  treeId: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
  def : {type: Sequelize.HSTORE},
});



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

Jobs.hasMany(JobsHistory, { foreignKey: 'jobid' })
JobsHistory.belongsTo(Jobs, { foreignKey: 'jobid' })

const seqsync = sequelize.sync({force : true}).then(() => {
  Jobs.bulkCreate([
    {
      jobid : 1,
      jobname : "Text job 1",
      pattern : "* * * * * *",
      createdt : new Date,
      command : "test",
      descr : "just test job",
      status : "N/A",
    },
    {
      jobid : 2,
      jobname : "Text job 2",
      pattern : "* * * * * *",
      createdt : new Date,
      command : "exec test.txt MySQL",
      descr : "just test job",
      status : "N/A",
    },
  ])
})


deasync.loopWhile(() => {
  return !seqsync.isFulfilled()
})

module.exports = {
  Jobs,
  JobsHistory,
}

