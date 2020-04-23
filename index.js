var JDBC = require('jdbc');
var java = require('java');
const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express()
const port = 4000
java.options.push("-Xrs")
java.classpath.pushDir("./drivers")
var cors = require('cors')


connections = {}
let config = JSON.parse(fs.readFileSync('connections.cfg'));
config.forEach(element => {
    let connection = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",element.connectionString)
    connections[element.name] = connection
});




function execQuery(connection, query) {
    selectStmt = connection.createStatementSync();
    resultSet = selectStmt.executeQuerySync(query);
    
    var js = []
    var total_columns = resultSet.getMetaDataSync().getColumnCountSync();
    
    while (resultSet.nextSync()) {
        var row = {}
        for (i = 1; i <= total_columns; i++) {
            key = resultSet.getMetaDataSync().getColumnLabelSync(i)
            value = resultSet.getStringSync(i)
            row[key] = value
        }
        js.push(row)
    }
    return js
}

app.use( bodyParser.json() ); 
app.use(cors());
app.use(express.json());


app.post('/', (req, res) => {
    let connection = connections[req.body.database]
    if(req.body.query.substring(0,6).toLowerCase() == "select") {
        result = execQuery(connection, req.body.query)
        res.send(result)
    }
    else{
        res.send("Query starts from SELECT!")
    }
})


app.get('/', (req, res) => {
    res.send('Use POST request. Query example {"query" : "select 1" }')
})

app.get('/connections', (req, res) => {
    res.send('Use POST request. Query example {"query" : "select 1" }')
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))