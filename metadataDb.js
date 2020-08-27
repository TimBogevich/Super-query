const Sequelize = require('sequelize');
require('sequelize-hierarchy')(Sequelize);
uuidv4 = require("uuid").v4

var deasync = require('deasync');
const { text } = require('body-parser');


const sequelize = new Sequelize(
  'postgres://postgres:a6HdM3a1gkehjzMi@35.234.66.49:5432/superbase',
  {
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000
    }
  }
)

const Connections = sequelize.define('connections', {
  connectionid : { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
  name : Sequelize.STRING,
  connectionString : Sequelize.STRING,
  user : Sequelize.STRING,
  password : Sequelize.STRING,
  status : Sequelize.STRING,
  lastConnectDate : Sequelize.DATE,
  disconnectedManually : Sequelize.STRING,
  connection : Sequelize.BLOB,
})

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
      name : "Text job 1",
      pattern : "* * * * *",
      createdt : new Date,
      command : "exec pg_run.sql Postgres",
      descr : "just test job",
      status : "unscheduled",
      folderId : 1,
    },
    {
      name : "Text job 2",
      pattern : "* * * * *",
      createdt : new Date,
      command : "exec pg_run.sql Postgres",
      descr : "just test job",
      status : "unscheduled",
      folderId : 1,
    },
  ])
  Connections.bulkCreate([
    {
      name: "MySQL",
      connectionString: "jdbc:mysql://@193.148.161.117",
      user: "root",
      password: "s6jD]D123bv6pO7"
  },
  {
      connectionString: "jdbc:sqlserver://193.148.161.117:1433",
      user: "sa",
      password: "A%sfvf343?!",
      name: "MS SQL"
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
  Connections,
  Sequelize
}

