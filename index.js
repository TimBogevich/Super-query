var JDBC = require('jdbc');
var java = require('java');
const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express()
const port = 4000
const apicache = require('apicache')
java.options.push("-Xrs")
java.classpath.pushDir("./drivers")
var cors = require('cors')

let cache = apicache.middleware


connections = {}
let config = JSON.parse(fs.readFileSync('connections.cfg'));
config.forEach(element => {
    let connection = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",element.connectionString, element.user, element.password)
    connections[element.name] = connection
});


function rsToJson(resultSet) {
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

function execQuery(connection, query, limit) {
    selectStmt = connection.createStatementSync();
    if(query.trim().substring(0,6).toLowerCase() == "select") {
        selectStmt.setMaxRowsSync(limit)
        selectStmt.setFetchSizeSync(limit)
        resultSet = selectStmt.executeQuerySync(query);
        return rsToJson(resultSet)
    }   
    else{
        resultSet = selectStmt.executeSync(query);
        return [{"Query":query,"Result": "SUCCESS"}]
    }
}

app.use( bodyParser.json() ); 
app.use(cors());
app.use(express.json());


app.post('/sql', (req, res) => {
    setTimeout(() => {}, 1000); // to emulate Delay
    try {
        let connection = connections[req.body.database]
        let statements = req.body.query.split(";") 
        let result
        statements.forEach(statement =>{
            result = execQuery(connection, req.body.query, parseInt(req.body.limit))
        })
        res.send(result)
    } catch (error) {
        res.status(400)
        res.send(error.message)
    }
})



app.post('/metadata', cache('20 minutes'), (req, res) => {
    let connection = connections[req.body.database]
    dbMeta = connection.getMetaDataSync()

    catalog = null
    schemaPattern = null,
    tableNamePattern = null;
    columnNamePattern = null;
    types = null
    rsTables = dbMeta.getTablesSync(catalog, schemaPattern, tableNamePattern, types);

    var database = []
    while (rsTables.nextSync()) {
        objectName = rsTables.getStringSync(3);
        objectSchema = rsTables.getStringSync(1),
        rsColumns = dbMeta.getColumnsSync(catalog, schemaPattern, objectName, columnNamePattern);
        columns = []
        while (rsColumns.nextSync()) {
            column = {}
            column.columnName = rsColumns.getStringSync("COLUMN_NAME");
            column.columnType = rsColumns.getStringSync("TYPE_NAME");
            column.columnSize = rsColumns.getIntSync("COLUMN_SIZE");
            columns.push(column)
        }
        table = {
            objectType : rsTables.getStringSync(4),
            objectName : objectName,
            columns : columns
        }
        var schema = database.filter(item => item.objectName === objectSchema)[0]
        if (schema) {
            schema.children.push(table)
        }
        else {
            database.push({
                objectName: objectSchema,
                objectType : "Database",
                children : [table]
            })
        }

    }
    
    res.send(database)
})

app.get('/', (req, res) => {
    res.send('Use POST request. Query example {"query" : "select 1" }')
})

app.get('/connections', (req, res) => {
    let conn = Object.keys(connections)
    res.send(conn)
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))