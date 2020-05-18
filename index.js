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


function checkConnections() {
    for (key in connections) {
        let conn = connections[key]
        if(!conn.isValidSync(5)) {
            console.log(`Found wrong connection ${key}`)
            try {
                let config = JSON.parse(fs.readFileSync('connections.cfg'));
                let connElement = config.filter(item => item.name == key)[0]
                connections[key] = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",connElement.connectionString, connElement.user, connElement.password)
                console.log(`Connection ${key} was restored`)
            } catch (error) {
                console.log(`Couldn't restore connection ${key}. ${error}`)
            }

        }
    }  
}


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
    queries = query.split(";")
    connection = connections[connection]
    return queries.map(item => {
        selectStmt = connection.createStatementSync();
        if(item.trim().substring(0,6).toLowerCase() == "select") {
            if(limit > 0) {
                selectStmt.setMaxRowsSync(limit)
                selectStmt.setFetchSizeSync(limit)
            }
            resultSet = selectStmt.executeQuerySync(item);
            return rsToJson(resultSet)
        }
        else if(item.trim() == "") {
            return
        }
        else{
            try {
                resultSet = selectStmt.executeSync(item);
                return [{"Query":item,"Result": "SUCCESS"}]
            }
            catch(error) {
                return [{"Query":item,"Result": error.cause.getMessageSync()}]
            }
        }
    })
}

app.use( bodyParser.json() ); 
app.use(cors());
app.use(express.json());


app.post('/sql', (req, res) => {
    setTimeout(() => {}, 1000); // to emulate Delay
    try {
        result = execQuery(req.body.database, req.body.query, parseInt(req.body.limit))
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


app.post("/runFile", (req, res)  => {
    try {
        let file = fs.readFileSync(`./store/${req.body.filename}`, "utf8")
        let output = execQuery(req.body.database, file, 0)
        let result = {
            file,
            result : output
        }
        res.send(result)
    } catch (error) {
        res.send(error)
    }
})

app.post("/getFiles", (req, res)  => {
    try {
        let dir = fs.readdirSync("./store", "utf8")
        res.send(dir)
    } catch (error) {
        res.send(error)
    }
})

app.post("/saveFile", (req, res)  => {
    try {
        let path = "./store/" + req.body.filename
        let dir = fs.writeFileSync(path, req.body.data, "utf8")
        res.sendStatus(200)
    } catch (error) {
        res.send(error)
    }
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))

setInterval(checkConnections, 5000)