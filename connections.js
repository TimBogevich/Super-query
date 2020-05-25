var JDBC = require('jdbc');
var java = require('java');
const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs');
java.options.push("-Xrs")
java.classpath.pushDir("./drivers")
uuidv4 = require("uuid").v4


var connections = []
var config = JSON.parse(fs.readFileSync('connections.cfg'));
var results = {}

config.forEach(element => {
    conn = connect(element.connectionString, element.user, element.password)
    conn.name = element.name
    connections.push(conn) 
});

function connect(connectionString,user,password) {
    let connection = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",connectionString, user, password)
    conn = {
        connectionString : connectionString,
        connection : connection,
        status : "OK",
        lastConnectDate : new Date(),
        disconnectedManually : false,
    }
    return conn
}

function getConnection(connName) {
    return  connections.filter(item => item.name == connName)[0]
    
}

function reconnect(connName) {
    let conn = config.filter(item => item.name == connName ) [0]
    connection = connect(conn.connectionString, conn.user, conn.password)
    connections = connections.map(item => {
        if (item.name == connName) {
            item = connection
            item.name = connName
        }
        return item
    })
    return connections
}

function disconnect(connName) {
    connections = connections.map(item => {
        if (item.name == connName) {
            item.connection = null
            item.status = "DISCONNECTED"
            item.disconnectedManually = true
        }
        return item
    })
    return connections
}

function checkConnections() {
    for (key in connections) {
        let disconnectedManually = connections[key].disconnectedManually
        if (disconnectedManually) {
            continue
        }
        let conn = connections[key].connection
        let connName = connections[key].name
        if(!conn.isValidSync(5)) {
            console.log(`Found wrong connection ${key}`)
            try {
                let config = JSON.parse(fs.readFileSync('connections.cfg'));
                let connElement = config.filter(item => item.name == connName)[0]
                connections[key].connection = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",connElement.connectionString, connElement.user, connElement.password)
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

function testConnection(connConfig) {
    connection = connect(connConfig.connectionString, connConfig.user, connConfig.password)
    return connection
}

function createConnection(connConfig) {
    connection = connect(connConfig.connectionString, connConfig.user, connConfig.password)
    connection.name = connConfig.name
    config.push(connConfig)
    fs.writeFileSync("./connections.cfg", JSON.stringify(config, null, 4) )
    connections.push(connection)
    return connections
}

function execQuery(connName, query, limit) {
    queries = query.split(";").filter(item => item.trim() != "")
    connection = getConnection(connName).connection
    return queries.map(item => {
        selectStmt = connection.createStatementSync();
        if(item.trim().substring(0,6).toLowerCase() == "select") {
            return execSelect(connName,item,limit)
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

function metadataCatalog(connName) {
    let connection = getConnection(connName).connection
    dbMeta = connection.getMetaDataSync()
    catalogs = dbMeta.getCatalogsSync();
    var metadata = []
    while (catalogs.nextSync()){
        catalogName = catalogs.getStringSync("TABLE_CAT")
        metadata.push({
            objectName: catalogName,
            objectType : "Database",
            children : [],
        })
    }
    return metadata
}

function getMetadataObject(connName, catalog) {
    let connection = getConnection(connName).connection
    dbMeta = connection.getMetaDataSync()

    schemaPattern = null,
    tableNamePattern = null;
    columnNamePattern = null;
    types = null
    rsTables = dbMeta.getTablesSync(catalog, schemaPattern, tableNamePattern, types);

    var metadata = []
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
        metadata.push(table)
    }
    return metadata
}

function execSelect(connName, query, limit, resultId) {
    if (!results[resultId]) {
        uid = uuidv4()
        connection = getConnection(connName).connection
        selectStmt = connection.createStatementSync();
        resultSet = selectStmt.executeQuerySync(query);
        results[uid] = resultSet
        results.dateOfCreation = new Date
    }
    else {
        resultSet = results[resultId]
    }
    var total_columns = resultSet.getMetaDataSync().getColumnCountSync();
    js = []
    for (let index = 0; index <= limit; index++) {
        if (!resultSet.nextSync()) {
            break
        }
        var row = {}
        for (i = 1; i <= total_columns; i++) {
            key = resultSet.getMetaDataSync().getColumnLabelSync(i)
            value = resultSet.getStringSync(i)
            row[key] = value
        }
        js.push(row)
    }
    return {connection : connName, query : query, resultId : uid, data : js}
}



module.exports = {
    connections,
    checkConnections,
    execQuery,
    reconnect,
    disconnect,
    testConnection,
    createConnection,
    metadataCatalog,
    getMetadataObject,
    execSelect,
}